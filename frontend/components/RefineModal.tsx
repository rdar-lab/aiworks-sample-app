import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Pencil, X } from 'lucide-react';
import AttachmentToolbar, { AttachmentToolbarHandle } from './AttachmentToolbar';
import { useAttachmentToolbarData } from '../hooks/useAttachmentToolbarData';
import { useFileDrop } from '../hooks/useFileDrop';
import { TunnelServerSummary } from '../types';

interface RefineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (notes: string, attachments?: {
    files: File[];
    attachedSessionIds: string[];
    knowledgeBaseIds: number[];
    mcpServerIds: number[];
    desktopTunnelServers: Record<string, string[]>;
  }) => Promise<void>;
  isLoading: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  availableTunnelServers?: TunnelServerSummary[];
  supportAttachments?: boolean;
}

const RefineModal: React.FC<RefineModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  title,
  description,
  placeholder,
  availableTunnelServers = [],
  supportAttachments = true,
}) => {
  const [notes, setNotes] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [selectedKbIds, setSelectedKbIds] = useState<number[]>([]);
  const [selectedMcpServerIds, setSelectedMcpServerIds] = useState<number[]>([]);
  const [selectedTunnelServerIds, setSelectedTunnelServerIds] = useState<string[]>([]);

  const toolbarRef = useRef<AttachmentToolbarHandle>(null);

  const { availableKbs, availableMcpServers, availableTunnelServers: hookTunnelServers } = useAttachmentToolbarData();

  const { isDragOver, handleDragOver, handleDragLeave, handleDrop } = useFileDrop(
    supportAttachments ? (files) => toolbarRef.current?.addFiles(files) : (files) => files,
  );

  const tunnelServers = availableTunnelServers.length > 0
    ? [...new Map([...availableTunnelServers, ...hookTunnelServers].map(s => [s.id, s])).values()]
    : hookTunnelServers;

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!notes.trim() || isLoading) return;

    if (!supportAttachments) {
      await onSubmit(notes.trim(), null as any);
      return;
    }

    const desktopTunnelServers: Record<string, string[]> = {};
    for (const srv of tunnelServers) {
      if (!selectedTunnelServerIds.includes(srv.id)) continue;
      const tid = (srv as TunnelServerSummary & { tunnelId?: string }).tunnelId || "";
      if (!tid) continue;
      if (!desktopTunnelServers[tid]) desktopTunnelServers[tid] = [];
      if (!desktopTunnelServers[tid].includes(srv.id)) desktopTunnelServers[tid].push(srv.id);
    }

    await onSubmit(notes.trim(), {
      files: attachedFiles,
      attachedSessionIds: selectedSessionIds,
      knowledgeBaseIds: selectedKbIds,
      mcpServerIds: selectedMcpServerIds,
      desktopTunnelServers,
    });
    setNotes('');
    setAttachedFiles([]);
    setSelectedSessionIds([]);
    setSelectedKbIds([]);
    setSelectedMcpServerIds([]);
    setSelectedTunnelServerIds([]);
  };

  const handleClose = () => {
    if (isLoading) return;
    setNotes('');
    setAttachedFiles([]);
    setSelectedSessionIds([]);
    setSelectedKbIds([]);
    setSelectedMcpServerIds([]);
    setSelectedTunnelServerIds([]);
    onClose();
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm no-print"
      {...(supportAttachments ? { onDragOver: handleDragOver, onDragLeave: handleDragLeave, onDrop: handleDrop } : {})}
    >
      {supportAttachments && isDragOver && (
        <div className="absolute inset-0 z-[101] flex items-center justify-center bg-blue-600/10 border-2 border-dashed border-blue-500 rounded-[2rem] sm:rounded-[2.5rem] pointer-events-none">
          <span className="text-blue-400 font-bold text-lg">Drop files to attach</span>
        </div>
      )}
      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 max-w-lg w-full animate-slide-up shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          data-analytics="close_refine_modal"
          onClick={handleClose}
          disabled={isLoading}
          className="absolute top-6 right-6 sm:top-8 sm:right-8 text-slate-500 hover:text-white disabled:opacity-40 z-10"
        >
          <X size={24} />
        </button>

        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <div className="p-3 rounded-2xl bg-violet-600/10">
            <Pencil size={24} className="text-violet-400" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white uppercase">{title}</h2>
        </div>

        <p className="text-slate-400 text-sm mb-5 leading-relaxed">{description}</p>

        <div className="mb-4">
          <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
            Refinement Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isLoading}
            placeholder={placeholder}
            rows={4}
            dir="auto"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm resize-none focus:outline-none focus:border-violet-500 disabled:opacity-50"
            data-testid="refine-notes"
          />
        </div>

        {supportAttachments && (
          <div className="mb-6">
            <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
              Attachments
            </label>
            <AttachmentToolbar
              ref={toolbarRef}
              attachedFiles={attachedFiles}
              onAddFiles={(files) => setAttachedFiles(prev => [...prev, ...files])}
              onRemoveFile={(index) => setAttachedFiles(prev => prev.filter((_, i) => i !== index))}
              availableKbs={availableKbs}
              selectedKbIds={selectedKbIds}
              onToggleKb={(id) => setSelectedKbIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
              availableMcpServers={availableMcpServers}
              selectedMcpServerIds={selectedMcpServerIds}
              onToggleMcpServer={(id) => setSelectedMcpServerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
              availableTunnelServers={tunnelServers}
              selectedTunnelServerIds={selectedTunnelServerIds}
              onToggleTunnelServer={(id) => setSelectedTunnelServerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
              showKbMcp={true}
              showPills={true}
              lightMode={false}
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            data-analytics="cancel_refine"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 py-3 sm:py-4 border border-slate-700 text-slate-400 rounded-xl font-bold uppercase hover:bg-slate-800 transition-all disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            data-analytics="submit_refine"
            data-testid="btn-submit-refine"
            onClick={handleSubmit}
            disabled={!notes.trim() || isLoading}
            className="flex-1 py-3 sm:py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold uppercase shadow-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Submitting…' : 'Refine'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default RefineModal;