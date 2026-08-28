import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Database, FileText, Paperclip, Server, Upload, X, Laptop } from 'lucide-react';
import { KnowledgeBaseSummary, MCPServerSummary, SavedSession, TunnelServerSummary } from '../types';
import SessionTypeIcon from './SessionTypeIcon';
import { useProFeature } from '../hooks/useProFeature';
import { ALLOWED_EXTENSIONS, isAllowedExtension, MAX_FILE_SIZE_BYTES } from '../utils/validation';

export interface AttachmentToolbarHandle {
  addFiles: (files: File[]) => void;
}

interface AttachmentToolbarProps {
  attachedFiles: File[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  availableKbs: KnowledgeBaseSummary[];
  selectedKbIds: number[];
  onToggleKb: (id: number) => void;
  availableMcpServers: MCPServerSummary[];
  selectedMcpServerIds: number[];
  onToggleMcpServer: (id: number) => void;
  availableTunnelServers?: TunnelServerSummary[];
  selectedTunnelServerIds?: string[];
  onToggleTunnelServer?: (id: string) => void;
  showKbMcp?: boolean;
  showPills?: boolean;
  lightMode: boolean;
  availableSessions?: SavedSession[];
  selectedSessionIds?: string[];
  onToggleSession?: (sessionId: string) => void;
  availableFavoriteSessions?: SavedSession[];
}

const AttachmentToolbar = forwardRef<AttachmentToolbarHandle, AttachmentToolbarProps>(({
  attachedFiles,
  onAddFiles,
  onRemoveFile,
  availableKbs,
  selectedKbIds,
  onToggleKb,
  availableMcpServers,
  selectedMcpServerIds,
  onToggleMcpServer,
  availableTunnelServers = [],
  selectedTunnelServerIds = [],
  onToggleTunnelServer,
  showKbMcp = true,
  showPills = true,
  lightMode,
  availableSessions = [],
  selectedSessionIds = [],
  onToggleSession,
  availableFavoriteSessions = [],
}, ref) => {
  const { isPro } = useProFeature();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const freeFileLimit = !isPro && attachedFiles.length >= 1;

  // Central validation: used by drag-drop and file picker.
  // attachedFiles comes from a closure — use a ref so the callback stays stable.
  const attachedFilesRef = useRef(attachedFiles);
  attachedFilesRef.current = attachedFiles;

  const processFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    const current = attachedFilesRef.current;

    const sizeValid = files.filter(f => f.size <= MAX_FILE_SIZE_BYTES);
    const hasRejected = files.some(f => f.size > MAX_FILE_SIZE_BYTES);

    if (sizeValid.length === 0) {
      setInfoMessage('Some files were not attached due to an unsupported format or size limitation');
      return;
    }

    if (!isPro) {
      const remaining = 1 - current.length;
      if (remaining <= 0) {
        setInfoMessage('Free plan allows only 1 file per session. Upgrade to Pro for unlimited uploads.');
        return;
      }
      const validFiles = sizeValid.filter(f => isAllowedExtension(f.name));
      const anyRejected = hasRejected || sizeValid.some(f => !isAllowedExtension(f.name));
      if (anyRejected) setInfoMessage('Some files were not attached due to an unsupported format or size limitation');
      if (validFiles.length > 0) onAddFiles(validFiles.slice(0, remaining));
    } else {
      const validFiles = sizeValid.filter(f => isAllowedExtension(f.name));
      const anyRejected = hasRejected || sizeValid.some(f => !isAllowedExtension(f.name));
      if (anyRejected) setInfoMessage('Some files were not attached due to an unsupported format or size limitation');
      if (validFiles.length > 0) onAddFiles(validFiles);
    }
  }, [isPro, onAddFiles]);

  useImperativeHandle(ref, () => ({ addFiles: processFiles }), [processFiles]);

