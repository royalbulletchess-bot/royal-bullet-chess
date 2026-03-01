'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  QUICK_PLAY_AMOUNTS,
  QUICK_PLAY_SEARCH_TIMEOUT_MS,
  COMMISSION_RATE,
} from '@/lib/constants';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

export default function QuickPlayGrid() {
  const router = useRouter();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleSelect(amount: number) {
    setSelectedAmount(amount);
    setIsSearching(false);
  }

  function handleSearch() {
    if (!selectedAmount) return;
    setIsSearching(true);

    // Phase 1 mock: after timeout, navigate to game
    timerRef.current = setTimeout(() => {
      const gameId = `qp-${selectedAmount}-${Date.now()}`;
      router.push(`/game/${gameId}`);
    }, QUICK_PLAY_SEARCH_TIMEOUT_MS);
  }

  function handleCancel() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setIsSearching(false);
  }

  function handleClose() {
    handleCancel();
    setSelectedAmount(null);
  }

  const fee = selectedAmount ? selectedAmount * COMMISSION_RATE : 0;
  const prize = selectedAmount ? selectedAmount * 2 - fee * 2 : 0;

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

            {/* Actions */}
            {!isSearching ? (
              <div className="flex flex-col gap-2">
                <Button size="lg" className="w-full" onClick={handleSearch}>
                  Search Opponent
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
                    Searching for opponent...
                  </span>
                </div>
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full"
                  onClick={handleCancel}
                >
                  Cancel Search
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
