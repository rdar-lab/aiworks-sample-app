"""AiWorks-specific session helper functions.

This module provides AiWorks-specific session utilities that extend the
base aiworks_core.session_helper functions.
"""

import logging
from typing import Optional

from aiworks_core.logic.llm import invoke_llm
from aiworks_core.logic.logic_utils import compress_if_needed, extract_title_from_response
from aiworks_core.logic.session_helper import (
    attach_to_session,
    get_formatted_files, get_effective_user_background,
)
from aiworks_core.models import WorkerTask

from ..models import AppSession

logger = logging.getLogger(__name__)


def _inject_session_files_to_zip(zip_file, session, included_files):
    """Inject session-type-specific files into the download zip.

    This is the callback for AIWORKS_CORE_CREATE_DOWNLOAD_ZIP_CALLBACK.
    """
    if (
            session.session_type in
            [
                AppSession.SESSION_TYPE_RESEARCH,
            ]
            and "report.md" not in included_files
    ):
        zip_file.writestr("report.md", session.agent_result or "")


def get_effective_context(session: AppSession) -> str:
    """Build the raw (uncompressed) effective context for a session.

    Assembles the context server-side from:
    - The user's LLM-generated background when ``session.include_user_context``
      is True (see :func:`get_effective_user_background`).
    - The online research report (``session.agent_result``) when present,
      separated by a section header when both parts are included.
    - The prev context (``session.prev_session``) when present — appended
      verbatim (the header label is embedded in the content when the summary is
      created during rerun).
    - Additional user comments (``session.additional_user_comments``) when present,
      appended as a dedicated section.
    """
    user_bg = ""
    if session.include_user_context:
        user_bg = get_effective_user_background(session.user)

    research = (session.agent_result or "").strip()
    prev = (session.prev_session or "").strip()
    user_comments = (session.additional_user_comments or "").strip()

    parts = []
    if prev:
        parts.append("---\n**Previous Run Results:**\n" + prev)

    if user_bg:
        parts.append("---\n**User Background:**\n" + user_bg)

    if research:
        parts.append("---\n**Online Research:**\n" + research)

    if user_comments:
        parts.append("---\n**Additional Context from User:**\n" + user_comments)

    return "\n\n".join(parts)


def get_compressed_context(session: AppSession) -> str:
    """Return the compressed effective context for a session, computing and persisting it if needed.

    Compresses the full effective context (user profile context + research report) so
    that all downstream LLM calls benefit from token reduction while still using the
    complete context.
    """

    def _update_session_compressed_context(compressed):
        AppSession.objects.filter(pk=session.pk).update(compressed_context=compressed)
        session.compressed_context = compressed

    return compress_if_needed(
        original_raw=get_effective_context(session),
        cached_compressed=session.compressed_context,
        save_compressed_callback=_update_session_compressed_context,
    )


def get_compressed_file_content(session: AppSession) -> str:
    """Return compressed combined file content for a session, computing and persisting it if needed."""

    def _update_session_compressed_files(compressed):
        AppSession.objects.filter(pk=session.pk).update(compressed_file_content=compressed)
        session.compressed_file_content = compressed

    return compress_if_needed(
        original_raw=get_formatted_files(session),
        cached_compressed=session.compressed_file_content,
        save_compressed_callback=_update_session_compressed_files,
    )


def rerun_session(
        session: AppSession,
        additional_user_comments: Optional[str] = None,
        attachments_data: Optional[dict] = None,
) -> WorkerTask:
    """Reset a completed session and create a new pending worker task."""
    logger.info(
        "rerun_session | session=%s | session_type=%s | attachments_data=%s",
        session.id,
        session.session_type,
        attachments_data is not None,
    )

    session.prev_session = session.agent_result
    session.prev_agent_result = session.agent_result
    session.additional_user_comments = additional_user_comments

    session.agent_result = ""
    session.is_agent_finished = False
    session.compressed_file_content = ""
    session.compressed_context = ""

    update_fields = [
        "prev_agent_result",
        "agent_result",
        "is_agent_finished",
        "compressed_file_content",
        "compressed_context",
        "prev_session",
        "additional_user_comments",
        "updated_at",
    ]

    session.save(update_fields=update_fields)

    WorkerTask.objects.filter(session=session).delete()

    attach_to_session(session, attachments_data)

    task = WorkerTask.objects.create(
        session=session,
        status=WorkerTask.STATUS_PENDING,
        progress_step="",
        error_message="",
        resume_state=None,
        completed_at=None,
    )

    return task


async def generate_session_title(dilemma: str, session_type: str) -> str:
    """Generate a short AI-powered title summarising the session topic into one line."""
    logger.info("generate_session_title | dilemma_len=%d session_type=%s", len(dilemma), session_type)

    session_type_str, session_objective = {
        AppSession.SESSION_TYPE_RESEARCH:
            ("Research Session",
             "Performing a detailed research on the provided topic"),
    }.get(session_type,
          ("Generic Session",
           "Performing an LLM task")
          )

    try:
        result = await invoke_llm(
            "generate_session_title",
            system_message_template_name="generate_session_title.system_message",
            user_message_template_name="generate_session_title.prompt_template",
            template_params={
                "session_intent": dilemma,
                "session_type": session_type_str,
                "session_objective": session_objective,
            },
            parse_json=False,
        )
        return await extract_title_from_response(result)
    except Exception as error:
        logger.exception("generate_session_title | error: %s", error)
        return dilemma[:80].strip()


def format_session_as_text(source_session: AppSession) -> str:
    """Format a APP session as a text string for attachment.

    Includes the dilemma, research report, advice items, and synthesis.
    """
    from ..models import AppSession

    if hasattr(source_session, 'dilemma'):
        session = source_session
    else:
        session = AppSession.objects.get(pk=source_session.pk)

    lines = []

    if getattr(session, 'session_title', None):
        lines.append(f"# {session.session_title}")

    if session.dilemma:
        lines.append(f"## Dilemma\n{session.dilemma}")

    if session.agent_result:
        lines.append(f"## Research Report\n{session.agent_result}")

    return "\n".join(lines)


def parse_session_to_file(source_session: AppSession):
    """APP-specific override: converts a source session to an AttachedFile.

    Uses APP's format_session_as_text instead of the framework version.
    For scout sessions, also generates JSON output files from tasks.
    """
    from aiworks_core.models import AttachedFile

    file_name = f"session_{source_session.id}.txt"
    content = format_session_as_text(source_session)

    af = AttachedFile(
        name=file_name,
        file_type=AttachedFile.FILE_TYPE_INPUT,
        binary_content=content.encode("utf-8") if content else b"",
    )
    output_files = list(
        source_session.attached_files.filter(
            file_type=AttachedFile.FILE_TYPE_OUTPUT,
            is_hidden=False,
        )
    )

    return af, output_files
