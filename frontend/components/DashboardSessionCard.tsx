import React from 'react';
import {ArrowRight, BookOpen, Check, Clock, MessageSquare, Pencil, Star, X,} from 'lucide-react';
import {SavedSession} from '../types';

interface DashboardSessionCardProps {
    session: SavedSession;
    lightMode: boolean;
    isFavorite?: boolean;
    onToggleFavorite: (session: SavedSession) => void;
    onLoadSession: (session: SavedSession) => void;
    onStartEditTitle?: (sessionId: string, currentTitle: string) => void;
    editingSessionId?: string | null;
    editingSessionTitle?: string;
    onEditingSessionTitleChange?: (title: string) => void;
    onSaveTitle?: () => void;
    onCancelTitle?: () => void;
}

const SessionTypeIcon: React.FC<{ sessionType: string; className?: string }> = ({sessionType, className}) => {
    const baseClass = className || '';
    switch (sessionType) {
        case 'research':
            return <BookOpen size={20} className={baseClass}/>;
        default:
            return <MessageSquare size={20} className={baseClass}/>;
    }
};

const getVerdictBadge = (session: SavedSession, lightMode: boolean) => {
    const baseClass = `text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border`;

    const resumeState = session.resumeState;

    type BadgeInfo = { label: string; lmClass: string };
    type BadgeMap = Record<string, BadgeInfo>;
    type AllBadges = Record<string, BadgeMap>;

    const badges: AllBadges = {
        research: {
            complete: {
                label: 'Report Generated',
                lmClass: lightMode ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-emerald-900/30 text-emerald-400 border-emerald-800'
            },
            has_worker_task: {
                label: 'Running',
                lmClass: lightMode ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-blue-900/30 text-blue-400 border-blue-800'
            },
            has_questions: {
                label: 'Awaiting Input',
                lmClass: lightMode ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-amber-900/30 text-amber-400 border-amber-800'
            },
            no_questions: {
                label: 'Not Started',
                lmClass: lightMode ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-800 text-slate-400 border-slate-700'
            },
        },
    };

    const sessionBadges = badges[session.sessionType || ''];
    if (!sessionBadges) return null;

    const badge = sessionBadges[resumeState];
    if (!badge) return null;

    return <span className={`${baseClass} ${badge.lmClass}`}>{badge.label}</span>;
};

export const DashboardSessionCard: React.FC<DashboardSessionCardProps> = ({
                                                                              session,
                                                                              lightMode,
                                                                              isFavorite,
                                                                              onToggleFavorite,
                                                                              onLoadSession,
                                                                              onStartEditTitle,
                                                                              editingSessionId,
                                                                              editingSessionTitle,
                                                                              onEditingSessionTitleChange,
                                                                              onSaveTitle,
                                                                              onCancelTitle,
                                                                          }) => {
    const isEditing = editingSessionId === session.id;

    const handleEditTitleClick = () => {
        if (onStartEditTitle) {
            onStartEditTitle(session.id, session.sessionTitle || '');
        }
    };

    const handleSave = () => {
        if (onSaveTitle) onSaveTitle();
    };

    const handleCancel = () => {
        if (onCancelTitle) onCancelTitle();
    };

    return (
        <div
            data-testid="session-row"
            data-session-id={session.id}
            data-favorite={isFavorite ? "true" : "false"}
            onClick={() => {
                if (!isEditing) onLoadSession(session);
            }}
            className={`
        relative border rounded-2xl p-4 transition-all duration-200 cursor-pointer group
        ${lightMode
                ? 'bg-white border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                : 'bg-slate-900 border-slate-800 hover:border-blue-500 hover:bg-slate-800'
            }
      `}
        >
            <div className="flex items-start gap-3">
                <div className={`shrink-0 mt-0.5 ${lightMode ? 'text-blue-600' : 'text-blue-400'}`}>
                    <SessionTypeIcon sessionType={session.sessionType || 'research'}/>
                    {onStartEditTitle && session.isOwner !== false && (
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                handleEditTitleClick();
                            }}
                            className={`hidden group-hover:inline transition-opacity p-1 rounded shrink-0 ${lightMode ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                            data-testid="btn-edit-title"
                            data-analytics="edit_session_title"
                            aria-label="Edit title"
                        >
                            <Pencil size={12} className="text-blue-400"/>
                        </button>
                    )}
                    <button
                        onClick={e => {
                            e.stopPropagation();
                            onToggleFavorite(session);
                        }}
                        className={`hidden group-hover:inline transition-opacity p-1 rounded shrink-0 ${lightMode ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                        data-testid="btn-toggle-favorite"
                        data-analytics="toggle_favorite_session"
                        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                    >
                        {isFavorite ? (
                            <Star size={12} className="text-yellow-400 fill-yellow-400"/>
                        ) : (
                            <Star size={12} className="text-slate-400"/>
                        )}
                    </button>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        {getVerdictBadge(session, lightMode)}
                    </div>

                    {isEditing ? (
                        <div className="flex items-center gap-1 w-full">
                            <input
                                type="text"
                                value={editingSessionTitle}
                                onChange={e => {
                                    if (onEditingSessionTitleChange) onEditingSessionTitleChange(e.target.value);
                                }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSave();
                                    if (e.key === 'Escape') handleCancel();
                                    e.stopPropagation();
                                }}
                                onBlur={handleCancel}
                                onClick={e => e.stopPropagation()}
                                className={`w-full font-semibold text-sm leading-snug mb-1 line-clamp-2 bg-transparent border-b border-blue-400 outline-none px-1 ${
                                    lightMode ? 'text-slate-900 border-blue-400' : 'text-white border-blue-400'
                                }`}
                                data-testid="input-edit-title"
                                autoFocus
                            />
                            <button onClick={e => {
                                e.stopPropagation();
                                handleSave();
                            }} className={`p-1 rounded ${lightMode ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                                    data-testid="btn-save-title" data-analytics="save_session_title"
                                    aria-label="Save title">
                                <Check size={12} className="text-blue-400"/>
                            </button>
                            <button onClick={e => {
                                e.stopPropagation();
                                handleCancel();
                            }} className={`p-1 rounded ${lightMode ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                                    data-testid="btn-cancel-title" data-analytics="cancel_session_title"
                                    aria-label="Cancel">
                                <X size={12} className="text-blue-400"/>
                            </button>
                        </div>
                    ) : (
                        <h3
                            className={`font-semibold text-sm leading-snug mb-1 line-clamp-2 ${
                                lightMode ? 'text-slate-900' : 'text-white'
                            }`}
                            title={session.sessionTitle}
                        >
                            {session.sessionTitle || session.dilemma?.substring(0, 60) || 'Untitled session'}
                        </h3>
                    )}

                    <div className={`text-[10px] flex items-center gap-1 ${
                        lightMode ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                        <Clock size={10}/>
                        {new Date(session.timestamp).toLocaleDateString()}
                    </div>
                </div>
                {!isEditing && (
                    <ArrowRight size={14}
                                className={`shrink-0 mt-1 ${lightMode ? 'text-slate-300' : 'text-slate-600'}`}/>
                )}
            </div>
        </div>
    );
};

export default DashboardSessionCard;
