'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { BET_AMOUNTS, MAX_CUSTOM_BET, MIN_CUSTOM_BET_STEP } from '@/lib/constants';

interface CreateGameFormProps {
  onSubmit: (betAmount: number) => void;
  loading?: boolean;
}

export default function CreateGameForm({ onSubmit, loading }: CreateGameFormProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(BET_AMOUNTS[0]);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);

  function handlePresetClick(amount: number) {
    setSelectedAmount(amount);
    setIsCustom(false);
    setCustomAmount('');
  }

  function handleCustomToggle() {
    setIsCustom(true);
    setCustomAmount('');
  }

  function handleCustomChange(value: string) {
    const numericOnly = value.replace(/[^0-9]/g, '');
    setCustomAmount(numericOnly);
  }

  function getEffectiveAmount(): number {
    if (isCustom) {
      const parsed = parseInt(customAmount, 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return selectedAmount;
  }

  function isValidAmount(): boolean {
    const amount = getEffectiveAmount();
    if (amount <= 0) return false;
    if (isCustom) {
      return amount >= MIN_CUSTOM_BET_STEP && amount <= MAX_CUSTOM_BET && amount % MIN_CUSTOM_BET_STEP === 0;
    }
    return true;
  }

  function handleSubmit() {
    if (isValidAmount()) {
      onSubmit(getEffectiveAmount());
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Preset amounts */}
      <div>
        <label className="text-xs text-[var(--muted)] mb-2 block">
          Select bet amount (USDC)
        </label>
        <div className="grid grid-cols-4 gap-2">
          {BET_AMOUNTS.map((amount) => (
            <button
              key={amount}
              onClick={() => handlePresetClick(amount)}
              className={`
                rounded-xl py-3 text-sm font-bold transition-colors border
                ${!isCustom && selectedAmount === amount
                  ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                  : 'bg-[var(--card)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--card-hover)]'
                }
              `}
            >
              ${amount}
            </button>
          ))}
        </div>
      </div>

      {/* Custom amount */}
      <div>
        <button
          onClick={handleCustomToggle}
          className={`
            text-xs mb-2 transition-colors
            ${isCustom ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}
          `}
        >
          Custom amount
        </button>
        {isCustom && (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={customAmount}
              onChange={(e) => handleCustomChange(e.target.value)}
              placeholder={`${MIN_CUSTOM_BET_STEP} - ${MAX_CUSTOM_BET}`}
              className="w-full rounded-xl bg-[var(--card)] border border-[var(--border)] pl-7 pr-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
            {isCustom && customAmount && !isValidAmount() && (
              <p className="text-xs text-[var(--danger)] mt-1">
                Must be a multiple of ${MIN_CUSTOM_BET_STEP}, max ${MAX_CUSTOM_BET}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Summary + Submit */}
      <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-[var(--muted)]">Your bet</span>
          <span className="font-bold">${getEffectiveAmount()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--muted)]">Potential win</span>
          <span className="font-bold text-[var(--accent)]">
            ${(getEffectiveAmount() * 2 * 0.9).toFixed(2)}
          </span>
        </div>
      </div>

      <Button
        size="lg"
        onClick={handleSubmit}
        disabled={!isValidAmount()}
        loading={loading}
        className="w-full"
      >
        Create Lobby &mdash; ${getEffectiveAmount()}
      </Button>
    </div>
  );
}
