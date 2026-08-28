import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Clock, RotateCcw, X } from 'lucide-react';
import { sessionAPI } from '../services/backendService';
import { useUI } from '../contexts/UIContext';
import { SessionSnapshot } from '../types';
import ConfirmDialog from './ConfirmDialog';

interface SnapshotHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  /** Called after a successful restore so the parent can reload the session. */
  onRestored: () => void;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const SnapshotHistoryPanel: React.FC<SnapshotHistoryPanelProps> = ({
  isOpen,
  onClose,
  sessionId,
  onRestored,
}) => {
  const { showError } = useUI();
  const [snapshots, setSnapshots] = useState<SessionSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const loadSnapshots = useCallback(async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const data = await sessionAPI.listSnapshots(sessionId);
      setSnapshots(data);
    } catch (err) {
      showError('Failed to load version history', err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, showError]);

  useEffect(() => {
    if (isOpen) {
      loadSnapshots();
    }
  }, [isOpen, loadSnapshots]);

  const handleConfirmRestore = async () => {
    if (!pendingRestoreId) return;
    setIsRestoring(true);
    try {
      await sessionAPI.restoreSnapshot(sessionId, pendingRestoreId);
      setPendingRestoreId(null);
      onClose();
      onRestored();
    } catch (err) {
      showError('Failed to restore version', err as Error);
    } finally {
      setIsRestoring(false);
    }
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <>
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm no-print"
        onClick={onClose}
      >
        <div
          className="bg-slate-900 border border-slate-800 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 max-w-lg w-full animate-slide-up shadow-2xl relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header close button */}
          <button
            data-analytics="close_snapshot_panel"
            data-testid="btn-close-snapshot-panel"
            onClick={onClose}
            className="absolute top-5 right-5 sm:top-7 sm:right-7 text-slate-500 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={22} />
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="p-3 rounded-2xl bg-sky-600/10">
              <Clock size={22} className="text-sky-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-tight">
              Versions
            </h2>
          </div>

          <p className="text-slate-400 text-sm mb-5 leading-relaxed">
            Each time the session completes successfully a version snapshot is saved.
            Select a version below to restore the session — including all its files — to
            that exact state.
          </p>

          {/* Snapshot list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : snapshots.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">
              No version snapshots available yet. Snapshots are created automatically after
              each successful run.
            </p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {snapshots.map((snap, idx) => (
                <li
                  key={snap.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-sky-600/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold truncate">
                      {snap.label || `Version ${snapshots.length - idx}`}
                    </p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {formatDate(snap.createdAt)}
                    </p>
                  </div>
                  <button
                    data-analytics="restore_snapshot"
                    data-testid={`btn-restore-snapshot-${snap.id}`}
                    onClick={() => setPendingRestoreId(snap.id)}
                    disabled={isRestoring}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600/15 text-sky-400 text-xs font-bold uppercase hover:bg-sky-600/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={`Restore version ${snapshots.length - idx}`}
                  >
                    <RotateCcw size={13} />
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Footer close button */}
          <button
            data-analytics="close_snapshot_panel_footer"
            data-testid="btn-close-snapshot-panel-footer"
            onClick={onClose}
            className="mt-5 w-full py-3 border border-slate-700 text-slate-400 rounded-xl font-bold uppercase hover:bg-slate-800 transition-all text-sm"
          >
            Close
          </button>
        </div>
      </div>

      {/* Confirm restore dialog */}
      {pendingRestoreId !== null && (
        <ConfirmDialog
          title="Restore This Version?"
          message="This will replace the current session state — including all its files — with the selected snapshot."
          confirmLabel={isRestoring ? 'Restoring…' : 'Restore'}
          confirmClassName="flex-1 py-3 sm:py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold uppercase shadow-xl transition-all"
          icon={<RotateCcw size={24} className="text-sky-400" />}
          onClose={() => { if (!isRestoring) setPendingRestoreId(null); }}
          onConfirm={handleConfirmRestore}
        />
      )}
    </>,
    document.body,
  );
};

export default SnapshotHistoryPanel;
