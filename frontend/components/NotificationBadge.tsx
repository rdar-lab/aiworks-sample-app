import React from 'react';

interface NotificationBadgeProps {
  count: number;
  className?: string;
  pulsing?: boolean;
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  className = '',
  pulsing = false,
}) => {
  if (count <= 0) {
    return null;
  }

  const displayCount = count > 9 ? '9+' : String(count);

  return (
    <span
      aria-label={`${count} unread notification${count !== 1 ? 's' : ''}`}
      className={`
        inline-flex items-center justify-center min-w-[18px] h-[18px] px-1
        text-[10px] font-bold rounded-full
        ${pulsing ? 'animate-pulse' : ''}
        bg-red-500 text-white
        ${className}
      `}
    >
      {displayCount}
    </span>
  );
};

export default NotificationBadge;
