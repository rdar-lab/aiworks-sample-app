import React from 'react';
import ReactDOM from 'react-dom';
import { Printer } from 'lucide-react';

interface PrintPreviewModalProps {
  /** Sets the browser document title during printing (e.g. for PDF file names). */
  documentTitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Full-screen white print preview portal.
 *
 * Renders into document.body via a React portal so it overlays everything
 * (including other modals). The caller provides the formatted printable
 * content as children. Print / Save PDF triggers window.print() after
 * temporarily setting the document title and marking the body with
 * `print-preview-open` so global no-print CSS rules still apply.
 */
const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  documentTitle,
  onClose,
  children,
}) => {
  const handlePrint = () => {
    const originalTitle = document.title;
    if (documentTitle) {
      document.title = `AiWorks - ${documentTitle}`;
    }
    document.body.classList.add('print-preview-open');
    try {
      window.focus();
      window.print();
    } finally {
      document.body.classList.remove('print-preview-open');
      document.title = originalTitle;
    }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[300] bg-white text-slate-900 overflow-y-auto" id="print-preview">
      <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between gap-4 shadow-sm">
        <h2 className="text-sm sm:text-xl font-bold text-slate-800 truncate">Print Preview</h2>
        <div className="flex gap-2 sm:gap-4 shrink-0">
          <button
            onClick={onClose}
            className="px-3 sm:px-8 py-2 sm:py-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-3 sm:px-8 py-2 sm:py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>
      {children}
    </div>,
    document.body,
  );
};

export default PrintPreviewModal;
