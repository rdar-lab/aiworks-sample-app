import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2 } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;

interface PdfViewerProps {
  url: string;
  title?: string;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ url }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const pageNumRef = useRef(1);

  const renderPage = async (pdf: pdfjsLib.PDFDocumentProxy, num: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const page = await pdf.getPage(num);
    const viewport = page.getViewport({ scale: 1.5 });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    return true;
  };

  useEffect(() => {
    if (!url) return;

    let isStale = false;

    const loadPdf = async () => {
      setLoading(true);
      setError(null);

      try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        if (isStale) { pdf.destroy(); return; }

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);

        const canvas = canvasRef.current;
        if (!canvas) {
          console.warn('[PdfViewer] canvas not ready, scheduling retry');
          setTimeout(() => {
            if (isStale) return;
            if (pdfDocRef.current) {
              renderPage(pdf, 1).then(ok => {
                if (ok) {
                  pageNumRef.current = 1;
                  setPageNum(1);
                }
                setLoading(false);
              }).catch(() => {
                setError('Preview is not available');
                setLoading(false);
              });
            }
          }, 100);
          return;
        }

        const page = await pdf.getPage(1);
        if (isStale) { pdf.destroy(); return; }

        await renderPage(pdf, 1);
        if (isStale) return;

        pageNumRef.current = 1;
        setPageNum(1);
        setLoading(false);
      } catch (err) {
        console.error('[PdfViewer]', err);
        if (!isStale) {
          setError('Failed to load PDF');
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isStale = true;
      pdfDocRef.current?.destroy();
      pdfDocRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    const pdf = pdfDocRef.current;
    if (!pdf || loading) return;
    const targetPage = pageNum;

    const render = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const page = await pdf.getPage(targetPage);
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      } catch (err) {
        console.error('[PdfViewer] render error', err);
      }
    };
    render();
  }, [pageNum, loading]);

  const goPrev = () => setPageNum(p => Math.max(1, p - 1));
  const goNext = () => setPageNum(p => Math.min(numPages, p + 1));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-10 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas ref={canvasRef} className="border border-slate-700 rounded" />
      {numPages > 1 && (
        <div className="flex items-center gap-4 py-2">
          <button
            onClick={goPrev}
            disabled={pageNum <= 1}
            className="px-3 py-1.5 rounded-lg border border-slate-600 text-sm font-semibold disabled:opacity-30 hover:bg-slate-700 transition-colors"
          >
            ‹ Prev
          </button>
          <span className="text-sm text-slate-400">
            {pageNum} / {numPages}
          </span>
          <button
            onClick={goNext}
            disabled={pageNum >= numPages}
            className="px-3 py-1.5 rounded-lg border border-slate-600 text-sm font-semibold disabled:opacity-30 hover:bg-slate-700 transition-colors"
          >
            Next ›
          </button>
        </div>
      )}
    </div>
  );
};

export default PdfViewer;