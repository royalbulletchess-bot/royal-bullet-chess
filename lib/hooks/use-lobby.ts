'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { LobbyGame } from '@/types';

interface UseLobbyReturn {
  games: LobbyGame[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook that fetches OPEN games from Supabase and subscribes to Realtime updates.
 */
export function useLobby(): UseLobbyReturn {
  const [games, setGames] = useState<LobbyGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useRef(createClient()).current;

  const fetchGames = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('games')
        .select(`
          id,
          bet_amount,
          created_at,
          invite_code,
          creator:users!creator_id (
            farcaster_username,
            farcaster_avatar
          )
        `)
        .eq('status', 'OPEN')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Lobby fetch error:', fetchError);
        setError('Failed to load games');
        return;
      }

      // Transform into LobbyGame shape
      const lobbyGames: LobbyGame[] = (data || []).map((game: Record<string, unknown>) => {
        const creator = game.creator as Record<string, unknown> | null;
        return {
          id: game.id as string,
          creator_username: (creator?.farcaster_username as string) || 'Unknown',
          creator_avatar: (creator?.farcaster_avatar as string) || null,
          bet_amount: game.bet_amount as number,
          created_at: game.created_at as string,
          invite_code: (game.invite_code as string) || null,
        };
      });

      setGames(lobbyGames);
      setError(null);
    } catch {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchGames();

    // Subscribe to realtime changes on games table
    const channel = supabase
      .channel('lobby-games')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: 'status=eq.OPEN',
        },
        () => {
          // On any change to OPEN games, refetch the list
          fetchGames();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchGames]);

  return { games, isLoading, error, refetch: fetchGames };
}
