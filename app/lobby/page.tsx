'use client';

import { useRouter } from 'next/navigation';
import MainTabs from '@/components/lobby/MainTabs';
import QuickPlayGrid from '@/components/lobby/QuickPlayGrid';
import LobbyContent from '@/components/lobby/LobbyContent';

export default function LobbyPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col px-4 py-6 gap-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Royal Bullet Chess</h1>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          1+0 Bullet &middot; USDC on Base
        </p>
      </div>

      {/* Play vs AI — always visible above tabs */}
      <button
        onClick={() => router.push('/play-ai')}
        className="flex items-center justify-between w-full rounded-xl bg-[var(--card)] border border-[var(--accent)]/30 px-4 py-3 transition-colors hover:bg-[var(--card-hover)] text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{'\u265E'}</span>
          <div>
            <p className="font-medium text-sm">Play vs AI</p>
            <p className="text-xs text-[var(--muted)]">
              Free practice &middot; Choose difficulty
            </p>
          </div>
        </div>
        <span className="text-[var(--accent)] text-sm font-semibold">FREE</span>
      </button>

      {/* Tabs */}
      <MainTabs
        quickPlayContent={<QuickPlayGrid />}
        lobbyContent={<LobbyContent />}
      />
    </div>
  );
}
