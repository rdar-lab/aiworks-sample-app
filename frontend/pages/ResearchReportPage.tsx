import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {ArrowLeft, BookOpen, Download, FileText, Link, Loader2, Paperclip, Printer, Share2, Pencil, Lock, Clock, Star} from 'lucide-react';
import { sessionAPI, sessionAttachmentAPI } from '../services/backendService';
import * as storageService from '../services/storageService';
import { useUI } from '../contexts/UIContext';
import { useGlobal } from '../contexts/GlobalContext';
import MarkdownRenderer from '../components/MarkdownRenderer';
import ShareConfirmModal from '../components/ShareConfirmModal';
import UnshareConfirmModal from '../components/UnshareConfirmModal';
import ShareUrlModal from '../components/ShareUrlModal';
import PrintPreviewModal from '../components/PrintPreviewModal';
import FileContentModal from '../components/FileContentModal';
import AttachmentContentViewer from '../components/AttachmentContentViewer';
import OutputFileCard from '../components/OutputFileCard';
import RefineModal from '../components/RefineModal';
import SnapshotHistoryPanel from '../components/SnapshotHistoryPanel';
import ActionButton from '../components/ActionButton';
import PdfIcon from '../components/PdfIcon';
import WordIcon from '../components/WordIcon';
import { useProFeature } from '../hooks/useProFeature';
import { AttachedFileItem } from '../types';

