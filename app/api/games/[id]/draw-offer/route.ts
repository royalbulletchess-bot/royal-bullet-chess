import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { withAuth, apiOk, apiError } from '@/lib/api/helpers';
import { finishGame } from '@/lib/game/finish';
import { broadcastGameUpdate } from '@/lib/game/broadcast';
import type { SessionPayload } from '@/lib/auth/session';
import type { Game } from '@/types';

/**
 * POST /api/games/[id]/draw-offer — Manage draw offers.
 *
 * Body: { action: 'offer' | 'accept' | 'reject' }
 *
 * - offer:  Create a PENDING draw offer
 * - accept: Accept the pending offer → game ends in DRAW
 * - reject: Reject the pending offer
 */
async function handler(req: NextRequest, session: SessionPayload) {
  const gameId = req.nextUrl.pathname.split('/')[3];
  const body = await req.json();
  const { action } = body;

  if (!action || !['offer', 'accept', 'reject'].includes(action)) {
    return apiError('Invalid action. Expected: offer, accept, or reject');
  }

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

  if (action === 'offer') {
    // Check for existing pending offers from this player
    const { data: existingOffers } = await supabaseAdmin
      .from('draw_offers')
      .select('id')
      .eq('game_id', gameId)
      .eq('offered_by', session.userId)
      .eq('status', 'PENDING');

    if (existingOffers && existingOffers.length > 0) {
      return apiError('You already have a pending draw offer');
    }

    // Create new draw offer
    const { data: offer, error: insertError } = await supabaseAdmin
      .from('draw_offers')
      .insert({
        game_id: gameId,
        offered_by: session.userId,
      })
      .select('*')
      .single();

    if (insertError || !offer) {
      console.error('[draw-offer] Insert error:', insertError);
      return apiError('Failed to create draw offer', 500);
    }

    // Broadcast draw offer event
    const channel = supabaseAdmin.channel(`game-broadcast-${gameId}`);
    await channel.send({
      type: 'broadcast',
      event: 'draw_offer',
      payload: {
        id: offer.id,
        offered_by: session.userId,
        status: 'PENDING',
      },
    }).catch(() => {});
    await supabaseAdmin.removeChannel(channel);

    return apiOk({ offer });
  }

  if (action === 'accept' || action === 'reject') {
    // Find the pending draw offer from the OTHER player
    const opponentId = isCreator ? game.opponent_id : game.creator_id;

    const { data: pendingOffer, error: findError } = await supabaseAdmin
      .from('draw_offers')
      .select('*')
      .eq('game_id', gameId)
      .eq('offered_by', opponentId)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (findError || !pendingOffer) {
      return apiError('No pending draw offer found');
    }

    const newStatus = action === 'accept' ? 'ACCEPTED' : 'REJECTED';

    // Update offer status
    await supabaseAdmin
      .from('draw_offers')
      .update({ status: newStatus })
      .eq('id', pendingOffer.id);

    if (action === 'accept') {
      // End the game as a draw
      const updatedGame = await finishGame({
        gameId,
        result: 'DRAW',
        winnerId: null,
        finalFen: game.current_fen,
      });

      if (updatedGame) {
        await broadcastGameUpdate(gameId, updatedGame as Game).catch(() => {});
      }

      return apiOk({ result: 'DRAW', reason: 'Mutual agreement' });
    }

    // Rejected — broadcast rejection
    const channel = supabaseAdmin.channel(`game-broadcast-${gameId}`);
    await channel.send({
      type: 'broadcast',
      event: 'draw_offer',
      payload: {
        id: pendingOffer.id,
        offered_by: opponentId,
        status: 'REJECTED',
      },
    }).catch(() => {});
    await supabaseAdmin.removeChannel(channel);

    return apiOk({ status: 'REJECTED' });
  }

  return apiError('Invalid action');
}

export const POST = withAuth(handler);
