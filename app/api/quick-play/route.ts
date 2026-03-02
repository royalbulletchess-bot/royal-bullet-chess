import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { withAuth, apiOk, apiError, generateInviteCode } from '@/lib/api/helpers';
import { GAME_TIME_MS, LOBBY_EXPIRY_SECONDS } from '@/lib/constants';
import { verifyGamePayment } from '@/lib/web3/verify-payment';
import { broadcastGameUpdate } from '@/lib/game/broadcast';
import type { SessionPayload } from '@/lib/auth/session';
import type { Game } from '@/types';

/**
 * POST /api/quick-play — Find an OPEN game with the same bet or create a new one
 * Body: { betAmount: number, txHash: string }
 *
 * Client flow:
 * 1. Client calls useGamePayment.createAndPay(betAmount, tempGameId) — sends USDC on-chain
 * 2. Client sends txHash here
 * 3. Server verifies tx, then either:
 *    a) Joins an existing OPEN game with same bet (matched=true)
 *    b) Creates a new OPEN game (matched=false)
 */
async function handler(req: NextRequest, session: SessionPayload) {
  const { betAmount, txHash } = await req.json();

  if (!betAmount || typeof betAmount !== 'number' || betAmount <= 0) {
    return apiError('Invalid bet amount');
  }

  if (!txHash || typeof txHash !== 'string') {
    return apiError('Transaction hash required');
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

  // 1. Try to find an existing OPEN game with the same bet (not created by this user)
  const { data: openGames } = await supabaseAdmin
    .from('games')
    .select('*')
    .eq('status', 'OPEN')
    .eq('bet_amount', betAmount)
    .neq('creator_id', session.userId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(1);

  if (openGames && openGames.length > 0) {
    const game = openGames[0];

    // Join this game
    const creatorColor = Math.random() < 0.5 ? 'WHITE' : 'BLACK';
    const matchingExpiresAt = new Date(Date.now() + 60_000).toISOString();

    const { data: updatedGame, error } = await supabaseAdmin
      .from('games')
      .update({
        opponent_id: session.userId,
        status: 'MATCHING',
        creator_color: creatorColor,
        matching_expires_at: matchingExpiresAt,
      })
      .eq('id', game.id)
      .eq('status', 'OPEN') // Optimistic lock
      .select('*')
      .single();

    if (updatedGame && !error) {
      // Record the payment
      await supabaseAdmin.from('game_payments').insert({
        game_id: game.id,
        user_id: session.userId,
        tx_hash: txHash,
        amount: betAmount,
        payment_type: 'BET_IN',
        status: 'CONFIRMED',
        from_address: verification.from || '',
        to_address: process.env.NEXT_PUBLIC_GAME_ESCROW_ADDRESS || '',
      });

      // Broadcast MATCHING state to Player 1 (creator) waiting on lobby
      // This bypasses RLS which blocks postgres_changes for custom JWT auth
      await broadcastGameUpdate(game.id, updatedGame as Game);

      return apiOk({ game: updatedGame, matched: true });
    }
    // If failed (race condition), fall through to create new game
  }

  // 2. No match found — create a new OPEN game
  const expiresAt = new Date(Date.now() + LOBBY_EXPIRY_SECONDS * 1000).toISOString();
  const inviteCode = generateInviteCode();

  const { data: newGame, error: createError } = await supabaseAdmin
    .from('games')
    .insert({
      creator_id: session.userId,
      bet_amount: betAmount,
      pot_amount: betAmount * 2,
      invite_code: inviteCode,
      status: 'OPEN',
      white_time_remaining_ms: GAME_TIME_MS,
      black_time_remaining_ms: GAME_TIME_MS,
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (createError || !newGame) {
    console.error('Quick play create error:', createError);
    return apiError('Failed to create game', 500);
  }

  // Record the payment
  await supabaseAdmin.from('game_payments').insert({
    game_id: newGame.id,
    user_id: session.userId,
    tx_hash: txHash,
    amount: betAmount,
    payment_type: 'BET_IN',
    status: 'CONFIRMED',
    from_address: verification.from || '',
    to_address: process.env.NEXT_PUBLIC_GAME_ESCROW_ADDRESS || '',
  });

  return apiOk({ game: newGame, matched: false }, 201);
}

export const POST = withAuth(handler);
