'use client';

import Avatar from '@/components/ui/Avatar';
import Timer from './Timer';

interface PlayerBarProps {
  username: string;
  avatar: string | null;
  timeMs: number;
  isTimerRunning: boolean;
  isCurrentPlayer: boolean;
  onTimeout: () => void;
  onLowTimeTick?: (remainingMs: number) => void;
}

export default function PlayerBar({
  username,
  avatar,
  timeMs,
  isTimerRunning,
  isCurrentPlayer,
  onTimeout,
  onLowTimeTick,
}: PlayerBarProps) {
  return (
    <div
      className={`
        flex items-center justify-between px-3 py-2 rounded-xl
        ${isCurrentPlayer ? 'bg-[var(--card)] border border-[var(--border)]' : ''}
      `}
    >
      <div className="flex items-center gap-2">
        <Avatar src={avatar} username={username} size="sm" />
        <span className="text-sm font-medium truncate max-w-[120px]">
          {username}
        </span>
        {isTimerRunning && (
          <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
        )}
      </div>
      <Timer
        initialTimeMs={timeMs}
        isRunning={isTimerRunning}
        onTimeout={onTimeout}
        onLowTimeTick={onLowTimeTick}
      />
    </div>
  );
}
