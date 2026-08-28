import React, {useCallback, useEffect, useState} from 'react';
import {useNavigate, useOutletContext} from 'react-router-dom';
import {SavedSession} from '../types';
import {ArrowRight, BookOpen, History, Star, Target,} from 'lucide-react';
import {useAuth} from '../contexts/AuthContext';
import {useUI} from '../contexts/UIContext';
import {useGlobal} from '../contexts/GlobalContext';
import {useProFeature} from '../hooks/useProFeature';
import * as appLogic from '../services/appLogicService';
import ActionButton from '../components/ActionButton';
import {DashboardSessionCard} from '../components/DashboardSessionCard';

const DashboardPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { lightMode } = useUI();
  const { isPro } = useProFeature();
  const { savedSessions, favoriteSessions, refreshSavedSessions, toggleFavoriteSession, updateSessionTitle } = useGlobal();
  const navigate = useNavigate();
  const { handleLoadSession } = useOutletContext<{ user: typeof user; handleLoadSession: (session: SavedSession) => void }>();

  const [isLoading, setIsLoading] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState('');

  const recentSessions = savedSessions.filter(s => !s.isFavorite && !favoriteSessions.some(f => f.id === s.id));

  const loadDashboardData = useCallback(async () => {
    try {
      await refreshSavedSessions();
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [refreshSavedSessions]);

  const handleStartEditTitle = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditingSessionTitle(currentTitle || '');
  };

  const handleSaveTitle = async () => {
    if (!editingSessionId) return;
    const trimmed = editingSessionTitle.trim();
    if (trimmed) {
      await updateSessionTitle(editingSessionId, trimmed);
    }
    setEditingSessionId(null);
    setEditingSessionTitle('');
  };

  const handleCancelTitle = () => {
    setEditingSessionId(null);
    setEditingSessionTitle('');
  };

  useEffect(() => {
    setIsLoading(true);
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    const interval = setInterval(loadDashboardData, 60000);
    return () => clearInterval(interval);
  }, [loadDashboardData]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl w-full mx-auto space-y-8">
      {savedSessions.length === 0 && !isLoading && (
        <div className={`rounded-2xl border p-6 ${lightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
          <div className="flex items-start gap-4">
            <Target size={24} className={`shrink-0 mt-0.5 ${lightMode ? 'text-blue-600' : 'text-blue-400'}`} />
            <div className="flex-1">
              <p className={`font-bold text-base mb-2 ${lightMode ? 'text-slate-900' : 'text-white'}`}>
                New here?
              </p>
              <p className={`text-sm mb-4 ${lightMode ? 'text-slate-600' : 'text-slate-300'}`}>
                AiWorks Sample Application.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  data-analytics="start_first_session"
                  onClick={() => { appLogic.resetCurrentSession(); navigate('/research/new'); }}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2"
                >
                  Start Your First Session
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Header + Action Buttons */}
      <div className="text-center animate-slide-up w-full flex flex-col items-center relative z-[1]">
        <div className="mb-6 sm:mb-8 relative py-3 sm:py-5">
          <div className={`absolute inset-0 blur-[150px] -z-10 rounded-full animate-pulse transition-colors ${lightMode ? 'bg-blue-600/5' : 'bg-blue-600/15'}`}></div>
          <h1 data-testid="app-title" className={`text-5xl sm:text-6xl md:text-7xl font-black mb-4 sm:mb-6 tracking-tighter uppercase leading-[0.9] text-center transition-colors ${lightMode ? 'text-slate-900' : 'text-white'}`}>
            AI<br /><span className="text-blue-600">WORKS</span>
          </h1>
          <p className="text-slate-500 font-medium normal-case tracking-normal text-xs mt-2 sm:mt-3 opacity-70">
            Your AI Works Sample Application.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 relative z-[1] w-full isolate overflow-visible">
          <ActionButton
            data-analytics="action_research_topic"
            data-testid="btn-action-research-topic"
            variant="primary"
            icon={BookOpen}
            label="Research a Topic"
            sublabel="Get a full research analysis on a subject"
            onClick={() => { appLogic.resetCurrentSession(); navigate('/research/new'); }}
            maxWidth={450}
            layout="card"
            lightMode={lightMode}
          />
        </div>
      </div>

      <div className="space-y-6">
          {favoriteSessions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={lightMode ? 'text-slate-700' : 'text-slate-300'}>
                  <Star size={18} className="text-yellow-400 fill-yellow-400" />
                </span>
                <h2 className={`text-sm font-bold uppercase tracking-wider ${
                  lightMode ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  Favorite Sessions
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {favoriteSessions.map((session) => (
                  <DashboardSessionCard
                    key={session.id}
                    session={session}
                    lightMode={lightMode}
                    isFavorite={true}
                    onToggleFavorite={toggleFavoriteSession}
                    onLoadSession={handleLoadSession}
                    onStartEditTitle={handleStartEditTitle}
                    editingSessionId={editingSessionId}
                    editingSessionTitle={editingSessionTitle}
                    onEditingSessionTitleChange={setEditingSessionTitle}
                    onSaveTitle={handleSaveTitle}
                    onCancelTitle={handleCancelTitle}
                  />
                ))}
              </div>
            </div>
          )}
          {recentSessions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={lightMode ? 'text-slate-700' : 'text-slate-300'}>
                  <History size={18} />
                </span>
                <h2 className={`text-sm font-bold uppercase tracking-wider ${
                  lightMode ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  Recent Activity
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recentSessions.slice(0, 6).map((session) => (
                  <DashboardSessionCard
                    key={session.id}
                    session={session}
                    lightMode={lightMode}
                    isFavorite={session.isFavorite}
                    onToggleFavorite={toggleFavoriteSession}
                    onLoadSession={handleLoadSession}
                    onStartEditTitle={handleStartEditTitle}
                    editingSessionId={editingSessionId}
                    editingSessionTitle={editingSessionTitle}
                    onEditingSessionTitleChange={setEditingSessionTitle}
                    onSaveTitle={handleSaveTitle}
                    onCancelTitle={handleCancelTitle}
                  />
                ))}
              </div>
            </div>
          )}

        </div>
    </div>
  );
};

export default DashboardPage;
