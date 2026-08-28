import React, { useRef, useState, useEffect } from 'react';
import { LucideIcon, ChevronDown, Loader2 } from 'lucide-react';
import ProLockBadge from './ProLockBadge';

export interface DropdownItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void | Promise<void>;
  iconColor?: 'red' | 'blue' | 'slate' | 'orange' | 'violet' | 'green';
  'data-analytics'?: string;
  'data-testid'?: string;
  isProGated?: boolean;
  isPro?: boolean;
}

interface ActionButtonProps {
  variant: 'primary' | 'secondary';
  isProGated?: boolean;
  icon: LucideIcon;
  label: string;
  sublabel?: string;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  isPro?: boolean;
  lightMode?: boolean;
  'data-analytics'?: string;
  'data-testid'?: string;
  className?: string;
  accentColor?: 'blue' | 'purple' | 'amber' | 'violet' | 'green';
  iconClassName?: string;
  dropdownItems?: DropdownItem[];
  dropdownDirection?: 'up' | 'down';
  loading?: boolean;
  minWidth?: number;
  maxWidth?: number;
  layout?: 'card' | 'action';
}

const ActionButton: React.FC<ActionButtonProps> = ({
  variant,
  isProGated = false,
  icon: Icon,
  label,
  sublabel,
  onClick,
  disabled = false,
  isPro = false,
  lightMode = false,
  'data-analytics': dataAnalytics,
  'data-testid': dataTestid,
  className = '',
  accentColor = 'blue',
  iconClassName = '',
  dropdownItems,
  dropdownDirection = 'up',
  loading: externalLoading = false,
  minWidth = 200,
  maxWidth = 200,
  layout = 'action',
}) => {
  const isDisabled = disabled || (isProGated && !isPro);
  const [isLoading, setIsLoading] = useState(false);
  const isLoadingFinal = isLoading || externalLoading;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const getIconColor = (color?: 'red' | 'blue' | 'slate' | 'orange' | 'violet' | 'green') => {
    if (!color) return '';
    const colors = {
      red: 'text-red-500',
      blue: 'text-blue-600',
      slate: 'text-slate-500',
      orange: 'text-orange-400',
      violet: 'text-violet-500',
      green: 'text-green-500',
    };
    return colors[color];
  };

  const handleClick = async () => {
    if (dropdownItems && dropdownItems.length > 0) {
      setIsDropdownOpen(v => !v);
    } else if (onClick) {
      setIsLoading(true);
      try {
        const result = onClick();
        if (result && typeof result.then === 'function') {
          await result;
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleDropdownItemClick = async (item: DropdownItem) => {
    setIsDropdownOpen(false);
    setIsLoading(true);
    try {
      const result = item.onClick();
      if (result && typeof result.then === 'function') {
        await result;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getPrimaryClasses = () => {
    const widthClass = layout === 'card' ? ('w-full h-full') : (`min-w-[${minWidth}px] flex-1` + (maxWidth === 0 ? 'w-full' : `max-w-[${maxWidth}px]`));
    const shadowMap: Record<string, string> = {
      blue: 'shadow-blue-600/20',
      purple: 'shadow-purple-600/20',
      amber: 'shadow-amber-600/20',
      violet: 'shadow-violet-600/20',
      green: 'shadow-green-600/20',
    };
    const shadowClass = shadowMap[accentColor] || shadowMap.blue;
    const base = `${widthClass} ${layout === 'card' ? 'px-6 py-4 sm:py-5 rounded-2xl sm:rounded-[1.5rem]' : 'py-6 sm:py-6 rounded-[2rem] sm:rounded-[2.5rem]'} font-bold text-base sm:text-lg flex items-center text-left ${layout === 'card' ? 'justify-between' : 'justify-center'} gap-3 shadow-xl ${shadowClass} transition-all active:scale-95 uppercase`;
    
    const colors = {
      blue: {
        enabled: 'bg-blue-600 hover:bg-blue-500 text-white',
        disabled: 'bg-blue-600/50 text-white/20',
        icon: 'text-white',
      },
      purple: {
        enabled: 'bg-purple-600 hover:bg-purple-500 text-white',
        disabled: 'bg-purple-600/50 text-white/70',
        icon: 'text-white',
      },
      green: {
        enabled: 'bg-green-600 hover:bg-green-500 text-white',
        disabled: 'bg-green-600/50 text-white/20',
        icon: 'text-white',
      },
      amber: {
        enabled: lightMode ? 'bg-amber-500 hover:bg-amber-400 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white',
        disabled: lightMode ? 'bg-amber-100 text-amber-700/20' : 'bg-amber-600/50 text-white/20',
        icon: lightMode ? 'text-amber-500' : 'text-white',
      },
      violet: {
        enabled: lightMode ? 'bg-violet-600 hover:bg-violet-500 text-white' : 'bg-violet-600 hover:bg-violet-500 text-white',
        disabled: lightMode ? 'bg-violet-100 text-violet-700/20' : 'bg-violet-600/50 text-white/20',
        icon: lightMode ? 'text-violet-500' : 'text-white',
      },
    };

    const c = colors[accentColor] || colors.blue;
    return `${base} ${(isDisabled || isLoadingFinal) ? ('cursor-not-allowed ' + c.disabled) : c.enabled}`;
  };

  const getIconClass = () => {
    if (iconClassName) return `shrink-0 ${iconClassName}`;
    if (variant === 'primary') {
      return 'shrink-0 text-white';
    }
    return `shrink-0 ${lightMode ? 'text-blue-600' : 'text-slate-300'}`;
  };

  const renderButtonContent = () => (
    <div className="flex items-center gap-3 shrink">
      {isLoadingFinal ? (
        <Loader2 size={20} className={`animate-spin ${getIconClass()}`} />
      ) : (
        <Icon size={20} className={getIconClass()} />
      )}
      <div className="flex flex-col items-start gap-0.5 min-w-0">
        <span>{isLoadingFinal ? 'Loading...' : label}</span>
        {sublabel && <span className="text-[10px] font-medium opacity-70 normal-case uppercase tracking-wide break-word">{sublabel}</span>}
      </div>
      {dropdownItems && !isDisabled && <ChevronDown size={16} />}
    </div>
  );

  const getSecondaryClasses = () => {
    const widthClass = layout === 'card' ? ('w-full h-full') : (`min-w-[${minWidth}px] flex-1` + (maxWidth === 0 ? 'w-full' : `max-w-[${maxWidth}px]`));
    const base = `${widthClass} ${layout === 'card' ? 'px-6 py-4 sm:py-5 rounded-2xl sm:rounded-[1.5rem]' : 'py-6 sm:py-6 rounded-[2rem] sm:rounded-[2.5rem]'} font-bold text-base sm:text-lg flex items-center text-left ${layout === 'card' ? 'justify-between' : 'justify-center'} gap-3 shadow-xl transition-all active:scale-95 uppercase`;

    const hoverBorderMap: Record<string, string> = {
      blue: lightMode ? 'hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700' : 'hover:bg-slate-700 hover:text-white hover:border-slate-700',
      purple: lightMode ? 'hover:border-purple-400 hover:bg-purple-50 hover:text-purple-700' : 'hover:bg-slate-700 hover:text-white hover:border-slate-700',
      violet: lightMode ? 'hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700' : 'hover:bg-slate-700 hover:text-white hover:border-slate-700',
      amber: lightMode ? 'hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700' : 'hover:bg-slate-700 hover:text-white hover:border-slate-700',
      green: lightMode ? 'hover:border-green-400 hover:bg-green-50 hover:text-green-700' : 'hover:bg-slate-700 hover:text-white hover:border-slate-700',
    };

    if (isDisabled || isLoadingFinal) {
      return `${base} opacity-60 cursor-not-allowed ${lightMode ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-300'}`;
    }
    return `${base} ${lightMode ? `bg-slate-50 border-slate-200 text-slate-700 ${hoverBorderMap[accentColor]}` : `bg-slate-900 border-slate-800 text-slate-300 ${hoverBorderMap[accentColor]}`}`;
  };

  const renderDropdown = () => (
    isDropdownOpen && dropdownItems && (
      <div className={`absolute ${dropdownDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 right-0 rounded-2xl border shadow-2xl overflow-hidden z-[300] ${
        lightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'
      }`}>
        {dropdownItems.map((item, index) => {
          const itemIsProGated = item.isProGated && !item.isPro;
          return (
            <button
              key={index}
              data-analytics={item['data-analytics'] || `${dataAnalytics}_${item.label.toLowerCase().replace(/\s+/g, '_')}`}
              data-testid={item['data-testid']}
              disabled={itemIsProGated}
              className={`w-full px-5 py-4 flex items-center gap-3 text-sm font-semibold transition-colors border-t ${
                index === 0 ? 'border-t-0' : ''
              } ${
                itemIsProGated
                  ? `${lightMode ? 'opacity-50 cursor-not-allowed text-slate-400 border-slate-100' : 'opacity-50 cursor-not-allowed text-slate-500 border-slate-800'}`
                  : `${lightMode ? 'hover:bg-slate-100 text-slate-700 border-slate-100' : 'hover:bg-slate-800 text-slate-200 border-slate-800'}`
              }`}
              onClick={() => !itemIsProGated && handleDropdownItemClick(item)}
            >
              <item.icon size={18} className={`shrink-0 ${getIconColor(item.iconColor)}`} />
              {item.label}
              {!isLoadingFinal && itemIsProGated && <ProLockBadge />}
            </button>
          );
        })}
      </div>
    )
  );

  if (variant === 'primary') {
    return (
      <div className={`relative flex items-center gap-2 ${dropdownItems ? 'z-[200]' : ''}`} ref={dropdownRef}>
        <button
          data-analytics={dataAnalytics}
          data-testid={dataTestid}
          onClick={isDisabled ? undefined : handleClick}
          disabled={isDisabled || isLoadingFinal}
          className={`${getPrimaryClasses()} ${className}`}
        >
          {renderButtonContent()}
          {!isLoadingFinal && isProGated && !isPro && <ProLockBadge />}
        </button>
        {renderDropdown()}
      </div>
    );
  }

  return (
    <div className={`relative flex items-center gap-2 ${dropdownItems ? 'z-[200]' : ''}`} ref={dropdownRef}>
      <button
        data-analytics={dataAnalytics}
        data-testid={dataTestid}
        onClick={isDisabled ? undefined : handleClick}
        disabled={isDisabled || isLoadingFinal}
        className={`${getSecondaryClasses()} ${className}`}
      >
        {renderButtonContent()}
        {!isLoadingFinal && isProGated && !isPro && <ProLockBadge />}
      </button>
      {renderDropdown()}
    </div>
  );
};

export default ActionButton;
