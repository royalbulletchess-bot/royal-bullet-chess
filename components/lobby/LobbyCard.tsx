'use client';

import type { LobbyGame } from '@/types';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';

interface LobbyCardProps {
  game: LobbyGame;
  onJoin: (gameId: string) => void;
}

function getWaitingTime(createdAt: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / 1000
  );
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export default function LobbyCard({ game, onJoin }: LobbyCardProps) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[var(--card)] border border-[var(--border)] px-4 py-3 transition-colors hover:bg-[var(--card-hover)]">
      <div className="flex items-center gap-3">
        <Avatar src={game.creator_avatar} username={game.creator_username} size="sm" />
        <div>
          <p className="font-medium text-sm">{game.creator_username}</p>
          <p className="text-xs text-[var(--muted)]">
            waiting {getWaitingTime(game.created_at)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-[var(--background)] px-3 py-1 text-sm font-bold text-[var(--accent)]">
          ${game.bet_amount}
        </span>
        <Button size="sm" onClick={() => onJoin(game.id)}>
          Join
        </Button>
      </div>
    </div>
  );
}
