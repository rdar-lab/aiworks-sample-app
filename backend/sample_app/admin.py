import logging
from urllib.parse import quote

from aiworks_core.models import User
from django.contrib import admin
from django.http import HttpResponse, Http404
from django.urls import path

from .models import (
    AppSession,
)

logger = logging.getLogger(__name__)


@admin.register(AppSession)
class SessionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "session_type",
        "session_title",
        "dilemma_short",
        "is_public",
        "is_deleted",
        "tunnel_ids_summary",
        "created_at",
        "updated_at",
    )
    list_filter = (
        ("user", admin.RelatedFieldListFilter),
    )
    search_fields = (
        "dilemma",
        "session_title",
        "agent_result",
        "user__email",
    )
    readonly_fields = ("created_at", "updated_at")

    actions = ["export_sessions"]

    change_list_template = "admin/sample_app/session_changelist.html"

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                "<uuid:object_id>/download_export/",
                self.admin_site.admin_view(self.download_export_view),
                name="sample_app_session_download_export",
            ),
            path(
                "import_session/",
                self.admin_site.admin_view(self.import_session_view),
                name="sample_app_session_import",
            ),
            path(
                "<uuid:object_id>/import_session/",
                self.admin_site.admin_view(self.import_session_view),
                name="sample_app_session_import",
            ),
        ]
        return custom + urls

    @staticmethod
    def download_export_view(request, object_id):
        from .logic.session_import_export import export_session, SessionExportError

        try:
            session = AppSession.objects.get(pk=object_id)
        except AppSession.DoesNotExist:
            raise Http404

        try:
            zip_bytes = export_session(session)
        except SessionExportError as exc:
            logger.exception("export_session failed for session %s", object_id)
            return HttpResponse(str(exc), status=500, content_type="text/plain")

        filename = f"session_export_{session.id}.zip"
        response = HttpResponse(zip_bytes, content_type="application/zip")
        response["Content-Disposition"] = (
            f'attachment; filename*=UTF-8\'\'{quote(filename)}'
        )
        return response

    @staticmethod
    def import_session_view(request, object_id=None):
        from django.contrib import messages
        from django.shortcuts import redirect
        from django.template.response import TemplateResponse
        from .logic.session_import_export import import_session

        if request.method != "POST":
            return TemplateResponse(
                request,
                "admin/sample_app/session_import_form.html",
                {},
            )

        uploaded_file = request.FILES.get("import_file")
        user_id = request.POST.get("target_user_id", "").strip()

        if not uploaded_file:
            messages.error(request, "No file uploaded.")
            return redirect("admin:sample_app_session_changelist")

        if not user_id:
            messages.error(request, "Target user ID is required.")
            return redirect("admin:sample_app_session_changelist")

        try:
            target_user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            messages.error(request, f"User with ID {user_id} does not exist.")
            return redirect("admin:sample_app_session_changelist")

        try:
            zip_bytes = uploaded_file.read()
        except Exception as exc:
            messages.error(request, f"Could not read uploaded file: {exc}")
            return redirect("admin:sample_app_session_changelist")

        try:
            session = import_session(zip_bytes, target_user)
        except ImportError as exc:
            logger.exception("import_session failed for user %s: %s", target_user.id, exc)
            messages.error(request, str(exc))
            return redirect("admin:sample_app_session_changelist")

        messages.success(request, f"Session imported successfully as {session.id}.")
        return redirect("admin:sample_app_session_change", session.pk)

    @admin.action(description="Export selected sessions as ZIP")
    def export_sessions(self, request, queryset):
        """Export the first selected session as a ZIP.

        For single-session export use the download button on the session change
        page.  This action is provided for bulk awareness.
        """
        from .logic.session_import_export import export_session, SessionExportError

        if queryset.count() == 0:
            return
        session = queryset.first()
        try:
            zip_bytes = export_session(session)
        except SessionExportError as exc:
            logger.exception("export_session failed for session %s", session.id)
            self.message_user(request, str(exc), level="error")
            return

        filename = f"session_export_{session.id}.zip"
        response = HttpResponse(zip_bytes, content_type="application/zip")
        response["Content-Disposition"] = (
            f'attachment; filename*=UTF-8\'\'{quote(filename)}'
        )
        return response

    def has_add_permission(self, request):
        return True

    def tunnel_ids_summary(self, obj: AppSession):
        if not obj.desktop_tunnel_servers:
            return "—"
        keys = list(obj.desktop_tunnel_servers.keys())
        return ", ".join(keys[:3]) + ("…" if len(keys) > 3 else "")

    tunnel_ids_summary.short_description = "Tunnels"

    def get_fieldsets(self, request, obj: AppSession = None):
        session_fieldset = (
            "Session",
            {
                "fields": ("user", "session_type", "session_title", "is_deleted"),
            },
        )
        metadata_fieldset = (
            "Metadata",
            {
                "fields": ("created_at", "updated_at"),
            },
        )
        if not obj:
            return [
                session_fieldset,
                metadata_fieldset
            ]
        elif obj.session_type == AppSession.SESSION_TYPE_RESEARCH:
            return [
                session_fieldset,
                (
                    "Research",
                    {
                        "fields": (
                            "dilemma",
                            "additional_user_comments",
                            "is_research_online",
                            "is_agent_finished",
                            "attached_sessions",
                            "knowledge_bases",
                            "mcp_servers",
                            "desktop_tunnel_servers",
                            "agent_result",
                            "is_public",
                        ),
                    },
                ),
                (
                    "Cached Data",
                    {
                        "fields": (
                            "prev_session",
                            "prev_agent_result",
                            "compressed_context",
                            "compressed_file_content",
                        ),
                    },
                ),
                metadata_fieldset,
            ]
        else:
            return [
                session_fieldset,
                metadata_fieldset
            ]

    def dilemma_short(self, obj):
        return obj.dilemma[:50] + "..." if len(obj.dilemma) > 50 else obj.dilemma

    dilemma_short.short_description = "Dilemma"
