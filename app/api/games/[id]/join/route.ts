import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { withAuth, apiOk, apiError } from '@/lib/api/helpers';
import { verifyGamePayment } from '@/lib/web3/verify-payment';
import { broadcastGameUpdate } from '@/lib/game/broadcast';
import type { SessionPayload } from '@/lib/auth/session';
import type { Game } from '@/types';

/**
 * POST /api/games/[id]/join — Join an existing lobby game
 * Body: { txHash: string }
 *
 * Client flow:
 * 1. Client calls useGamePayment.joinAndPay(gameId, betAmount) — sends USDC to escrow on-chain
 * 2. Client sends txHash here for server-side verification
 * 3. Server verifies on-chain tx, updates game in DB
 */
async function handler(
  req: NextRequest,
  session: SessionPayload
) {
  const gameId = req.nextUrl.pathname.split('/')[3]; // /api/games/[id]/join
  const { txHash } = await req.json();

  // Validate txHash
  if (!txHash || typeof txHash !== 'string') {
    return apiError('Transaction hash required');
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

  // Validations
  if (game.status !== 'OPEN') {
    return apiError('Game is no longer available');
  }

  if (game.creator_id === session.userId) {
    return apiError('Cannot join your own game');
  }

  // Check expiry
  if (game.expires_at && new Date(game.expires_at) < new Date()) {
    // Auto-expire
    await supabaseAdmin
      .from('games')
      .update({ status: 'EXPIRED' })
      .eq('id', gameId);
    return apiError('Game has expired');
  }

  // Verify on-chain payment
  const verification = await verifyGamePayment(txHash);
  if (!verification.valid) {
    return apiError(`Payment verification failed: ${verification.error}`);
  }

  // Check that the txHash hasn't been used before (prevent replay)
  const { data: existingPayment } = await supabaseAdmin
    .from('game_payments')
    .select('id')
    .eq('tx_hash', txHash)
    .maybeSingle();

  if (existingPayment) {
    return apiError('Transaction already used');
  }

  // Assign random colors
  const creatorColor = Math.random() < 0.5 ? 'WHITE' : 'BLACK';

  // Matching expiry (60s for approval)
  const matchingExpiresAt = new Date(Date.now() + 60_000).toISOString();

  // Update game: set opponent, change status to MATCHING
  const { data: updatedGame, error: updateError } = await supabaseAdmin
    .from('games')
    .update({
      opponent_id: session.userId,
      status: 'MATCHING',
      creator_color: creatorColor,
      matching_expires_at: matchingExpiresAt,
    })
    .eq('id', gameId)
    .eq('status', 'OPEN') // Optimistic lock
    .select('*')
    .single();

  if (updateError || !updatedGame) {
    console.error('Join error:', updateError);
    return apiError('Failed to join game — it may have been taken');
  }

  // Record the payment
  await supabaseAdmin.from('game_payments').insert({
    game_id: gameId,
    user_id: session.userId,
    tx_hash: txHash,
    amount: Number(game.bet_amount),
    payment_type: 'BET_IN',
    status: 'CONFIRMED',
    from_address: verification.from || '',
    to_address: process.env.NEXT_PUBLIC_GAME_ESCROW_ADDRESS || '',
  });

  // Broadcast MATCHING state to Player 1 (creator)
  // This bypasses RLS which blocks postgres_changes for custom JWT auth
  await broadcastGameUpdate(gameId, updatedGame as Game);

  return apiOk({ game: updatedGame });
}

export const POST = withAuth(handler);
