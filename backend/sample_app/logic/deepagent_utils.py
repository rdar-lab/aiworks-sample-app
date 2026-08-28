"""Thin APP wrapper around aiworks_core.logic.deepagent_utils.

Computes APP-specific fields (dilemma, context, qa_responses) and passes
them as additional_parameters to run_deep_agent_on_session.
"""

from typing import Any, Dict, List, Optional

from aiworks_core.logic.deepagent_utils import run_deep_agent_on_session as _run_deep_agent_on_session

from .session_helper import get_compressed_context


def run_deep_agent_on_session(
        prompt_key: str,
        rerun_prompt_key: Optional[str],
        recovery_prompt_key: Optional[str],
        session,
        output_file_name: str,
        additional_attached_files: Optional[Dict[str, str]] = None,
        run_main_step_text: str = "Running Agent ...",
        update_task_callback=None,
        force_run: bool = False,
        force_clean_run: bool = False,
        additional_parameters: Optional[Dict[str, Any]] = None,
        auto_update_session: bool = True,
        extra_tools: Optional[List] = None,
        quality_check_prompt_key=None,
        schema_file_path: Optional[str] = None,
        custom_validator=None,
):
    compressed_context = get_compressed_context(session)
    dilemma = session.get_effective_dilemma()

    params = dict(additional_parameters) if additional_parameters else {}
    params.setdefault("dilemma", dilemma)
    params.setdefault("context", compressed_context)

    return _run_deep_agent_on_session(
        prompt_key=prompt_key,
        rerun_prompt_key=rerun_prompt_key,
        recovery_prompt_key=recovery_prompt_key,
        session=session,
        output_file_name=output_file_name,
        additional_attached_files=additional_attached_files,
        run_main_step_text=run_main_step_text,
        update_task_callback=update_task_callback,
        force_run=force_run,
        force_clean_run=force_clean_run,
        additional_parameters=params,
        auto_update_session=auto_update_session,
        extra_tools=extra_tools,
        quality_check_prompt_key=quality_check_prompt_key,
        schema_file_path=schema_file_path,
        custom_validator=custom_validator,
    )
