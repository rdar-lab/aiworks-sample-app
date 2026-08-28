import React, { useState } from 'react';
import { Calendar, Globe, History, Loader2, MessageSquare, Palette, Pencil, Check, Trash2, UserRound, X, Star } from 'lucide-react';
import { SavedSession } from '../types';
import SessionTypeIcon from './SessionTypeIcon';

interface HistoryViewProps {
  isOpen: boolean;
  onClose: () => void;
  savedSessions: SavedSession[];
  currentSessionId: string | null;
  onLoadSession: (session: SavedSession) => void;
  onDeleteSession: (sessionId: string) => void;
  hasMoreSessions: boolean;
  onLoadMore: () => Promise<void>;
  onUpdateSessionTitle: (sessionId: string, title: string) => Promise<void>;
  onToggleFavorite: (session: SavedSession) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  isOpen,
  onClose,
  savedSessions,
  currentSessionId,
  onLoadSession,
  onDeleteSession,
  hasMoreSessions,
  onLoadMore,
  onUpdateSessionTitle,
  onToggleFavorite,
}) => {
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState('');

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      await onLoadMore();
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleStartEditTitle = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditingSessionTitle(currentTitle || '');
  };

  const handleSaveTitle = async () => {
    if (!editingSessionId) return;
    const trimmed = editingSessionTitle.trim();
    if (trimmed) {
      await onUpdateSessionTitle(editingSessionId, trimmed);
    }
    setEditingSessionId(null);
    setEditingSessionTitle('');
  };

  const handleCancelTitle = () => {
    setEditingSessionId(null);
    setEditingSessionTitle('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/80 backdrop-blur-sm no-print">
      <div data-testid="history-panel" className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col p-4 sm:p-8 animate-slide-up shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold uppercase flex items-center gap-3 text-white">
            <History className="text-amber-400" /> History
          </h2>
          <button data-analytics="close_history_panel" onClick={onClose} className="text-slate-500 hover:text-white">
            <X size={24} />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto flex-grow no-scrollbar pb-10">
          {savedSessions.map(s => {
            const isActive = s.id === currentSessionId;
            return (
              <div
                key={s.id}
                data-testid="session-row"
                data-session-id={s.id}
                onClick={() => {if (editingSessionId !== s.id) onLoadSession(s)}}
                className="group bg-slate-950/50 border border-slate-800 p-6 rounded-[2rem] cursor-pointer hover:border-blue-500 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5 text-blue-400">
                    <SessionTypeIcon sessionType={s.sessionType} size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-lg">
                        {new Date(Number(s.timestamp)).toLocaleDateString()}
                      </span>
                      <button
                          onClick={e => { e.stopPropagation(); handleStartEditTitle(s.id, s.sessionTitle || ''); }}
                          className="text-slate-500 hover:text-blue-400 rounded shrink-0 "
                          data-testid="btn-edit-title"
                          data-analytics="edit_session_title"
                          aria-label="Edit title"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                          onClick={e => { e.stopPropagation(); onToggleFavorite(s); }}
                          className="text-slate-500 hover:text-yellow-400 rounded shrink-0"
                          data-testid="btn-toggle-favorite"
                          data-analytics="toggle_favorite_session"
                          aria-label={s.isFavorite ? "Remove from favorites" : "Add to favorites"}
                      >
                        {s.isFavorite ? <Star size={14} className="text-yellow-400 fill-yellow-400" /> : <Star size={14} />}
                      </button>
                      {s.scheduleFrequency && (
                        <span className="text-[9px] font-bold text-violet-300 uppercase tracking-widest bg-violet-900/30 px-2 py-1 rounded-lg border border-violet-800 flex items-center gap-1">
                          <Calendar size={9} /> {s.scheduleFrequency.charAt(0).toUpperCase() + s.scheduleFrequency.slice(1)}
                        </span>
                      )}
                      {isActive ? (
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-lg ml-auto">
                          Active
                        </span>
                      ) : (
                        <button
                          data-analytics="delete_session"
                          onClick={e => { e.stopPropagation(); onDeleteSession(s.id); }}
                          data-testid="btn-delete-session"
                          className="p-2 text-slate-500 hover:text-red-400 active:text-red-400 bg-slate-900 rounded-xl ml-auto"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    {editingSessionId === s.id ? (
                      <div className="flex items-center gap-1 w-full">
                        <input
                          type="text"
                          value={editingSessionTitle}
                          onChange={e => setEditingSessionTitle(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') handleCancelTitle(); }}
                          onBlur={handleCancelTitle}
                          className="flex-1 text-lg font-bold text-slate-200 bg-transparent border-b border-blue-400 outline-none px-1 w-full"
                          data-testid="input-edit-title"
                          autoFocus
                        />
                        <button onClick={handleSaveTitle} className="p-1 hover:bg-white/10 rounded" data-testid="btn-save-title" data-analytics="save_session_title" aria-label="Save title">
                          <Check size={14} className="text-blue-400" />
                        </button>
                        <button onClick={handleCancelTitle} className="p-1 hover:bg-white/10 rounded" data-testid="btn-cancel-title" data-analytics="cancel_session_title" aria-label="Cancel">
                          <X size={14} className="text-blue-400" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="flex-1 text-lg font-bold text-slate-200 line-clamp-2 italic leading-snug" title={s.sessionTitle}>
                          "{s.sessionTitle}"
                        </h3>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {hasMoreSessions && (
            <button
              data-analytics="load_more_sessions"
              data-testid="btn-load-more-sessions"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="w-full py-3 px-4 rounded-xl font-bold uppercase text-xs tracking-widest text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-slate-300 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Loading ...
                </>
              ) : (
                'Load more'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryView;
