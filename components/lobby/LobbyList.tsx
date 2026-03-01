'use client';

import type { LobbyGame } from '@/types';
import LobbyCard from './LobbyCard';

interface LobbyListProps {
  games: LobbyGame[];
  onJoin: (gameId: string) => void;
}

export default function LobbyList({ games, onJoin }: LobbyListProps) {
  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-4xl mb-3">&#9822;</div>
        <p className="text-[var(--muted)] text-sm">
          No open games right now.
        </p>
        <p className="text-[var(--muted)] text-xs mt-1">
          Create one and be the first!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {games.map((game) => (
        <LobbyCard key={game.id} game={game} onJoin={onJoin} />
      ))}
    </div>
  );
}
