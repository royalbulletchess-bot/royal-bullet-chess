'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { StockfishService, parseUCIMove } from './stockfish-service';
import type { AIDifficulty } from './constants';

interface UseStockfishOptions {
  difficulty: AIDifficulty;
  enabled: boolean;
}

interface UseStockfishReturn {
  isReady: boolean;
  isThinking: boolean;
  error: string | null;
  getMove: (
    fen: string
  ) => Promise<{ from: string; to: string; promotion?: string } | null>;
}

export function useStockfish({
  difficulty,
  enabled,
}: UseStockfishOptions): UseStockfishReturn {
  const serviceRef = useRef<StockfishService | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const difficultyRef = useRef(difficulty);
  difficultyRef.current = difficulty;

  useEffect(() => {
    if (!enabled) return;

    const service = new StockfishService();
    serviceRef.current = service;
    let disposed = false;

    service
      .init()
      .then(() => {
        if (disposed) return;
        return service.setDifficulty(difficulty.skillLevel);
      })
      .then(() => {
        if (disposed) return;
        setIsReady(true);
      })
      .catch((err) => {
        if (disposed) return;
        console.error('Stockfish init error:', err);
        setError(err.message || 'Failed to load chess engine');
      });

    return () => {
      disposed = true;
      service.dispose();
      serviceRef.current = null;
      setIsReady(false);
    };
  }, [difficulty.skillLevel, enabled]);

  const getMove = useCallback(
    async (
      fen: string
    ): Promise<{ from: string; to: string; promotion?: string } | null> => {
      const service = serviceRef.current;
      if (!service) return null;

      setIsThinking(true);
      try {
        const uciMove = await service.getBestMove(
          fen,
          difficultyRef.current.moveTimeMs
        );
        return parseUCIMove(uciMove);
      } catch (err) {
        console.error('Stockfish move error:', err);
        return null;
      } finally {
        setIsThinking(false);
      }
    },
    []
  );

  return { isReady, isThinking, error, getMove };
}
