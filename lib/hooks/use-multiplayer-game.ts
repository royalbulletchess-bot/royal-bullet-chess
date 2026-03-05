'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { useApi } from '@/lib/hooks/use-api';
import { useGameSounds } from '@/lib/chess/use-game-sounds';
import { getTurn, getGameOverReason } from '@/lib/chess/helpers';
import { INITIAL_FEN } from '@/lib/constants';
import type { Game, Move, User, PlayerColor, GameResult } from '@/types';

// ──────── Types ────────

export interface GameOverState {
  result: GameResult;
  reason: string;
}

export interface UseMultiplayerGameReturn {
  // Board
  fen: string;
  playerColor: PlayerColor;
  isMyTurn: boolean;
  lastMove: { from: string; to: string } | null;
  moveHistory: string[];
  moveCount: number;

  // Timers
  whiteTimeMs: number;
  blackTimeMs: number;
  isWhiteTimerRunning: boolean;
  isBlackTimerRunning: boolean;

  // Game state
  gameOver: GameOverState | null;
  opponent: User | null;

  // Actions
  handleMove: (from: string, to: string, promotion?: string) => boolean;
  handleTimeout: () => void;

  // Loading
  isLoading: boolean;
}

// ──────── Hook ────────

/**
 * Multiplayer game hook — handles server-authoritative moves with broadcast sync.
 *
 * Architecture:
 * - Player's own moves: optimistic local apply + async API call
 * - Opponent's moves: received via Supabase broadcast channel (new_move event)
 * - Game state: received via Supabase broadcast channel (game_update event)
 * - Timers: local countdown with server sync on each broadcast update
 * - Game over: detected both locally and from server broadcasts
 */
