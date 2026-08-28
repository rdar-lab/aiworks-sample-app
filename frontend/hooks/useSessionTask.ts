import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as appLogic from '../services/appLogicService';
import { useUI } from '../contexts/UIContext';
import { useGlobal } from '../contexts/GlobalContext';

interface UseSessionTaskOptions {
  /** Route prefix for navigation on completion, e.g. '/session' or '/research'. */
  successRoute: string;
  /** Error title shown when the task (research) fails. */
  submitErrorTitle: string;
  setInternalView: (view: 'loading') => void;
  setIsRunning: (val: boolean) => void;
  setLoadingStep: (step: string) => void;
}

/**
 * Encapsulates the two steps shared by both NewSessionPage and NewResearchPage:
 *
 * 1. `submit(answers)` — post answers, kick off the background task, navigate or
 *    hand off to the polling loop on completion/failure.
 *
 * 2. `fetchQuestionsAndProceed()` — fetch clarifying questions, filter out
 *    ONLINE_RESEARCH ones, then either show the clarifying view or call
 *    submit({}) immediately if there are none.
 */
export function useSessionTask({
  successRoute,
  submitErrorTitle,
  setInternalView,
  setIsRunning,
  setLoadingStep,
}: UseSessionTaskOptions) {
  const navigate = useNavigate();
  const { showError } = useUI();
  const { refreshSavedSessions } = useGlobal();

  const submit = useCallback(async () => {
    setInternalView('loading');
    setLoadingStep('Loading...');
    try {
      await appLogic.updateSession({ });
      const initial = await appLogic.startExecution();
      if (initial.status === 'completed') {
        refreshSavedSessions();
        navigate(`${successRoute}/${appLogic.getCurrentSessionId()}`, { replace: true });
      } else if (initial.status === 'fatal_failure') {
        showError(submitErrorTitle, new Error(initial.error || 'Failed'));
        navigate('/', { replace: true });
      } else {
        setIsRunning(true);
      }
    } catch (err: any) {
      showError(submitErrorTitle, err);
      navigate('/', { replace: true });
    }
  }, [navigate, refreshSavedSessions, showError, successRoute, submitErrorTitle, setInternalView, setIsRunning, setLoadingStep]);

  return { submit };
}
