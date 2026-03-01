'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { useApi } from '@/lib/hooks/use-api';
import type { Game, User, PlayerColor } from '@/types';

export type GamePhase = 'loading' | 'waiting' | 'matching' | 'active' | 'finished' | 'error';

interface UseGameStateReturn {
  game: Game | null;
  phase: GamePhase;
  error: string | null;
  myColor: PlayerColor | null;
  isMyTurn: boolean;
  opponent: User | null;
  approve: () => Promise<void>;
  isApproving: boolean;
  myApproved: boolean;
  opponentApproved: boolean;
}

/**
 * Central hook for managing game state.
 *
 * Architecture:
 * - Initial fetch via authenticated API route (bypasses RLS)
 * - Real-time updates via Supabase broadcast channel (no RLS dependency)
 * - Handles all game phases: waiting → matching → active → finished
 */
export function useGameState(gameId: string): UseGameStateReturn {
  const { user } = useAuth();
  const { apiFetch } = useApi();
  const [game, setGame] = useState<Game | null>(null);
  const [opponent, setOpponent] = useState<User | null>(null);
  const [phase, setPhase] = useState<GamePhase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const supabase = useRef(createClient()).current;

  // Derive game info
  const isCreator = game?.creator_id === user?.id;
  const myColor: PlayerColor | null = game?.creator_color
    ? (isCreator ? game.creator_color as PlayerColor : (game.creator_color === 'WHITE' ? 'BLACK' : 'WHITE'))
    : null;

  const isWhiteTurn = game?.current_fen?.split(' ')[1] === 'w';
  const isMyTurn = myColor
    ? (myColor === 'WHITE' ? isWhiteTurn : !isWhiteTurn)
    : false;

  const myApproved = isCreator ? (game?.creator_approved ?? false) : (game?.opponent_approved ?? false);
  const opponentApproved = isCreator ? (game?.opponent_approved ?? false) : (game?.creator_approved ?? false);

  // Helper to derive phase from game status
  function derivePhase(status: string): GamePhase {
    switch (status) {
      case 'OPEN': return 'waiting';
      case 'MATCHING': return 'matching';
      case 'ACTIVE': return 'active';
      case 'FINISHED':
      case 'CANCELLED':
      case 'EXPIRED':
        return 'finished';
      default: return 'error';
    }
  }

  // Fetch game data via authenticated API route (service role, no RLS)
  const fetchGame = useCallback(async () => {
    const { data, error: apiErr } = await apiFetch<{
      game: Game;
      opponent: User | null;
      moves: unknown[];
    }>(`/api/games/${gameId}`);

    if (apiErr || !data?.game) {
      setError(apiErr || 'Game not found');
      setPhase('error');
      return;
    }

    setGame(data.game);
    setPhase(derivePhase(data.game.status));

    if (data.opponent) {
      setOpponent(data.opponent);
    }
  }, [gameId, apiFetch]);

  // Initial fetch
  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  // Subscribe to broadcast channel for real-time game updates
  useEffect(() => {
    const channelName = `game-broadcast-${gameId}`;

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'game_update' }, (payload) => {
        const update = payload.payload as Partial<Game>;

        setGame(prev => {
          if (!prev) return prev;
          const updated = { ...prev, ...update };
          return updated;
        });

        // Update phase based on new status
        if (update.status) {
          const newPhase = derivePhase(update.status);
          setPhase(newPhase);

          // If opponent just joined (matching phase), re-fetch to get opponent data
          if (update.status === 'MATCHING' && !opponent) {
            fetchGame();
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, supabase, opponent, fetchGame]);

  // Approve match
  const approve = useCallback(async () => {
    setIsApproving(true);
    const { error: apiErr } = await apiFetch(
      `/api/games/${gameId}/approve`,
      { method: 'POST' }
    );
    if (apiErr) {
      setError(apiErr);
    }
    setIsApproving(false);
  }, [gameId, apiFetch]);

  return {
    game,
    phase,
    error,
    myColor,
    isMyTurn,
    opponent,
    approve,
    isApproving,
    myApproved,
    opponentApproved,
  };
}
