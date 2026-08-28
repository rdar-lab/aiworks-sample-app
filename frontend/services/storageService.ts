
import { AttachedFileItem, ResumeState, SavedSession } from '../types';
import { sessionAPI } from './backendService';

// Session storage now uses backend API instead of localStorage

export function mapBackendSession(s: any): SavedSession {
  return {
    id: s.id,
    dilemma: s.dilemma,
    sessionTitle: s.sessionTitle ?? undefined,
    includeUserContext: s.includeUserContext ?? false,
    agentResult: s.agentResult || undefined,
    timestamp: s.updated_at ? new Date(s.updated_at).getTime() : Date.now(),
    resumeState: (s.resumeState as ResumeState) ?? 'created',
    isPublic: s.isPublic ?? s.is_public ?? false,
    isOwner: s.isOwner ?? true,
    sessionType: s.sessionType ?? s.session_type ?? 'research',
    attachedFiles: (s.attachedFiles || []).map((f: any): AttachedFileItem => ({
      id: f.id,
      name: f.name,
      content: f.content,
      fileType: f.file_type ?? f.fileType ?? 'input',
    })),
    isFavorite: s.isFavorite ?? false,
    labels: s.labels ?? [],
  };
}

export const getSession = async (sessionId: string): Promise<SavedSession | null> => {
  try {
    const response = await sessionAPI.getSession(sessionId);
    return mapBackendSession(response);
  } catch (error) {
    console.error("Failed to load session from server", error);
    return null;
  }
};

export const getSavedSessions = async (cursor?: string): Promise<{ sessions: SavedSession[], nextCursor: string | null, hasMore: boolean }> => {
  try {
    const response = await sessionAPI.listSessions(cursor);
    const sessions = (response.results || []).map(mapBackendSession);
    return {
      sessions,
      nextCursor: response.next_cursor ?? null,
      hasMore: response.has_more ?? false,
    };
  } catch (error) {
    console.error("Failed to load sessions from server", error);
    return { sessions: [], nextCursor: null, hasMore: false };
  }
};

export const deleteSession = async (id: string): Promise<void> => {
  await sessionAPI.deleteSession(id);
};
