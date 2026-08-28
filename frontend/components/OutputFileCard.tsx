import React from 'react';
import { FileText } from 'lucide-react';
import { AttachedFileItem } from '../types';

interface OutputFileCardProps {
  file: AttachedFileItem;
  onClick: () => void;
  lightMode: boolean;
}

const OutputFileCard: React.FC<OutputFileCardProps> = ({ file, onClick, lightMode }) => {
  return (
    <button
      onClick={onClick}
      className={`truncate flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all max-w-xs
        ${lightMode
          ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'
          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-blue-900/30 hover:border-blue-500 hover:text-blue-300'
        }`}
    >
      <FileText size={15} className="shrink-0 text-blue-400" />
      <span className="truncate" title={file.name}>{file.name}</span>
    </button>
  );
};

export default OutputFileCard;
