import React from 'react';

interface ProBadgeProps {
  className?: string;
}

const GemIcon = ({ size = 10 }: { size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    style={{ display: 'inline-block', filter: 'drop-shadow(0 1px 3px rgba(168,85,247,0.6))' }}
  >
    <defs>
      <linearGradient id="pb-tl" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F3E8FF" />
        <stop offset="100%" stopColor="#C084FC" />
      </linearGradient>
      <linearGradient id="pb-bl" x1="0%" y1="0%" x2="40%" y2="100%">
        <stop offset="0%" stopColor="#A855F7" />
        <stop offset="100%" stopColor="#581C87" />
      </linearGradient>
      <linearGradient id="pb-br" x1="100%" y1="0%" x2="60%" y2="100%">
        <stop offset="0%" stopColor="#9333EA" />
        <stop offset="100%" stopColor="#3B0764" />
      </linearGradient>
    </defs>
    <polygon points="12,1.5 4,8.5 10,8.5" fill="url(#pb-tl)" />
    <polygon points="12,1.5 10,8.5 14,8.5" fill="#E9D5FF" />
    <polygon points="12,1.5 14,8.5 20,8.5" fill="#C084FC" />
    <polygon points="4,8.5 10,8.5 12,22.5" fill="url(#pb-bl)" />
    <polygon points="10,8.5 14,8.5 12,22.5" fill="#7E22CE" />
    <polygon points="14,8.5 20,8.5 12,22.5" fill="url(#pb-br)" />
    <polygon points="8.5,3 12,1.5 15.5,3 12,6" fill="white" opacity="0.65" />
  </svg>
);

const ProBadge: React.FC<ProBadgeProps> = ({ className = '' }) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border text-purple-300 ${className}`}
      style={{
        background: 'linear-gradient(135deg, rgba(243,232,255,0.12) 0%, rgba(168,85,247,0.18) 100%)',
        borderColor: 'rgba(168,85,247,0.4)',
        boxShadow: '0 0 8px rgba(168,85,247,0.18), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      PRO <GemIcon size={10} />
    </span>
  );
};

export default ProBadge;
