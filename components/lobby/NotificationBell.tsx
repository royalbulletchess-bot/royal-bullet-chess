'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/lib/hooks/use-notifications';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { Notification } from '@/types';

function getNotificationText(notification: Notification): string {
  switch (notification.type) {
    case 'REMATCH_REQUEST':
      return 'You received a rematch request!';
    case 'DRAW_OFFER':
      return 'Draw offer received';
    case 'LOBBY_JOIN':
      return 'Someone joined your game!';
    default:
      return 'New notification';
  }
}

function getNotificationIcon(type: string): string {
  switch (type) {
    case 'REMATCH_REQUEST':
      return '\u2694\uFE0F'; // ⚔️
    case 'DRAW_OFFER':
      return '\u{1F91D}'; // 🤝
    case 'LOBBY_JOIN':
      return '\u{1F3AE}'; // 🎮
    default:
      return '\u{1F514}'; // 🔔
  }
}

export default function NotificationBell() {
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  function handleNotificationClick(notification: Notification) {
    markAsRead(notification.id);

    if (notification.game_id) {
      if (notification.type === 'REMATCH_REQUEST') {
        // Navigate to lobby to create a rematch
        router.push('/lobby');
      } else {
        router.push(`/game/${notification.game_id}`);
      }
    }

    setIsOpen(false);
  }

  return (
    <>
      {/* Bell icon */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2 rounded-lg hover:bg-[var(--card)] transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--muted)]"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-[var(--danger)] text-white text-[10px] font-bold px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification list modal */}
      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Notifications"
      >
        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-4">
              No notifications yet
            </p>
          ) : (
            <>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-[var(--accent)] hover:underline self-end mb-1"
                >
                  Mark all as read
                </button>
              )}
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    notification.read
                      ? 'bg-[var(--background)] opacity-60'
                      : 'bg-[var(--card-hover)] border border-[var(--border)]'
                  } hover:bg-[var(--card-hover)]`}
                >
                  <span className="text-lg flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {getNotificationText(notification)}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {formatTimeAgo(notification.created_at)}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="h-2 w-2 rounded-full bg-[var(--accent)] flex-shrink-0" />
                  )}
                </button>
              ))}
            </>
          )}

          <Button
            variant="ghost"
            className="w-full mt-2"
            onClick={() => setIsOpen(false)}
          >
            Close
          </Button>
        </div>
      </Modal>
    </>
  );
}

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
