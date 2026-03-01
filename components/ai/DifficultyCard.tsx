'use client';

import type { AIDifficulty } from '@/lib/ai/constants';

interface DifficultyCardProps {
  difficulty: AIDifficulty;
  onSelect: (id: string) => void;
}

export default function DifficultyCard({ difficulty, onSelect }: DifficultyCardProps) {
  return (
    <button
      onClick={() => onSelect(difficulty.id)}
      className="flex items-center justify-between w-full rounded-xl bg-[var(--card)] border border-[var(--border)] px-4 py-3 transition-colors hover:bg-[var(--card-hover)] hover:border-[var(--accent)]/40 text-left"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl w-8 text-center">{difficulty.icon}</span>
        <div>
          <p className="font-medium text-sm">{difficulty.label}</p>
          <p className="text-xs text-[var(--muted)]">{difficulty.description}</p>
        </div>
      </div>
      <span className="text-xs text-[var(--muted)] font-mono">
        ~{difficulty.elo}
      </span>
    </button>
  );
}
