import React from 'react';
import ReactDOM from 'react-dom';
import { Link, X } from 'lucide-react';

interface UnshareConfirmModalProps {
    /** Dialog heading, e.g. "Stop Sharing?" or "Make Private?" */
    title?: string;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

const UnshareConfirmModal: React.FC<UnshareConfirmModalProps> = ({
    title = 'Stop Sharing?',
    onClose,
    onConfirm,
}) => ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm no-print">
        <div className="bg-slate-900 border border-slate-800 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 max-w-md w-full animate-slide-up shadow-2xl relative">
            <button data-analytics="close_unshare_modal" onClick={onClose} className="absolute top-6 right-6 sm:top-8 sm:right-8 text-slate-500 hover:text-white">
                <X size={24} />
            </button>
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="p-3 rounded-2xl bg-amber-600/10"><Link size={24} className="text-amber-400" /></div>
                <h2 className="text-xl sm:text-2xl font-bold text-white uppercase">{title}</h2>
            </div>
            <p className="text-slate-400 font-semibold mb-2 leading-relaxed">
                The link will stop working. Anyone with the old link will no longer have access.
            </p>
            <div className="flex gap-3">
                <button
                    data-analytics="cancel_unshare"
                    onClick={onClose}
                    className="flex-1 py-3 sm:py-4 border border-slate-700 text-slate-400 rounded-xl font-bold uppercase hover:bg-slate-800 transition-all"
                >
                    Cancel
                </button>
                <button
                    data-analytics="confirm_unshare"
                    onClick={onConfirm}
                    className="flex-1 py-3 sm:py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold uppercase shadow-xl transition-all"
                >
                    Yes, Stop Sharing
                </button>
            </div>
        </div>
    </div>,
    document.body,
);

export default UnshareConfirmModal;