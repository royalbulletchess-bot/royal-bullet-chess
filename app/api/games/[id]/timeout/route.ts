import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { withAuth, apiOk, apiError } from '@/lib/api/helpers';
import { finishGame } from '@/lib/game/finish';
import { broadcastGameUpdate } from '@/lib/game/broadcast';
import type { SessionPayload } from '@/lib/auth/session';
import type { PlayerColor, GameResult, Game } from '@/types';

/**
 * POST /api/games/[id]/timeout — Claim that the opponent timed out.
 *
 * The server verifies by calculating elapsed time from last_move_at.
 * Only the NON-timed-out player should call this (i.e. the one whose turn it is NOT).
 */
async function handler(req: NextRequest, session: SessionPayload) {
  const gameId = req.nextUrl.pathname.split('/')[3];

  // 1. Fetch game
  const { data: game, error: fetchError } = await supabaseAdmin
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (fetchError || !game) {
    return apiError('Game not found', 404);
  }

  if (game.status !== 'ACTIVE') {
    return apiError('Game is not active');
  }

  // 2. Verify caller is a participant
  const isCreator = game.creator_id === session.userId;
  const isOpponent = game.opponent_id === session.userId;

  if (!isCreator && !isOpponent) {
    return apiError('You are not a participant in this game', 403);
  }

  // 3. Determine whose turn it is (the player whose clock is running)
  const fenParts = game.current_fen.split(' ');
  const turnColor: PlayerColor = fenParts[1] === 'w' ? 'WHITE' : 'BLACK';

  // 4. Calculate time remaining for the active player
  const now = new Date();
  const lastMoveAt = game.last_move_at
    ? new Date(game.last_move_at)
    : new Date(game.started_at);
  const elapsedMs = now.getTime() - lastMoveAt.getTime();

  const activeTimeMs: number = turnColor === 'WHITE'
    ? game.white_time_remaining_ms
    : game.black_time_remaining_ms;

  const remaining = activeTimeMs - elapsedMs;

  // 5. Verify timeout actually occurred
  if (remaining > 0) {
    return apiError('No timeout — player still has time');
  }

  // 6. Finish the game — the player whose turn it is loses
  const result: GameResult = turnColor === 'WHITE' ? 'BLACK_WIN' : 'WHITE_WIN';

  // Determine winner user ID
  const creatorColor: PlayerColor = game.creator_color as PlayerColor;
  const winnerId = turnColor === creatorColor
    ? game.opponent_id
    : game.creator_id;

  const updatedGame = await finishGame({
    gameId,
    result,
    winnerId,
    finalFen: game.current_fen,
  });

  if (!updatedGame) {
    return apiError('Game already finished or error', 409);
  }

  // Broadcast game over to both players
  await broadcastGameUpdate(gameId, updatedGame as Game).catch((err) => {
    console.error('[timeout] Broadcast error:', err);
  });

  return apiOk({
    game: updatedGame,
    result,
    reason: 'Timeout',
  });
}

export const POST = withAuth(handler);
