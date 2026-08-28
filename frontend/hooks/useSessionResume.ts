import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as appLogic from '../services/appLogicService';
import * as storageService from '../services/storageService';
import { useUI } from '../contexts/UIContext';
import { ClarifyingQuestion } from '../types';

interface UseSessionResumeOptions {
  /**
   * Called when the session is already complete — navigate to the result page.
   * Receives the session ID so the caller can build the URL.
   */
  onComplete: (sessionId: string) => void;
  /**
   * Called to submit answers and start/join the background worker.
   * Used for both `has_worker_task` (task already running) and
   * `has_questions` when all questions are ONLINE_RESEARCH (no private questions).
   */
  onSubmit: () => Promise<void>;
  /**
   * Called when the session exists but clarifying questions have not been
   * generated yet — typically re-runs the analysis/scoping phase.
   * Receives the full raw session object so callers can read any field they need
   * (e.g. `dilemma`, `includeUserContext`).
   */
  onStartFresh: (session: any) => Promise<void>;
  /** Update the local topic/dilemma input state. */
  setDilemma: (dilemma: string) => void;
  /** Switch the page's internal view. */
  setInternalView: (view: 'loading' | 'clarifying') => void;
  /** Set the loading step label shown while the session is being fetched. */
  setLoadingStep?: (step: string) => void;
  /** Title shown in the error toast on failure. */
  errorTitle?: string;
}

/**
 * Handles the ?resume=:id flow shared by NewSessionPage and NewResearchPage.
 *
 * On mount (runs once, guarded by a ref):
 *  1. Reads `?resume` from the URL
 *  2. Fetches the session from the storage service
 *  3. Dispatches to the appropriate callback based on `resumeState`:
 *     - complete          → onComplete
 *     - has_worker_task   → onSubmit (with saved answers)
 *     - created           → read to execute
 *
 * Callers must stabilise callbacks with useCallback to avoid dep-churn.
 * The internal guard ref ensures the effect runs exactly once per mount
 * regardless of how many times callback references change.
 */
export function useSessionResume({
  onComplete,
  onSubmit,
  onStartFresh,
  setDilemma,
  setInternalView,
  setLoadingStep,
  errorTitle = 'Failed to resume session',
}: UseSessionResumeOptions): void {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showError } = useUI();
  const hasResumedRef = useRef(false);

  useEffect(() => {
    const resumeId = searchParams.get('resume');
    if (!resumeId) return;
    if (hasResumedRef.current) return;
    hasResumedRef.current = true;

    setInternalView('loading');
    setLoadingStep?.('Loading session...');
    appLogic.setCurrentSessionId(resumeId);

    storageService.getSession(resumeId)
      .then(async s => {
        if (!s) { navigate('/', { replace: true }); return; }

        setDilemma(s.dilemma);

        const state = s.resumeState ?? (s.synthesis ? 'complete' : 'no_questions');

        if (state === 'complete') {
          onComplete(resumeId);
        } else if (state === 'has_worker_task') {
          await onSubmit();
        } else if (state === 'has_questions') {
          const privateQ = (s.clarifyingQuestions ?? []).filter(
            q => (q.classification ?? 'PRIVATE_QUESTION') !== 'ONLINE_RESEARCH' && !q.answer,
          );
          await onSubmit();
        } else {
          await onStartFresh(s);
        }
      })
      .catch(err => {
        showError(errorTitle, err);
        navigate('/', { replace: true });
      });
    // Callbacks are intentionally excluded from deps — callers must stabilise
    // them with useCallback. The guard ref prevents re-runs on reference changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
}
