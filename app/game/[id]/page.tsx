'use client';

import { useState, useCallback, useRef } from 'react';
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

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;

  // Phase 1: mock single-player game (White vs yourself for testing)
  const [fen, setFen] = useState(INITIAL_FEN);
  const [playerColor] = useState<PlayerColor>('WHITE');
  const [whiteTimeMs, setWhiteTimeMs] = useState(GAME_TIME_MS);
  const [blackTimeMs, setBlackTimeMs] = useState(GAME_TIME_MS);
  const [gameOver, setGameOver] = useState<GameOverState | null>(null);
  const [showResignModal, setShowResignModal] = useState(false);
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);

  // Sounds
  const { playMoveSound, playLowTimeTick } = useGameSounds();

  // Use refs to avoid stale closures in callbacks
  const lastMoveTimeRef = useRef<number | null>(null);
  const gameOverRef = useRef<GameOverState | null>(null);
  const fenRef = useRef(INITIAL_FEN);

  // Keep refs in sync with state
  gameOverRef.current = gameOver;
  fenRef.current = fen;

  const currentTurn = getTurn(fen);
  const isMyTurn = currentTurn === playerColor;

  // In Phase 1, we allow moving both colors for testing
  const canMove = !gameOver;

  const handleMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      if (gameOverRef.current) return false;

      const currentFen = fenRef.current;
      const game = new Chess(currentFen);
      try {
        const move = game.move({ from, to, promotion });
        if (!move) return false;

        // Deduct time from the player who just moved
        const now = performance.now();
        if (lastMoveTimeRef.current !== null) {
          const elapsed = now - lastMoveTimeRef.current;
          const movingColor = getTurn(currentFen);
          if (movingColor === 'WHITE') {
            setWhiteTimeMs((prev) => Math.max(0, prev - elapsed));
          } else {
            setBlackTimeMs((prev) => Math.max(0, prev - elapsed));
          }
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
            const winner = getTurn(newFen) === 'WHITE' ? 'BLACK_WIN' : 'WHITE_WIN';
            setGameOver({ result: winner as GameResult, reason: 'Checkmate' });
          } else {
            setGameOver({ result: 'DRAW', reason: overReason.replace(/_/g, ' ') });
          }
        }

        return true;
      } catch {
        return false;
      }
    },
    [playMoveSound]
  );

  function handleTimeout() {
    if (gameOverRef.current) return;
    const loser = getTurn(fenRef.current);
    const result: GameResult = loser === 'WHITE' ? 'BLACK_WIN' : 'WHITE_WIN';
    setGameOver({ result, reason: 'Timeout' });
  }

  function handleResign() {
    setShowResignModal(false);
    const result: GameResult = playerColor === 'WHITE' ? 'BLACK_WIN' : 'WHITE_WIN';
    setGameOver({ result, reason: 'Resignation' });
  }

  function handleDrawOffer() {
    setShowDrawModal(false);
    // Phase 1: auto-accept draw for testing
    setGameOver({ result: 'DRAW', reason: 'Mutual agreement' });
  }

  // Determine display names
  const myUsername = 'You';
  const opponentUsername = 'Opponent';

  const isWhiteTimerRunning = !gameOver && currentTurn === 'WHITE' && moveCount > 0;
  const isBlackTimerRunning = !gameOver && currentTurn === 'BLACK' && moveCount > 0;

  // Flip display: opponent on top, player on bottom
  const topColor: PlayerColor = playerColor === 'WHITE' ? 'BLACK' : 'WHITE';
  const topUsername = playerColor === 'WHITE' ? opponentUsername : myUsername;
  const topAvatar = null;
  const topTimeMs = topColor === 'WHITE' ? whiteTimeMs : blackTimeMs;
  const topTimerRunning = topColor === 'WHITE' ? isWhiteTimerRunning : isBlackTimerRunning;

  const bottomUsername = playerColor === 'WHITE' ? myUsername : opponentUsername;
  const bottomAvatar = null;
  const bottomTimeMs = playerColor === 'WHITE' ? whiteTimeMs : blackTimeMs;
  const bottomTimerRunning = playerColor === 'WHITE' ? isWhiteTimerRunning : isBlackTimerRunning;

  return (
    <div className="flex flex-col h-screen px-2 py-3 gap-2">
      {/* Game Over Banner */}
      {gameOver && (
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-3 text-center">
          <p className="text-lg font-bold">
            {gameOver.result === 'DRAW'
              ? 'Draw!'
              : gameOver.result === (playerColor === 'WHITE' ? 'WHITE_WIN' : 'BLACK_WIN')
                ? 'You Win!'
                : 'You Lose!'}
          </p>
          <p className="text-xs text-[var(--muted)]">{gameOver.reason}</p>
          <div className="flex gap-2 mt-3 justify-center">
            <Button size="sm" onClick={() => router.push(`/game-over/${gameId}`)}>
              Details
            </Button>
            <Button size="sm" variant="secondary" onClick={() => router.push('/lobby')}>
              Lobby
            </Button>
          </div>
        </div>
      )}

      {/* Opponent (top) */}
      <PlayerBar
        username={topUsername}
        avatar={topAvatar}
        timeMs={topTimeMs}
        isTimerRunning={topTimerRunning}
        isCurrentPlayer={currentTurn === topColor}
        onTimeout={handleTimeout}
        onLowTimeTick={playLowTimeTick}
      />
      <CapturedPieces fen={fen} color={topColor} />

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
      <CapturedPieces fen={fen} color={playerColor} />
      <PlayerBar
        username={bottomUsername}
        avatar={bottomAvatar}
        timeMs={bottomTimeMs}
        isTimerRunning={bottomTimerRunning}
        isCurrentPlayer={currentTurn === playerColor}
        onTimeout={handleTimeout}
        onLowTimeTick={playLowTimeTick}
      />

      {/* Move list */}
      <MoveList moves={moveHistory} />

      {/* Action buttons */}
      {!gameOver && (
        <div className="flex gap-2 justify-center mt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDrawModal(true)}
          >
            &#189; Draw
          </Button>
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
          {isMyTurn ? "Your turn" : "Opponent's turn"}
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
          <Button variant="danger" size="sm" onClick={handleResign} className="flex-1">
            Yes, Resign
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowResignModal(false)} className="flex-1">
            Cancel
          </Button>
        </div>
      </Modal>

      {/* Draw Offer Modal */}
      <Modal
        open={showDrawModal}
        onClose={() => setShowDrawModal(false)}
        title="Offer Draw?"
      >
        <p className="text-sm text-[var(--muted)] mb-4">
          Send a draw offer to your opponent?
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleDrawOffer} className="flex-1">
            Offer Draw
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowDrawModal(false)} className="flex-1">
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
