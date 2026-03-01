'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '@/lib/hooks/use-api';
import { useAuth } from '@/lib/auth/AuthContext';
import type { Notification } from '@/types';

/**
 * Hook to fetch and manage user notifications.
 * Polls every 30 seconds for new notifications.
 */
export function useNotifications() {
  const { apiFetch } = useApi();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    const { data, error } = await apiFetch<{ notifications: Notification[]; unreadCount: number }>(
      '/api/notifications'
    );

    if (!error && data) {
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    }
    setIsLoading(false);
  }, [user, apiFetch]);

  // Initial fetch + polling
  useEffect(() => {
    fetchNotifications();

    intervalRef.current = setInterval(fetchNotifications, 30_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchNotifications]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      await apiFetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    },
    [apiFetch]
  );

  const markAllAsRead = useCallback(async () => {
    await apiFetch('/api/notifications/read-all', {
      method: 'POST',
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [apiFetch]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
