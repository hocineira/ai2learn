import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Bell, Check, CheckCheck, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

export default function NotificationBell() {
  const { getAuthHeaders, API } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const [notifsRes, countRes] = await Promise.all([
        axios.get(`${API}/notifications`, { headers }),
        axios.get(`${API}/notifications/unread-count`, { headers }),
      ]);
      setNotifications(notifsRes.data || []);
      setUnreadCount(countRes.data?.count || 0);
    } catch {}
  }, [API, getAuthHeaders]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await axios.put(`${API}/notifications/read-all`, {}, { headers: getAuthHeaders() });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  const handleClickNotif = async (notif) => {
    if (!notif.read) {
      try {
        await axios.put(`${API}/notifications/${notif.id}/read`, {}, { headers: getAuthHeaders() });
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      } catch {}
    }
    if (notif.link) {
      navigate(notif.link);
      setOpen(false);
    }
  };

  const typeColors = {
    grading: 'text-emerald-400',
    info: 'text-cyan-400',
    warning: 'text-amber-400',
    error: 'text-red-400',
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "a l'instant";
    if (mins < 60) return `il y a ${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days}j`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-200 dark:hover:bg-zinc-800"
        data-testid="notification-bell"
      >
        <Bell className="w-4 h-4 th-text-muted" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center animate-bounce-in">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 w-80 max-h-96 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-zinc-800">
              <span className="text-sm font-semibold th-text" style={{ fontFamily: 'Space Grotesk' }}>Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-cyan-500 hover:text-cyan-400 flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" /> Tout lire
                </button>
              )}
            </div>
            <div className="overflow-y-auto max-h-72">
              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="w-8 h-8 th-text-faint mx-auto mb-2" />
                  <p className="text-sm th-text-muted">Aucune notification</p>
                </div>
              ) : (
                notifications.slice(0, 15).map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleClickNotif(notif)}
                    className={`p-3 border-b border-gray-100 dark:border-zinc-800/50 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/30 ${!notif.read ? 'bg-cyan-50/50 dark:bg-cyan-900/10' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!notif.read ? 'bg-cyan-500' : 'bg-transparent'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${!notif.read ? 'th-text' : 'th-text-secondary'}`}>{notif.title}</p>
                        <p className="text-xs th-text-muted mt-0.5 line-clamp-2">{notif.message}</p>
                        <p className="text-[10px] th-text-faint mt-1">{timeAgo(notif.created_at)}</p>
                      </div>
                      {notif.link && <ExternalLink className="w-3 h-3 th-text-faint flex-shrink-0 mt-1" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
