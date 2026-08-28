import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Globe, X } from 'lucide-react';
import { sessionAPI } from '../services/backendService';
import * as appLogic from '../services/appLogicService';
import { useUI } from '../contexts/UIContext';
import { useGlobal } from '../contexts/GlobalContext';
import { useProFeature } from '../hooks/useProFeature';
import { useFileDrop } from '../hooks/useFileDrop';
import ProLockBadge from '../components/ProLockBadge';
import SessionLoadingView from '../components/SessionLoadingView';
import AttachmentToolbar, { AttachmentToolbarHandle } from '../components/AttachmentToolbar';
import ActionButton from '../components/ActionButton';
import { useWorkerPolling } from '../hooks/useWorkerPolling';
import { useSessionResume } from '../hooks/useSessionResume';
import { useSessionTask } from '../hooks/useSessionTask';
import { useAttachmentToolbarData } from '../hooks/useAttachmentToolbarData';
import {SavedSession} from "@/types.ts";

type InternalView = 'input' | 'clarifying' | 'loading';

const POLL_INTERVAL_MS = 10000;

const NewResearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { showError, lightMode } = useUI();
  const { refreshSavedSessions } = useGlobal();
  const { isPro } = useProFeature();

  const [internalView, setInternalView] = useState<InternalView>('input');
  const [topic, setTopic] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [researchOnline, setResearchOnline] = useState(true);
  const [selectedKbIds, setSelectedKbIds] = useState<number[]>([]);
  const [selectedMcpServerIds, setSelectedMcpServerIds] = useState<number[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [availableSessions, setAvailableSessions] = useState<SavedSession[]>([]);
  const [availableFavoriteSessions, setAvailableFavoriteSessions] = useState<SavedSession[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const toolbarRef = useRef<AttachmentToolbarHandle>(null);

  const {
    isDragOver: isPageDragOver,
    handleDragOver: handlePageDragOver,
    handleDragLeave: handlePageDragLeave,
    handleDrop: handlePageDrop,
  } = useFileDrop((files) => toolbarRef.current?.addFiles(files));

  const { availableKbs, availableMcpServers, availableTunnelServers, selectedTunnelServerIds, onToggleTunnelServer } = useAttachmentToolbarData();

  useEffect(() => {
    async function fetchSessions() {
      try {
        const [sessionsResult, favoritesResult] = await Promise.all([
          sessionAPI.listSessions(),
          sessionAPI.listFavorites(),
        ]);
        setAvailableSessions(sessionsResult.results || []);
        setAvailableFavoriteSessions(favoritesResult.results || []);
      } catch (err) {
        console.error('Failed to load sessions', err);
      }
    }
    fetchSessions();
  }, []);

  const onPollingComplete = useCallback(() => {
    setIsRunning(false);
    refreshSavedSessions();
    navigate(`/research/${appLogic.getCurrentSessionId()}`, { replace: true });
  }, [navigate, refreshSavedSessions]);

  const onPollingError = useCallback((errorMsg: string) => {
    setIsRunning(false);
    showError('Research failed', new Error(errorMsg));
    navigate('/', { replace: true });
  }, [navigate, showError]);

  const { loadingStep, setLoadingStep, stepTasks, thinking, lastToolCall } = useWorkerPolling({
    isRunning,
    onComplete: onPollingComplete,
    onError: onPollingError,
  });

  const { submit: startResearch } = useSessionTask({
    successRoute: '/research',
    submitErrorTitle: 'Research failed',
    setInternalView,
    setIsRunning,
    setLoadingStep,
  });

  const startAnalysis = useCallback(async (
    currentTopic = topic,
  ) => {
    if (!currentTopic.trim()) return;
    setInternalView('loading');
    setLoadingStep('Scoping research task ...');
    try {
      if (!appLogic.getCurrentSessionId()) {
        const desktopTunnelServers = appLogic.buildDesktopTunnelServers(availableTunnelServers, selectedTunnelServerIds);
        const session = await sessionAPI.createSession(
          {
            dilemma: currentTopic,
            sessionType: 'research',
            isResearchOnline: researchOnline,
            ...(selectedKbIds.length > 0 ? { knowledgeBaseIds: selectedKbIds } : {}),
            ...(selectedMcpServerIds.length > 0 ? { mcpServerIds: selectedMcpServerIds } : {}),
            ...(Object.keys(desktopTunnelServers).length > 0 ? { desktopTunnelServers } : {}),
          },
          attachedFiles,
          selectedSessionIds,
        );
        appLogic.setCurrentSessionId(session.id);
      }
      await startResearch();
    } catch (err: any) {
      showError('Failed to start research', err);
      if (appLogic.getCurrentSessionId()) {
        navigate('/', { replace: true });
      } else {
        setInternalView('input');
      }
    }
  }, [attachedFiles, startResearch, researchOnline, selectedKbIds, selectedMcpServerIds, selectedSessionIds, showError, topic, navigate]);

  useSessionResume({
    onComplete: (sessionId) => navigate(`/research/${sessionId}`, { replace: true }),
    onSubmit: startResearch,
    onStartFresh: (s) => startAnalysis(s.dilemma),
    setDilemma: setTopic,
    setInternalView,
    setLoadingStep,
    errorTitle: 'Failed to resume research',
  });

  const researchOnlineDisabled = !isPro;
  const hasResearchSource = (researchOnline && !researchOnlineDisabled) || selectedKbIds.length > 0 || selectedMcpServerIds.length > 0 || attachedFiles.length > 0;

  if (internalView === 'loading') {
    return (
      <SessionLoadingView
        icon={<BookOpen size={56} className="text-blue-500" />}
        loadingStep={loadingStep}
        stepTasks={stepTasks}
        thinking={thinking}
        lastToolCall={lastToolCall}
        lightMode={lightMode}
        runningMessage={isRunning ? 'Research can take several minutes. You may close this page and return to it later from your session history — an email will be sent to you once the report is ready.' : undefined}
      />
    );
  }

  // Input view — panel layout matching InputStage
  const cardClass = [
    'border rounded-[2rem] sm:rounded-[3.5rem] p-6 sm:p-10 md:p-14 shadow-2xl relative flex flex-col flex-grow transition-colors duration-500 overflow-hidden',
    lightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800',
    isPageDragOver ? (lightMode ? 'border-blue-400' : 'border-blue-500') : '',
  ].join(' ');

  return (
    <div className="w-full max-w-3xl animate-slide-up flex flex-col h-full max-h-[85dvh] gap-4 sm:gap-6" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div
        className={cardClass}
        onDragOver={handlePageDragOver}
        onDragLeave={handlePageDragLeave}
        onDrop={handlePageDrop}
      >
        {isPageDragOver && (
          <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center rounded-[2rem] sm:rounded-[3.5rem] border-2 border-dashed border-blue-500 bg-blue-600/10">
            <span className={`text-sm font-bold ${lightMode ? 'text-blue-600' : 'text-blue-400'}`}>Drop files to attach</span>
          </div>
        )}
        <button
          data-analytics="cancel_new_session"
          data-testid="btn-cancel-new-session"
          onClick={() => navigate('/')}
          className={`absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-xl ${lightMode ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100' : 'text-slate-500 hover:text-white hover:bg-slate-800'} transition-colors`}
          aria-label="Cancel and return to dashboard"
        >
          <X size={20} />
        </button>
        {/* Topic textarea — pinned at top */}
        <label htmlFor="research-topic" className={`block text-[10px] font-bold uppercase tracking-[0.2em] mb-2 shrink-0 ${lightMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Research Topic
        </label>
        <div className={`flex-grow flex flex-col border rounded-2xl overflow-hidden transition-colors min-h-[200px] sm:min-h-[140px] ${lightMode ? 'bg-slate-50 border-slate-200 focus-within:border-blue-400' : 'bg-slate-950 border-slate-800 focus-within:border-blue-500'}`}>
          <textarea
            id="research-topic"
            data-testid="input-dilemma"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g. Competitive landscape of generative AI in healthcare, 2025"
            dir="auto"
            className={`w-full flex-grow p-4 sm:p-5 min-h-[60px] sm:min-h-[80px] resize-none focus:outline-none font-semibold text-sm sm:text-base transition-colors no-scrollbar bg-transparent ${lightMode ? 'text-slate-800 placeholder:text-slate-300' : 'text-slate-200 placeholder:text-slate-700'}`}
          />

          {/* Example prompts — shown only when empty */}
          {topic.length === 0 && (
            <div className="px-4 sm:px-5 pb-3 flex flex-wrap gap-2 items-center">
              <span className={`text-[10px] font-bold uppercase tracking-[0.2em] shrink-0 ${lightMode ? 'text-slate-400' : 'text-slate-500'}`}>Try:</span>
              {['Competitive landscape of AI in healthcare in 2025', 'Market trends for EV charging infrastructure', 'Latest developments in quantum computing'].map((example, index) => (
                <button
                  key={index}
                  type="button"
                  data-testid={`example-prompt-${index}`}
                  data-analytics="select_example_research"
                  onClick={() => setTopic(example)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all truncate max-w-[220px] ${lightMode ? 'border-slate-200 text-slate-500 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600' : 'border-slate-700 text-slate-400 bg-slate-800/50 hover:bg-blue-900/30 hover:border-blue-600 hover:text-blue-300'}`}
                >
                  {example}
                </button>
              ))}
            </div>
          )}

          {/* Options bar — same style as InputStage checkboxes bar */}
          <div className={`px-4 sm:px-5 py-3 border-t flex flex-wrap gap-x-5 gap-y-2 ${lightMode ? 'border-slate-200' : 'border-slate-800'}`}>
            <label
              htmlFor="research-online"
              data-testid="toggle-research-online"
              className={`flex items-center gap-2 w-fit group relative ${researchOnlineDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              onClick={researchOnlineDisabled ? e => e.preventDefault() : undefined}
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${researchOnline && !researchOnlineDisabled ? 'bg-blue-600 border-blue-600' : lightMode ? 'border-slate-300 bg-white' : 'border-slate-700 bg-slate-950'}`}>
                {researchOnline && !researchOnlineDisabled && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <input
                id="research-online"
                type="checkbox"
                checked={researchOnline && !researchOnlineDisabled}
                onChange={e => { if (!researchOnlineDisabled) setResearchOnline(e.target.checked); }}
                disabled={researchOnlineDisabled}
                className="sr-only"
              />
              <Globe size={14} className={researchOnline && !researchOnlineDisabled ? 'text-blue-400' : 'text-slate-500'} />
              <span className={`text-[10px] font-bold uppercase tracking-[0.15em] transition-colors ${researchOnline && !researchOnlineDisabled ? 'text-blue-400' : lightMode ? 'text-slate-400 group-hover:text-slate-600' : 'text-slate-500 group-hover:text-slate-300'}`}>
                Research Online
              </span>
              {!isPro && <ProLockBadge />}
              <span className={`absolute bottom-full left-0 mb-2 w-64 p-2 rounded-lg text-[10px] font-semibold leading-relaxed pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 ${lightMode ? 'bg-slate-800 text-slate-100' : 'bg-slate-700 text-slate-100'}`}>
                {!isPro
                  ? 'Upgrade to Pro for access to online research.'
                  : 'Enables an AI agent to research the topic online for a comprehensive report.'}
              </span>
            </label>
          </div>
        </div>

        {/* Bottom toolbar — file upload + attached files + KB pills + MCP pills */}
        <div
          className={`pt-5 sm:pt-8 border-t flex flex-col gap-5 sm:gap-8 shrink-0 transition-all rounded-xl ${lightMode ? 'border-slate-100' : 'border-slate-800/50'}`}
        >
          <AttachmentToolbar
            ref={toolbarRef}
            attachedFiles={attachedFiles}
            onAddFiles={(files) => setAttachedFiles(prev => [...prev, ...files])}
            onRemoveFile={(i) => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))}
            availableKbs={availableKbs}
            selectedKbIds={selectedKbIds}
            onToggleKb={(id) => setSelectedKbIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
            availableMcpServers={availableMcpServers}
            selectedMcpServerIds={selectedMcpServerIds}
            onToggleMcpServer={(id) => setSelectedMcpServerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
            availableTunnelServers={availableTunnelServers}
            selectedTunnelServerIds={selectedTunnelServerIds}
            onToggleTunnelServer={onToggleTunnelServer}
            lightMode={lightMode}
            availableSessions={availableSessions}
            availableFavoriteSessions={availableFavoriteSessions}
            selectedSessionIds={selectedSessionIds}
            onToggleSession={(id) => setSelectedSessionIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
          />

          <ActionButton
            variant="primary"
            icon={BookOpen}
            label="Start Research"
            onClick={() => startAnalysis()}
            disabled={!topic.trim() || !hasResearchSource}
            lightMode={lightMode}
            data-analytics="start_research"
            data-testid="btn-start-research"
            maxWidth={0}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};

export default NewResearchPage;
