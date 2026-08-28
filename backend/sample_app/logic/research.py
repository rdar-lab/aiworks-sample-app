import datetime
import logging

from django.utils import timezone

from .deepagent_utils import (
    run_deep_agent_on_session,
)
from .emails import EmailService
from .session_helper import get_compressed_context
from aiworks_core.logic.executor import WorkerExecutor
from aiworks_core.models import WorkerTask, Notification
from ..models import (
    AppSession,
)

logger = logging.getLogger(__name__)


def research_context(
        session,
        prompt_key: str = "context_research",
        update_task_callback=None,
        force_clean_run=False,
        quality_check_prompt_key=None,
):
    context_value = (
        session.additional_user_comments
        if session.additional_user_comments
        else get_compressed_context(session)
    )
    additional_parameters = {"context": context_value}

    if session.is_agent_finished and not force_clean_run:
        return {"result": session.agent_result or "", "output_files": {}}, None

    result, err = run_deep_agent_on_session(
        prompt_key=prompt_key,
        rerun_prompt_key="context_research_refine",
        recovery_prompt_key="context_research_recovery",
        session=session,
        output_file_name="/report.md",
        run_main_step_text="Researching Context ...",
        update_task_callback=update_task_callback,
        force_clean_run=force_clean_run,
        quality_check_prompt_key=quality_check_prompt_key,
        additional_parameters=additional_parameters,
    )

    if not err and result:
        agent_result_val = result.get("result", "")
        session.agent_result = agent_result_val
        session.compressed_context = ""
        session.save(update_fields=["agent_result", "compressed_context"])

    return result, err


class ResearchExecutor(WorkerExecutor):
    """Encapsulates the research lifecycle for a research-report session.

    Runs the deep research agent (same as DeliberationExecutor's research step)
    and stores the resulting Markdown report in ``session.agent_result``.
    No board selection, advisor advice, or synthesis is performed.

    Usage::

        executor = ResearchExecutor(session.id)
        threading.Thread(target=executor.run, daemon=True).start()
    """

    def __init__(self, session_id):
        super().__init__(session_id)

    def run_inner(self, session):
        session = AppSession.objects.select_related("user").get(pk=session.pk)
        self._update_task(status=WorkerTask.STATUS_RUNNING)
        logger.info(
            "research_executor | task=%s | started for session=%s",
            self.task_id,
            session.id,
        )

        self._update_task(progress_step="Researching Topic ...")

        result, err = research_context(
            session,
            prompt_key="context_research",
            update_task_callback=self._update_task,
            quality_check_prompt_key="context_research_quality_check",
        )
        if err:
            self._update_task(status=WorkerTask.STATUS_FAILED, error_message=err)
            return False

        session.is_agent_finished = True
        session.save(update_fields=["is_agent_finished"])

        # Step 4: Send completion notification and email
        now = timezone.now()

        try:
            Notification.objects.create(
                user=session.user,
                type="research_complete",
                title="Your research report is ready",
                body="Tap to view your findings and insights.",
                cta_action="view_report",
                cta_params={"session_id": str(session.id)},
                status="sent",
                read_at=None,
                dismissed_at=None,
                expires_at=now + datetime.timedelta(days=7),
            )
        except Exception as exc:
            logger.exception(
                "research_executor | task=%s | failed to create notification: %s",
                self.task_id,
                exc,
            )

        app_session = AppSession.objects.select_related("user").get(id=session.id)
        try:
            EmailService.send_research_complete_email(app_session.user, app_session)
        except Exception as exc:
            logger.exception(
                "research_executor | task=%s | failed to send completion email: %s",
                self.task_id,
                exc,
            )

        return True
