import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Check, Link, X } from 'lucide-react';

interface ShareUrlModalProps {
  url: string;
  onClose: () => void;
  onUnshare?: () => void;
  isOwner?: boolean;
}

/**
 * Modal that displays a public share URL with a one-click copy button.
 * Shown after the user has confirmed sharing (or when the session is already public).
 */
const ShareUrlModal: React.FC<ShareUrlModalProps> = ({ url, onClose, onUnshare, isOwner }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm no-print" data-testid="share-url-modal">
      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 max-w-lg w-full animate-slide-up shadow-2xl relative">
        <button data-analytics="close_share_modal" data-testid="btn-close-share-modal" onClick={onClose} className="absolute top-6 right-6 sm:top-8 sm:right-8 text-slate-500 hover:text-white">
          <X size={24} />
        </button>
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <div className="p-3 rounded-2xl bg-blue-600/10"><Link size={24} className="text-blue-400" /></div>
          <h2 className="text-xl sm:text-2xl font-bold text-white uppercase">Share Link</h2>
        </div>
        <p className="text-slate-400 font-semibold mb-4 leading-relaxed">
          Anyone with this link can view this in read-only mode.
        </p>
        <div className="flex gap-2 items-stretch">
          <input
            readOnly
            value={url}
            onFocus={e => e.target.select()}
            className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-300 text-sm font-mono outline-none select-all"
          />
          <button
            data-analytics="copy_share_url"
            data-testid="btn-copy-share-url"
            onClick={handleCopy}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all flex items-center gap-2 shrink-0"
          >
            {copied ? <Check size={18} /> : <Link size={18} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isOwner && onUnshare && (
          <button
            data-analytics="unshare_from_share_modal"
            data-testid="btn-unshare"
            onClick={onUnshare}
            className="mt-4 w-full px-4 py-2 border border-amber-600/50 text-amber-400 hover:bg-amber-600/10 rounded-xl font-semibold transition-all text-sm"
          >
            Unshare
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default ShareUrlModal;