const ResearchReportPage: React.FC = () => {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showError, lightMode } = useUI();
  const { refreshSavedSessions, toggleFavoriteSession } = useGlobal();
  const [isFavorite, setIsFavorite] = useState(false);

  const [report, setReport] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('Research Report');
  const [isPublic, setIsPublic] = useState(false);
  const [isOwner, setIsOwner] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [outputFiles, setOutputFiles] = useState<AttachedFileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<AttachedFileItem | null>(null);
  const [showAttachmentsInPrint, setShowAttachmentsInPrint] = useState(false);
  const [printAttachmentContents, setPrintAttachmentContents] = useState<Record<number, string>>({});

  const [isShareConfirmOpen, setIsShareConfirmOpen] = useState(false);
  const [isUnshareConfirmOpen, setIsUnshareConfirmOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isPrintPreview, setIsPrintPreview] = useState(false);
  const { isPro } = useProFeature();
  const [isRefineModalOpen, setIsRefineModalOpen] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isSnapshotPanelOpen, setIsSnapshotPanelOpen] = useState(false);
  const [hasSnapshots, setHasSnapshots] = useState(false);


  const shareUrl = useMemo(
    () => `${window.location.origin}/app/research/${sessionId}`,
    [sessionId],
  );

  // Load session on mount — mirrors SessionLayout's approach.
  // Any non-complete state is redirected to NewResearchPage to handle
  // loading/resume (polling lives there, not here).
  useEffect(() => {
    if (!sessionId) {
      navigate('/', { replace: true });
      return;
    }

    setIsLoading(true);
    setLoadError(false);

    storageService.getSession(sessionId)
      .then(async s => {
        if (!s) {
          setLoadError(true);
          return;
        }

        const state = s.resumeState ?? 'no_questions';
        if (state !== 'complete') {
          navigate(`/research/new?resume=${sessionId}`, { replace: true });
          return;
        }

        setTitle(s.sessionTitle || s.dilemma || 'Research Report');
        setIsPublic(s.isPublic ?? false);
        setIsOwner(s.isOwner ?? true);
        setReport(s.agentResult ?? null);
        setOutputFiles((s.attachedFiles ?? []).filter(f => f.fileType === 'output'));
        setIsFavorite(s.isFavorite ?? false);
        refreshSavedSessions();

        if (s.isOwner) {
          try {
            const snaps = await sessionAPI.listSnapshots(sessionId!);
            setHasSnapshots(snaps.length > 0);
          } catch {
            setHasSnapshots(false);
          }
        }
      })
      .catch(err => {
        showError('Failed to load research report', err);
        setLoadError(true);
      })
      .finally(() => setIsLoading(false));
  }, [sessionId, navigate, showError, refreshSavedSessions]);

  useEffect(() => {
    if (!showAttachmentsInPrint || outputFiles.length === 0 || !sessionId) return;
    const hasUnloaded = outputFiles.some(f => !printAttachmentContents[f.id]);
    if (!hasUnloaded) return;

    let cancelled = false;
    const loadContents = async () => {
      const results: Record<number, string> = {};
      for (const f of outputFiles) {
        if (cancelled) break;
        if (printAttachmentContents[f.id]) {
          results[f.id] = printAttachmentContents[f.id];
          continue;
        }
        try {
          const response = await sessionAttachmentAPI.get(sessionId, f.name);
          results[f.id] = response.content;
        } catch {
          results[f.id] = `[Failed to load content for ${f.name}]`;
        }
      }
      if (!cancelled) {
        setPrintAttachmentContents(prev => ({ ...prev, ...results }));
      }
    };
    loadContents();
    return () => { cancelled = true; };
  }, [showAttachmentsInPrint, sessionId, outputFiles, printAttachmentContents]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div data-testid="session-not-found" className="flex-grow flex flex-col items-center justify-center gap-6 text-center p-8 my-auto">
        <p className={`font-bold text-lg ${lightMode ? 'text-slate-600' : 'text-slate-400'}`}>
          Report not found or not accessible.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all"
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] w-full mx-auto px-4 py-8 space-y-8 animate-slide-up">
      {/* Header — title only, no action buttons */}
      <div className="space-y-2">
        <button
          onClick={() => navigate('/')}
          className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors mb-2 ${lightMode ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <ArrowLeft size={14} /> Back
        </button>
          <div className="flex items-center gap-3">
          <BookOpen size={22} className="text-blue-500 shrink-0 mt-0.5" />
          <h1
            data-testid="research-report-title"
            className={`text-2xl sm:text-3xl font-black uppercase tracking-tight leading-tight ${lightMode ? 'text-slate-900' : 'text-white'}`}
          >
              Research <span className="hidden sm:inline">Report</span>
          </h1>
          {isPro && isOwner && hasSnapshots && (
            <button
              data-testid="btn-version-history"
              data-analytics="open_snapshot_history"
              onClick={() => setIsSnapshotPanelOpen(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/80 transition-all"
              aria-label="Version History"
            >
              <Clock size={18} />
            </button>
          )}
          <button
            data-testid="btn-toggle-favorite"
            data-analytics="toggle_favorite_session"
            onClick={() => { const newVal = !isFavorite; setIsFavorite(newVal); toggleFavoriteSession({ id: sessionId!, isFavorite } as any); }}
            className="p-2 rounded-xl text-slate-400 hover:text-yellow-400 hover:bg-slate-700/80 transition-all ml-auto"
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            {isFavorite ? <Star size={18} className="text-yellow-400 fill-yellow-400" /> : <Star size={18} />}
          </button>
        </div>
        <p className={`text-sm italic font-medium ml-9 ${lightMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {title}
        </p>
      </div>

        {!isOwner && (
            <div className={`no-print flex items-center gap-3 px-5 py-4 rounded-2xl border text-sm font-bold ${lightMode ? 'border-slate-200 bg-slate-100 text-slate-600' : 'border-slate-700 bg-slate-900/80 text-slate-400'}`}>
                <Lock size={16} className={`shrink-0 ${lightMode ? 'text-slate-400' : 'text-slate-500'}`} />
                <span>You are viewing a shared session in read-only mode.</span>
            </div>
        )}

      {/* Report content */}
      <div
        className={`rounded-3xl border p-6 sm:p-10 md:p-14 shadow-2xl transition-colors ${lightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}
        data-testid="research-report-content"
      >
        {report ? (
          <MarkdownRenderer content={report} lightMode={lightMode} />
        ) : (
          <p className={`text-sm ${lightMode ? 'text-slate-400' : 'text-slate-500'}`}>
            No report content available.
          </p>
        )}
      </div>

      {/* Output file attachments */}
      {outputFiles.length > 0 && (
        <div className={`rounded-3xl border p-6 sm:p-8 shadow transition-colors ${lightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
          <div className={`flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-widest ${lightMode ? 'text-slate-500' : 'text-slate-400'}`}>
            <Paperclip size={14} />
            <span>Attachments</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {outputFiles.map(f => (
              <OutputFileCard
                key={f.id}
                file={f}
                onClick={() => setSelectedFile(f)}
                lightMode={lightMode}
              />
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-8 no-print pb-10">
          <ActionButton
            variant="primary"
            icon={Pencil}
            label="Refine"
            isProGated
            isPro={isPro}
            lightMode={lightMode}
            disabled={!isPro || !isOwner}
            onClick={() => setIsRefineModalOpen(true)}
          />

        <ActionButton
          variant="secondary"
          icon={Printer}
          label="Print"
          isProGated
          isPro={isPro}
          lightMode={lightMode}
          disabled={!isPro}
          onClick={() => setIsPrintPreview(true)}
        />

      <ActionButton
        variant="secondary"
        icon={Download}
        label="Download"
        isProGated
        isPro={isPro}
        lightMode={lightMode}
        data-testid="btn-download"
        data-analytics="open_download_menu"
        dropdownItems={[
          {
            label: 'PDF Document',
            icon: PdfIcon,
            'data-testid': 'btn-download-pdf',
            'data-analytics': 'download_report_pdf',
            onClick: async () => {
              try {
                await sessionAPI.exportReport(sessionId!, 'pdf');
              } catch (e: any) {
                showError('Failed to export PDF', e);
              }
            },
          },
          {
            label: 'Word Document (.docx)',
            icon: WordIcon,
            'data-testid': 'btn-download-docx',
            'data-analytics': 'download_report_docx',
            onClick: async () => {
              try {
                await sessionAPI.exportReport(sessionId!, 'docx');
              } catch (e: any) {
                showError('Failed to export Word document', e);
              }
            },
          },
          {
            label: 'ZIP Archive (all files)',
            icon: Download,
            'data-testid': 'btn-download-zip',
            'data-analytics': 'download_report_zip',
            onClick: async () => {
              try {
                await sessionAPI.downloadOutputFiles(sessionId!);
              } catch (e: any) {
                showError('Failed to download files', e);
              }
            },
          },
        ]}
      />

        <ActionButton
          variant="secondary"
          icon={isPublic ? Link : Share2}
          label="Share"
          lightMode={lightMode}
          data-analytics="share_research_session"
          data-testid="btn-share"
          onClick={() => isPublic ? setIsShareModalOpen(true) : setIsShareConfirmOpen(true)}
        />
      </div>

      {/* Refine Modal */}
      {isRefineModalOpen && (
        <RefineModal
          isOpen={isRefineModalOpen}
          onClose={() => setIsRefineModalOpen(false)}
          isLoading={isRefining}
          title="Refine Research Report"
          description="Describe what you'd like to change or add to the existing research report. The agent will read the current report and apply your instructions — it will not start from scratch."
          placeholder="e.g. Expand the competitive analysis section, add more recent data sources, deepen the market opportunity section…"
          onSubmit={async (notes: string, attachments: {
            files: File[];
            attachedSessionIds: string[];
            knowledgeBaseIds: number[];
            mcpServerIds: number[];
            desktopTunnelServers: Record<string, string[]>;
          }) => {
            setIsRefining(true);
            try {
              await sessionAPI.refineSession(
                sessionId!,
                notes,
                attachments.files,
                attachments.attachedSessionIds,
                attachments.knowledgeBaseIds,
                attachments.mcpServerIds,
                attachments.desktopTunnelServers,
              );
              setIsRefineModalOpen(false);
              navigate(`/research/new?resume=${sessionId}`, { replace: true });
            } catch (e: any) {
              showError('Failed to refine research', e);
              setIsRefining(false);
            }
          }}
        />
      )}

      {/* Snapshot History Panel */}
      <SnapshotHistoryPanel
        isOpen={isSnapshotPanelOpen}
        onClose={() => setIsSnapshotPanelOpen(false)}
        sessionId={sessionId!}
        onRestored={() => {
          // Reload the session data after restore
          storageService.getSession(sessionId!).then(s => {
            if (s) {
              setReport(s.agentResult ?? null);
              setOutputFiles((s.attachedFiles ?? []).filter(f => f.fileType === 'output'));
              refreshSavedSessions();
            }
          }).catch(err => showError('Failed to reload session after restore', err));
        }}
      />

      {/* Share Confirmation Modal */}
      {isShareConfirmOpen && (
        <ShareConfirmModal
          title="Share Report?"
          onClose={() => setIsShareConfirmOpen(false)}
          onConfirm={async () => {
            try {
              await sessionAPI.makePublic(sessionId!);
              setIsPublic(true);
              setIsShareConfirmOpen(false);
              setIsShareModalOpen(true);
            } catch (e: any) {
              showError('Failed to share report', e);
              setIsShareConfirmOpen(false);
            }
          }}
        />
      )}

      {/* Unshare Confirmation Modal */}
      {isUnshareConfirmOpen && (
        <UnshareConfirmModal
          title="Stop Sharing?"
          onClose={() => setIsUnshareConfirmOpen(false)}
          onConfirm={async () => {
            try {
              await sessionAPI.makePrivate(sessionId!);
              setIsPublic(false);
              setIsUnshareConfirmOpen(false);
            } catch (e: any) {
              showError('Failed to stop sharing', e);
              setIsUnshareConfirmOpen(false);
            }
          }}
        />
      )}

      {/* Share URL Modal */}
      {isShareModalOpen && (
        <ShareUrlModal url={shareUrl} onClose={() => setIsShareModalOpen(false)} onUnshare={() => { setIsShareModalOpen(false); setIsUnshareConfirmOpen(true); }} isOwner={isOwner} />
      )}

      {/* Print Preview Modal */}
      {isPrintPreview && (
        <PrintPreviewModal documentTitle={title} onClose={() => setIsPrintPreview(false)}>
          <div className="max-w-4xl mx-auto px-12 py-16 space-y-10">
            <div className="border-b-4 border-blue-600 pb-6 mb-8" style={{ breakInside: 'avoid', breakAfter: 'avoid' }}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Research Report</p>
              <h1 className="text-4xl font-black uppercase tracking-tight text-slate-900 mb-3">{title}</h1>
            </div>
            {report && (
              <MarkdownRenderer content={report} lightMode={true} compact={true} />
            )}
              {outputFiles.length > 0 && (
                  <label className={`no-print flex items-center gap-2 text-sm cursor-pointer select-none px-2 ${lightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      <input
                          type="checkbox"
                          checked={showAttachmentsInPrint}
                          onChange={e => setShowAttachmentsInPrint(e.target.checked)}
                          className="rounded"
                          data-testid="print-show-attachments"
                      />
                      Show Attachments in Print
                  </label>
              )}

            {showAttachmentsInPrint && outputFiles.length > 0 && (
              <div className="mt-10 space-y-8">
                {outputFiles.filter(f => printAttachmentContents[f.id]).map(f => (
                  <div key={f.id} className="space-y-2" style={{ breakInside: 'avoid' }}>
                    <h3 className="text-lg font-semibold text-slate-700">{f.name}</h3>
                    <MarkdownRenderer content={printAttachmentContents[f.id]} lightMode={true} compact={true} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </PrintPreviewModal>
      )}

      {/* File Content Modal */}
      {selectedFile && (
        <AttachmentContentViewer
          file={selectedFile}
          sessionId={sessionId!}
          onClose={() => setSelectedFile(null)}
          lightMode={lightMode}
        />
      )}
    </div>
  );
};

export default ResearchReportPage;
