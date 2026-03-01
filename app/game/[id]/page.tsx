'use client';

import { useRouter, useParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import WaitingScreen from '@/components/game/WaitingScreen';
import ApprovalScreen from '@/components/game/ApprovalScreen';
import ActiveGame from '@/components/game/ActiveGame';
import { useGameState } from '@/lib/hooks/use-game-state';

/**
 * Game page — state-machine-based rendering.
 *
 * Phase flow:
 *   loading   → Spinner
 *   error     → Error screen
 *   waiting   → WaitingScreen (OPEN game, waiting for opponent)
 *   matching  → ApprovalScreen (both players approve)
 *   active    → ActiveGame (multiplayer chess board)
 *   finished  → ActiveGame (shows game over banner)
 */
export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;

  const {
    game,
    phase,
    error: stateError,
    myColor,
    opponent,
    approve,
    isApproving,
    myApproved,
    opponentApproved,
  } = useGameState(gameId);

  // ──────── Loading ────────
  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="text-4xl animate-pulse">{'\u265A'}</div>
        <p className="text-sm text-[var(--muted)]">Loading game...</p>
      </div>
    );
  }

  // ──────── Error ────────
  if (phase === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-6">
        <p className="text-lg font-bold">Game Error</p>
        <p className="text-sm text-[var(--muted)]">{stateError || 'Something went wrong'}</p>
        <Button onClick={() => router.push('/lobby')}>Back to Lobby</Button>
      </div>
    );
  }

  // ──────── Waiting for opponent ────────
  if (phase === 'waiting' && game) {
    return <WaitingScreen game={game} />;
  }

  // ──────── Matching — approval phase ────────
  if (phase === 'matching' && game) {
    return (
      <ApprovalScreen
        game={game}
        opponent={opponent}
        myColor={myColor}
        myApproved={myApproved}
        opponentApproved={opponentApproved}
        onApprove={approve}
        isApproving={isApproving}
      />
    );
  }

  // ──────── Active / Finished game ────────
  if ((phase === 'active' || phase === 'finished') && game) {
    return (
      <ActiveGame
        game={game}
        myColor={myColor || 'WHITE'}
        opponent={opponent}
        gameId={gameId}
      />
    );
  }

  // Fallback
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <div className="text-4xl animate-pulse">{'\u265A'}</div>
      <p className="text-sm text-[var(--muted)]">Loading...</p>
    </div>
  );
}
