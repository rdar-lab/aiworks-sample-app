import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Settings, X } from 'lucide-react';
import { Notification } from '../types';
import { notificationsAPI } from '../services/backendService';
import NotificationBadge from './NotificationBadge';

interface NotificationPanelProps {
  lightMode?: boolean;
  onClose?: () => void;
  onNavigateToPreferences?: () => void;
  onUnreadCountChange?: (count: number) => void;
}

const notificationTypeIcons: Record<string, React.ReactNode> = {
  research_complete: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  default: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
};

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  lightMode = false,
  onClose,
  onNavigateToPreferences,
  onUnreadCountChange,
}) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await notificationsAPI.list({ limit: 20 });
      setNotifications(response.data);
      const unread = response.data.filter(
        (n) => n.status !== 'read' && n.status !== 'dismissed'
      ).length;
      setUnreadCount(unread);
      onUnreadCountChange?.(unread);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationsAPI.updateStatus(notificationId, 'read');
      await loadNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleDismiss = async (notificationId: string) => {
    try {
      await notificationsAPI.updateStatus(notificationId, 'dismissed');
      await loadNotifications();
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    const { ctaAction, ctaParams, id } = notification;
    if (!ctaAction) return;

    const sessionId = ctaParams?.session_id as string | undefined;

    if (ctaAction === 'view_report' && sessionId) {
      navigate(`/research/${sessionId}`);
      handleMarkAsRead(id);
      onClose?.();
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d`;
    if (diffHours > 0) return `${diffHours}h`;
    return 'Just now';
  };

  const visibleNotifications = notifications.filter(
    (n) => n.status !== 'dismissed'
  );

  return (
    <div
      ref={panelRef}
      className={`
        absolute top-full left-1/2 -translate-x-1/2 sm:right-0 sm:left-auto sm:-translate-x-0 mt-2 w-[85vw] max-w-[320px] sm:w-80 max-h-96 overflow-hidden
        border rounded-2xl shadow-2xl z-50
        ${lightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}
      `}
    >
      <div className={`flex items-center justify-between px-4 py-3 border-b ${
        lightMode ? 'border-slate-200' : 'border-slate-800'
      }`}>
        <div className="flex items-center gap-2">
          <Bell size={16} className={lightMode ? 'text-slate-600' : 'text-slate-400'} />
          <span className={`font-semibold text-sm ${lightMode ? 'text-slate-900' : 'text-white'}`}>
            Notifications
          </span>
          {unreadCount > 0 && <NotificationBadge count={unreadCount} />}
        </div>
        <div className="flex items-center gap-1">
          {onNavigateToPreferences && (
            <button
              data-analytics="notification_settings"
              onClick={onNavigateToPreferences}
              className={`p-1.5 rounded-lg transition-colors ${
                lightMode
                  ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
              title="Notification settings"
            >
              <Settings size={14} />
            </button>
          )}
          {onClose && (
            <button
              data-analytics="close_notification_panel"
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${
                lightMode
                  ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-y-auto max-h-80">
        {isLoading ? (
          <div className={`flex items-center justify-center py-8 ${
            lightMode ? 'text-slate-500' : 'text-slate-400'
          }`}>
            Loading...
          </div>
        ) : visibleNotifications.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-8 ${
            lightMode ? 'text-slate-500' : 'text-slate-400'
          }`}>
            <Bell size={24} className="mb-2 opacity-50" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <div className={`divide-y ${lightMode ? 'divide-slate-100' : 'divide-slate-800'}`}>
            {visibleNotifications.map((notification) => {
              const isUnread = notification.status !== 'read';
              const Icon = notificationTypeIcons[notification.type] || notificationTypeIcons.default;

              return (
                <div
                  key={notification.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNotificationClick(notification)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleNotificationClick(notification); }}
                  className={`
                    w-full text-left px-4 py-3 transition-colors cursor-pointer select-none
                    ${isUnread ? (lightMode ? 'bg-blue-50' : 'bg-blue-900/10') : ''}
                    ${lightMode ? 'hover:bg-slate-50' : 'hover:bg-slate-800/50'}
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 mt-0.5 pointer-events-none ${
                      lightMode ? 'text-blue-600' : 'text-blue-400'
                    }`}>
                      {Icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className={`text-sm font-medium truncate ${
                          isUnread
                            ? (lightMode ? 'text-slate-900' : 'text-white')
                            : (lightMode ? 'text-slate-700' : 'text-slate-300')
                        }`}>
                          {notification.title}
                        </p>
                        <span className={`text-[10px] shrink-0 ${
                          lightMode ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          {formatRelativeTime(notification.createdAt)}
                        </span>
                      </div>
                      {notification.body && (
                        <p className={`text-xs leading-relaxed mb-2 line-clamp-2 ${
                          lightMode ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                          {notification.body}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        {isUnread && (
                          <button
                            data-analytics="mark_notification_read"
                            onClick={(e) => { e.stopPropagation(); handleMarkAsRead(notification.id); }}
                            className={`text-xs font-medium px-2 py-1 rounded-lg transition-colors ${
                              lightMode
                                ? 'text-blue-600 hover:bg-blue-50'
                                : 'text-blue-400 hover:bg-blue-900/30'
                            }`}
                          >
                            Mark read
                          </button>
                        )}
                        <button
                          data-analytics="dismiss_notification"
                          onClick={(e) => { e.stopPropagation(); handleDismiss(notification.id); }}
                          className={`text-xs font-medium px-2 py-1 rounded-lg transition-colors ${
                            lightMode
                              ? 'text-slate-500 hover:bg-slate-100'
                              : 'text-slate-500 hover:bg-slate-700'
                          }`}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;
