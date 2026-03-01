import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { withAuth, apiOk, apiError } from '@/lib/api/helpers';
import type { SessionPayload } from '@/lib/auth/session';

/**
 * POST /api/games/[id]/rematch — Request a rematch
 * Creates a notification for the opponent and returns the new game details.
 */
async function handler(req: NextRequest, session: SessionPayload) {
  const gameId = req.nextUrl.pathname.split('/')[3]; // /api/games/[id]/rematch

  // Fetch original game
  const { data: game, error: fetchError } = await supabaseAdmin
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (fetchError || !game) {
    return apiError('Game not found', 404);
  }

  if (game.status !== 'FINISHED') {
    return apiError('Game is not finished');
  }

  // Determine who the opponent is
  const isCreator = game.creator_id === session.userId;
  const isOpponent = game.opponent_id === session.userId;

  if (!isCreator && !isOpponent) {
    return apiError('You are not a participant in this game', 403);
  }

  const opponentId = isCreator ? game.opponent_id : game.creator_id;

  if (!opponentId) {
    return apiError('No opponent to rematch');
  }

  // Check if there's already a pending rematch notification for this game
  const { count } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', gameId)
    .eq('type', 'REMATCH_REQUEST')
    .eq('read', false);

  if (count && count > 0) {
    return apiError('Rematch already requested');
  }

  // Create notification for opponent
  const { error: notifError } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: opponentId,
      type: 'REMATCH_REQUEST',
      game_id: gameId,
    });

  if (notifError) {
    console.error('[rematch] Notification error:', notifError);
    return apiError('Failed to send rematch request', 500);
  }

  return apiOk({ sent: true, opponentId });
}

export const POST = withAuth(handler);
