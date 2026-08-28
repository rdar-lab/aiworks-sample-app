import base64
import datetime
import json
import logging
import uuid
from typing import cast

from aiworks_core.models import AttachedFile, WorkerTask, SessionSnapshot, User, Notification
from aiworks_core.utils import async_to_sync
from aiworks_core.views.jwt import create_token
from aiworks_core.views.views_utils import (
    require_pro,
    make_content_disposition,
    prepare_attachments_data,
    upload_files,
    download_session_attachment,
    parse_effective_data
)
from django.db import models as db_models, transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import (
    action,
)
from rest_framework.exceptions import (
    PermissionDenied,
    ValidationError as DRFValidationError,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import UserProfile, AppSession
from ..serializers import (
    SessionSerializer,
    SessionListSerializer,
    SessionSnapshotSerializer,
)

# Maximum number of characters to use as a default session title (truncated from the
# dilemma or first chat message) before an AI-generated title is available.
_DEFAULT_TITLE_MAX_LENGTH = 80

_ACTIONS_ALLOWED_FOR_SHARED_SESSIONS = [
    "retrieve", "download_output_files", "export_report", "preview_token", "favorite",
    "unfavorite", "session_attachment"
]

logger = logging.getLogger(__name__)


class SessionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing advisory board sessions"""

    serializer_class = SessionSerializer
    permission_classes = [IsAuthenticated]

    @staticmethod
    def _validate_feature_usage_limit(feature_name, user: User, last_used_prop_name, daily_count_prop_name, limit_func):
        today = timezone.now().date()
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=user.pk)
            profile = UserProfile(user)
            last_used_date = getattr(profile, last_used_prop_name)
            if last_used_date != today:
                setattr(profile, daily_count_prop_name, 0)
                setattr(profile, last_used_prop_name, today)
            limit = limit_func(user)
            daily_count = getattr(profile, daily_count_prop_name)
            if daily_count >= limit:
                return Response(
                    {
                        "error": (
                            f"You have used up your {limit} {feature_name} session credits for today. "
                            "Credit resets tomorrow."
                        ),
                        "daily_limit_reached": True,
                    },
                    status=status.HTTP_402_PAYMENT_REQUIRED,
                )
            setattr(profile, daily_count_prop_name, daily_count + 1)
            setattr(profile, last_used_prop_name, today)
            user.save(update_fields=['extra_data'])

        return None

    @staticmethod
    def _validate_user_limits(request, serializer):
        request_user = cast(User, request.user)
        # Research online daily limit for free users — charged at session creation
        session_type = serializer.validated_data.get(
            "session_type", AppSession.SESSION_TYPE_RESEARCH
        )

        usage_limit_response = None
        if session_type == AppSession.SESSION_TYPE_RESEARCH:
            require_pro(request_user, "Research Report")
            usage_limit_response = SessionViewSet._validate_feature_usage_limit(
                "research",
                request_user,
                last_used_prop_name="research_last_used_date",
                daily_count_prop_name="research_daily_count",
                limit_func=lambda u: UserProfile(u).get_effective_research_limit(),
            )

        return usage_limit_response

    def create(self, request, *args, **kwargs):
        from ..logic.session_helper import generate_session_title

        # Resolve session fields — supports both JSON body and multipart-with-blob.
        eff_data = parse_effective_data(self.request)

        serializer: SessionSerializer = cast(
            SessionSerializer, self.get_serializer(data=eff_data)
        )
        if not serializer.is_valid():
            # Log validation details so they appear in your console/logs
            logger.warning(
                "session.create | validation failed: %s | data=%s",
                serializer.errors,
                eff_data,
            )
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        attachment_data = prepare_attachments_data(request, eff_data)

        usage_limit_response = self._validate_user_limits(request, serializer)
        if usage_limit_response:
            return usage_limit_response

        # ── Atomic: create session + files + session attachments ──────────────
        # All DB writes happen inside a single transaction so that any failure
        # (e.g. a file that can't be saved) rolls back the session row too.
        with transaction.atomic():
            self.perform_create(serializer, eff_data, attachment_data)

            session: AppSession = cast(AppSession, serializer.instance)

        # Best-effort AI title — outside the transaction (non-fatal if it fails)
        if (
                session.session_type
                in (
                AppSession.SESSION_TYPE_RESEARCH,
        )
                and session.dilemma
        ):
            try:
                title = async_to_sync(generate_session_title)(session.dilemma, session.session_type)
                if title:
                    session.session_title = title
                    session.save(update_fields=["session_title"])
            except Exception as exc:
                logger.warning(
                    "session.create | failed to generate session title: %s", exc
                )

        headers = self.get_success_headers(serializer.data)
        return Response(
            self.get_serializer(session).data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    def get_serializer_class(self):
        if self.action == "list":
            return SessionListSerializer
        return SessionSerializer

    def list(self, request, *args, **kwargs):
        """List sessions with cursor-based pagination.

        Sessions are ordered by:
        1. Scheduled sessions first (schedule_frequency IS NOT NULL), ordered by schedule_next_run ASC
           (sessions with NULL schedule_next_run sort last among scheduled)
        2. Non-scheduled sessions second, ordered by created_at DESC
        3. Then by id DESC for tiebreaking
        """
        _PAGE_SIZE = 20
        _SENTINEL_DATE = datetime.datetime(9000, 12, 31, tzinfo=datetime.timezone.utc)

        page_size = int(request.query_params.get("page_size", _PAGE_SIZE))
        page_size = min(max(page_size, 1), 100)

        queryset = self.get_queryset().order_by("-updated_at", "-id")

        cursor = request.query_params.get("cursor")
        if cursor:
            try:
                json_str = base64.urlsafe_b64decode(cursor.encode()).decode()
                data = json.loads(json_str)
                cursor_sort_time = (
                    None
                    if data["t"] is None
                    else datetime.datetime.fromisoformat(data["t"])
                )
                cursor_id = data["i"]

                cursor_filter = Q(updated_at__lte=cursor_sort_time) & ~Q(id=cursor_id)
                queryset = queryset.filter(cursor_filter)
            except (ValueError, KeyError, json.JSONDecodeError, TypeError):
                logger.warning("Invalid pagination cursor ignored: %r", cursor)

        sessions = list(queryset[: page_size + 1])
        has_more = len(sessions) > page_size
        sessions = sessions[:page_size]

        next_cursor = None
        if has_more:
            last = sessions[-1]
            sort_time_for_cursor = (
                None if last.updated_at is None else last.updated_at.isoformat()
            )
            next_cursor = base64.urlsafe_b64encode(
                json.dumps(
                    {
                        "t": sort_time_for_cursor,
                        "i": str(last.id),
                    }
                ).encode()
            ).decode()

        serializer = SessionListSerializer(sessions, many=True, context={"request": request})
        return Response(
            {
                "results": serializer.data,
                "next_cursor": next_cursor,
                "has_more": has_more,
            }
        )

    def get_queryset(self):
        # For retrieve, download_output_files, export_report, preview_token, favorite, and unfavorite,
        # also return public sessions from other users (read-only access)
        if self.action in _ACTIONS_ALLOWED_FOR_SHARED_SESSIONS:
            query_filter = AppSession.objects.filter(
                db_models.Q(user__username__iexact=self.request.user.username)
                | db_models.Q(is_public=True),
                is_deleted=False,
            )
        else:
            query_filter = AppSession.objects.filter(
                user__username__iexact=self.request.user.username,
                is_deleted=False,
            )

        return query_filter.prefetch_related(
            "knowledge_bases",
            "mcp_servers",
            "attached_files",
            "worker_task",
        )

    def get_object(self) -> AppSession:
        obj: AppSession = super().get_object()
        if self.request.method in ("GET", "HEAD", "OPTIONS") or self.action in _ACTIONS_ALLOWED_FOR_SHARED_SESSIONS:
            if obj.user != self.request.user and not obj.is_public:
                raise PermissionDenied(
                    "You do not have permission to perform this operation on this session."
                )
        else:
            if obj.user != self.request.user:
                raise PermissionDenied(
                    "You do not have permission to perform this operation on this session."
                )

        return obj

    def perform_create(self, serializer: SessionSerializer, eff_data: dict = None, attachment_data: dict | None = None):
        """Create the AppSession row, attach KBs and MCP servers.

        ``eff_data`` is the plain-dict session payload (already parsed from
        either a JSON body or the multipart ``data`` JSON blob).  When called
        from outside ``create()`` (e.g. tests using the default DRF path) it
        falls back to ``self.request.data``.
        """
        from ..logic.session_helper import attach_to_session

        if eff_data is None:
            eff_data = self.request.data

        # Generate session ID if not provided
        session_id = eff_data.get("id") or f"session_{uuid.uuid4().hex[:12]}"
        logger.info(
            "session.create | user=%s | session_id=%s",
            self.request.user.username,
            session_id,
        )

        # Compute a non-empty default title so the DB constraint is satisfied at creation.
        session_type = eff_data.get("sessionType", AppSession.SESSION_TYPE_RESEARCH)
        dilemma = eff_data.get("dilemma", "")
        if session_type == AppSession.SESSION_TYPE_RESEARCH:
            require_pro(cast(User, self.request.user), "Research Report")
            default_title = (dilemma.strip() or "New research report")[
                :_DEFAULT_TITLE_MAX_LENGTH
            ]
        else:
            default_title = (dilemma.strip() or "New session")[
                :_DEFAULT_TITLE_MAX_LENGTH
            ]

        session = serializer.save(
            user=self.request.user,
            id=session_id,
            session_title=default_title
        )

        attach_to_session(session, attachment_data)

        # Validate: is_research_needed requires either is_research_online, attached KBs, MCP servers,
        # attached files, or session attachments (all of which are now included atomically at creation).
        # Research and branding sessions are exempt — they run their agents regardless of online/KB settings.
        has_files = bool(attachment_data and attachment_data.get("files"))
        has_session_attachments = bool(attachment_data and attachment_data.get("attached_session_ids"))
        if (
                session.session_type == AppSession.SESSION_TYPE_RESEARCH
                and not session.is_research_online
                and not session.knowledge_bases.exists()
                and not session.mcp_servers.exists()
                and not has_files
                and not has_session_attachments
        ):
            session.delete()
            raise DRFValidationError(
                "Research session requires either online research, or at least one KB, MCP server, attached file, or session attachment."
            )

    def destroy(self, request, *args, **kwargs):
        session = self.get_object()

        # Cancel any pending or running worker tasks immediately
        WorkerTask.objects.filter(
            session=session,
            status__in=[WorkerTask.STATUS_PENDING, WorkerTask.STATUS_RUNNING],
        ).update(status=WorkerTask.STATUS_FATAL_FAILURE, error_message="AppSession deleted by the user")

        # Dismiss notifications related to this session (cta_params contains session_id)
        Notification.objects.filter(
            user=session.user,
            cta_params__session_id=str(session.id),
        ).update(status="dismissed", dismissed_at=timezone.now())

        # Soft-delete: mark as deleted instead of removing from DB
        session.is_deleted = True
        session.save(update_fields=["is_deleted"])

        logger.info(
            "session.destroy | soft-deleted | session=%s | user=%s",
            session.id,
            request.user.username,
        )

        return Response({"OK"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def favorite(self, request, *_args, **_kwargs):
        """Add a session to the current user's favorites."""
        session = self.get_object()
        user = request.user
        favorite_ids = user.favorite_session_ids or []
        session_id_str = str(session.id)
        if session_id_str not in favorite_ids:
            favorite_ids.append(session_id_str)
            User.objects.filter(pk=user.pk).update(favorite_session_ids=favorite_ids)
        return Response({"favorited": True, "favoriteIds": favorite_ids})

    @action(detail=True, methods=["post"])
    def unfavorite(self, request, *_args, **_kwargs):
        """Remove a session from the current user's favorites."""
        session = self.get_object()
        user = request.user
        favorite_ids = user.favorite_session_ids or []
        session_id_str = str(session.id)
        if session_id_str in favorite_ids:
            favorite_ids = [i for i in favorite_ids if i != session_id_str]
            User.objects.filter(pk=user.pk).update(favorite_session_ids=favorite_ids)
        return Response({"favorited": False, "favoriteIds": favorite_ids})

    @action(detail=False, methods=["get"])
    def favorites(self, request, *_args, **_kwargs):
        """Return all of the current user's favorited sessions."""
        user = request.user
        favorite_ids = user.favorite_session_ids or []
        if not favorite_ids:
            return Response({"results": [], "next_cursor": None, "has_more": False})
        queryset = AppSession.objects.filter(
            id__in=favorite_ids,
            is_deleted=False,
        ).prefetch_related("worker_task", "clarifying_questions")
        sessions = list(queryset.order_by("-updated_at", "-id"))
        serializer = SessionListSerializer(sessions, many=True, context={"request": request})
        return Response({
            "results": serializer.data,
            "next_cursor": None,
            "has_more": False,
        })

    @action(detail=True, methods=["post"])
    def upload_files(self, request, *_args, **_kwargs):
        """Upload files to a session; backend parses and stores original + extracted content."""
        session = self.get_object()
        if session.session_type not in (
                AppSession.SESSION_TYPE_RESEARCH,
        ):
            return Response(
                {
                    "error": "This operation is not allowed for this session type"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Free-tier users are limited to 1 file per session
        if not request.user.is_pro:
            existing_count = AttachedFile.objects.filter(session=session).count()
            incoming_count = len(request.FILES.getlist("files"))
            if existing_count >= 1:
                return Response(
                    {
                        "error": "Free plan allows 1 file per session. Upgrade to Pro for unlimited uploads."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            if incoming_count > 1:
                return Response(
                    {
                        "error": "Free plan allows 1 file per session. Please upload only 1 file."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
        created, errors = upload_files(
            request, additional_file_fields={"session": session}
        )
        if not created:
            return Response(
                {"parse_errors": errors}, status=status.HTTP_400_BAD_REQUEST
            )
        response_data = {"files": created}
        if errors:
            response_data["parse_errors"] = errors

        # Invalidate the compressed file content cache so it gets recomputed
        # on the next use with the newly-added files included.
        session.compressed_file_content = ""
        session.save(update_fields=["compressed_file_content"])

        return Response(response_data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def attach_session(self, request, *_args, **_kwargs):
        """Attach another session to this session via session ID reference.

        The attached session (source) must be owned by the same user or public.

        The session is converted to file at execution time (not at attachment time),
        ensuring the agent always gets the most up-to-date session data.
        """
        session = self.get_object()
        if session.session_type not in (
                AppSession.SESSION_TYPE_RESEARCH,
        ):
            return Response(
                {
                    "error": "This operation is not allowed for this session type."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        source_session_id = request.data.get("session_id")
        if not source_session_id:
            return Response(
                {"error": "session_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        source_session = AppSession.objects.filter(
            db_models.Q(id=source_session_id)
            & (
                    db_models.Q(user=request.user)
                    | db_models.Q(is_public=True)
            )
        ).first()
        if not source_session:
            return Response(
                {"error": "AppSession not found or permission denied"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session.attached_sessions.add(source_session)

        session.compressed_file_content = ""
        session.save(update_fields=["compressed_file_content"])

        return Response(
            {"session_id": source_session.id, "name": f"session_{source_session.id}.txt"},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def execute(self, request, *_args, **_kwargs):
        """
        Start (or join) the execution task for the session.

        Response:
          status: "pending" | "running" | "completed" | "failed"
          progress_step: current step description (when running)
          error: error message (when failed)
        """
        session = self.get_object()
        if session.session_type not in (
                AppSession.SESSION_TYPE_RESEARCH,
        ):
            return Response(
                {
                    "error": "This operation is not allowed for this session type."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        logger.info(
            "session.execute | session=%s | user=%s",
            session.id,
            request.user.username,
        )

        task, created = WorkerTask.objects.get_or_create(
            session=session,
            defaults={
                "status": WorkerTask.STATUS_PENDING,
                "progress_step": "",
                "error_message": "",
                "resume_state": None,
                "completed_at": None,
            },
        )

        if created:
            return Response(
                {
                    "status": task.status,
                    "progress_step": task.progress_step,
                    "step_tasks": task.step_tasks,
                }
            )
        return self._get_worker_task_status(task)

    @staticmethod
    def _get_worker_task_status(task: WorkerTask) -> Response:
        """Build the polling response for a worker task.

        Returns a ``Response`` whose shape depends on the task status:
          - completed:      {'status': 'completed'}
          - fatal_failure:  {'status': 'fatal_failure', 'error': <message>}
          - failed:         {'status': 'failed', 'error': <message>}
          - pending/running: {'status': <status>, 'progress_step': ..., 'step_tasks': ...}
        """
        if task.status == WorkerTask.STATUS_COMPLETED:
            return Response({"status": "completed"})
        if task.status == WorkerTask.STATUS_FATAL_FAILURE:
            return Response(
                {
                    "status": "fatal_failure",
                    "error": "Task failed after multiple attempts. Please try again later.",
                }
            )
        if task.status == WorkerTask.STATUS_FAILED:
            return Response(
                {
                    "status": "failed",
                    "error": "An internal error occurred. Please try again.",
                }
            )
        return Response(
            {
                "status": task.status,
                "progress_step": task.progress_step,
                "step_tasks": task.step_tasks,
                "thinking": task.thinking,
                "last_tool_call": task.last_tool_call
            }
        )

    # noinspection PyUnusedLocal
    @action(detail=True, methods=["get"])
    def worker_status(self, request, *_args, **_kwargs):
        """
        Return the current status of the background worker task for this session.

        Poll this endpoint after calling ``deliberate`` to track progress.

        Response:
          status: "not_started" | "pending" | "running" | "completed" | "failed" | "fatal_failure"
          progress_step: current step description (when pending/running)
          step_tasks: list of step task items with content and status (when pending/running)
          error: error message (when failed or fatal_failure)

        Note on failure statuses:
          "failed"        - Transient failure; the watchdog will retry automatically (up to
                            MAX_RETRIES times).  Clients should treat this as still-in-progress.
          "fatal_failure" - Permanent failure after max retries; clients should surface an error.
        """
        session = self.get_object()
        try:
            task = session.worker_task
        except WorkerTask.DoesNotExist:
            return Response({"status": "not_started"})

        return self._get_worker_task_status(task)

    @action(detail=True, methods=["post"])
    def rerun(self, request, *_args, **_kwargs):
        """
        Reset a completed session and re-run it. Unified handler for all session types.

        - Deliberation: Summarizes board findings into prev_session, clears advice/synthesis/chat.
        - Research/Communication: Copies report to prev_agent_result, clears report.

        Accepts ``additionalUserComments``:
          - For deliberation: optional extra context to append
          - For research/communication: required refinement notes

        For research/branding/website/dashboard/task sessions, also accepts:
          - ``files``: uploaded files (multipart/form-data)
          - ``attachedSessionIds``: array of session IDs to attach
          - ``knowledgeBaseIds``: array of KB IDs
          - ``mcpServerIds``: array of MCP server IDs
          - ``desktopTunnelServers``: dict of tunnel_id -> [server_id, ...]

        Constraints:
          - Pro users only.
          - AppSession must have a completed WorkerTask.
          - For research/communication: refinement notes must be non-empty.
        """
        from ..logic.session_helper import rerun_session

        session = self.get_object()

        if session.session_type not in (
                AppSession.SESSION_TYPE_RESEARCH,
        ):
            return Response(
                {
                    "error": "This operation is not allowed for this session type."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        require_pro(request.user, "Rerun")

        worker_task = WorkerTask.objects.filter(session=session).first()
        if not worker_task or worker_task.status != WorkerTask.STATUS_COMPLETED:
            return Response(
                {
                    "error": "Rerun is only available for sessions with a completed worker task."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        eff_data = parse_effective_data(self.request)

        refinement_notes = (eff_data.get("additionalUserComments") or "").strip()
        refinement_notes = refinement_notes if refinement_notes else None

        if not refinement_notes:
            return Response(
                {
                    "error": "additionalUserComments (refinement notes) is required for rerun on this session type."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Only research/branding/website/dashboard/task/presentation support attachment changes on refine
        supported_attachments_in_refine_sessions = (
            AppSession.SESSION_TYPE_RESEARCH,
        )

        attachments_data = None
        if session.session_type in supported_attachments_in_refine_sessions:
            attachments_data = prepare_attachments_data(request, eff_data)

        logger.info(
            "session.rerun | session=%s | user=%s | session_type=%s",
            session.id,
            request.user.username,
            session.session_type,
        )

        task = rerun_session(
            session,
            additional_user_comments=refinement_notes,
            attachments_data=attachments_data,
        )
        return self._get_worker_task_status(task)

    @action(detail=True, methods=["get"])
    def snapshots(self, request, *_args, **_kwargs):
        """List all snapshots for a session (Pro only).

        Returns a list of snapshot records, newest first.  Only available for
        session types that generate file artifacts: research, branding,
        website, task, and presentation.
        """
        session = self.get_object()

        if session.session_type not in (
                AppSession.SESSION_TYPE_RESEARCH,
        ):
            return Response(
                {"error": "Snapshots are not available for this session type."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        require_pro(request.user, "AppSession snapshots")

        qs = SessionSnapshot.objects.filter(session=session).order_by("-created_at")
        serializer = SessionSnapshotSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path=r"snapshots/(?P<snapshot_id>[^/.]+)/restore")
    def restore_snapshot(self, request, snapshot_id=None, *_args, **_kwargs):
        """Restore a session to the state captured in a specific snapshot (Pro only).

        URL: POST /api/sessions/{id}/snapshots/{snapshot_id}/restore/

        The session's attached files and text fields are replaced with the
        content from the snapshot ZIP.  Any running or pending worker task is
        cancelled first.
        """
        from aiworks_core.logic.session_snapshot import restore_snapshot as do_restore

        session = self.get_object()

        if session.session_type not in (
                AppSession.SESSION_TYPE_RESEARCH,
        ):
            return Response(
                {"error": "Snapshots are not available for this session type."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        require_pro(request.user, "AppSession snapshot restore")

        try:
            snapshot = SessionSnapshot.objects.get(pk=snapshot_id, session=session)
        except SessionSnapshot.DoesNotExist:
            return Response(
                {"error": "Snapshot not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Cancel any active worker task before restoring
        WorkerTask.objects.filter(
            session=session,
            status__in=[WorkerTask.STATUS_PENDING, WorkerTask.STATUS_RUNNING],
        ).update(status=WorkerTask.STATUS_FATAL_FAILURE)

        logger.info(
            "session.restore_snapshot | session=%s | snapshot=%s | user=%s",
            session.id,
            snapshot.id,
            request.user.username,
        )

        try:
            do_restore(session, snapshot)
        except Exception as exc:
            return Response(
                {"error": str(exc) or "Failed to restore snapshot. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        session.refresh_from_db()
        serializer = SessionSerializer(session, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def take_snapshot(self, request, *_args, **_kwargs):
        """Manually take a snapshot of a session (Pro only).

        URL: POST /api/sessions/{id}/take_snapshot/

        Snapshots capture the current session state and all attached files.
        Returns the created snapshot record, or an error if the session type
        is not eligible or cold storage is not enabled.
        """
        from aiworks_core.logic.session_snapshot import create_snapshot as do_create_snapshot

        session = self.get_object()

        if session.session_type not in (
                AppSession.SESSION_TYPE_RESEARCH,
        ):
            return Response(
                {"error": "Snapshots are not available for this session type."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        require_pro(request.user, "AppSession snapshot")

        snapshot = do_create_snapshot(session)
        if snapshot is None:
            return Response(
                {"error": "Failed to create snapshot. Cold storage may not be enabled."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        logger.info(
            "session.take_snapshot | session=%s | snapshot=%s | user=%s",
            session.id,
            snapshot.id,
            request.user.username,
        )

        serializer = SessionSnapshotSerializer(snapshot)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def download_output_files(self, request, *_args, **_kwargs):
        """Download all output files from a research session as a zip archive.

        Only non-hidden output files are included (excludes memory.md and report.md).
        Requires Pro membership and session ownership.
        """
        from aiworks_core.logic.session_helper import create_download_zip

        session = self.get_object()

        if session.session_type not in (
                AppSession.SESSION_TYPE_RESEARCH,
        ):
            return Response(
                {
                    "error": "This operation is not allowed for this session type."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        require_pro(request.user, "Download session files")

        if session.user != request.user and not session.is_public:
            return Response(
                {
                    "error": "You do not have permission to download files from this session."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        zip_buffer = create_download_zip(session)

        session_title = session.session_title or "download-package"
        response = HttpResponse(zip_buffer.getvalue(), content_type="application/zip")
        response["Content-Disposition"] = make_content_disposition(f"{session_title}-files.zip")
        return response

    @action(detail=True, methods=["get"], url_path=r"session_attachment/(?P<attachment_path>.+)$")
    def session_attachment(self, request, pk=None, attachment_path=None):
        """Serve a specific output attachment file for a session.

        Uses standard DRF authentication.
        Path format: /api/sessions/{id}/session_attachment/{attachment_path}
        """
        session = self.get_object()

        if not session.is_public and session.user_id != request.user.pk:
            return Response(
                {"error": "You do not have permission to access this file."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return download_session_attachment(session, attachment_path)

    @action(detail=True, methods=["get"])
    def export_report(self, request, *_args, **_kwargs):
        """Export the research report as a PDF or Word document.

        Query parameter:
          ``format`` – ``pdf`` (default) or ``docx``

        Only available for research and branding sessions. Requires Pro membership and
        session ownership (or the session must be public).
        """
        from aiworks_core.logic.export import generate_docx, generate_pdf

        require_pro(request.user, "Export session report")

        session = self.get_object()

        if session.session_type not in (
                AppSession.SESSION_TYPE_RESEARCH,
        ):
            return Response(
                {
                    "error": "This operation is not allowed for this session type."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if session.user != request.user and not session.is_public:
            return Response(
                {"error": "You do not have permission to export this session."},
                status=status.HTTP_403_FORBIDDEN,
            )

        export_format = request.query_params.get("format") or request.query_params.get(
            "export_format", "pdf"
        )
        export_format = export_format.lower()
        if export_format not in ("pdf", "docx"):
            return Response(
                {"error": "Invalid format. Supported formats: 'pdf', 'docx'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        report_content = session.agent_result or ""
        session_title = session.session_title or "research-report"

        logger.info(
            "session.export_report | session=%s | user=%s | format=%s",
            session.id,
            request.user.username,
            export_format,
        )

        if export_format == "docx":
            buf = generate_docx(session_title, report_content)
            content_type = (
                "application/vnd.openxmlformats-officedocument"
                ".wordprocessingml.document"
            )
            response = HttpResponse(buf.read(), content_type=content_type)
            response["Content-Disposition"] = make_content_disposition(f"{session_title}.docx")
            return response

        # PDF (default)
        pdf_bytes = generate_pdf(session_title, report_content)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = make_content_disposition(f"{session_title}.pdf")
        return response

    @action(detail=True, methods=["get"])
    def preview_token(self, request, *_args, **_kwargs):
        """Generate a scoped JWT token for website preview iframe access.

        The token is valid for 1 hour and encodes the session_id and user_id.
        Any authenticated user can obtain a token for a public session.
        Only the session owner can obtain a token for a private session.
        """
        session = self.get_object()

        if session.user != request.user and not session.is_public:
            return Response(
                {"error": "You do not have permission to preview this session."},
                status=status.HTTP_403_FORBIDDEN,
            )

        token = create_token(
            user_id=request.user.pk,
            token_type="preview",
            session_id=str(session.id),
            no_expiry=session.is_public,
            is_public=session.is_public,
        )
        return Response({"previewToken": token})

    @action(detail=True, methods=["post"])
    def make_private(self, request, *_args, **_kwargs):
        """Mark a session as no longer publicly shareable."""
        session = self.get_object()
        session.is_public = False
        session.save(update_fields=["is_public"])
        logger.info(
            "session.make_private | session=%s | user=%s",
            session.id,
            request.user.username,
        )
        return Response({"isPublic": False})

    @action(detail=True, methods=["post"])
    def make_public(self, request, *_args, **_kwargs):
        """Mark a session as publicly shareable."""
        session = self.get_object()
        if session.session_type not in (
                AppSession.SESSION_TYPE_RESEARCH,
        ):
            return Response(
                {
                    "error": "This operation is not allowed for this session type."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        session.is_public = True
        session.save(update_fields=["is_public"])
        logger.info(
            "session.make_public | session=%s | user=%s",
            session.id,
            request.user.username,
        )
        return Response({"isPublic": True})
