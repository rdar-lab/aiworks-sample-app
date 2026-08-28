import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

interface ImageViewerProps {
  src: string;
  filename: string;
  onClose: () => void;
  lightMode: boolean;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ src, filename, onClose, lightMode }) => {
  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  useEffect(() => {
    if (!portalTarget) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, portalTarget]);

  if (!portalTarget) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${lightMode ? 'bg-white' : 'bg-slate-900'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between px-6 py-4 border-b ${lightMode ? 'border-slate-200' : 'border-slate-700'}`}>
          <span className={`font-bold text-sm truncate ${lightMode ? 'text-slate-800' : 'text-white'}`}>
            {filename}
          </span>
          <button
            onClick={onClose}
            className={`ml-4 p-1 rounded-lg transition-colors ${lightMode ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-slate-700 text-slate-400'}`}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-hidden p-4 flex items-center justify-center bg-slate-800">
          <img
            src={src}
            alt={filename}
            className="max-w-full max-h-[80vh] object-contain rounded-lg"
          />
        </div>
      </div>
    </div>,
    portalTarget,
  );
};

export default ImageViewer;
