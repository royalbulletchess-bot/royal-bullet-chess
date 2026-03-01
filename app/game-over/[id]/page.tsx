'use client';

import { useRouter, useParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';

// Phase 1: static mock data for game over screen
// In the real app, this would fetch from the database
export default function GameOverPage() {
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;

  // Mock data for Phase 1
  const mockResult: {
    outcome: 'win' | 'lose' | 'draw';
    reason: string;
    betAmount: number;
    payout: number;
    opponentUsername: string;
    opponentAvatar: string | null;
    myUsername: string;
  } = {
    outcome: 'win',
    reason: 'Checkmate',
    betAmount: 5,
    payout: 9.0,
    opponentUsername: 'chess_degen',
    opponentAvatar: null,
    myUsername: 'You',
  };

  const isWin = mockResult.outcome === 'win';
  const isDraw = mockResult.outcome === 'draw';

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
        <p className="text-sm text-[var(--muted)]">{mockResult.reason}</p>
      </div>

      {/* Opponent */}
      <div className="flex items-center gap-3 rounded-xl bg-[var(--card)] border border-[var(--border)] px-4 py-3">
        <Avatar
          src={mockResult.opponentAvatar}
          username={mockResult.opponentUsername}
          size="md"
        />
        <div>
          <p className="text-sm font-medium">{mockResult.opponentUsername}</p>
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
          {isWin ? '+' : isDraw ? '' : '-'}${isWin ? mockResult.payout.toFixed(2) : mockResult.betAmount.toFixed(2)}
        </p>
        <p className="text-xs text-[var(--muted)] mt-1">USDC</p>
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
          onClick={() => {
            // Phase 2: send rematch notification
            console.log('Rematch requested for game:', gameId);
            router.push('/lobby');
          }}
        >
          Rematch
        </Button>
        <Button
          size="lg"
          variant="ghost"
          className="w-full"
          onClick={() => {
            // Phase 2: compose Farcaster cast
            console.log('Share game result');
          }}
        >
          Share Result
        </Button>
      </div>
    </div>
  );
}
