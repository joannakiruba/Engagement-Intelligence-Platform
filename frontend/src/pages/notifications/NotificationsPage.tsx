import React, { useState, useEffect } from 'react';
import { getNotifications, markAsRead, markAllAsRead } from '../../services/notifications.service';
import { Notification } from '../../types';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { getErrorMessage } from '../../services/api';
import {
  Bell,
  CheckCheck,
  Mail,
  MailOpen,
  ChevronLeft,
  ChevronRight,
  Info,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

function typeIcon(type?: string) {
  switch (type) {
    case 'WARNING':
    case 'ALERT':
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case 'SUCCESS':
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    default:
      return <Info className="w-4 h-4 text-indigo-500" />;
  }
}

function typeBadge(type?: string) {
  const map: Record<string, string> = {
    WARNING: 'bg-amber-50 text-amber-700 border-amber-200',
    ALERT: 'bg-red-50 text-red-700 border-red-200',
    SUCCESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    INFO: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  const cls = map[type || ''] || 'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${cls}`}>
      {type || 'GENERAL'}
    </span>
  );
}

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = 15;

  const loadData = async (p = page) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getNotifications(p, limit);
      setNotifications(res.notifications);
      setTotal(res.total);
      setUnreadCount(res.unreadCount);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(page);
  }, [page]);

  const handleMarkRead = async (id: string) => {
    try {
      const updated = await markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: updated.isRead } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      if (res.markedRead > 0) await loadData(page);
    } catch (err) {
      console.error(err);
    }
  };

  const totalPages = Math.ceil(total / limit);

  if (loading && notifications.length === 0) {
    return <LoadingState message="Loading notifications..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => loadData(page)} />;
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-violet-600 via-indigo-700 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white mb-2 backdrop-blur-xs">
            <Bell className="w-3.5 h-3.5" />
            Notification Centre
          </div>
          <h1 className="text-2xl font-black tracking-tight">Notifications</h1>
          <p className="text-violet-100 text-sm mt-1 max-w-2xl">
            Stay informed about risk alerts, task updates, intervention actions, and system events.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <span className="px-3 py-1.5 rounded-xl bg-white/20 text-xs font-bold backdrop-blur-xs">
              {unreadCount} Unread
            </span>
          )}
          <button
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-900 font-semibold text-xs hover:bg-violet-50 shadow-sm transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCheck className="w-4 h-4" />
            Mark All Read
          </button>
        </div>
      </div>

      {/* Notification List */}
      {notifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">No notifications yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            You'll see risk alerts, task updates, and system messages here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`bg-white rounded-xl border p-4 flex items-start gap-4 transition-all hover:shadow-sm ${
                n.isRead
                  ? 'border-slate-200'
                  : 'border-indigo-200 bg-indigo-50/30 shadow-xs'
              }`}
            >
              <div className="mt-0.5">{typeIcon(n.type)}</div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {typeBadge(n.type)}
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                  )}
                </div>
                {n.title && (
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{n.title}</h3>
                )}
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{n.message}</p>
                <p className="text-[10px] text-slate-400 mt-2">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>

              {!n.isRead && (
                <button
                  onClick={() => handleMarkRead(n.id)}
                  className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Mark as read"
                >
                  <MailOpen className="w-4 h-4" />
                </button>
              )}
              {n.isRead && (
                <div className="shrink-0 p-2 text-slate-300">
                  <Mail className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3">
          <p className="text-xs text-slate-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-slate-700">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
