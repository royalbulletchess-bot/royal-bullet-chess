'use client';

import { useMemo } from 'react';
import { getCapturedPieces } from '@/lib/chess/helpers';

const PIECE_SYMBOLS: Record<string, { white: string; black: string }> = {
  q: { white: '\u2655', black: '\u265B' },
  r: { white: '\u2656', black: '\u265C' },
  b: { white: '\u2657', black: '\u265D' },
  n: { white: '\u2658', black: '\u265E' },
  p: { white: '\u2659', black: '\u265F' },
};

interface CapturedPiecesProps {
  fen: string;
  color: 'WHITE' | 'BLACK';
}

export default function CapturedPieces({ fen, color }: CapturedPiecesProps) {
  const { white, black, advantage } = useMemo(
    () => getCapturedPieces(fen),
    [fen]
  );

  const pieces = color === 'WHITE' ? white : black;
  const materialDiff = color === 'WHITE' ? advantage : -advantage;

  if (pieces.length === 0 && materialDiff <= 0) return null;

  return (
    <div className="flex items-center gap-0.5 min-h-[18px] px-1">
      <div className="flex items-center flex-wrap text-sm opacity-70 leading-none">
        {pieces.map((piece, i) => (
          <span key={`${piece}-${i}`}>
            {PIECE_SYMBOLS[piece]?.[color === 'WHITE' ? 'black' : 'white'] ??
              ''}
          </span>
        ))}
      </div>
      {materialDiff > 0 && (
        <span className="text-xs text-[var(--muted)] ml-1">
          +{materialDiff}
        </span>
      )}
    </div>
  );
}
