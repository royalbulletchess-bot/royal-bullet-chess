'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CreateGameForm from '@/components/lobby/CreateGameForm';
import Button from '@/components/ui/Button';
import { useApi } from '@/lib/hooks/use-api';
import { useGamePayment } from '@/lib/hooks/use-game-payment';

export default function CreateGamePage() {
  const router = useRouter();
  const { apiFetch } = useApi();
  const { createAndPay, status: paymentStatus, error: paymentError, reset: resetPayment, isConnected } = useGamePayment();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(betAmount: number) {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError(null);
    resetPayment();

    try {
      // Step 1: Send on-chain payment (approve + createGame on escrow contract)
      const tempGameId = crypto.randomUUID();
      const paymentResult = await createAndPay(betAmount, tempGameId);

      // Step 2: Send txHash to server for verification + DB game creation
      const { data, error: apiErr } = await apiFetch<{ game: { id: string } }>(
        '/api/games',
        {
          method: 'POST',
          body: JSON.stringify({
            betAmount,
            txHash: paymentResult.txHash,
          }),
        }
      );

      if (apiErr) {
        setError(apiErr);
        setLoading(false);
        return;
      }

      // Game created — navigate to lobby
      if (data?.game) {
        router.push('/lobby');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      if (!message.includes('cancelled by user')) {
        setError(message);
      }
    }
    setLoading(false);
  }

  // Payment status text
  const getStatusText = () => {
    switch (paymentStatus) {
      case 'approving': return 'Approving USDC in wallet...';
      case 'approved': return 'USDC approved!';
      case 'sending': return 'Sending to escrow contract...';
      case 'pending': return 'Confirming on-chain...';
      case 'confirmed': return 'Payment confirmed! Creating game...';
      default: return '';
    }
  };

  return (
    <div className="flex flex-col px-4 py-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          &larr; Back
        </Button>
        <h1 className="text-lg font-bold">Create Game</h1>
      </div>

      {/* Payment status */}
      {paymentStatus !== 'idle' && paymentStatus !== 'error' && (
        <div className="flex items-center gap-2 justify-center">
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-sm text-[var(--muted)]">{getStatusText()}</span>
        </div>
      )}

      {/* Error */}
      {(error || paymentError) && (
        <p className="text-xs text-[var(--danger)] text-center">{error || paymentError}</p>
      )}

      {/* Form */}
      <CreateGameForm onSubmit={handleSubmit} loading={loading} />

      {/* Info */}
      <div className="text-xs text-[var(--muted)] space-y-1">
        <p>&#9679; USDC payment via wallet (on-chain escrow)</p>
        <p>&#9679; Your bet is held in a smart contract</p>
        <p>&#9679; Lobby expires after 5 minutes (auto-refund)</p>
        <p>&#9679; 10% commission on wins, draws are fully refunded</p>
      </div>
    </div>
  );
}
