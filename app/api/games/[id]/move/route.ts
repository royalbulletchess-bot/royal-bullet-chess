import { NextRequest } from 'next/server';
import { Chess } from 'chess.js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { withAuth, apiOk, apiError } from '@/lib/api/helpers';
import { finishGame } from '@/lib/game/finish';
import { broadcastNewMove, broadcastGameUpdate } from '@/lib/game/broadcast';
import type { SessionPayload } from '@/lib/auth/session';
import type { PlayerColor, GameResult, Game } from '@/types';

/**
 * POST /api/games/[id]/move — Make a move (server-authoritative)
 *
 * Flow:
 * 1. Verify auth + fetch game (ACTIVE only)
 * 2. Check it's this player's turn
 * 3. Calculate elapsed time, check for timeout
 * 4. Validate move with chess.js (server-side)
 * 5. Insert into moves table, update games table
 * 6. Check for checkmate/stalemate/draw → finishGame()
 */
async function handler(req: NextRequest, session: SessionPayload) {
  const gameId = req.nextUrl.pathname.split('/')[3]; // /api/games/[id]/move

  const body = await req.json();
  const { from, to, promotion } = body;

  if (!from || !to) {
    return apiError('Missing from/to fields');
  }

  // 1. Fetch game
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

  // 2. Identify player and determine color
  const isCreator = game.creator_id === session.userId;
  const isOpponent = game.opponent_id === session.userId;

  if (!isCreator && !isOpponent) {
    return apiError('You are not a participant in this game', 403);
  }

  const myColor: PlayerColor = isCreator
    ? (game.creator_color as PlayerColor)
    : (game.creator_color === 'WHITE' ? 'BLACK' : 'WHITE');

  // 3. Check turn
  const chess = new Chess(game.current_fen);
  const fenTurn: PlayerColor = chess.turn() === 'w' ? 'WHITE' : 'BLACK';

  if (fenTurn !== myColor) {
    return apiError('Not your turn');
  }

  // 4. Calculate elapsed time
  const now = new Date();
  const lastMoveAt = game.last_move_at
    ? new Date(game.last_move_at)
    : new Date(game.started_at);
  const elapsedMs = now.getTime() - lastMoveAt.getTime();

  const currentTimeMs: number = myColor === 'WHITE'
    ? game.white_time_remaining_ms
    : game.black_time_remaining_ms;

  const newTimeMs = Math.max(0, currentTimeMs - elapsedMs);

  // Timeout check — player's clock ran out before making the move
  if (newTimeMs <= 0) {
    const winnerId = isCreator ? game.opponent_id : game.creator_id;
    const result: GameResult = myColor === 'WHITE' ? 'BLACK_WIN' : 'WHITE_WIN';

    await finishGame({
      gameId,
      result,
      winnerId,
      finalFen: game.current_fen,
    });

    return apiError('Time expired');
  }

  // 5. Validate move with chess.js
  let move;
  try {
    move = chess.move({ from, to, promotion: promotion || undefined });
    if (!move) {
      return apiError('Illegal move');
    }
  } catch {
    return apiError('Illegal move');
  }

  const newFen = chess.fen();

  // 6. Get move count for move_number
  const { count: moveCount } = await supabaseAdmin
    .from('moves')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', gameId);

  const moveNumber = (moveCount || 0) + 1;

  // 7. Insert move record
  const { error: moveInsertError } = await supabaseAdmin
    .from('moves')
    .insert({
      game_id: gameId,
      player_id: session.userId,
      move_san: move.san,
      move_number: moveNumber,
      fen_after: newFen,
      time_remaining: Math.round(newTimeMs),
    });

  if (moveInsertError) {
    console.error('[move] Insert error:', moveInsertError);
    return apiError('Failed to save move', 500);
  }

  // 8. Update game state
  const timeUpdate = myColor === 'WHITE'
    ? { white_time_remaining_ms: Math.round(newTimeMs) }
    : { black_time_remaining_ms: Math.round(newTimeMs) };

  const { error: gameUpdateError } = await supabaseAdmin
    .from('games')
    .update({
      current_fen: newFen,
      last_move_at: now.toISOString(),
      ...timeUpdate,
    })
    .eq('id', gameId);

  if (gameUpdateError) {
    console.error('[move] Game update error:', gameUpdateError);
    return apiError('Failed to update game', 500);
  }

  // 9. Check for game over (checkmate, stalemate, draw)
  let gameFinished = false;

  if (chess.isCheckmate()) {
    const result: GameResult = myColor === 'WHITE' ? 'WHITE_WIN' : 'BLACK_WIN';
    const finished = await finishGame({ gameId, result, winnerId: session.userId, finalFen: newFen });
    gameFinished = true;
    if (finished) {
      await broadcastGameUpdate(gameId, finished as Game).catch(() => {});
    }
  } else if (
    chess.isStalemate() ||
    chess.isDraw() ||
    chess.isThreefoldRepetition() ||
    chess.isInsufficientMaterial()
  ) {
    const finished = await finishGame({ gameId, result: 'DRAW', winnerId: null, finalFen: newFen });
    gameFinished = true;
    if (finished) {
      await broadcastGameUpdate(gameId, finished as Game).catch(() => {});
    }
  }

  // 10. Broadcast move to opponent via Supabase broadcast channel
  await broadcastNewMove(gameId, {
    san: move.san,
    from: move.from,
    to: move.to,
    captured: move.captured || null,
    promotion: move.promotion || null,
    player_id: session.userId,
    fen_after: newFen,
    time_remaining: Math.round(newTimeMs),
    move_number: moveNumber,
  }).catch((err) => {
    console.error('[move] Broadcast error:', err);
  });

  return apiOk({
    move: {
      san: move.san,
      from: move.from,
      to: move.to,
      captured: move.captured || null,
      promotion: move.promotion || null,
      isKingsideCastle: move.san === 'O-O',
      isQueensideCastle: move.san === 'O-O-O',
    },
    fen: newFen,
    timeRemainingMs: Math.round(newTimeMs),
    gameOver: gameFinished,
  });
}

export const POST = withAuth(handler);
