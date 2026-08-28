import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { MemoryEntry, SavedSession } from '../types';
import { authAPI, memoryAPI, sessionAPI } from '../services/backendService';
import * as storageService from '../services/storageService';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';

interface GlobalContextType {
  savedSessions: SavedSession[];
  setSavedSessions: React.Dispatch<React.SetStateAction<SavedSession[]>>;
  favoriteSessions: SavedSession[];
  setFavoriteSessions: React.Dispatch<React.SetStateAction<SavedSession[]>>;
  profileContext: string;
  setProfileContext: React.Dispatch<React.SetStateAction<string>>;
  memories: MemoryEntry[];
  setMemories: React.Dispatch<React.SetStateAction<MemoryEntry[]>>;
  refreshMemories: () => Promise<void>;
  hasPersonalContextOrMemories: boolean;
  isInitialDataLoading: boolean;
  refreshSavedSessions: () => Promise<void>;
  toggleFavoriteSession: (session: SavedSession) => Promise<void>;
  loadMoreSessions: () => Promise<void>;
  hasMoreSessions: boolean;
  updateSessionTitle: (sessionId: string, title: string) => Promise<void>;
}

const GlobalContext = createContext<GlobalContextType | null>(null);

export const GlobalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { showError } = useUI();
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [favoriteSessions, setFavoriteSessions] = useState<SavedSession[]>([]);
  const [profileContext, setProfileContext] = useState('');
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [isInitialDataLoading, setIsInitialDataLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMoreSessions, setHasMoreSessions] = useState(false);

  const hasPersonalContextOrMemories = profileContext.trim().length > 0 || memories.length > 0;

  useEffect(() => {
    if (!user) {
      setSavedSessions([]);
      setFavoriteSessions([]);
      setProfileContext('');
      setMemories([]);
      setNextCursor(null);
      setHasMoreSessions(false);
      return;
    }
    setProfileContext(user.profileContext || '');
    setIsInitialDataLoading(true);
    const promises = [
      storageService.getSavedSessions(),
      sessionAPI.listFavorites(),
      user.isPro ? memoryAPI.list() : Promise.resolve([] as MemoryEntry[]),
    ] as const;
    Promise.all(promises).then(([{ sessions, nextCursor, hasMore }, favoritesData, memoryEntries]) => {
      setSavedSessions(sessions);
      setNextCursor(nextCursor);
      setHasMoreSessions(hasMore);
      setFavoriteSessions((favoritesData.results || []).map(storageService.mapBackendSession));
      setMemories(memoryEntries);
    }).catch((error: any) => {
      showError('Failed to load initial data', error);
    }).finally(() => {
      setIsInitialDataLoading(false);
    });
  }, [user, showError]);

  const refreshSavedSessions = useCallback(async () => {
    try {
      const { sessions, nextCursor: next, hasMore } = await storageService.getSavedSessions();
      const [favoritesData] = await Promise.all([
        sessionAPI.listFavorites(),
      ]);
      setSavedSessions(sessions);
      setNextCursor(next);
      setHasMoreSessions(hasMore);
      setFavoriteSessions((favoritesData.results || []).map(storageService.mapBackendSession));
    } catch {
      // non-critical
    }
  }, []);

  const toggleFavoriteSession = useCallback(async (session: SavedSession) => {
    try {
      if (session.isFavorite) {
        await sessionAPI.unfavoriteSession(session.id);
        setFavoriteSessions(prev => prev.filter(s => s.id !== session.id));
        setSavedSessions(prev => prev.map(s => s.id === session.id ? { ...s, isFavorite: false } : s));
      } else {
        await sessionAPI.favoriteSession(session.id);
        await refreshSavedSessions();
      }
    } catch {
      // non-critical
    }
  }, [refreshSavedSessions]);

  const refreshMemories = useCallback(async () => {
    if (!user?.isPro) return;
    try {
      const entries = await memoryAPI.list();
      setMemories(entries);
    } catch {
      // non-critical
    }
  }, [user]);

  const loadMoreSessions = useCallback(async () => {
    if (!hasMoreSessions || !nextCursor) return;
    try {
      const { sessions, nextCursor: next, hasMore } = await storageService.getSavedSessions(nextCursor);
      setSavedSessions(prev => [...prev, ...sessions]);
      setNextCursor(next);
      setHasMoreSessions(hasMore);
    } catch {
      // non-critical
    }
  }, [hasMoreSessions, nextCursor]);

  const updateSessionTitle = useCallback(async (sessionId: string, title: string) => {
    try {
      await sessionAPI.updateSession(sessionId, { sessionTitle: title });
      await refreshSavedSessions();
    } catch (e: any) {
      showError('Failed to update session title', e);
      throw e;
    }
  }, [showError, refreshSavedSessions]);

  return (
    <GlobalContext.Provider value={{
      savedSessions, setSavedSessions,
      favoriteSessions, setFavoriteSessions,
      profileContext, setProfileContext,
      memories, setMemories,
      refreshMemories,
      hasPersonalContextOrMemories,
      isInitialDataLoading,
      refreshSavedSessions,
      toggleFavoriteSession,
      loadMoreSessions,
      hasMoreSessions,
      updateSessionTitle,
    }}>
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobal = (): GlobalContextType => {
  const ctx = useContext(GlobalContext);
  if (!ctx) throw new Error('useGlobal must be used within GlobalProvider');
  return ctx;
};
