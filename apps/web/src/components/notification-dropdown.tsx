'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell, CheckCheck, X, BookOpen, MessageSquare,
  Clock, CheckCircle, XCircle, Star, UserPlus,
  CreditCard, AlertTriangle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationType =
  | 'approval_needed'
  | 'approved'
  | 'rejected'
  | 'homework'
  | 'communication'
  | 'milestone'
  | 'admission'
  | 'payment'
  | 'system'
  | 'alert';

interface ActivityNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  created_at: string;
}

interface Props {
  userId: string | null;
  userRole: 'teacher' | 'student' | 'admin' | 'parent';
  className?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<NotificationType, { icon: React.ReactNode; color: string; bg: string }> = {
  approval_needed: {
    icon: <Clock size={13} />,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/30',
  },
  approved: {
    icon: <CheckCircle size={13} />,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/30',
  },
  rejected: {
    icon: <XCircle size={13} />,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/30',
  },
  homework: {
    icon: <BookOpen size={13} />,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/30',
  },
  communication: {
    icon: <MessageSquare size={13} />,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-900/30',
  },
  milestone: {
    icon: <Star size={13} />,
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-900/30',
  },
  admission: {
    icon: <UserPlus size={13} />,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-900/30',
  },
  payment: {
    icon: <CreditCard size={13} />,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/30',
  },
  system: {
    icon: <Bell size={13} />,
    color: 'text-gray-500 dark:text-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-800',
  },
  alert: {
    icon: <AlertTriangle size={13} />,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-900/30',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffMin < 1)   return 'just now';
  if (diffMin < 60)  return `${diffMin}m ago`;
  if (diffHrs < 24)  return `${diffHrs}h ago`;
  if (diffDays < 7)  return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationDropdown({ userId, userRole, className }: Props) {
  const [open, setOpen]                     = useState(false);
  const [notifications, setNotifications]   = useState<ActivityNotification[]>([]);
  const containerRef                        = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const res  = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.success) setNotifications(data.notifications ?? []);
    } catch {
      // network errors are silent
    }
  }, [userId]);

  // Initial load + 30-second poll
  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

  // ── Click-outside to close ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const markRead = useCallback(async (id: string) => {
    // Optimistic
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
    } catch { /* silent */ }
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch('/api/notifications/read-all', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId }),
      });
    } catch { /* silent */ }
  }, [userId]);

  const handleNotificationClick = useCallback(
    (n: ActivityNotification) => {
      if (!n.read) markRead(n.id);
      if (n.link) window.location.href = n.link;
      setOpen(false);
    },
    [markRead]
  );

  const isDemo = !userId || userId === 'demo';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`relative ${className ?? ''}`} ref={containerRef}>
      {/* Bell trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-black dark:text-white transition-colors"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none pointer-events-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        {/* Static red dot in demo/empty state so the UI still shows something */}
        {unreadCount === 0 && isDemo && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-400 rounded-full pointer-events-none" />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-black dark:text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-[10px] font-bold rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-medium px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                >
                  <CheckCheck size={11} />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-[380px] overflow-y-auto overscroll-contain">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                <div className="w-11 h-11 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                  <Bell size={20} className="text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {isDemo ? 'Demo mode' : 'All caught up!'}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 leading-relaxed">
                  {isDemo
                    ? 'Notifications will appear here once connected to a live account.'
                    : `Activity for your ${userRole} account will appear here.`}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                {notifications.map((n) => {
                  const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.system;
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => handleNotificationClick(n)}
                        className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors ${
                          !n.read ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : ''
                        }`}
                      >
                        {/* Icon pill */}
                        <div
                          className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${cfg.bg} ${cfg.color}`}
                        >
                          {cfg.icon}
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`text-xs font-semibold leading-tight truncate ${
                                !n.read
                                  ? 'text-gray-900 dark:text-white'
                                  : 'text-gray-600 dark:text-gray-300'
                              }`}
                            >
                              {n.title}
                            </p>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0 mt-px">
                              {formatTime(n.created_at)}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>
                        </div>

                        {/* Unread dot */}
                        {!n.read && (
                          <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-50 dark:border-gray-800 text-center">
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                Showing {notifications.length} most recent activity events
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
