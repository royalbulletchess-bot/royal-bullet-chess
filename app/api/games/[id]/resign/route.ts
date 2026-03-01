import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { withAuth, apiOk, apiError } from '@/lib/api/helpers';
import { finishGame } from '@/lib/game/finish';
import { broadcastGameUpdate } from '@/lib/game/broadcast';
import type { SessionPayload } from '@/lib/auth/session';
import type { PlayerColor, GameResult, Game } from '@/types';

/**
 * POST /api/games/[id]/resign — Player resigns the game.
 * The resigning player loses.
 */
async function handler(req: NextRequest, session: SessionPayload) {
  const gameId = req.nextUrl.pathname.split('/')[3];

  // Fetch game
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

  // Verify participant
  const isCreator = game.creator_id === session.userId;
  const isOpponent = game.opponent_id === session.userId;

  if (!isCreator && !isOpponent) {
    return apiError('You are not a participant in this game', 403);
  }

  // Determine result — the resigning player loses
  const creatorColor: PlayerColor = game.creator_color as PlayerColor;
  const myColor: PlayerColor = isCreator ? creatorColor : (creatorColor === 'WHITE' ? 'BLACK' : 'WHITE');
  const result: GameResult = myColor === 'WHITE' ? 'BLACK_WIN' : 'WHITE_WIN';
  const winnerId = isCreator ? game.opponent_id : game.creator_id;

  const updatedGame = await finishGame({
    gameId,
    result,
    winnerId,
    finalFen: game.current_fen,
  });

  if (!updatedGame) {
    return apiError('Game already finished or error', 409);
  }

  // Broadcast
  await broadcastGameUpdate(gameId, updatedGame as Game).catch((err) => {
    console.error('[resign] Broadcast error:', err);
  });

  return apiOk({
    game: updatedGame,
    result,
    reason: 'Resignation',
  });
}

export const POST = withAuth(handler);
