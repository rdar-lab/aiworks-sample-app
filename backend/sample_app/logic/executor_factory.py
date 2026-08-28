from aiworks_core.logic.executor import WorkerExecutor
from .research import ResearchExecutor
from ..models import AppSession


def create_executor(session) -> WorkerExecutor:
    """Return the appropriate WorkerExecutor for the given session type."""
    if session.session_type == AppSession.SESSION_TYPE_RESEARCH:
        return ResearchExecutor(session.id)
    raise ValueError(
        f"No executor registered for session type: {session.session_type!r}"
    )
