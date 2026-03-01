'use client';

import { useEffect, useState, useRef } from 'react';
import { formatTime } from '@/lib/chess/helpers';
import { LOW_TIME_WARNING_MS } from '@/lib/constants';

interface TimerProps {
  initialTimeMs: number;
  isRunning: boolean;
  onTimeout: () => void;
  onLowTimeTick?: (remainingMs: number) => void;
}

export default function Timer({ initialTimeMs, isRunning, onTimeout, onLowTimeTick }: TimerProps) {
  const [displayMs, setDisplayMs] = useState(initialTimeMs);
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const timeAtStartRef = useRef<number>(initialTimeMs);
  const onTimeoutRef = useRef(onTimeout);
  const onLowTimeTickRef = useRef(onLowTimeTick);

  // Keep refs in sync to avoid stale closures
  onTimeoutRef.current = onTimeout;
  onLowTimeTickRef.current = onLowTimeTick;

  // Sync when initialTimeMs changes externally (opponent made a move)
  useEffect(() => {
    setDisplayMs(initialTimeMs);
    timeAtStartRef.current = initialTimeMs;
  }, [initialTimeMs]);

  useEffect(() => {
    if (!isRunning) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    startTimeRef.current = performance.now();
    timeAtStartRef.current = displayMs;

    function tick() {
      const elapsed = performance.now() - startTimeRef.current;
      const remaining = Math.max(0, timeAtStartRef.current - elapsed);
      setDisplayMs(remaining);

      if (onLowTimeTickRef.current) {
        onLowTimeTickRef.current(remaining);
      }

      if (remaining <= 0) {
        onTimeoutRef.current();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLowTime = displayMs <= LOW_TIME_WARNING_MS && displayMs > 0;
  const isExpired = displayMs <= 0;

  return (
    <div
      className={`
        font-[family-name:var(--font-geist-mono)] text-2xl font-bold tabular-nums
        rounded-xl px-4 py-2 min-w-[100px] text-center transition-colors
        ${isExpired
          ? 'bg-[var(--danger)] text-white'
          : isLowTime
            ? 'bg-[var(--danger)]/20 text-[var(--danger)] animate-pulse'
            : isRunning
              ? 'bg-[var(--card)] text-[var(--foreground)]'
              : 'bg-[var(--card)] text-[var(--muted)]'
        }
      `}
    >
      {formatTime(displayMs)}
    </div>
  );
}
