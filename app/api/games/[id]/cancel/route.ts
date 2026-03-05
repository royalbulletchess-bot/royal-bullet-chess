import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { withAuth, apiOk, apiError } from '@/lib/api/helpers';
import type { SessionPayload } from '@/lib/auth/session';

/**
 * POST /api/games/[id]/cancel — Creator cancels an OPEN game.
 * Only the creator can cancel, and only while the game is still OPEN.
 */
async function handler(req: NextRequest, session: SessionPayload) {
  const gameId = req.nextUrl.pathname.split('/')[3];

  const { data: game, error: fetchError } = await supabaseAdmin
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (fetchError || !game) {
    return apiError('Game not found', 404);
  }

  if (game.creator_id !== session.userId) {
    return apiError('Only the creator can cancel this game', 403);
  }

  if (game.status !== 'OPEN') {
    return apiError('Game can only be cancelled while open');
  }

  const { data: updatedGame, error: updateError } = await supabaseAdmin
    .from('games')
    .update({
      status: 'CANCELLED',
      finished_at: new Date().toISOString(),
    })
    .eq('id', gameId)
    .eq('status', 'OPEN')
    .select('*')
    .single();

  if (updateError) {
    console.error('[cancel] Update error:', updateError);
    return apiError('Failed to cancel game', 500);
  }

  return apiOk({ game: updatedGame });
}

export const POST = withAuth(handler);