  useEffect(() => {
    if (!infoMessage) return;
    const timer = setTimeout(() => setInfoMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [infoMessage]);

  const hasAnyAttachment = attachedFiles.length > 0 || selectedKbIds.length > 0 || selectedMcpServerIds.length > 0 || selectedSessionIds.length > 0 || selectedTunnelServerIds.length > 0;
  const hasAvailableSources = availableKbs.length > 0 || availableMcpServers.length > 0 || availableTunnelServers.length > 0;
  const showHint = !hasAnyAttachment && hasAvailableSources && showKbMcp;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    processFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = '';
    setDropdownOpen(false);
  };

  return (
    <div className="relative flex items-center gap-2">
      <div ref={dropdownRef} className="relative shrink-0">
        <button
          type="button"
          data-testid="btn-attach-dropdown"
          data-analytics="toggle_attachment_dropdown"
          onClick={(e) => {
            e.stopPropagation();
            setDropdownOpen(!dropdownOpen);
            setInfoMessage(null);
          }}
          className={`p-2 rounded-xl border transition-all flex items-center justify-center ${lightMode ? 'bg-slate-50 border-slate-200 hover:bg-slate-100' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
        >
          <Paperclip size={16} className="text-blue-400" />
        </button>

        {dropdownOpen && (
          <div className={`absolute bottom-full mb-2 left-0 z-50 rounded-xl border shadow-xl min-w-[220px] max-h-[300px] overflow-y-auto ${lightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}>
            <button
              type="button"
              data-testid="btn-upload-file"
              data-analytics="upload_file"
              onClick={() => {
                if (!freeFileLimit) {
                  fileInputRef.current?.click();
                }
              }}
              disabled={freeFileLimit}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition-colors ${freeFileLimit ? 'opacity-50 cursor-not-allowed' : lightMode ? 'hover:bg-slate-100' : 'hover:bg-slate-700'} ${lightMode ? 'text-slate-700' : 'text-slate-200'}`}
            >
              <Upload size={14} className="text-blue-400" />
              Upload a file
            </button>

            <input
              ref={fileInputRef}
              type="file"
              data-testid="input-file-upload"
              multiple={isPro}
              className="hidden"
              accept={ALLOWED_EXTENSIONS.join(',')}
              onChange={handleFileChange}
              disabled={freeFileLimit}
            />

            {showKbMcp && availableKbs.length > 0 && (
              <>
                <div className={`border-t ${lightMode ? 'border-slate-200' : 'border-slate-700'}`} />
                <div data-testid="section-header-kb" className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider ${lightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Knowledge Bases
                </div>
                {availableKbs.map(kb => {
                  const isSelected = selectedKbIds.includes(kb.id);
                  return (
                    <button
                      key={kb.id}
                      type="button"
                      data-testid="btn-kb-dropdown-item"
                      data-kb-name={kb.name}
                      data-analytics="toggle_kb_attachment"
                      onClick={() => onToggleKb(kb.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition-colors ${isSelected ? (lightMode ? 'bg-cyan-50 text-cyan-700' : 'bg-cyan-900/30 text-cyan-400') : lightMode ? 'hover:bg-slate-100' : 'hover:bg-slate-700'} ${lightMode ? 'text-slate-700' : 'text-slate-200'}`}
                    >
                      <Database size={14} className={isSelected ? 'text-cyan-500' : 'text-slate-400'} />
                      <span className="truncate" title={kb.name.length > 20 ? kb.name : undefined}>{kb.name.length > 20 ? kb.name.slice(0, 20) + '…' : kb.name}</span>
                      {isSelected && <X size={12} className="ml-auto text-cyan-500" />}
                    </button>
                  );
                })}
              </>
            )}

            {showKbMcp && availableMcpServers.length > 0 && (
              <>
                <div className={`border-t ${lightMode ? 'border-slate-200' : 'border-slate-700'}`} />
                <div data-testid="section-header-mcp" className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider ${lightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  MCP Servers
                </div>
                {availableMcpServers.map(srv => {
                  const isSelected = selectedMcpServerIds.includes(srv.id);
                  return (
                    <button
                      key={srv.id}
                      type="button"
                      data-testid="btn-mcp-dropdown-item"
                      data-mcp-server-name={srv.name}
                      data-analytics="toggle_mcp_attachment"
                      onClick={() => onToggleMcpServer(srv.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition-colors ${isSelected ? (lightMode ? 'bg-purple-50 text-purple-700' : 'bg-purple-900/30 text-purple-400') : lightMode ? 'hover:bg-slate-100' : 'hover:bg-slate-700'} ${lightMode ? 'text-slate-700' : 'text-slate-200'}`}
                    >
                      <Server size={14} className={isSelected ? 'text-purple-500' : 'text-slate-400'} />
                      <span className="truncate" title={srv.name.length > 20 ? srv.name : undefined}>{srv.name.length > 20 ? srv.name.slice(0, 20) + '…' : srv.name}</span>
                      {isSelected && <X size={12} className="ml-auto text-purple-500" />}
                    </button>
                  );
                })}
              </>
            )}

            {showKbMcp && isPro && availableTunnelServers.length > 0 && (
              <>
                <div className={`border-t ${lightMode ? 'border-slate-200' : 'border-slate-700'}`} />
                <div data-testid="section-header-tunnel" className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${lightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span>Local MCP Servers</span>
                </div>
                {availableTunnelServers.map(srv => {
                  const isSelected = selectedTunnelServerIds.includes(srv.id);
                  return (
                    <button
                      key={srv.id}
                      type="button"
                      data-testid="btn-tunnel-server-dropdown-item"
                      data-tunnel-server-id={srv.id}
                      data-analytics="toggle_tunnel_server_attachment"
                      onClick={() => onToggleTunnelServer?.(srv.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition-colors ${isSelected ? (lightMode ? 'bg-purple-50 text-purple-700' : 'bg-purple-900/30 text-purple-400') : lightMode ? 'hover:bg-slate-100' : 'hover:bg-slate-700'} ${lightMode ? 'text-slate-700' : 'text-slate-200'}`}
                    >
                      <Laptop size={14} className={isSelected ? 'text-purple-500' : 'text-slate-400'} />
                      <span className="truncate" title={srv.name.length > 20 ? srv.name : undefined}>{srv.name.length > 20 ? srv.name.slice(0, 20) + '…' : srv.name}</span>
                      {isSelected && <X size={12} className="ml-auto text-purple-500" />}
                    </button>
                  );
                })}
              </>
            )}

            {availableSessions.length > 0 && (
              <>
                <div className={`border-t ${lightMode ? 'border-slate-200' : 'border-slate-700'}`} />

                {availableFavoriteSessions.length > 0 && (
                  <>
                    <div data-testid="section-header-favorite-sessions" className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${lightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      <span>★</span>
                      <span>Favorite Sessions</span>
                    </div>
                    {availableFavoriteSessions.map(session => {
                      const isSelected = selectedSessionIds.includes(session.id);
                      return (
                        <button
                          key={`fav-${session.id}`}
                          type="button"
                          data-testid="btn-session-dropdown-item"
                          data-session-id={session.id}
                          data-analytics="toggle_session_attachment"
                          onClick={() => onToggleSession?.(session.id)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition-colors ${isSelected ? (lightMode ? 'bg-green-50 text-green-700' : 'bg-green-900/30 text-green-400') : lightMode ? 'hover:bg-slate-100' : 'hover:bg-slate-700'} ${lightMode ? 'text-slate-700' : 'text-slate-200'}`}
                        >
                          <SessionTypeIcon sessionType={session.sessionType} size={14} className={isSelected ? 'text-green-500' : 'text-slate-400'} />
                          <span className="truncate" title={session.sessionTitle}>
                            {session.sessionTitle.length > 20 ? session.sessionTitle.slice(0, 20) + '…' : session.sessionTitle }
                          </span>
                          {isSelected && <X size={12} className="ml-auto text-green-500" />}
                        </button>
                      );
                    })}
                  </>
                )}

                {(() => {
                  const nonFavoriteSessions = availableSessions.filter(s => !availableFavoriteSessions.some(f => f.id === s.id));
                  if (nonFavoriteSessions.length === 0) return null;
                  return (
                    <>
                      <div className={`border-t ${lightMode ? 'border-slate-200' : 'border-slate-700'}`} />
                      <div data-testid="section-header-recent-sessions" className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider ${lightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Recent Sessions
                      </div>
                      {nonFavoriteSessions.map(session => {
                        const isSelected = selectedSessionIds.includes(session.id);
                        return (
                          <button
                            key={session.id}
                            type="button"
                            data-testid="btn-session-dropdown-item"
                            data-session-id={session.id}
                            data-analytics="toggle_session_attachment"
                            onClick={() => onToggleSession?.(session.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition-colors ${isSelected ? (lightMode ? 'bg-green-50 text-green-700' : 'bg-green-900/30 text-green-400') : lightMode ? 'hover:bg-slate-100' : 'hover:bg-slate-700'} ${lightMode ? 'text-slate-700' : 'text-slate-200'}`}
                          >
                            <SessionTypeIcon sessionType={session.sessionType} size={14} className={isSelected ? 'text-green-500' : 'text-slate-400'} />
                            <span className="truncate" title={session.sessionTitle}>
                              {session.sessionTitle.length > 20 ? session.sessionTitle.slice(0, 20) + '…' : session.sessionTitle }
                            </span>
                            {isSelected && <X size={12} className="ml-auto text-green-500" />}
                          </button>
                        );
                      })}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>

      {showPills && (
        <div className="flex overflow-x-auto no-scrollbar items-center gap-2">
          {showHint && (
            <span className="text-xs font-bold shrink-0 text-blue-500 animate-pulse">
              ← Click to attach your data sources
            </span>
          )}

          {attachedFiles.map((f, i) => (
            <div key={i} className="shrink-0 bg-blue-600/10 border border-blue-500/20 px-2 py-1.5 rounded-xl flex items-center gap-1.5 animate-slide-up" data-testid="file-attachment-chip">
              <FileText size={12} className="text-blue-400" />
              <span className={`text-[10px] font-bold truncate max-w-[80px] ${lightMode ? 'text-slate-700' : 'text-slate-200'}`}>{f.name}</span>
              <button data-analytics="remove_file_attachment" onClick={() => onRemoveFile(i)} className="text-slate-500 hover:text-red-400">
                <X size={10} />
              </button>
            </div>
          ))}

          {showKbMcp && selectedKbIds.map(id => {
            const kb = availableKbs.find(k => k.id === id);
            if (!kb) return null;
            return (
              <div key={`kb-${id}`} className="shrink-0 bg-cyan-600/10 border border-cyan-500/20 px-2 py-1.5 rounded-xl flex items-center gap-1.5 animate-slide-up" data-testid="kb-attachment-chip" data-kb-name={kb.name}>
                <Database size={12} className="text-cyan-400" />
                <span className={`text-[10px] font-bold truncate max-w-[80px] ${lightMode ? 'text-slate-700' : 'text-slate-200'}`}>{kb.name}</span>
                <button data-analytics="remove_kb_attachment" onClick={() => onToggleKb(id)} className="text-slate-500 hover:text-red-400">
                  <X size={10} />
                </button>
              </div>
            );
          })}

          {showKbMcp && selectedMcpServerIds.map(id => {
            const srv = availableMcpServers.find(s => s.id === id);
            if (!srv) return null;
            return (
              <div key={`mcp-${id}`} className="shrink-0 bg-purple-600/10 border border-purple-500/20 px-2 py-1.5 rounded-xl flex items-center gap-1.5 animate-slide-up">
                <Server size={12} className="text-purple-400" />
                <span className={`text-[10px] font-bold truncate max-w-[80px] ${lightMode ? 'text-slate-700' : 'text-slate-200'}`}>{srv.name}</span>
                <button data-analytics="remove_mcp_attachment" onClick={() => onToggleMcpServer(id)} className="text-slate-500 hover:text-red-400">
                  <X size={10} />
                </button>
              </div>
            );
          })}

          {selectedTunnelServerIds.map(id => {
            const srv = availableTunnelServers.find(s => s.id === id);
            if (!srv) return null;
            return (
              <div key={`tunnel-${id}`} className="shrink-0 bg-purple-600/10 border border-purple-500/20 px-2 py-1.5 rounded-xl flex items-center gap-1.5 animate-slide-up">
                <Laptop size={12} className="text-purple-400" />
                <span className={`text-[10px] font-bold truncate max-w-[80px] ${lightMode ? 'text-slate-700' : 'text-slate-200'}`} title={srv.name}>{srv.name}</span>
                <button data-analytics="remove_tunnel_server_attachment" onClick={() => onToggleTunnelServer?.(id)} className="text-slate-500 hover:text-red-400">
                  <X size={10} />
                </button>
              </div>
            );
          })}

          {selectedSessionIds.map(id => {
            const session = availableSessions.find(s => s.id === id) || availableFavoriteSessions.find(s => s.id === id);
            if (!session) return null;
            return (
              <div key={`session-${id}`} className="shrink-0 bg-green-600/10 border border-green-500/20 px-2 py-1.5 rounded-xl flex items-center gap-1.5 animate-slide-up">
                <SessionTypeIcon sessionType={session.sessionType} size={12} className="text-green-400" />
                <span className={`text-[10px] font-bold truncate max-w-[80px] ${lightMode ? 'text-slate-700' : 'text-slate-200'}`} title={session.sessionTitle || session.dilemma}>
                  {session.sessionTitle || (session.dilemma.length > 15 ? session.dilemma.slice(0, 15) + '…' : session.dilemma) || session.id}
                </span>
                <button data-analytics="remove_session_attachment" onClick={() => onToggleSession?.(id)} className="text-slate-500 hover:text-red-400">
                  <X size={10} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {infoMessage && (
        <div className={`hidden sm:block absolute left-[50px] right-0 top-[50px] -mt-14 z-50 flex items-center gap-2 px-3 py-2 rounded-xl border animate-slide-up ${lightMode ? 'bg-yellow-50 border-amber-500' : 'bg-gray-700 border-amber-400'}`}>
          <span className={`text-xs font-semibold ${lightMode ? 'text-amber-700' : 'text-amber-400'}`}>{infoMessage}</span>
          <button
            data-analytics="dismiss_info_message"
            onClick={() => setInfoMessage(null)}
            className={`absolute top-3 right-3 ${lightMode ? 'text-amber-500 hover:text-amber-700' : 'text-amber-400 hover:text-amber-300'}`}
          >
            <X size={12} />
          </button>
        </div>
      )}

    </div>
  );
});

AttachmentToolbar.displayName = 'AttachmentToolbar';

export default AttachmentToolbar;
