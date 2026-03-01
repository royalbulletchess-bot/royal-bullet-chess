import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { withAuth, apiOk, apiError } from '@/lib/api/helpers';
import { broadcastGameUpdate } from '@/lib/game/broadcast';
import type { SessionPayload } from '@/lib/auth/session';
import type { Game } from '@/types';

/**
 * POST /api/games/[id]/approve — Player approves the match
 * When both players approve, game transitions to ACTIVE.
 */
async function handler(req: NextRequest, session: SessionPayload) {
  const gameId = req.nextUrl.pathname.split('/')[3]; // /api/games/[id]/approve

  // Fetch game
  const { data: game, error: fetchError } = await supabaseAdmin
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (fetchError || !game) {
    return apiError('Game not found', 404);
  }

  if (game.status !== 'MATCHING') {
    return apiError('Game is not in matching state');
  }

  // Check matching expiry
  if (game.matching_expires_at && new Date(game.matching_expires_at) < new Date()) {
    await supabaseAdmin
      .from('games')
      .update({ status: 'CANCELLED' })
      .eq('id', gameId);
    return apiError('Approval period expired');
  }

  // Determine which player is approving
  const isCreator = game.creator_id === session.userId;
  const isOpponent = game.opponent_id === session.userId;

  if (!isCreator && !isOpponent) {
    return apiError('You are not a participant in this game', 403);
  }

  // Update approval
  const updateField = isCreator ? 'creator_approved' : 'opponent_approved';
  const otherApproved = isCreator ? game.opponent_approved : game.creator_approved;

  const updates: Record<string, unknown> = {
    [updateField]: true,
  };

  // If both approved, start the game
  if (otherApproved) {
    updates.status = 'ACTIVE';
    updates.started_at = new Date().toISOString();
    updates.last_move_at = new Date().toISOString(); // White's clock starts
  }

  const { data: updatedGame, error: updateError } = await supabaseAdmin
    .from('games')
    .update(updates)
    .eq('id', gameId)
    .select('*')
    .single();

  if (updateError || !updatedGame) {
    console.error('Approve error:', updateError);
    return apiError('Failed to approve', 500);
  }

  // Broadcast game update to both players
  await broadcastGameUpdate(gameId, updatedGame as Game).catch((err) => {
    console.error('[approve] Broadcast error:', err);
  });

  return apiOk({
    game: updatedGame,
    started: updatedGame.status === 'ACTIVE',
  });
}

export const POST = withAuth(handler);
