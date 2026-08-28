
import {
  StepTask,
  SavedSession,
  TunnelServerSummary,
} from '../types';
import { sessionAPI } from './backendService';

export function buildDesktopTunnelServers(
  availableTunnelServers: TunnelServerSummary[],
  selectedTunnelServerIds: string[],
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const srv of availableTunnelServers) {
    if (!selectedTunnelServerIds.includes(srv.id)) continue;
    const tid = srv.tunnelId || "";
    if (!tid) continue;
    if (!result[tid]) result[tid] = [];
    if (!result[tid].includes(srv.id)) result[tid].push(srv.id);
  }
  return result;
}

// Session ID tracker for backend API calls
let currentSessionId: string = '';

export const setCurrentSessionId = (sessionId: string) => {
  currentSessionId = sessionId;
};

export const getCurrentSessionId = () => currentSessionId;

export const resetCurrentSession = () => {
  currentSessionId = '';
};

// Create a new session (called explicitly when starting a fresh analysis flow)
export const createSession = async (
  dilemma: string,
  includeUserContext: boolean,
  files: File[],
  isResearchOnline: boolean = false,
  knowledgeBaseIds: number[] = [],
  mcpServerIds: number[] = [],
  attachedSessionIds: string[] = [],
  desktopTunnelServers: Record<string, string[]> = {},
): Promise<void> => {
  const session = await sessionAPI.createSession(
    {
      dilemma, includeUserContext,
      isResearchOnline,
      ...(knowledgeBaseIds.length > 0 ? { knowledgeBaseIds } : {}),
      ...(mcpServerIds.length > 0 ? { mcpServerIds } : {}),
      ...(Object.keys(desktopTunnelServers).length > 0 ? { desktopTunnelServers } : {}),
    },
    files,
    attachedSessionIds,
  );
  currentSessionId = session.id;
};

// Update the existing session (called to persist qaAnswers, etc.)
export const updateSession = async (
  data: { sessionTitle?: string; autoPilot?: boolean }
): Promise<void> => {
  if (!currentSessionId) throw new Error('No active session');
  await sessionAPI.updateSession(currentSessionId, data);
};

// Start (or join an already-running)  task.
// Returns the initial status immediately;
// for updates until the task reaches 'completed' or 'failed'.
export const startExecution = async (): Promise<{ status: string; error?: string }> => {
  if (!currentSessionId) throw new Error('No active session');
  return sessionAPI.execute(currentSessionId);
};

// Fetch the current status of the active task.
export const getWorkerStatus = async (): Promise<{ status: string; error?: string; progress_step?: string; step_tasks?: StepTask[]; thinking?: string; last_tool_call?: { tool: string; input: string } }> => {
  if (!currentSessionId) throw new Error('No active session');
  return sessionAPI.getWorkerStatus(currentSessionId);
};


export const getSessionNavigationUrl = (session: SavedSession): string => {
  if (session.sessionType === 'research') {
    return session.resumeState === 'complete'
      ? `/research/${session.id}`
      : `/research/new?resume=${session.id}`;
  }
  return null;
};
