'use client';

import { useCallback } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';

/**
 * Hook that provides an authenticated fetch wrapper.
 * Automatically adds the session token to requests.
 */
export function useApi() {
  const { sessionToken } = useAuth();

  const apiFetch = useCallback(
    async <T = unknown>(
      url: string,
      options: RequestInit = {}
    ): Promise<{ data: T | null; error: string | null }> => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(options.headers as Record<string, string>),
        };

        if (sessionToken) {
          headers['Authorization'] = `Bearer ${sessionToken}`;
        }

        const res = await fetch(url, {
          ...options,
          headers,
        });

        const json = await res.json();

        if (!res.ok) {
          return { data: null, error: json.error || `HTTP ${res.status}` };
        }

        return { data: json as T, error: null };
      } catch {
        return { data: null, error: 'Network error' };
      }
    },
    [sessionToken]
  );

  return { apiFetch };
}
