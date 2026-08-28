import React from 'react';
import ReactDOM from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Icon element to display. Defaults to AlertTriangle. */
  icon?: React.ReactNode;
  /** Tailwind classes for the confirm button. Defaults to red (destructive). */
  confirmClassName?: string;
  /** Tailwind classes for the cancel button. Defaults to border/slate style. */
  cancelClassName?: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

/**
 * Generic in-app confirmation dialog. Use this instead of window.confirm() everywhere.
 *
 * Usage:
 *   {pendingId !== null && (
 *     <ConfirmDialog
 *       title="Delete Item?"
 *       message="This action cannot be undone."
 *       icon={<Trash2 size={24} className="text-red-400" />}
 *       onClose={() => setPendingId(null)}
 *       onConfirm={confirmDelete}
 *     />
 *   )}
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  icon,
  confirmClassName = 'flex-1 py-3 sm:py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold uppercase shadow-xl transition-all',
  cancelClassName = 'flex-1 py-3 sm:py-4 border border-slate-700 text-slate-400 rounded-xl font-bold uppercase hover:bg-slate-800 transition-all',
  onClose,
  onConfirm,
}) => ReactDOM.createPortal(
  <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm no-print">
    <div className="bg-slate-900 border border-slate-800 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 max-w-md w-full animate-slide-up shadow-2xl relative">
      <button
        data-analytics="close_confirm_dialog"
        data-testid="btn-cancel-dialog"
        onClick={onClose}
        className="absolute top-6 right-6 sm:top-8 sm:right-8 text-slate-500 hover:text-white"
      >
        <X size={24} />
      </button>
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className="p-3 rounded-2xl bg-slate-800">
          {icon ?? <AlertTriangle size={24} className="text-amber-400" />}
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white uppercase">{title}</h2>
      </div>
      <p className="text-slate-400 font-semibold mb-6 sm:mb-8 leading-relaxed">{message}</p>
      <div className="flex gap-3">
        <button
          data-analytics="cancel_confirm_dialog"
          data-testid="btn-cancel-dialog"
          onClick={onClose}
          className={cancelClassName}
        >
          {cancelLabel}
        </button>
        <button
          data-analytics="confirm_action"
          data-testid="btn-confirm-dialog"
          onClick={onConfirm}
          className={confirmClassName}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>,
  document.body,
);

export default ConfirmDialog;
