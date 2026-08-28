import React from 'react';

interface ProLockBadgeProps {
  className?: string;
  size?: number;
}

const GemIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    style={{ display: 'inline-block', filter: 'drop-shadow(0 1px 4px rgba(168,85,247,0.65))' }}
  >
    <defs>
      <linearGradient id="plb-tl" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F3E8FF" />
        <stop offset="100%" stopColor="#C084FC" />
      </linearGradient>
      <linearGradient id="plb-bl" x1="0%" y1="0%" x2="40%" y2="100%">
        <stop offset="0%" stopColor="#A855F7" />
        <stop offset="100%" stopColor="#581C87" />
      </linearGradient>
      <linearGradient id="plb-br" x1="100%" y1="0%" x2="60%" y2="100%">
        <stop offset="0%" stopColor="#9333EA" />
        <stop offset="100%" stopColor="#3B0764" />
      </linearGradient>
    </defs>
    {/* Crown faces */}
    <polygon points="12,1.5 4,8.5 10,8.5" fill="url(#plb-tl)" />
    <polygon points="12,1.5 10,8.5 14,8.5" fill="#E9D5FF" />
    <polygon points="12,1.5 14,8.5 20,8.5" fill="#C084FC" />
    {/* Pavilion faces */}
    <polygon points="4,8.5 10,8.5 12,22.5" fill="url(#plb-bl)" />
    <polygon points="10,8.5 14,8.5 12,22.5" fill="#7E22CE" />
    <polygon points="14,8.5 20,8.5 12,22.5" fill="url(#plb-br)" />
    {/* Shine highlight */}
    <polygon points="8.5,3 12,1.5 15.5,3 12,6" fill="white" opacity="0.65" />
  </svg>
);

const ProLockBadge: React.FC<ProLockBadgeProps> = ({ className = '', size = 14 }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    window.open('/#pricing', '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid="pro-lock-badge"
      className={`inline-flex items-center gap-1 group/pro-lock relative cursor-pointer ${className}`}
      title="This feature requires a Pro account. Click to learn more."
      aria-label="Pro feature — click to learn more"
    >
      <GemIcon size={size} />
    </button>
  );
};

export default ProLockBadge;
