'use client';

import { useRouter } from 'next/navigation';
import DifficultyCard from '@/components/ai/DifficultyCard';
import { AI_DIFFICULTIES } from '@/lib/ai/constants';

export default function PlayAIPage() {
  const router = useRouter();

  function handleSelect(difficultyId: string) {
    router.push(`/game-ai/${difficultyId}`);
  }

  return (
    <div className="flex flex-col px-4 py-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/lobby')}
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          &larr; Back
        </button>
        <h1 className="text-xl font-bold">Play vs AI</h1>
      </div>

      {/* Subtitle */}
      <p className="text-sm text-[var(--muted)] -mt-3">
        Free practice &middot; no bets, just chess
      </p>

      {/* Difficulty cards */}
      <div className="flex flex-col gap-2">
        {AI_DIFFICULTIES.map((diff) => (
          <DifficultyCard
            key={diff.id}
            difficulty={diff}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Info */}
      <p className="text-xs text-[var(--muted)] text-center">
        AI uses your clock too &mdash; 1 minute bullet!
      </p>
    </div>
  );
}
