import { useEffect, useState } from 'react';
import * as appLogic from '../services/appLogicService';
import { StepTask } from '../types';

const DEFAULT_POLL_INTERVAL_MS = 10000;

interface UseWorkerPollingOptions {
  /** Set to true to start polling; set to false to stop (component-controlled). */
  isRunning: boolean;
  /** Called when the worker task reaches the 'completed' status. */
  onComplete: () => void;
  /** Called on 'fatal_failure', 'not_started', or an unexpected fetch error. */
  onError: (errorMsg: string) => void;
  pollIntervalMs?: number;
}

interface UseWorkerPollingResult {
  loadingStep: string;
  setLoadingStep: (step: string) => void;
  stepTasks: StepTask[];
  thinking: string;
  lastToolCall: { tool: string; input: string } | null;
}

/**
 * Polls the worker-status endpoint while `isRunning` is true.
 *
 * Handles all status cases:
 * - completed      → calls onComplete
 * - fatal_failure  → calls onError with the server error message
 * - not_started    → calls onError (task disappeared)
 * - failed         → transient; keeps polling (watchdog will retry)
 * - pending/running → updates loadingStep and stepTasks
 *
 * The interval is automatically cleared on unmount or when isRunning flips to false.
 */
export function useWorkerPolling({
  isRunning,
  onComplete,
  onError,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: UseWorkerPollingOptions): UseWorkerPollingResult {
  const [loadingStep, setLoadingStep] = useState('');
  const [stepTasks, setStepTasks] = useState<StepTask[]>([]);
  const [thinking, setThinking] = useState('');
  const [lastToolCall, setLastToolCall] = useState<{ tool: string; input: string } | null>(null);

  useEffect(() => {
    if (!isRunning) return;

    if (!appLogic.getCurrentSessionId()) return;

    let cancelled = false;
    let inFlight = false;

    const poll = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const status = await appLogic.getWorkerStatus();
        if (cancelled) return;

        if (status.status === 'completed') {
          onComplete();
        } else if (status.status === 'fatal_failure') {
          onError(status.error || 'Task failed');
        } else if (status.status === 'not_started') {
          onError('Task not found. Please try again.');
        } else if (status.status === 'failed') {
          if (status.progress_step) setLoadingStep(status.progress_step);
        } else {
          if (status.progress_step) setLoadingStep(status.progress_step);
          setStepTasks(status.step_tasks ?? []);
          setThinking(status.thinking || '')
          setLastToolCall(status.last_tool_call || null);
        }
      } catch (err: any) {
        if (cancelled) return;
        onError(err?.message || 'An unexpected error occurred');
      } finally {
        inFlight = false;
      }
    };

    const intervalId = setInterval(poll, pollIntervalMs);
    poll();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        poll();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // onComplete/onError are intentionally excluded from deps — callers must
    // stabilise them with useCallback.  Adding them would restart the interval
    // on every render that recreates a callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, pollIntervalMs]);

  return { loadingStep, setLoadingStep, stepTasks, thinking, lastToolCall };
}
