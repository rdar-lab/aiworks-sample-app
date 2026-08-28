import React from 'react';
import ReactDOM from 'react-dom';
import { Share2, X } from 'lucide-react';

interface ShareConfirmModalProps {
  /** Dialog heading, e.g. "Share Session?" or "Share Report?" */
  title?: string;
  onClose: () => void;
  /**
   * Called when the user confirms. Responsible for calling makePublic, updating
   * public state, closing this modal, and opening the URL modal.
   * Any error thrown is the caller's responsibility to surface.
   */
  onConfirm: () => Promise<void>;
}

/**
 * Confirmation modal for the first step of the share flow.
 * Warns the user that sharing is irreversible, then calls onConfirm.
 */
const ShareConfirmModal: React.FC<ShareConfirmModalProps> = ({
  title = 'Share?',
  onClose,
  onConfirm,
}) => ReactDOM.createPortal(
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm no-print">
    <div className="bg-slate-900 border border-slate-800 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 max-w-md w-full animate-slide-up shadow-2xl relative">
      <button onClick={onClose} className="absolute top-6 right-6 sm:top-8 sm:right-8 text-slate-500 hover:text-white">
        <X size={24} />
      </button>
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className="p-3 rounded-2xl bg-blue-600/10"><Share2 size={24} className="text-blue-400" /></div>
        <h2 className="text-xl sm:text-2xl font-bold text-white uppercase">{title}</h2>
      </div>
      <p className="text-slate-400 font-semibold mb-2 leading-relaxed">
        Anyone with the link will be able to view this in read-only mode.
      </p>
      <div className="flex gap-3 pt-3">
        <button
          data-testid="btn-cancel-share"
          onClick={onClose}
          className="flex-1 py-3 sm:py-4 border border-slate-700 text-slate-400 rounded-xl font-bold uppercase hover:bg-slate-800 transition-all"
        >
          Cancel
        </button>
        <button
          data-testid="btn-confirm-share"
          onClick={onConfirm}
          className="flex-1 py-3 sm:py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase shadow-xl transition-all"
        >
          Yes, Share It
        </button>
      </div>
    </div>
  </div>,
  document.body,
);

export default ShareConfirmModal;
