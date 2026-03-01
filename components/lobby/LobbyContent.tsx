'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LobbyList from '@/components/lobby/LobbyList';
import Button from '@/components/ui/Button';
import { useLobby } from '@/lib/hooks/use-lobby';
import { useApi } from '@/lib/hooks/use-api';
import { useGamePayment } from '@/lib/hooks/use-game-payment';

export default function LobbyContent() {
  const router = useRouter();
  const { games, isLoading } = useLobby();
  const { apiFetch } = useApi();
  const { joinAndPay, isConnected, reset: resetPayment } = useGamePayment();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function handleJoin(gameId: string) {
    if (!isConnected) {
      setJoinError('Please connect your wallet first');
      return;
    }

    const game = games.find(g => g.id === gameId);
    if (!game) return;

    setJoiningId(gameId);
    setJoinError(null);
    resetPayment();

    try {
      // Step 1: Send on-chain payment (approve + joinGame on escrow contract)
      const betAmount = Number(game.bet_amount);
      const paymentResult = await joinAndPay(gameId, betAmount);

      // Step 2: Send txHash to server for verification
      const { data, error } = await apiFetch<{ game: { id: string } }>(
        `/api/games/${gameId}/join`,
        {
          method: 'POST',
          body: JSON.stringify({ txHash: paymentResult.txHash }),
        }
      );

      if (error) {
        setJoinError(error);
        setJoiningId(null);
        return;
      }

      if (data?.game) {
        router.push(`/game/${data.game.id}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      if (!message.includes('cancelled by user')) {
        setJoinError(message);
      }
    }
    setJoiningId(null);
  }

  function handleCreate() {
    router.push('/create');
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Create game + count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-xs text-[var(--muted)]">
            {games.length} open game{games.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Button size="sm" onClick={handleCreate}>
          + Create Game
        </Button>
      </div>

      {/* Error */}
      {joinError && (
        <p className="text-xs text-[var(--danger)] text-center">{joinError}</p>
      )}

      {/* Game list */}
      <LobbyList games={games} onJoin={handleJoin} joiningId={joiningId} />
    </div>
  );
}
