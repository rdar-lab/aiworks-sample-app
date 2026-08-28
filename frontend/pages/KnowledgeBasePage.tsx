import React, { useEffect, useRef, useState } from 'react';
import { Database, Edit2, FileText, Plus, Trash2, Upload, X } from 'lucide-react';
import { useUI } from '../contexts/UIContext';
import { knowledgeBaseAPI } from '../services/backendService';
import { KnowledgeBase } from '../types';
import { useProFeature } from '../hooks/useProFeature';
import ProLockBadge from '../components/ProLockBadge';
import ConfirmDialog from '../components/ConfirmDialog';

const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.docx', '.doc', '.rtf', '.odt',
  '.xlsx', '.xls', '.ods',
  '.pptx', '.ppt', '.odp',
  '.txt', '.md', '.csv'
];
const UPLOAD_BATCH_SIZE = 3;

const KnowledgeBasePage: React.FC = () => {
  const { lightMode } = useUI();
  const { isPro } = useProFeature('knowledge_base');
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New KB form
  const [newKbName, setNewKbName] = useState('');
  const [creating, setCreating] = useState(false);

  // Rename state: kbId -> draft name
  const [renaming, setRenaming] = useState<Record<number, string>>({});

  // Expanded KB: shows its files
  const [expandedKbId, setExpandedKbId] = useState<number | null>(null);

  // Upload state: kbId -> { done, total } for batch progress display
  const [uploadProgress, setUploadProgress] = useState<Record<number, { done: number; total: number }>>({});

  // Drag-and-drop: kbId of the KB currently being dragged over
  const [dragOverKbId, setDragOverKbId] = useState<number | null>(null);

  // Pending delete confirmation
  const [deleteKbId, setDeleteKbId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetKbId, setUploadTargetKbId] = useState<number | null>(null);

  const card = lightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800';
  const text = lightMode ? 'text-slate-800' : 'text-slate-200';
  const subText = lightMode ? 'text-slate-500' : 'text-slate-400';
  const inputCls = lightMode
    ? 'bg-slate-50 border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-blue-400'
    : 'bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-blue-500';

  useEffect(() => {
    loadKbs();
  }, []);

  async function loadKbs() {
    try {
      setLoading(true);
      const data = await knowledgeBaseAPI.list();
      setKbs(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load knowledge bases');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newKbName.trim();
    if (!name) return;
    try {
      setCreating(true);
      await knowledgeBaseAPI.create(name);
      setNewKbName('');
      await loadKbs();
    } catch (e: any) {
      setError(e.message || 'Failed to create knowledge base');
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(kb: KnowledgeBase) {
    const name = (renaming[kb.id] ?? kb.name).trim();
    if (!name || name === kb.name) {
      setRenaming(prev => { const n = { ...prev }; delete n[kb.id]; return n; });
      return;
    }
    try {
      await knowledgeBaseAPI.update(kb.id, name);
      await loadKbs();
      setRenaming(prev => { const n = { ...prev }; delete n[kb.id]; return n; });
    } catch (e: any) {
      setError(e.message || 'Failed to rename knowledge base');
    }
  }

  function handleDelete(kbId: number) {
    setDeleteKbId(kbId);
  }

  async function confirmDelete() {
    if (deleteKbId === null) return;
    const id = deleteKbId;
    setDeleteKbId(null);
    try {
      await knowledgeBaseAPI.delete(id);
      await loadKbs();
      if (expandedKbId === id) setExpandedKbId(null);
    } catch (e: any) {
      setError(e.message || 'Failed to delete knowledge base');
    }
  }

  async function handleRemoveFile(kbId: number, fileId: number) {
    try {
      await knowledgeBaseAPI.removeFile(kbId, fileId);
      const refreshedKb = await knowledgeBaseAPI.get(kbId);
      setKbs(prev =>
          prev.map(k => (k.id === kbId ? refreshedKb : k))
      );
    } catch (e: any) {
      setError(e.message || 'Failed to remove file');
    }
  }

  function handleUploadClick(kbId: number) {
    setUploadTargetKbId(kbId);
    setExpandedKbId(kbId);
    fileInputRef.current?.click();
  }

  async function uploadFilesToKb(kbId: number, files: File[]) {
    if (!files.length) return;
    const invalid = files.find(f => {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      return !ALLOWED_EXTENSIONS.includes(ext);
    });
    if (invalid) {
      setError(`File type not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      return;
    }
    setUploadProgress(prev => ({ ...prev, [kbId]: { done: 0, total: files.length } }));
    try {
      for (let i = 0; i < files.length; i += UPLOAD_BATCH_SIZE) {
        const batch = files.slice(i, i + UPLOAD_BATCH_SIZE);
        const response = await knowledgeBaseAPI.uploadFiles(kbId, batch);
        const refreshedKb = await knowledgeBaseAPI.get(kbId);
        // Append the newly uploaded files to the KB in state immediately
        setKbs(prev =>
            prev.map(k => (k.id === kbId ? refreshedKb : k))
        );
        setUploadProgress(prev => ({
          ...prev,
          [kbId]: { done: Math.min(i + UPLOAD_BATCH_SIZE, files.length), total: files.length },
        }));
        if (response.parse_errors){
          setError(`Some files uploaded but failed to parse: ${response.parse_errors.map((err_obj=> err_obj.error)).join(', ')}`);
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to upload files');
    } finally {
      setUploadProgress(prev => { const n = { ...prev }; delete n[kbId]; return n; });
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length || uploadTargetKbId === null) return;
    await uploadFilesToKb(uploadTargetKbId, files);
  }

  function handleDragOver(e: React.DragEvent, kbId: number) {
    e.preventDefault();
    setDragOverKbId(kbId);
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverKbId(null);
    }
  }

  async function handleDrop(e: React.DragEvent, kbId: number) {
    e.preventDefault();
    setDragOverKbId(null);
    if (!isPro) return;
    setExpandedKbId(kbId);
    const files = Array.from(e.dataTransfer.files);
    await uploadFilesToKb(kbId, files);
  }

  return (
    <div className="w-full max-w-3xl py-6 flex flex-col gap-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        data-testid="input-kb-file-upload"
        multiple
        accept={ALLOWED_EXTENSIONS.join(',')}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Database size={28} className="text-blue-500 shrink-0" />
        <div>
          <h1 className={`text-2xl font-bold ${text}`}>Knowledge Bases</h1>
          <p className={`text-sm ${subText}`}>Attach documents to your sessions</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-950 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
          <span className="flex-grow">{error}</span>
          <button data-analytics="dismiss_error" onClick={() => setError(null)}><X size={16} /></button>
        </div>
      )}

      {/* Create KB form */}
      <div className={!isPro ? 'opacity-60 pointer-events-none' : undefined}>
        <form onSubmit={handleCreate} className={`border rounded-2xl p-5 flex gap-3 ${card}`}>
          <input
            data-testid="input-kb-name"
            value={newKbName}
            onChange={e => setNewKbName(e.target.value)}
            placeholder="New knowledge base name..."
            disabled={!isPro}
            dir="auto"
            className={`flex-grow min-w-0 border rounded-xl px-4 py-2 text-sm font-semibold outline-none transition-colors ${inputCls}`}
          />
          <button
            data-analytics="create_knowledge_base"
            data-testid="btn-kb-create"
            type="submit"
            disabled={!isPro || creating || !newKbName.trim()}
            className="shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Create</span>
          </button>
          {!isPro && <ProLockBadge className="pointer-events-auto" />}
        </form>
      </div>

      {/* KB list */}
      {loading ? (
        <div className={`text-center py-12 ${subText}`}>Loading...</div>
      ) : kbs.length === 0 ? (
        <div className={`text-center py-12 border rounded-2xl ${card} ${subText}`}>
          <Database size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No knowledge bases yet</p>
          <p className="text-xs mt-1">Create one above to get started</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {kbs.map(kb => (
            <div
              key={kb.id}
              data-testid="kb-card"
              data-kb-name={kb.name}
              className={`border rounded-2xl overflow-hidden transition-colors ${card} ${dragOverKbId === kb.id ? (lightMode ? 'border-blue-400 bg-blue-50' : 'border-blue-500 bg-blue-950/20') : ''}`}
              onDragOver={e => handleDragOver(e, kb.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, kb.id)}
            >
              {/* KB header row */}
              <div className="flex items-center gap-3 p-4">
                <button
                  data-analytics="toggle_kb_expansion"
                  onClick={() => setExpandedKbId(expandedKbId === kb.id ? null : kb.id)}
                  className="flex-grow flex items-center gap-3 text-left min-w-0"
                >
                  <Database size={18} className="text-blue-400 shrink-0" />
                  {renaming[kb.id] !== undefined ? (
                    <input
                      autoFocus
                      value={renaming[kb.id]}
                      onChange={e => setRenaming(prev => ({ ...prev, [kb.id]: e.target.value }))}
                      onBlur={() => handleRename(kb)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(kb); if (e.key === 'Escape') setRenaming(prev => { const n = { ...prev }; delete n[kb.id]; return n; }); }}
                      onClick={e => e.stopPropagation()}
                      dir="auto"
                      className={`flex-grow min-w-0 border rounded-lg px-3 py-1 text-sm font-semibold outline-none ${inputCls}`}
                    />
                  ) : (
                    <span className={`font-semibold truncate ${text}`}>{kb.name}</span>
                  )}
                  <span className={`hidden sm:inline text-xs shrink-0 ${subText}`}>{kb.filesCount} file{kb.filesCount !== 1 ? 's' : ''}</span>
                </button>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {isPro && (
                    <button
                      onClick={() => handleUploadClick(kb.id)}
                      disabled={!!uploadProgress[kb.id]}
                      data-testid="btn-kb-upload"
                      data-analytics="upload_to_kb"
                      title="Upload files"
                      className={`p-2 rounded-lg transition-colors ${lightMode ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-slate-800 text-slate-400'}`}
                    >
                      <Upload size={16} />
                    </button>
                  )}
                  <button
                    data-analytics="rename_kb"
                    onClick={e => { e.stopPropagation(); setRenaming(prev => ({ ...prev, [kb.id]: kb.name })); }}
                    title="Rename"
                    className={`p-2 rounded-lg transition-colors ${lightMode ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-slate-800 text-slate-400'}`}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    data-analytics="delete_knowledge_base"
                    onClick={() => handleDelete(kb.id)}
                    data-testid="btn-kb-delete"
                    title="Delete"
                    className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Expanded: file list */}
              {expandedKbId === kb.id && (
                <div className={`border-t px-4 py-3 ${lightMode ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-950/50'}`}>
                  {uploadProgress[kb.id] && (
                    <p className={`text-xs mb-2 ${subText}`}>
                      Uploading {uploadProgress[kb.id].done} / {uploadProgress[kb.id].total}...
                    </p>
                  )}
                  {dragOverKbId === kb.id && (
                    <div className={`text-xs text-center py-2 mb-2 rounded-lg border border-dashed ${lightMode ? 'border-blue-400 text-blue-500' : 'border-blue-500 text-blue-400'}`}>
                      Drop files here
                    </div>
                  )}
                  {kb.files.length === 0 ? (
                    <p className={`text-sm py-2 ${subText}`}>No files yet. Click upload or drag and drop documents here.</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {kb.files.map(f => (
                        <li key={f.id} data-testid="kb-file-item" data-file-name={f.name} className={`flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 ${lightMode ? 'hover:bg-slate-100' : 'hover:bg-slate-800/50'}`}>
                          <FileText size={14} className="text-blue-400 shrink-0" />
                          <span className={`flex-grow truncate ${text}`}>{f.name}</span>
                          <button
                            data-analytics="remove_kb_file"
                            onClick={() => handleRemoveFile(kb.id, f.id)}
                            className="text-red-400 hover:text-red-300 shrink-0"
                          >
                            <X size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {isPro && (
                    <button
                      data-analytics="upload_files_to_kb"
                      onClick={() => handleUploadClick(kb.id)}
                      disabled={!!uploadProgress[kb.id]}
                      className={`mt-3 flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg border transition-colors disabled:opacity-50 ${lightMode ? 'border-slate-300 text-slate-600 hover:bg-slate-100' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                    >
                      <Upload size={13} /> Upload files
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {deleteKbId !== null && (
        <ConfirmDialog
          title="Delete Knowledge Base?"
          message="All files inside this knowledge base will be permanently removed."
          confirmLabel="Delete"
          icon={<Trash2 size={24} className="text-red-400" />}
          onClose={() => setDeleteKbId(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
};

export default KnowledgeBasePage;