export function useMultiplayerGame(
  game: Game,
  myColor: PlayerColor,
  opponent: User | null
): UseMultiplayerGameReturn {
  const { user } = useAuth();
  const { apiFetch } = useApi();
  const supabase = useRef(createClient()).current;
  const { playMoveSound, playGameStart } = useGameSounds();

  // ──── State ────
  const [fen, setFen] = useState(game.current_fen || INITIAL_FEN);
  const [whiteTimeMs, setWhiteTimeMs] = useState(game.white_time_remaining_ms);
  const [blackTimeMs, setBlackTimeMs] = useState(game.black_time_remaining_ms);
  const [gameOver, setGameOver] = useState<GameOverState | null>(null);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // ──── Refs (for stable callbacks) ────
  const fenRef = useRef(fen);
  const gameOverRef = useRef<GameOverState | null>(null);
  const lastMoveTimeRef = useRef<number>(performance.now());
  const moveCountRef = useRef(0);

  fenRef.current = fen;
  gameOverRef.current = gameOver;
  moveCountRef.current = moveCount;

  // ──── Derived ────
  const currentTurn = getTurn(fen);
  const isMyTurn = currentTurn === myColor && !gameOver;
  const isWhiteTimerRunning = !gameOver && currentTurn === 'WHITE' && moveCount > 0;
  const isBlackTimerRunning = !gameOver && currentTurn === 'BLACK' && moveCount > 0;

  // ──── Initialize: fetch existing moves via API ────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Fetch game + moves via API (service role, bypasses RLS)
      const { data } = await apiFetch<{
        game: Game;
        opponent: User | null;
        moves: Move[];
      }>(`/api/games/${game.id}`);

      if (cancelled) return;

      if (data?.moves && data.moves.length > 0) {
        const history = data.moves.map((m: Move) => m.move_san);
        setMoveHistory(history);
        setMoveCount(data.moves.length);
        moveCountRef.current = data.moves.length;

        const lastMoveData = data.moves[data.moves.length - 1] as Move;
        setFen(lastMoveData.fen_after);
        fenRef.current = lastMoveData.fen_after;

        // Reconstruct last move from/to for board highlighting
        try {
          const prevFen = data.moves.length >= 2
            ? (data.moves[data.moves.length - 2] as Move).fen_after
            : INITIAL_FEN;
          const chess = new Chess(prevFen);
          const move = chess.move(lastMoveData.move_san);
          if (move) {
            setLastMove({ from: move.from, to: move.to });
          }
        } catch {
          // Ignore reconstruction errors
        }
      }

      // Sync timer from server
      if (data?.game) {
        setWhiteTimeMs(data.game.white_time_remaining_ms);
        setBlackTimeMs(data.game.black_time_remaining_ms);
      }

      // If game is already finished (reconnection scenario)
      if (data?.game?.status === 'FINISHED' && data.game.result) {
        let reason = 'Game over';
        const finalFen = data.game.final_fen || data.game.current_fen;
        const overReason = getGameOverReason(finalFen);
        if (overReason) {
          reason = overReason === 'checkmate' ? 'Checkmate' : overReason.replace(/_/g, ' ');
        }
        setGameOver({ result: data.game.result as GameResult, reason });
      }

      setIsLoading(false);
      playGameStart();
    }

    init();

    return () => { cancelled = true; };
  }, [game.id, apiFetch, playGameStart]);

  // ──── Broadcast subscription: new moves + game updates ────
  useEffect(() => {
    const channelName = `game-broadcast-${game.id}`;

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'new_move' }, (payload) => {
        const moveData = payload.payload as {
          san: string;
          from: string;
          to: string;
          captured?: string | null;
          promotion?: string | null;
          player_id: string;
          fen_after: string;
          time_remaining: number;
          move_number: number;
        };

        // Skip own moves (already applied optimistically)
        if (moveData.player_id === user?.id) return;

        // Apply opponent's move
        const currentFen = fenRef.current;
        const chess = new Chess(currentFen);

        // Determine the mover's color from FEN turn (before move is applied)
        const moverColor: PlayerColor = chess.turn() === 'w' ? 'WHITE' : 'BLACK';

        try {
          const move = chess.move(moveData.san);
          if (!move) return;

          const newFen = chess.fen();
          setFen(newFen);
          fenRef.current = newFen;
          setMoveHistory(prev => [...prev, moveData.san]);
          setMoveCount(prev => prev + 1);
          moveCountRef.current += 1;
          setLastMove({ from: move.from, to: move.to });
          lastMoveTimeRef.current = performance.now();

          // Sync mover's timer with server-authoritative value
          if (moverColor === 'WHITE') {
            setWhiteTimeMs(moveData.time_remaining);
          } else {
            setBlackTimeMs(moveData.time_remaining);
          }

          // Play sound
          const isCheckmate = chess.isCheckmate();
          playMoveSound(
            {
              san: move.san,
              captured: move.captured,
              isKingsideCastle: move.san === 'O-O',
              isQueensideCastle: move.san === 'O-O-O',
              isPromotion: !!move.promotion,
            },
            isCheckmate
          );

          // Check for game over
          if (isCheckmate) {
            const winner = getTurn(newFen) === 'WHITE' ? 'BLACK_WIN' : 'WHITE_WIN';
            setGameOver({ result: winner as GameResult, reason: 'Checkmate' });
          } else {
            const overReason = getGameOverReason(newFen);
            if (overReason) {
              setGameOver({ result: 'DRAW', reason: overReason.replace(/_/g, ' ') });
            }
          }
        } catch (e) {
          console.error('[useMultiplayerGame] Error applying opponent move:', e);
        }
      })
      .on('broadcast', { event: 'game_update' }, (payload) => {
        const update = payload.payload as Partial<Game>;

        // Sync timers from server
        if (update.white_time_remaining_ms !== undefined) {
          setWhiteTimeMs(update.white_time_remaining_ms);
        }
        if (update.black_time_remaining_ms !== undefined) {
          setBlackTimeMs(update.black_time_remaining_ms);
        }

        // Server FINISHED broadcast is authoritative — always accept it,
        // even if client already set gameOver locally (prevents mismatched results).
        if (update.status === 'FINISHED') {
          const result = (update.result || 'DRAW') as GameResult;
          let reason = 'Game ended';

          if (update.final_fen) {
            const overReason = getGameOverReason(update.final_fen);
            if (overReason) {
              reason = overReason === 'checkmate' ? 'Checkmate' : overReason.replace(/_/g, ' ');
            }
          }

          setGameOver({ result, reason });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id, supabase, user?.id, playMoveSound]);

  // ──── Make a move (optimistic + server) ────
  const handleMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      if (gameOverRef.current) return false;

      const currentFen = fenRef.current;
      const chess = new Chess(currentFen);

      try {
        const move = chess.move({ from, to, promotion });
        if (!move) return false;

        // ─── Optimistic local update ───

        // Time deduction (local estimate)
        const now = performance.now();
        const elapsed = now - lastMoveTimeRef.current;
        lastMoveTimeRef.current = now;

        if (moveCountRef.current > 0) {
          if (myColor === 'WHITE') {
            setWhiteTimeMs(prev => Math.max(0, prev - elapsed));
          } else {
            setBlackTimeMs(prev => Math.max(0, prev - elapsed));
          }
        }

        // Update board state
        const newFen = chess.fen();
        setFen(newFen);
        fenRef.current = newFen;
        setMoveCount(prev => prev + 1);
        moveCountRef.current += 1;
        setLastMove({ from, to });
        setMoveHistory(prev => [...prev, move.san]);

        // Play sound
        const isCheckmate = chess.isCheckmate();
        playMoveSound(
          {
            san: move.san,
            captured: move.captured,
            isKingsideCastle: move.san === 'O-O',
            isQueensideCastle: move.san === 'O-O-O',
            isPromotion: !!move.promotion,
          },
          isCheckmate
        );

        // Check for game over
        if (isCheckmate) {
          const winner = getTurn(newFen) === 'WHITE' ? 'BLACK_WIN' : 'WHITE_WIN';
          setGameOver({ result: winner as GameResult, reason: 'Checkmate' });
        } else {
          const overReason = getGameOverReason(newFen);
          if (overReason) {
            setGameOver({ result: 'DRAW', reason: overReason.replace(/_/g, ' ') });
          }
        }

        // ─── Send to server ───
        // Save full snapshot for rollback
        const prevFen = currentFen;
        const prevMoveCount = moveCountRef.current - 1;
        const prevMoveHistory = moveHistory;
        const prevGameOver = gameOverRef.current;
        const prevLastMoveTime = lastMoveTimeRef.current;
        const prevWhiteTimeMs = whiteTimeMs;
        const prevBlackTimeMs = blackTimeMs;

        apiFetch(`/api/games/${game.id}/move`, {
          method: 'POST',
          body: JSON.stringify({ from, to, promotion }),
        }).then(({ error }) => {
          if (error) {
            console.error('[useMultiplayerGame] Server rejected move, rolling back:', error);
            setFen(prevFen);
            fenRef.current = prevFen;
            setMoveCount(prevMoveCount);
            moveCountRef.current = prevMoveCount;
            setMoveHistory(prevMoveHistory);
            setLastMove(null);
            setGameOver(prevGameOver);
            gameOverRef.current = prevGameOver;
            lastMoveTimeRef.current = prevLastMoveTime;
            setWhiteTimeMs(prevWhiteTimeMs);
            setBlackTimeMs(prevBlackTimeMs);
          }
        });

        return true;
      } catch {
        return false;
      }
    },
    [game.id, myColor, apiFetch, playMoveSound, moveHistory, whiteTimeMs, blackTimeMs]
  );

  // ──── Handle timeout ────
  const handleTimeout = useCallback(() => {
    if (gameOverRef.current) return;

    const loser = getTurn(fenRef.current);
    const result: GameResult = loser === 'WHITE' ? 'BLACK_WIN' : 'WHITE_WIN';
    setGameOver({ result, reason: 'Timeout' });

    // Notify server
    apiFetch(`/api/games/${game.id}/timeout`, {
      method: 'POST',
    }).catch(() => {
      // Server will handle/verify the timeout claim
    });
  }, [game.id, apiFetch]);

  return {
    fen,
    playerColor: myColor,
    isMyTurn,
    lastMove,
    moveHistory,
    moveCount,
    whiteTimeMs,
    blackTimeMs,
    isWhiteTimerRunning,
    isBlackTimerRunning,
    gameOver,
    opponent,
    handleMove,
    handleTimeout,
    isLoading,
  };
}
