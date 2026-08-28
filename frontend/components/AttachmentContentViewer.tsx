import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Loader2 } from 'lucide-react';
import { AttachedFileItem } from '../types';
import { sessionAttachmentAPI } from '../services/backendService';
import FileContentModal from './FileContentModal';
import ImageViewer from './ImageViewer';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];

function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext));
}

interface AttachmentContentViewerProps {
  file: AttachedFileItem;
  sessionId: string;
  onClose: () => void;
  lightMode: boolean;
}

const AttachmentContentViewer: React.FC<AttachmentContentViewerProps> = ({
  file,
  sessionId,
  onClose,
  lightMode,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string | Blob | null>(null);

  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);

    if (isImageFile(file.name)) {
      sessionAttachmentAPI.getBlob(sessionId, file.name)
        .then(blob => {
          if (!cancelled) {
            setContent(blob);
            setLoading(false);
          }
        })
        .catch(err => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Failed to load file content');
            setLoading(false);
          }
        });
    } else {
      sessionAttachmentAPI.get(sessionId, file.name)
        .then(response => {
          if (!cancelled) {
            setContent(response.content);
            setLoading(false);
          }
        })
        .catch(err => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Failed to load file content');
            setLoading(false);
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [sessionId, file.name]);

  const renderLoading = () => (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
    >
      <div className={`p-8 rounded-2xl shadow-2xl ${lightMode ? 'bg-white' : 'bg-slate-900'}`}>
        <Loader2 size={32} className="text-blue-500 animate-spin mx-auto" />
        <p className={`mt-3 text-sm ${lightMode ? 'text-slate-600' : 'text-slate-400'}`}>Loading...</p>
      </div>
    </div>
  );

  const renderError = () => (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
    >
      <div className={`p-8 rounded-2xl shadow-2xl ${lightMode ? 'bg-white' : 'bg-slate-900'}`}>
        <p className="text-red-500 text-center">{error}</p>
        <button
          onClick={onClose}
          className={`mt-4 px-4 py-2 rounded-lg text-sm ${lightMode ? 'bg-slate-100 hover:bg-slate-200' : 'bg-slate-700 hover:bg-slate-600'}`}
        >
          Close
        </button>
      </div>
    </div>
  );

  if (!portalTarget) {
    return null;
  }

  return ReactDOM.createPortal(
    <>
      {loading && renderLoading()}
      {error && renderError()}
      {!loading && !error && content && (
        isImageFile(file.name) ? (
          <ImageViewer
            src={URL.createObjectURL(content as Blob)}
            filename={file.name}
            onClose={onClose}
            lightMode={lightMode}
          />
        ) : (
          <FileContentModal
            file={{ ...file, content: content as string }}
            onClose={onClose}
            lightMode={lightMode}
          />
        )
      )}
    </>,
    portalTarget
  );
};

export default AttachmentContentViewer;