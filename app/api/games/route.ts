import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { withAuth, apiOk, apiError, generateInviteCode } from '@/lib/api/helpers';
import { LOBBY_EXPIRY_SECONDS, GAME_TIME_MS, MAX_LOBBIES_PER_USER } from '@/lib/constants';
import { verifyGamePayment } from '@/lib/web3/verify-payment';
import type { SessionPayload } from '@/lib/auth/session';

/**
 * POST /api/games — Create a new lobby game
 * Body: { betAmount: number, txHash: string }
 *
 * Client flow:
 * 1. Client calls useGamePayment.createAndPay(betAmount, gameId) — sends USDC to escrow on-chain
 * 2. Client sends txHash here for server-side verification
 * 3. Server verifies on-chain tx, creates game in DB
 */
async function handler(req: NextRequest, session: SessionPayload) {
  const { betAmount, txHash } = await req.json();

  // Validate bet amount
  if (!betAmount || typeof betAmount !== 'number' || betAmount <= 0) {
    return apiError('Invalid bet amount');
  }

  // Validate txHash
  if (!txHash || typeof txHash !== 'string') {
    return apiError('Transaction hash required');
  }

  // Check user doesn't already have an open lobby
  const { count } = await supabaseAdmin
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('creator_id', session.userId)
    .eq('status', 'OPEN');

  if (count && count >= MAX_LOBBIES_PER_USER) {
    return apiError('You already have an open lobby');
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

  // Create game
  const expiresAt = new Date(Date.now() + LOBBY_EXPIRY_SECONDS * 1000).toISOString();
  const inviteCode = generateInviteCode();

  const { data: game, error } = await supabaseAdmin
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

  if (error || !game) {
    console.error('Game creation error:', error);
    return apiError('Failed to create game', 500);
  }

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

  return apiOk({ game }, 201);
}

export const POST = withAuth(handler);
