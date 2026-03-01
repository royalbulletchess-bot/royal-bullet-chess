'use client';

import { useRef, useEffect } from 'react';

interface MoveListProps {
  moves: string[];
}

export default function MoveList({ moves }: MoveListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [moves.length]);

  if (moves.length === 0) return null;

  const pairs: { number: number; white: string; black?: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto px-2 py-1.5 text-xs font-[family-name:var(--font-geist-mono)] bg-[var(--card)] rounded-lg border border-[var(--border)]"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {pairs.map((pair) => (
        <div key={pair.number} className="flex items-center gap-1 shrink-0">
          <span className="text-[var(--muted)]">{pair.number}.</span>
          <span>{pair.white}</span>
          {pair.black && <span>{pair.black}</span>}
        </div>
      ))}
    </div>
  );
}
