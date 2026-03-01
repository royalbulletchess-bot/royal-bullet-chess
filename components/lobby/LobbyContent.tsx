'use client';

import { useRouter } from 'next/navigation';
import LobbyList from '@/components/lobby/LobbyList';
import Button from '@/components/ui/Button';
import { MOCK_LOBBY_GAMES } from '@/lib/mock-data';

export default function LobbyContent() {
  const router = useRouter();

  function handleJoin(gameId: string) {
    router.push(`/game/${gameId}`);
  }

  function handleCreate() {
    router.push('/create');
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Create game + count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-xs text-[var(--muted)]">
            {MOCK_LOBBY_GAMES.length} open games
          </span>
        </div>
        <Button size="sm" onClick={handleCreate}>
          + Create Game
        </Button>
      </div>

      {/* Game list */}
      <LobbyList games={MOCK_LOBBY_GAMES} onJoin={handleJoin} />
    </div>
  );
}
