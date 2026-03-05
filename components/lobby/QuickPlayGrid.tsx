'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  QUICK_PLAY_AMOUNTS,
  COMMISSION_RATE,
} from '@/lib/constants';
import { useApi } from '@/lib/hooks/use-api';
import { useGamePayment } from '@/lib/hooks/use-game-payment';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

export default function QuickPlayGrid() {
  const router = useRouter();
  const { apiFetch } = useApi();
  const { createAndPay, status: paymentStatus, error: paymentError, reset: resetPayment, isConnected } = useGamePayment();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [waitingGameId, setWaitingGameId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);
  const supabaseRef = useRef(createClient());

  // Cleanup on unmount
  useEffect(() => {
    const supabase = supabaseRef.current;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  function handleSelect(amount: number) {
    setSelectedAmount(amount);
    setIsSearching(false);
    setSearchError(null);
    resetPayment();
  }

  async function handlePayAndPlay() {
    if (!selectedAmount) return;

    if (!isConnected) {
      setSearchError('Please connect your wallet first');
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      // Step 1: Send on-chain payment (approve + createGame on escrow contract)
      const tempGameId = crypto.randomUUID();
      const paymentResult = await createAndPay(selectedAmount, tempGameId);

      // Step 2: Send txHash to server for verification + matchmaking
      const { data, error } = await apiFetch<{
        game: { id: string; status: string };
        matched: boolean;
      }>('/api/quick-play', {
        method: 'POST',
        body: JSON.stringify({
          betAmount: selectedAmount,
          txHash: paymentResult.txHash,
        }),
      });

      if (error) {
        setSearchError(error);
        setIsSearching(false);
        return;
      }

      if (data?.matched) {
        // Matched with an existing game — go to game
        router.push(`/game/${data.game.id}`);
        return;
      }

      // Created a new OPEN game — subscribe to broadcast channel and wait for opponent
      // Uses broadcast (not postgres_changes) because our custom JWT auth
      // doesn't work with Supabase RLS, which blocks postgres_changes events
      if (data?.game) {
        setWaitingGameId(data.game.id);

        const channel = supabaseRef.current
          .channel(`game-broadcast-${data.game.id}`)
          .on('broadcast', { event: 'game_update' }, (payload) => {
            const update = payload.payload;
            if (update?.status === 'MATCHING' || update?.status === 'ACTIVE') {
              router.push(`/game/${data.game.id}`);
            }
          })
          .subscribe();

        channelRef.current = channel;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      if (!message.includes('cancelled by user')) {
        setSearchError(message);
      }
      setIsSearching(false);
    }
  }

  async function handleCancel() {
    if (channelRef.current) {
      supabaseRef.current.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    // Cancel the server-side game so it doesn't remain OPEN
    if (waitingGameId) {
      await apiFetch(`/api/games/${waitingGameId}/cancel`, { method: 'POST' }).catch(() => {});
    }
    setIsSearching(false);
    setWaitingGameId(null);
    setSearchError(null);
    resetPayment();
  }

  function handleClose() {
    handleCancel();
    setSelectedAmount(null);
  }

  const fee = selectedAmount ? selectedAmount * COMMISSION_RATE : 0;
  const prize = selectedAmount ? selectedAmount * 2 - fee * 2 : 0;

  // Payment status text
  const getStatusText = () => {
    switch (paymentStatus) {
      case 'approving': return 'Approving USDC...';
      case 'approved': return 'USDC approved!';
      case 'sending': return 'Sending to escrow...';
      case 'pending': return 'Confirming on-chain...';
      case 'confirmed': return 'Payment confirmed!';
      default:
        if (waitingGameId) return 'Waiting for opponent...';
        return 'Processing...';
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 4x3 Grid */}
      <div className="grid grid-cols-4 gap-2">
        {QUICK_PLAY_AMOUNTS.map((amount) => (
          <button
            key={amount}
            onClick={() => handleSelect(amount)}
            className="rounded-xl border bg-[var(--card)] border-[var(--border)] px-2 py-3 text-center transition-all hover:bg-[var(--card-hover)] hover:border-[var(--accent)]/40"
          >
            <span className="text-sm font-bold">${amount}</span>
          </button>
        ))}
      </div>

      {/* Info */}
      <p className="text-xs text-[var(--muted)] text-center">
        1+0 Bullet &middot; Winner takes all (minus 10% fee)
      </p>

      {/* Bet Detail Popup */}
      <Modal
        open={selectedAmount !== null}
        onClose={handleClose}
        title={`Quick Play — $${selectedAmount}`}
      >
        {selectedAmount && (
          <div className="flex flex-col gap-4">
            {/* Details */}
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Your bet</span>
                <span className="font-medium">${selectedAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Fee (10%)</span>
                <span className="font-medium text-[var(--muted)]">
                  -${fee.toFixed(2)}
                </span>
              </div>
              <div className="h-px bg-[var(--border)]" />
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Win prize</span>
                <span className="font-bold text-[var(--accent)]">
                  ${prize.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Time control</span>
                <span className="font-medium">1+0 Bullet</span>
              </div>
            </div>

            {/* Error */}
            {(searchError || paymentError) && (
              <p className="text-xs text-[var(--danger)] text-center">
                {searchError || paymentError}
              </p>
            )}

            {/* Actions */}
            {!isSearching ? (
              <div className="flex flex-col gap-2">
                <Button size="lg" className="w-full" onClick={handlePayAndPlay}>
                  💳 Pay & Play ${selectedAmount}
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="w-full"
                  onClick={handleClose}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 items-center">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-[var(--accent)] animate-pulse" />
                  <span className="text-sm text-[var(--muted)]">
                    {getStatusText()}
                  </span>
                </div>
                {waitingGameId && (
                  <Button
                    size="lg"
                    variant="secondary"
                    className="w-full"
                    onClick={handleCancel}
                  >
                    Cancel Search
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
