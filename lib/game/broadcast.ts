import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Game } from '@/types';

/**
 * Broadcast helpers — uses Supabase broadcast channels to push
 * real-time events to clients. This bypasses RLS (unlike postgres_changes)
 * since our auth system uses custom JWTs, not Supabase Auth.
 *
 * Channel naming: `game-{gameId}`
 * Events:
 *   - `game_update` — game status/timer changes
 *   - `new_move`    — a new move was made
 */

const CHANNEL_PREFIX = 'game-broadcast-';

function getChannelName(gameId: string) {
  return `${CHANNEL_PREFIX}${gameId}`;
}

/**
 * Broadcast a game state update (status change, timer sync, game over, etc.)
 */
export async function broadcastGameUpdate(gameId: string, game: Game) {
  const channel = supabaseAdmin.channel(getChannelName(gameId));

  await channel.send({
    type: 'broadcast',
    event: 'game_update',
    payload: {
      id: game.id,
      status: game.status,
      result: game.result,
      winner_id: game.winner_id,
      creator_id: game.creator_id,
      opponent_id: game.opponent_id,
      creator_color: game.creator_color,
      bet_amount: game.bet_amount,
      current_fen: game.current_fen,
      white_time_remaining_ms: game.white_time_remaining_ms,
      black_time_remaining_ms: game.black_time_remaining_ms,
      last_move_at: game.last_move_at,
      matching_expires_at: game.matching_expires_at,
      final_fen: game.final_fen,
      finished_at: game.finished_at,
      creator_approved: game.creator_approved,
      opponent_approved: game.opponent_approved,
      started_at: game.started_at,
    },
  });

  // Cleanup: unsubscribe the server-side channel after sending
  await supabaseAdmin.removeChannel(channel);
}

/**
 * Broadcast a new move to all subscribers of this game.
 */
export async function broadcastNewMove(
  gameId: string,
  move: {
    san: string;
    from: string;
    to: string;
    captured?: string | null;
    promotion?: string | null;
    player_id: string;
    fen_after: string;
    time_remaining: number;
    move_number: number;
  }
) {
  const channel = supabaseAdmin.channel(getChannelName(gameId));

  await channel.send({
    type: 'broadcast',
    event: 'new_move',
    payload: move,
  });

  await supabaseAdmin.removeChannel(channel);
}

/**
 * Get the broadcast channel name for a game (used by client hooks).
 */
export function getGameBroadcastChannel(gameId: string) {
  return getChannelName(gameId);
}
