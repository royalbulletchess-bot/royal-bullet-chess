'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CreateGameForm from '@/components/lobby/CreateGameForm';
import Button from '@/components/ui/Button';

export default function CreateGamePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function handleSubmit(betAmount: number) {
    setLoading(true);
    // Phase 1: mock game creation — just navigate to a placeholder game
    // In the real flow: create game in DB, then navigate to lobby
    setTimeout(() => {
      setLoading(false);
      // For now, navigate back to lobby with a mock success
      router.push('/lobby');
    }, 800);
    console.log('Creating lobby with bet:', betAmount);
  }

  return (
    <div className="flex flex-col px-4 py-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          &larr; Back
        </Button>
        <h1 className="text-lg font-bold">Create Game</h1>
      </div>

      {/* Form */}
      <CreateGameForm onSubmit={handleSubmit} loading={loading} />

      {/* Info */}
      <div className="text-xs text-[var(--muted)] space-y-1">
        <p>&#9679; Your lobby will be visible to all players</p>
        <p>&#9679; No payment until an opponent joins</p>
        <p>&#9679; Lobby expires after 5 minutes</p>
        <p>&#9679; 10% commission on wins, draws are fully refunded</p>
      </div>
    </div>
  );
}
