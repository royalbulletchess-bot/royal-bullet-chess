import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { withAuth, apiOk, apiError } from '@/lib/api/helpers';
import type { SessionPayload } from '@/lib/auth/session';

/**
 * GET /api/games/[id] — Fetch game data with opponent info.
 * Uses service role to bypass RLS (since we use custom auth, not Supabase Auth).
 */
async function handler(req: NextRequest, session: SessionPayload) {
  const gameId = req.nextUrl.pathname.split('/')[3]; // /api/games/[id]

  // Fetch game
  const { data: game, error: fetchError } = await supabaseAdmin
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (fetchError || !game) {
    return apiError('Game not found', 404);
  }

  // Verify the user is a participant or the game is public (OPEN)
  const isCreator = game.creator_id === session.userId;
  const isOpponent = game.opponent_id === session.userId;
  const isPublic = game.status === 'OPEN';

  if (!isCreator && !isOpponent && !isPublic) {
    return apiError('You are not a participant in this game', 403);
  }

  // Fetch opponent info
  const opponentId = isCreator ? game.opponent_id : game.creator_id;
  let opponent = null;

  if (opponentId) {
    const { data: opponentData } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', opponentId)
      .single();

    opponent = opponentData;
  }

  // Fetch moves (for active/finished games)
  let moves: unknown[] = [];
  if (game.status === 'ACTIVE' || game.status === 'FINISHED') {
    const { data: movesData } = await supabaseAdmin
      .from('moves')
      .select('*')
      .eq('game_id', gameId)
      .order('move_number', { ascending: true });

    moves = movesData || [];
  }

  return apiOk({ game, opponent, moves });
}

export const GET = withAuth(handler);
