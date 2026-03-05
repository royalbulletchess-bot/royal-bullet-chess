import { supabaseAdmin } from '@/lib/supabase/admin';
import { calculateGameElo } from '@/lib/game/elo';
import { finishGameOnChain, finishDrawOnChain, cancelGameOnChain } from '@/lib/web3/send-payout';
import { COMMISSION_RATE } from '@/lib/constants';
import type { GameResult, PlayerColor } from '@/types';

interface FinishGameParams {
  gameId: string;
  result: GameResult;
  winnerId: string | null;
  finalFen: string;
}

/**
 * Finish a game: update status, calculate ELO, trigger on-chain payout.
 *
 * On-chain flow:
 * - WIN: backend calls contract.finishGame(gameId, winnerAddress) — contract pays winner (minus commission)
 * - DRAW: backend calls contract.finishDraw(gameId) — contract refunds both
 * - ABANDONED: backend calls contract.cancelGame(gameId) — contract refunds creator (+opponent if joined)
 */
export async function finishGame({
  gameId,
  result,
  winnerId,
  finalFen,
}: FinishGameParams) {
  // Fetch game for pot info
  const { data: game, error: fetchError } = await supabaseAdmin
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (fetchError || !game) {
    console.error('[finishGame] Game not found:', fetchError);
    return null;
  }

  // Already finished — idempotent
  if (game.status === 'FINISHED') {
    return game;
  }

  const now = new Date().toISOString();

  // Update game with optimistic lock on status
  const { data: updatedGame, error: updateError } = await supabaseAdmin
    .from('games')
    .update({
      status: 'FINISHED',
      result,
      winner_id: winnerId,
      final_fen: finalFen,
      finished_at: now,
    })
    .eq('id', gameId)
    .eq('status', 'ACTIVE')
    .select('*')
    .single();

  if (updateError) {
    console.error('[finishGame] Update error:', updateError);
    return null;
  }

  // ── ELO Update ──
  try {
    // Fetch both players' current ELO
    const { data: creator } = await supabaseAdmin
      .from('users')
      .select('id, elo_rating, wallet_address')
      .eq('id', game.creator_id)
      .single();

    const { data: opponent } = await supabaseAdmin
      .from('users')
      .select('id, elo_rating, wallet_address')
      .eq('id', game.opponent_id)
      .single();

    if (creator && opponent && result !== 'ABANDONED') {
      const creatorColor: PlayerColor = game.creator_color as PlayerColor;
      const whiteElo = creatorColor === 'WHITE' ? creator.elo_rating : opponent.elo_rating;
      const blackElo = creatorColor === 'WHITE' ? opponent.elo_rating : creator.elo_rating;

      // Map game result to white/black perspective
      let eloResult: 'WHITE_WIN' | 'BLACK_WIN' | 'DRAW';
      if (result === 'DRAW') {
        eloResult = 'DRAW';
      } else if (result === 'WHITE_WIN') {
        eloResult = 'WHITE_WIN';
      } else {
        eloResult = 'BLACK_WIN';
      }

      const { whiteNew, blackNew, whiteDelta, blackDelta } = calculateGameElo(
        whiteElo,
        blackElo,
        eloResult
      );

      // Update creator's ELO
      const creatorNewElo = creatorColor === 'WHITE' ? whiteNew : blackNew;
      const creatorDelta = creatorColor === 'WHITE' ? whiteDelta : blackDelta;
      await supabaseAdmin
        .from('users')
        .update({ elo_rating: creatorNewElo })
        .eq('id', creator.id);

      // Update opponent's ELO
      const opponentNewElo = creatorColor === 'WHITE' ? blackNew : whiteNew;
      const opponentDelta = creatorColor === 'WHITE' ? blackDelta : whiteDelta;
      await supabaseAdmin
        .from('users')
        .update({ elo_rating: opponentNewElo })
        .eq('id', opponent.id);

      // Store ELO deltas in the game record
      await supabaseAdmin
        .from('games')
        .update({
          creator_elo_change: creatorDelta,
          opponent_elo_change: opponentDelta,
        })
        .eq('id', gameId);

      // Merge into returned object so broadcast includes ELO data
      if (updatedGame) {
        (updatedGame as Record<string, unknown>).creator_elo_change = creatorDelta;
        (updatedGame as Record<string, unknown>).opponent_elo_change = opponentDelta;
      }

      console.log(
        `[finishGame] ELO — Creator: ${creator.elo_rating} → ${creatorNewElo} (${creatorDelta >= 0 ? '+' : ''}${creatorDelta}), ` +
        `Opponent: ${opponent.elo_rating} → ${opponentNewElo} (${opponentDelta >= 0 ? '+' : ''}${opponentDelta})`
      );
    }
  } catch (eloErr) {
    console.error('[finishGame] ELO update error:', eloErr);
    // Don't fail the whole finish operation for ELO errors
  }

  // ── On-Chain Payout ──
  try {
    if (result === 'DRAW') {
      // Contract refunds both players their bet
      const payoutResult = await finishDrawOnChain(gameId);
      if ('error' in payoutResult) {
        console.error(`[finishGame] On-chain draw payout failed: ${payoutResult.error}`);
      } else {
        // Record payout transactions
        const betAmount = Number(game.bet_amount);
        await supabaseAdmin.from('game_payments').insert([
          {
            game_id: gameId,
            user_id: game.creator_id,
            tx_hash: payoutResult.txHash,
            amount: betAmount,
            payment_type: 'REFUND',
            status: 'CONFIRMED',
            from_address: process.env.NEXT_PUBLIC_GAME_ESCROW_ADDRESS || '',
            to_address: '',
          },
          {
            game_id: gameId,
            user_id: game.opponent_id,
            tx_hash: `${payoutResult.txHash}_opp`,
            amount: betAmount,
            payment_type: 'REFUND',
            status: 'CONFIRMED',
            from_address: process.env.NEXT_PUBLIC_GAME_ESCROW_ADDRESS || '',
            to_address: '',
          },
        ]);
        console.log(`[finishGame] DRAW — on-chain refund tx: ${payoutResult.txHash}`);
      }
    } else if (winnerId) {
      // Determine winner's wallet address
      const { data: winnerUser } = await supabaseAdmin
        .from('users')
        .select('wallet_address')
        .eq('id', winnerId)
        .single();

      if (winnerUser?.wallet_address) {
        const payoutResult = await finishGameOnChain(gameId, winnerUser.wallet_address);
        if ('error' in payoutResult) {
          console.error(`[finishGame] On-chain win payout failed: ${payoutResult.error}`);
        } else {
          const potAmount = Number(game.pot_amount);
          const commission = potAmount * COMMISSION_RATE;
          const payout = potAmount - commission;

          // Record payout + commission
          await supabaseAdmin.from('game_payments').insert([
            {
              game_id: gameId,
              user_id: winnerId,
              tx_hash: payoutResult.txHash,
              amount: payout,
              payment_type: 'PAYOUT',
              status: 'CONFIRMED',
              from_address: process.env.NEXT_PUBLIC_GAME_ESCROW_ADDRESS || '',
              to_address: winnerUser.wallet_address,
            },
            {
              game_id: gameId,
              user_id: winnerId,
              tx_hash: `${payoutResult.txHash}_com`,
              amount: commission,
              payment_type: 'COMMISSION',
              status: 'CONFIRMED',
              from_address: process.env.NEXT_PUBLIC_GAME_ESCROW_ADDRESS || '',
              to_address: process.env.NEXT_PUBLIC_TREASURY_ADDRESS || '',
            },
          ]);
          console.log(
            `[finishGame] Winner ${winnerId} receives $${payout.toFixed(2)} on-chain (commission: $${commission.toFixed(2)}). Tx: ${payoutResult.txHash}`
          );
        }
      } else {
        console.error(`[finishGame] Winner ${winnerId} has no wallet_address — cannot payout on-chain`);
      }
    } else if (result === 'ABANDONED') {
      // Cancel the game — contract refunds creator (and opponent if joined)
      const payoutResult = await cancelGameOnChain(gameId);
      if ('error' in payoutResult) {
        console.error(`[finishGame] On-chain cancel failed: ${payoutResult.error}`);
      } else {
        console.log(`[finishGame] ABANDONED — on-chain cancel tx: ${payoutResult.txHash}`);
      }
    }
  } catch (payoutErr) {
    console.error('[finishGame] On-chain payout error:', payoutErr);
    // Don't fail the whole finish operation for payout errors
  }

  return updatedGame;
}
