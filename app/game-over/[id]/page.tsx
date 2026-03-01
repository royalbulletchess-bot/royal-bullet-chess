'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import { Chess } from 'chess.js';
import { useApi } from '@/lib/hooks/use-api';
import { useAuth } from '@/lib/auth/AuthContext';
import { COMMISSION_RATE } from '@/lib/constants';
import { shareGameResult } from '@/lib/farcaster/share';
import type { Game, User, PlayerColor } from '@/types';

interface GameOverData {
  game: Game;
  opponent: User | null;
  moves: unknown[];
}

export default function GameOverPage() {
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;
  const { apiFetch } = useApi();
  const { user } = useAuth();

  const [data, setData] = useState<GameOverData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rematchSent, setRematchSent] = useState(false);
  const [rematchLoading, setRematchLoading] = useState(false);

  useEffect(() => {
    async function fetchGame() {
      const { data: result, error: apiErr } = await apiFetch<GameOverData>(
        `/api/games/${gameId}`
      );
      if (apiErr || !result) {
        setError(apiErr || 'Game not found');
      } else {
        setData(result);
      }
      setIsLoading(false);
    }
    fetchGame();
  }, [gameId, apiFetch]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="text-4xl animate-pulse">{'\u265A'}</div>
        <p className="text-sm text-[var(--muted)]">Loading result...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-6">
        <p className="text-lg font-bold">Error</p>
        <p className="text-sm text-[var(--muted)]">{error || 'Game not found'}</p>
        <Button onClick={() => router.push('/lobby')}>Back to Lobby</Button>
      </div>
    );
  }

  const { game, opponent } = data;

  // Determine result from player's perspective
  const isCreator = game.creator_id === user?.id;
  const myColor: PlayerColor = isCreator
    ? (game.creator_color as PlayerColor)
    : (game.creator_color === 'WHITE' ? 'BLACK' : 'WHITE');

  const isWin =
    (game.result === 'WHITE_WIN' && myColor === 'WHITE') ||
    (game.result === 'BLACK_WIN' && myColor === 'BLACK');
  const isDraw = game.result === 'DRAW';
  const isLoss = !isWin && !isDraw;

  // Financial info
  const betAmount = Number(game.bet_amount);
  const potAmount = Number(game.pot_amount);
  const commission = potAmount * COMMISSION_RATE;
  const winPayout = potAmount - commission;

  // Determine reason
  let reason = 'Game over';
  if (game.final_fen) {
    try {
      const chess = new Chess(game.final_fen);
      if (chess.isCheckmate()) reason = 'Checkmate';
      else if (chess.isStalemate()) reason = 'Stalemate';
      else if (chess.isThreefoldRepetition()) reason = 'Threefold repetition';
      else if (chess.isInsufficientMaterial()) reason = 'Insufficient material';
      else if (chess.isDraw()) reason = 'Draw by 50-move rule';
      else reason = isWin || isLoss ? 'Resignation / Timeout' : 'Draw';
    } catch {
      reason = isWin || isLoss ? 'Resignation / Timeout' : 'Draw';
    }
  }

  const opponentUsername = opponent?.farcaster_username || 'Opponent';
  const opponentAvatar = opponent?.farcaster_avatar || null;

  // Move count
  const totalMoves = data.moves?.length || 0;
  const fullMoves = Math.ceil(totalMoves / 2);

  async function handleRematch() {
    setRematchLoading(true);
    const { error: rematchErr } = await apiFetch(`/api/games/${gameId}/rematch`, {
      method: 'POST',
    });
    if (rematchErr) {
      console.error('Rematch error:', rematchErr);
    } else {
      setRematchSent(true);
    }
    setRematchLoading(false);
  }

  function handleShare() {
    const resultType = isWin ? 'win' : isDraw ? 'draw' : 'loss';
    shareGameResult({
      result: resultType,
      opponent: opponentUsername,
      betAmount,
      payout: isWin ? winPayout : 0,
      moves: fullMoves,
      gameId,
    });
  }

  return (
    <div className="flex flex-col items-center px-4 py-8 gap-6 min-h-screen justify-center">
      {/* Result icon */}
      <div className="text-6xl">
        {isWin ? '\u2655' : isDraw ? '\u265E' : '\u265B'}
      </div>

      {/* Result text */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-1">
          {isWin ? 'Victory!' : isDraw ? 'Draw!' : 'Defeat'}
        </h1>
        <p className="text-sm text-[var(--muted)]">{reason}</p>
        {fullMoves > 0 && (
          <p className="text-xs text-[var(--muted)] mt-1">
            {fullMoves} move{fullMoves !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Opponent */}
      <div className="flex items-center gap-3 rounded-xl bg-[var(--card)] border border-[var(--border)] px-4 py-3">
        <Avatar
          src={opponentAvatar}
          username={opponentUsername}
          size="md"
        />
        <div>
          <p className="text-sm font-medium">{opponentUsername}</p>
          <p className="text-xs text-[var(--muted)]">
            {isWin ? 'Defeated' : isDraw ? 'Drew with' : 'Won against you'}
          </p>
        </div>
      </div>

      {/* Payout */}
      <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-4 w-full max-w-xs text-center">
        <p className="text-xs text-[var(--muted)] mb-1">
          {isWin ? 'You won' : isDraw ? 'Refunded' : 'You lost'}
        </p>
        <p
          className={`text-3xl font-bold ${
            isWin
              ? 'text-[var(--accent)]'
              : isDraw
                ? 'text-[var(--foreground)]'
                : 'text-[var(--danger)]'
          }`}
        >
          {isWin ? '+' : isDraw ? '' : '-'}${isWin ? winPayout.toFixed(2) : isDraw ? '0.00' : betAmount.toFixed(2)}
        </p>
        <p className="text-xs text-[var(--muted)] mt-1">USDC</p>
      </div>

      {/* Color & Time info */}
      <div className="flex gap-4 text-xs text-[var(--muted)]">
        <span>You played {myColor === 'WHITE' ? '\u2654 White' : '\u265A Black'}</span>
        <span>&middot;</span>
        <span>1+0 Bullet</span>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Button size="lg" className="w-full" onClick={() => router.push('/lobby')}>
          Play Again
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="w-full"
          loading={rematchLoading}
          disabled={rematchSent}
          onClick={handleRematch}
        >
          {rematchSent ? 'Rematch Sent!' : 'Rematch'}
        </Button>
        <Button
          size="lg"
          variant="ghost"
          className="w-full"
          onClick={handleShare}
        >
          Share Result
        </Button>
      </div>
    </div>
  );
}
