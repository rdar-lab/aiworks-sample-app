from aiworks_core.models import SessionSnapshot, WorkerTask
from aiworks_core.serializers import AttachedFileSerializer
from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from .models import (
    AppSession,
)


def _calc_resume_state(session: AppSession):
    try:
        worker = session.worker_task
    except ObjectDoesNotExist:
        worker = None
    has_worker = worker is not None
    if has_worker:
        return (
            "complete"
            if worker.status == WorkerTask.STATUS_COMPLETED
            else "has_worker_task"
        )
    return "created"


# noinspection PyPep8Naming,PyMethodMayBeStatic
class SessionSerializer(serializers.ModelSerializer):
    """Serializer for Session model"""

    includeUserContext = serializers.BooleanField(
        source="include_user_context", required=False
    )
    agentResult = serializers.CharField(
        source="agent_result", required=False, allow_blank=True, read_only=True
    )
    prevAgentResult = serializers.CharField(
        source="prev_agent_result", required=False, allow_blank=True, read_only=True
    )
    isResearchOnline = serializers.BooleanField(
        source="is_research_online", required=False
    )

    attachedFiles = serializers.SerializerMethodField()
    sessionTitle = serializers.CharField(source="session_title", required=False, allow_blank=False)
    isPublic = serializers.BooleanField(source="is_public", default=False)
    isOwner = serializers.SerializerMethodField()
    hasPendingWorkerTask = serializers.SerializerMethodField()
    resumeState = serializers.SerializerMethodField()
    sessionType = serializers.CharField(source="session_type", required=False)
    knowledgeBases = serializers.SerializerMethodField()
    mcpServers = serializers.SerializerMethodField()
    desktopTunnelServers = serializers.JSONField(
        source="desktop_tunnel_servers", required=False, default=dict
    )
    isFavorite = serializers.SerializerMethodField()

    def get_isFavorite(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return str(obj.id) in request.user.favorite_session_ids
        return False

    def get_attachedFiles(self, obj):
        visible_files = obj.attached_files.filter(is_hidden=False)
        return AttachedFileSerializer(visible_files, many=True).data

    def get_knowledgeBases(self, obj):
        return [{"id": kb.id, "name": kb.name} for kb in obj.knowledge_bases.all()]

    def get_mcpServers(self, obj):
        return [
            {"id": s.id, "name": s.name, "url": s.url} for s in obj.mcp_servers.all()
        ]

    def get_isOwner(self, obj):
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            return obj.user == request.user
        return False

    def get_hasPendingWorkerTask(self, obj):
        try:
            if obj.worker_task is None:
                return False
            return obj.worker_task.status != WorkerTask.STATUS_COMPLETED
        except ObjectDoesNotExist:
            return False

    def get_resumeState(self, obj):
        return _calc_resume_state(obj)

    def validate(self, data):
        if self.instance is None:
            session_type = data.get("session_type") or data.get("sessionType") or "research"
            dilemma = data.get("dilemma", "")
            if (
                    session_type in ("research",)
                    and not dilemma
            ):
                raise serializers.ValidationError(
                    {
                        "dilemma": "This field is required for research sessions."
                    }
                )
            data["session_type"] = session_type
        return data

    def create(self, validated_data):
        if "session_type" not in validated_data:
            validated_data["session_type"] = "research"
        return super().create(validated_data)

    class Meta:
        model = AppSession
        fields = (
            "id",
            "dilemma",
            "includeUserContext",
            "agentResult",
            "prevAgentResult",
            "isResearchOnline",
            "sessionTitle",
            "isPublic",
            "isOwner",
            "hasPendingWorkerTask",
            "resumeState",
            "sessionType",
            "attachedFiles",
            "knowledgeBases",
            "mcpServers",
            "desktopTunnelServers",
            "isFavorite",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


# noinspection PyPep8Naming,PyMethodMayBeStatic
class SessionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the sessions list — omits all large nested content."""

    sessionTitle = serializers.SerializerMethodField()
    sessionType = serializers.CharField(source="session_type", read_only=True)
    resumeState = serializers.SerializerMethodField()
    hasPendingWorkerTask = serializers.SerializerMethodField()
    isFavorite = serializers.SerializerMethodField()
    isOwner = serializers.SerializerMethodField()

    def get_sessionTitle(self, obj):
        return obj.session_title

    def get_resumeState(self, obj):
        return _calc_resume_state(obj)

    def get_hasPendingWorkerTask(self, obj):
        try:
            if obj.worker_task is None:
                return False
            return obj.worker_task.status != WorkerTask.STATUS_COMPLETED
        except ObjectDoesNotExist:
            return False

    def get_isFavorite(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            user = request.user
            if not hasattr(user, 'favorite_session_ids'):
                return False
            return str(obj.id) in user.favorite_session_ids
        return False

    def get_isOwner(self, obj):
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            return obj.user == request.user
        return False

    class Meta:
        model = AppSession
        fields = (
            "id",
            "dilemma",
            "sessionTitle",
            "sessionType",
            "created_at",
            "updated_at",
            "resumeState",
            "hasPendingWorkerTask",
            "isFavorite",
            "isOwner",
        )
        read_only_fields = fields


class SessionSnapshotSerializer(serializers.ModelSerializer):
    """Serializer for SessionSnapshot model."""

    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = SessionSnapshot
        fields = ("id", "label", "createdAt")
        read_only_fields = fields
