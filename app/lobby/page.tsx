'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import Avatar from '@/components/ui/Avatar';
import MainTabs from '@/components/lobby/MainTabs';
import QuickPlayGrid from '@/components/lobby/QuickPlayGrid';
import LobbyContent from '@/components/lobby/LobbyContent';
import WalletInfo from '@/components/wallet/WalletInfo';
import NotificationBell from '@/components/lobby/NotificationBell';

export default function LobbyPage() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <div className="flex flex-col px-4 py-6 gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Royal Bullet Chess</h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            1+0 Bullet &middot; USDC on Base
          </p>
        </div>
        {user && (
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="text-right">
              <p className="text-xs font-medium truncate max-w-[100px]">
                {user.farcaster_username}
              </p>
              <p className="text-[10px] text-[var(--muted)]">
                ELO {user.elo_rating}
              </p>
            </div>
            <Avatar
              src={user.farcaster_avatar}
              username={user.farcaster_username}
              size="sm"
            />
          </div>
        )}
      </div>

      {/* Wallet Info (on-chain balance) */}
      <WalletInfo />

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
