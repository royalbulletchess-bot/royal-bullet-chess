'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Chess } from 'chess.js';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import PlayerBar from '@/components/chess/PlayerBar';
import CapturedPieces from '@/components/chess/CapturedPieces';
import MoveList from '@/components/chess/MoveList';
import { GAME_TIME_MS, INITIAL_FEN } from '@/lib/constants';
import { getGameOverReason, getTurn } from '@/lib/chess/helpers';
import { getDifficultyById, AI_USERNAME } from '@/lib/ai/constants';
import { useStockfish } from '@/lib/ai/use-stockfish';
import { useGameSounds } from '@/lib/chess/use-game-sounds';
import type { PlayerColor, GameResult } from '@/types';

// Dynamic import to prevent SSR issues with react-chessboard
const ChessBoard = dynamic(() => import('@/components/chess/ChessBoard'), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-square bg-[var(--card)] rounded-sm animate-pulse" />
  ),
});

interface GameOverState {
  result: GameResult;
  reason: string;
}

export default function AIGamePage() {
  const router = useRouter();
  const params = useParams();
  const difficultyId = params.difficulty as string;
  const difficulty = getDifficultyById(difficultyId);

  // Game state
  const [fen, setFen] = useState(INITIAL_FEN);
  const playerColor: PlayerColor = 'WHITE';
  const [whiteTimeMs, setWhiteTimeMs] = useState(GAME_TIME_MS);
  const [blackTimeMs, setBlackTimeMs] = useState(GAME_TIME_MS);
  const [gameOver, setGameOver] = useState<GameOverState | null>(null);
  const [showResignModal, setShowResignModal] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);

  // Sounds
  const { playMoveSound, playGameStart, playLowTimeTick } = useGameSounds();

  // Refs for stale closure prevention
  const lastMoveTimeRef = useRef<number | null>(null);
  const gameOverRef = useRef<GameOverState | null>(null);
  const fenRef = useRef(INITIAL_FEN);
  const gameStartedRef = useRef(false);

  // Keep refs in sync with state
  gameOverRef.current = gameOver;
  fenRef.current = fen;

  // Stockfish engine
  const { isReady, isThinking, error, getMove } = useStockfish({
    difficulty: difficulty || {
      id: 'beginner',
      label: 'Beginner',
      description: '',
      elo: 1200,
      skillLevel: 0,
      moveTimeMs: 50,
      artificialDelayMs: 800,
      icon: '',
    },
    enabled: !gameOver,
  });

  // Play game start sound when engine is ready
  useEffect(() => {
    if (isReady && !gameStartedRef.current) {
      gameStartedRef.current = true;
      playGameStart();
    }
  }, [isReady, playGameStart]);

  const currentTurn = getTurn(fen);
  const isMyTurn = currentTurn === playerColor;

  // Player can only move their own pieces
  const canMove = isMyTurn && !gameOver && isReady;

  // Handle player move
  const handleMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      if (gameOverRef.current) return false;

      const currentFen = fenRef.current;
      // Only allow player color to move
      const turn = getTurn(currentFen);
      if (turn !== 'WHITE') return false;

      const game = new Chess(currentFen);
      try {
        const move = game.move({ from, to, promotion });
        if (!move) return false;

        // Deduct time from the player who just moved
        const now = performance.now();
        if (lastMoveTimeRef.current !== null) {
          const elapsed = now - lastMoveTimeRef.current;
          setWhiteTimeMs((prev) => Math.max(0, prev - elapsed));
        }
        lastMoveTimeRef.current = now;

        const newFen = game.fen();
        setFen(newFen);
        setMoveCount((prev) => prev + 1);
        setLastMove({ from, to });
        setMoveHistory((prev) => [...prev, move.san]);

        // Check for game over
        const overReason = getGameOverReason(newFen);
        const isCheckmate = overReason === 'checkmate';

        // Play sound
        playMoveSound(
          {
            san: move.san,
            captured: move.captured,
            isKingsideCastle: move.san === 'O-O',
            isQueensideCastle: move.san === 'O-O-O',
            isPromotion: !!move.promotion,
          },
          isCheckmate
        );

        if (overReason) {
          if (isCheckmate) {
            const winner =
              getTurn(newFen) === 'WHITE' ? 'BLACK_WIN' : 'WHITE_WIN';
            setGameOver({
              result: winner as GameResult,
              reason: 'Checkmate',
            });
          } else {
            setGameOver({
              result: 'DRAW',
              reason: overReason.replace(/_/g, ' '),
            });
          }
        }

        return true;
      } catch {
        return false;
      }
    },
    [playMoveSound]
  );

  // AI move trigger — watches for Black's turn after player moves
  useEffect(() => {
    if (gameOver || !isReady || !difficulty) return;

    const currentTurnNow = getTurn(fen);
    if (currentTurnNow !== 'BLACK') return;
    if (moveCount === 0) return; // Don't trigger before first player move

    let cancelled = false;

    const makeAIMove = async () => {
      // Artificial delay to feel natural
      await new Promise((resolve) =>
        setTimeout(resolve, difficulty.artificialDelayMs)
      );
      if (cancelled || gameOverRef.current) return;

      const aiMove = await getMove(fen);
      if (cancelled || gameOverRef.current || !aiMove) return;

      const game = new Chess(fen);
      try {
        const result = game.move(aiMove);
        if (!result) return;

        // Deduct real elapsed time from AI's clock
        const now = performance.now();
        if (lastMoveTimeRef.current !== null) {
          const elapsed = now - lastMoveTimeRef.current;
          setBlackTimeMs((prev) => Math.max(0, prev - elapsed));
        }
        lastMoveTimeRef.current = now;

        const newFen = game.fen();
        setFen(newFen);
        setMoveCount((prev) => prev + 1);
        setLastMove({ from: result.from, to: result.to });
        setMoveHistory((prev) => [...prev, result.san]);

        // Check for game over
        const overReason = getGameOverReason(newFen);
        const isCheckmate = overReason === 'checkmate';

        // Play sound for AI move
        playMoveSound(
          {
            san: result.san,
            captured: result.captured,
            isKingsideCastle: result.san === 'O-O',
            isQueensideCastle: result.san === 'O-O-O',
            isPromotion: !!result.promotion,
          },
          isCheckmate
        );

        if (overReason) {
          if (isCheckmate) {
            const winner =
              getTurn(newFen) === 'WHITE' ? 'BLACK_WIN' : 'WHITE_WIN';
            setGameOver({
              result: winner as GameResult,
              reason: 'Checkmate',
            });
          } else {
            setGameOver({
              result: 'DRAW',
              reason: overReason.replace(/_/g, ' '),
            });
          }
        }
      } catch (err) {
        console.error('AI move error:', err);
      }
    };

    makeAIMove();
    return () => {
      cancelled = true;
    };
  }, [fen, moveCount, gameOver, isReady, difficulty, getMove, playMoveSound]);

  function handleTimeout() {
    if (gameOverRef.current) return;
    const loser = getTurn(fenRef.current);
    const result: GameResult = loser === 'WHITE' ? 'BLACK_WIN' : 'WHITE_WIN';
    setGameOver({ result, reason: 'Timeout' });
  }

  function handleResign() {
    setShowResignModal(false);
    setGameOver({ result: 'BLACK_WIN', reason: 'Resignation' });
  }

  // Invalid difficulty — redirect
  if (!difficulty) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-[var(--muted)]">Invalid difficulty level</p>
        <Button size="sm" onClick={() => router.push('/play-ai')}>
          Choose Difficulty
        </Button>
      </div>
    );
  }

  // Determine display
  const aiDisplayName = `${AI_USERNAME} \u00B7 ${difficulty.label}`;
  const myUsername = 'You';

  const isWhiteTimerRunning =
    !gameOver && currentTurn === 'WHITE' && moveCount > 0;
  const isBlackTimerRunning =
    !gameOver && currentTurn === 'BLACK' && moveCount > 0;

  // Opponent (AI) on top, Player on bottom
  const topTimeMs = blackTimeMs;
  const topTimerRunning = isBlackTimerRunning;
  const bottomTimeMs = whiteTimeMs;
  const bottomTimerRunning = isWhiteTimerRunning;

  // Determine result message
  const getResultMessage = () => {
    if (!gameOver) return '';
    if (gameOver.result === 'DRAW') return 'Draw!';
    if (gameOver.result === 'WHITE_WIN') return 'You Win!';
    return 'You Lose!';
  };

  return (
    <div className="flex flex-col h-screen px-2 py-3 gap-2">
      {/* Game Over Banner */}
      {gameOver && (
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-3 text-center">
          <p className="text-lg font-bold">{getResultMessage()}</p>
          <p className="text-xs text-[var(--muted)]">{gameOver.reason}</p>
          <p className="text-xs text-[var(--accent)] mt-1">
            Practice Mode &mdash; No stakes
          </p>
          <div className="flex gap-2 mt-3 justify-center">
            <Button size="sm" onClick={() => router.push('/play-ai')}>
              Play Again
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => router.push('/lobby')}
            >
              Lobby
            </Button>
          </div>
        </div>
      )}

      {/* Engine loading / error state */}
      {!isReady && !gameOver && (
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-3 text-center">
          {error ? (
            <p className="text-xs text-[var(--danger)]">
              Engine error: {error}
            </p>
          ) : (
            <p className="text-xs text-[var(--muted)] animate-pulse">
              Loading chess engine...
            </p>
          )}
        </div>
      )}

      {/* AI (top) */}
      <PlayerBar
        username={aiDisplayName}
        avatar={null}
        timeMs={topTimeMs}
        isTimerRunning={topTimerRunning}
        isCurrentPlayer={currentTurn === 'BLACK'}
        onTimeout={handleTimeout}
        onLowTimeTick={playLowTimeTick}
      />
      <CapturedPieces fen={fen} color="BLACK" />

      {/* Board */}
      <ChessBoard
        fen={fen}
        playerColor={playerColor}
        isMyTurn={canMove}
        isGameOver={!!gameOver}
        onMove={handleMove}
        premoveEnabled={true}
        lastMove={lastMove}
      />

      {/* Player (bottom) */}
      <CapturedPieces fen={fen} color="WHITE" />
      <PlayerBar
        username={myUsername}
        avatar={null}
        timeMs={bottomTimeMs}
        isTimerRunning={bottomTimerRunning}
        isCurrentPlayer={currentTurn === 'WHITE'}
        onTimeout={handleTimeout}
        onLowTimeTick={playLowTimeTick}
      />

      {/* Move list */}
      <MoveList moves={moveHistory} />

      {/* Action buttons — no draw offer for AI */}
      {!gameOver && (
        <div className="flex gap-2 justify-center mt-1">
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowResignModal(true)}
          >
            Resign
          </Button>
        </div>
      )}

      {/* Turn indicator */}
      {!gameOver && (
        <p className="text-center text-xs text-[var(--muted)]">
          {isThinking
            ? 'AI is thinking...'
            : isMyTurn
              ? 'Your turn'
              : "AI's turn"}
          {' '}&middot;{' '}
          Move {Math.floor(moveCount / 2) + 1}
        </p>
      )}

      {/* Resign Modal */}
      <Modal
        open={showResignModal}
        onClose={() => setShowResignModal(false)}
        title="Resign?"
      >
        <p className="text-sm text-[var(--muted)] mb-4">
          Are you sure you want to resign? This counts as a loss.
        </p>
        <div className="flex gap-2">
          <Button
            variant="danger"
            size="sm"
            onClick={handleResign}
            className="flex-1"
          >
            Yes, Resign
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowResignModal(false)}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
