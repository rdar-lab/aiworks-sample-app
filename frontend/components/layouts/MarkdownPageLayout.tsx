import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';
import MarkdownRenderer from '../MarkdownRenderer';

interface MarkdownPageLayoutProps {
  /** The label shown in the header breadcrumb */
  title: string;
  /** Path to the markdown file to fetch and render, e.g. "/eula.md" */
  mdFile: string;
}

const MarkdownPageLayout: React.FC<MarkdownPageLayoutProps> = ({ title, mdFile }) => {
  const { lightMode } = useUI();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setContent('');
    fetch(mdFile)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load document.');
        return res.text();
      })
      .then((text) => setContent(text))
      .catch(() => setError('Failed to load document. Please try again later.'))
      .finally(() => setLoading(false));
  }, [mdFile]);

  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 ${lightMode ? 'bg-slate-50 text-slate-900' : 'bg-[#020617] text-white'}`}>
      {/* Header */}
      <div className={`border-b backdrop-blur-xl sticky top-0 z-10 transition-colors duration-500 ${lightMode ? 'bg-white/80 border-slate-200' : 'bg-slate-900/40 border-white/5'}`}>
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/login" className={`flex items-center gap-2 transition-colors ${lightMode ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}>
            <span className="text-sm font-semibold">AIWorks</span>
          </Link>
          <span className={lightMode ? 'text-slate-400' : 'text-slate-600'}>/</span>
          <span className={`text-sm ${lightMode ? 'text-slate-700' : 'text-slate-300'}`}>{title}</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-10 pb-20">
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 size={36} className="text-blue-500 animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center py-20 text-red-400">{error}</div>
        )}

        {!loading && !error && (
          <article>
            <MarkdownRenderer content={content} lightMode={lightMode} variant="page" />
          </article>
        )}
      </div>

      {/* Footer */}
      <div className={`border-t py-6 text-center text-xs transition-colors duration-500 ${lightMode ? 'border-slate-200 text-slate-500' : 'border-white/5 text-slate-600'}`}>
        <p>
          <Link to="/manual" className={`transition-colors ${lightMode ? 'hover:text-slate-700' : 'hover:text-slate-400'}`}>User Manual</Link>
          {' · '}
          <Link to="/eula" className={`transition-colors ${lightMode ? 'hover:text-slate-700' : 'hover:text-slate-400'}`}>License Agreement</Link>
          {' · '}
          <Link to="/privacy" className={`transition-colors ${lightMode ? 'hover:text-slate-700' : 'hover:text-slate-400'}`}>Privacy Policy</Link>
          {' · '}
          <a href="mailto:AiWorks@proton.me" className={`transition-colors ${lightMode ? 'hover:text-slate-700' : 'hover:text-slate-400'}`}>AiWorks@proton.me</a>
        </p>
      </div>
    </div>
  );
};

export default MarkdownPageLayout;

