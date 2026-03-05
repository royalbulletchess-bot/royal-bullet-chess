'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { useApi } from '@/lib/hooks/use-api';
import type { Game } from '@/types';

interface WaitingScreenProps {
  game: Game;
}

export default function WaitingScreen({ game }: WaitingScreenProps) {
  const router = useRouter();
  const { apiFetch } = useApi();
  const [isCancelling, setIsCancelling] = useState(false);

  async function handleCancel() {
    setIsCancelling(true);
    const { error } = await apiFetch(`/api/games/${game.id}/cancel`, {
      method: 'POST',
    });
    if (error) {
      console.error('Cancel error:', error);
    }
    setIsCancelling(false);
    router.push('/lobby');
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen px-6 gap-6">
      <div className="text-center">
        <div className="text-5xl mb-4">{'\u265A'}</div>
        <h2 className="text-xl font-bold">Waiting for Opponent</h2>
        <p className="text-sm text-[var(--muted)] mt-2">
          Your ${Number(game.bet_amount).toFixed(0)} lobby is open
        </p>
      </div>

      {/* Invite code */}
      {game.invite_code && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl px-6 py-4 text-center">
          <p className="text-xs text-[var(--muted)] mb-1">Invite Code</p>
          <p className="text-2xl font-mono font-bold tracking-widest">
            {game.invite_code}
          </p>
        </div>
      )}

      {/* Searching animation */}
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-[var(--accent)] animate-pulse" />
        <span className="text-sm text-[var(--muted)]">
          Searching for players...
        </span>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Button
          variant="danger"
          size="lg"
          className="w-full"
          onClick={handleCancel}
          loading={isCancelling}
        >
          Cancel Game
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={() => router.push('/lobby')}
        >
          Back to Lobby
        </Button>
      </div>
    </div>
  );
}
