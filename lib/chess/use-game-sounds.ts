'use client';

import { useCallback, useRef } from 'react';
import { soundManager } from './sounds';

export interface MoveSound {
  san: string;
  captured?: string;
  isKingsideCastle: boolean;
  isQueensideCastle: boolean;
  isPromotion: boolean;
}

export function useGameSounds() {
  const lastLowTimeTickRef = useRef(0);

  const playMoveSound = useCallback(
    (moveInfo: MoveSound, isCheckmate: boolean) => {
      if (isCheckmate) {
        soundManager.play('checkmate');
      } else if (moveInfo.san.includes('+')) {
        soundManager.play('check');
      } else if (moveInfo.isPromotion) {
        soundManager.play('promote');
      } else if (moveInfo.isKingsideCastle || moveInfo.isQueensideCastle) {
        soundManager.play('castle');
      } else if (moveInfo.captured) {
        soundManager.play('capture');
      } else {
        soundManager.play('move');
      }
    },
    []
  );

  const playGameStart = useCallback(() => {
    soundManager.play('gameStart');
  }, []);

  const playLowTimeTick = useCallback((timeMs: number) => {
    if (timeMs > 10_000 || timeMs <= 0) return;
    const now = Date.now();
    if (now - lastLowTimeTickRef.current >= 900) {
      soundManager.play('lowTime');
      lastLowTimeTickRef.current = now;
    }
  }, []);

  return { playMoveSound, playGameStart, playLowTimeTick };
}
