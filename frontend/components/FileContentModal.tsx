import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { AttachedFileItem } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface FileContentModalProps {
  file: AttachedFileItem;
  onClose: () => void;
  lightMode: boolean;
}

const FileContentModal: React.FC<FileContentModalProps> = ({ file, onClose, lightMode }) => {
  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  useEffect(() => {
    if (!portalTarget) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, portalTarget]);

  if (!portalTarget) {
    return null;
  }

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${lightMode ? 'bg-white' : 'bg-slate-900'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${lightMode ? 'border-slate-200' : 'border-slate-700'}`}>
          <span className={`font-bold text-sm truncate ${lightMode ? 'text-slate-800' : 'text-white'}`}>
            {file.name}
          </span>
          <button
            onClick={onClose}
            className={`ml-4 p-1 rounded-lg transition-colors ${lightMode ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-slate-700 text-slate-400'}`}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 flex-1 mb-5">
          {file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm') ? (
            (() => {
              const blocker = `<style>a { pointer-events: none !important; cursor: default !important; color: inherit !important; } a[href] { text-decoration: none !important; }</style><` + `script>
                document.addEventListener('click', function(e) {
                  var a = e.target.closest ? e.target.closest('a') : null;
                  if (a) { e.preventDefault(); e.stopPropagation(); }
                }, true);
                document.addEventListener('submit', function(e) { e.preventDefault(); e.stopPropagation(); }, true);
              </script>`;
              const content = file.content
                .replace(/(<body[^>]*>)/i, `$1${blocker}`)
                .replace(/<\/body>/i, `</body>`);
              const hasHtmlTag = /<html[^>]*>/i.test(file.content);
              const srcDoc = hasHtmlTag
                ? content
                : `<!DOCTYPE html><html><head><meta charset="utf-8"></head>${content}</html>`;
              return (
                <iframe
                  srcDoc={srcDoc}
                  className="w-full h-full min-h-[60vh] rounded-lg border"
                  title={file.name}
                  sandbox="allow-scripts"
                />
              );
            })()
          ) : (
            <MarkdownRenderer content={file.content} lightMode={lightMode} compact={false} />
          )}
        </div>
      </div>
    </div>,
    portalTarget,
  );
};

export default FileContentModal;
