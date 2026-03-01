'use client';

import { useState, useEffect } from 'react';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import type { Game, User, PlayerColor } from '@/types';

interface ApprovalScreenProps {
  game: Game;
  opponent: User | null;
  myColor: PlayerColor | null;
  myApproved: boolean;
  opponentApproved: boolean;
  onApprove: () => void;
  isApproving: boolean;
}

export default function ApprovalScreen({
  game,
  opponent,
  myColor,
  myApproved,
  opponentApproved,
  onApprove,
  isApproving,
}: ApprovalScreenProps) {
  const [countdown, setCountdown] = useState(60);

  // Countdown timer based on matching_expires_at
  useEffect(() => {
    if (!game.matching_expires_at) return;

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(game.matching_expires_at!).getTime() - Date.now()) / 1000)
      );
      setCountdown(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [game.matching_expires_at]);

  return (
    <div className="flex flex-col items-center justify-center h-screen px-6 gap-6">
      <h2 className="text-xl font-bold">Match Found!</h2>

      {/* Opponent info */}
      <div className="flex flex-col items-center gap-3">
        <Avatar
          src={opponent?.farcaster_avatar}
          username={opponent?.farcaster_username || 'Opponent'}
          size="lg"
        />
        <div className="text-center">
          <p className="font-medium">
            {opponent?.farcaster_username || 'Loading...'}
          </p>
          <p className="text-xs text-[var(--muted)]">
            ELO {opponent?.elo_rating || '---'}
          </p>
        </div>
      </div>

      {/* Game details */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 w-full max-w-xs">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[var(--muted)]">Bet</span>
          <span className="font-bold">${Number(game.bet_amount).toFixed(0)}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[var(--muted)]">Your color</span>
          <span className="font-bold">
            {myColor === 'WHITE' ? '\u2654 White' : '\u265A Black'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--muted)]">Time control</span>
          <span className="font-medium">1+0 Bullet</span>
        </div>
      </div>

      {/* Approval status */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <div
            className={`h-3 w-3 rounded-full ${
              myApproved ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
            }`}
          />
          <span className={myApproved ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}>
            You
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className={`h-3 w-3 rounded-full ${
              opponentApproved ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
            }`}
          />
          <span className={opponentApproved ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}>
            Opponent
          </span>
        </div>
      </div>

      {/* Countdown */}
      <p className="text-xs text-[var(--muted)]">
        {countdown > 0 ? `${countdown}s to confirm` : 'Time expired'}
      </p>

      {/* Action */}
      {!myApproved ? (
        <Button
          size="lg"
          className="w-full max-w-xs"
          onClick={onApprove}
          loading={isApproving}
        >
          {'\u2714'} Ready
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-sm text-[var(--muted)]">
            Waiting for opponent...
          </span>
        </div>
      )}
    </div>
  );
}
