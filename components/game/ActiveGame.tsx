'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import PlayerBar from '@/components/chess/PlayerBar';
import CapturedPieces from '@/components/chess/CapturedPieces';
import MoveList from '@/components/chess/MoveList';
import DrawOfferBanner from '@/components/game/DrawOfferBanner';
import { useMultiplayerGame } from '@/lib/hooks/use-multiplayer-game';
import { useGameSounds } from '@/lib/chess/use-game-sounds';
import { useApi } from '@/lib/hooks/use-api';
import { useAuth } from '@/lib/auth/AuthContext';
import type { Game, User, PlayerColor } from '@/types';

// Dynamic import to prevent SSR issues with react-chessboard
const ChessBoard = dynamic(() => import('@/components/chess/ChessBoard'), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-square bg-[var(--card)] rounded-sm animate-pulse" />
  ),
});

interface ActiveGameProps {
  game: Game;
  myColor: PlayerColor;
  opponent: User | null;
  gameId: string;
}

/**
 * Active game component — renders the chess board, timers, moves, and action buttons.
 * Uses the multiplayer game hook for server-authoritative moves + Realtime sync.
 * Handles resign, draw offer/accept/reject via API.
 */
export default function ActiveGame({ game, myColor, opponent, gameId }: ActiveGameProps) {
  const router = useRouter();
  const { apiFetch } = useApi();
  const { user } = useAuth();
  const { playLowTimeTick } = useGameSounds();
  const supabase = useRef(createClient()).current;

  const {
    fen,
    playerColor,
    isMyTurn,
    lastMove,
    moveHistory,
    moveCount,
    whiteTimeMs,
    blackTimeMs,
    isWhiteTimerRunning,
    isBlackTimerRunning,
    gameOver,
    handleMove,
    handleTimeout,
    isLoading,
  } = useMultiplayerGame(game, myColor, opponent);

  // ──── Resign & Draw state ────
  const [showResignModal, setShowResignModal] = useState(false);
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [isResigning, setIsResigning] = useState(false);
  const [isOfferingDraw, setIsOfferingDraw] = useState(false);
  const [pendingDrawOffer, setPendingDrawOffer] = useState(false);
  const [isRespondingDraw, setIsRespondingDraw] = useState(false);
  const [drawOfferSent, setDrawOfferSent] = useState(false);

  // ──── Warn before page close during active game ────
  useEffect(() => {
    if (gameOver) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [gameOver]);

  // ──── Listen for draw offer broadcasts ────
  useEffect(() => {
    const channelName = `game-broadcast-${gameId}`;

    const channel = supabase
      .channel(`${channelName}-draw`)
      .on('broadcast', { event: 'draw_offer' }, (payload) => {
        const offer = payload.payload as {
          offered_by: string;
          status: string;
        };

        // Opponent offered a draw
        if (offer.status === 'PENDING' && offer.offered_by !== game.creator_id && offer.offered_by !== game.opponent_id) {
          return; // Invalid
        }

        if (offer.status === 'PENDING') {
          if (offer.offered_by !== user?.id) {
            setPendingDrawOffer(true);
          }
        } else if (offer.status === 'REJECTED') {
          setPendingDrawOffer(false);
          setDrawOfferSent(false);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, supabase, game.creator_id, game.opponent_id, game.creator_color, myColor, user?.id]);

  // ──── Actions ────

  async function handleResign() {
    setIsResigning(true);
    setShowResignModal(false);

    const { error } = await apiFetch(`/api/games/${gameId}/resign`, {
      method: 'POST',
    });

    if (error) {
      console.error('Resign error:', error);
    }
    setIsResigning(false);
  }

  async function handleDrawOffer() {
    setIsOfferingDraw(true);
    setShowDrawModal(false);

    const { error } = await apiFetch(`/api/games/${gameId}/draw-offer`, {
      method: 'POST',
      body: JSON.stringify({ action: 'offer' }),
    });

    if (error) {
      console.error('Draw offer error:', error);
    } else {
      setDrawOfferSent(true);
    }
    setIsOfferingDraw(false);
  }

  async function handleAcceptDraw() {
    setIsRespondingDraw(true);

    const { error } = await apiFetch(`/api/games/${gameId}/draw-offer`, {
      method: 'POST',
      body: JSON.stringify({ action: 'accept' }),
    });

    if (error) {
      console.error('Accept draw error:', error);
    }
    setPendingDrawOffer(false);
    setIsRespondingDraw(false);
  }

  async function handleRejectDraw() {
    setIsRespondingDraw(true);

    const { error } = await apiFetch(`/api/games/${gameId}/draw-offer`, {
      method: 'POST',
      body: JSON.stringify({ action: 'reject' }),
    });

    if (error) {
      console.error('Reject draw error:', error);
    }
    setPendingDrawOffer(false);
    setIsRespondingDraw(false);
  }

  // ──── Player info ────
  const myUsername = 'You';
  const opponentUsername = opponent?.farcaster_username || 'Opponent';

  const topColor: PlayerColor = playerColor === 'WHITE' ? 'BLACK' : 'WHITE';
  const topUsername = opponentUsername;
  const topAvatar = opponent?.farcaster_avatar || null;
  const topTimeMs = topColor === 'WHITE' ? whiteTimeMs : blackTimeMs;
  const topTimerRunning = topColor === 'WHITE' ? isWhiteTimerRunning : isBlackTimerRunning;

  const bottomUsername = myUsername;
  const bottomAvatar = null;
  const bottomTimeMs = playerColor === 'WHITE' ? whiteTimeMs : blackTimeMs;
  const bottomTimerRunning = playerColor === 'WHITE' ? isWhiteTimerRunning : isBlackTimerRunning;

  const currentTurn = fen.split(' ')[1] === 'w' ? 'WHITE' : 'BLACK';

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="text-4xl animate-pulse">{'\u265A'}</div>
        <p className="text-sm text-[var(--muted)]">Preparing board...</p>
      </div>
    );
  }

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

      {/* Draw Offer Banner (when opponent offers) */}
      {pendingDrawOffer && !gameOver && (
        <DrawOfferBanner
          onAccept={handleAcceptDraw}
          onReject={handleRejectDraw}
          isResponding={isRespondingDraw}
        />
      )}

      {/* Draw offer sent indicator */}
      {drawOfferSent && !gameOver && !pendingDrawOffer && (
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-2 text-center">
          <p className="text-xs text-[var(--muted)]">½ Draw offer sent — waiting for response...</p>
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
        isMyTurn={isMyTurn}
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
            loading={isOfferingDraw}
            disabled={drawOfferSent}
          >
            {drawOfferSent ? '½ Offered' : '½ Draw'}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowResignModal(true)}
            loading={isResigning}
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
      <Modal open={showResignModal} onClose={() => setShowResignModal(false)} title="Resign?">
        <p className="text-sm text-[var(--muted)] mb-4">
          Are you sure you want to resign? This counts as a loss.
        </p>
        <div className="flex gap-2">
          <Button
            variant="danger"
            size="sm"
            onClick={handleResign}
            loading={isResigning}
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

      {/* Draw Offer Modal */}
      <Modal open={showDrawModal} onClose={() => setShowDrawModal(false)} title="Offer Draw?">
        <p className="text-sm text-[var(--muted)] mb-4">
          Send a draw offer to your opponent?
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleDrawOffer}
            loading={isOfferingDraw}
            className="flex-1"
          >
            Offer Draw
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowDrawModal(false)}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
