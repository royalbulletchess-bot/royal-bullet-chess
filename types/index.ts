// ============================================================
// Royal Bullet Chess — TypeScript Types
// Matches the corrected Supabase PostgreSQL schema
// ============================================================

// ---------- Enums / Unions ----------

export type GameStatus =
  | 'OPEN'
  | 'MATCHING'
  | 'ACTIVE'
  | 'FINISHED'
  | 'CANCELLED'
  | 'EXPIRED';

export type GameResult =
  | 'WHITE_WIN'
  | 'BLACK_WIN'
  | 'DRAW'
  | 'ABANDONED';

export type PlayerColor = 'WHITE' | 'BLACK';

export type DrawOfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export type WithdrawalStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';

export type DepositStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';

export type NotificationType =
  | 'LOBBY_JOIN'
  | 'REMATCH_REQUEST'
  | 'DRAW_OFFER';

// ---------- Database Row Types ----------

export interface User {
  id: string;
  farcaster_id: string;
  farcaster_username: string;
  farcaster_avatar: string | null;
  wallet_address: string;
  elo_rating: number;
  balance_usdc: number;
  created_at: string;
}

export interface Game {
  id: string;
  status: GameStatus;
  creator_id: string;
  opponent_id: string | null;
  bet_amount: number;
  pot_amount: number;
  winner_id: string | null;
  result: GameResult | null;
  creator_color: PlayerColor | null;
  invite_code: string | null;
  contract_game_id: string | null;
  current_fen: string;
  white_time_remaining_ms: number;
  black_time_remaining_ms: number;
  last_move_at: string | null;
  creator_approved: boolean;
  opponent_approved: boolean;
  pgn: string | null;
  final_fen: string | null;
  expires_at: string | null;
  matching_expires_at: string | null;
  creator_elo_change: number | null;
  opponent_elo_change: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface Move {
  id: string;
  game_id: string;
  player_id: string;
  move_san: string;
  move_number: number;
  fen_after: string;
  time_remaining: number; // milliseconds remaining for this player
  created_at: string;
}

export interface DrawOffer {
  id: string;
  game_id: string;
  offered_by: string;
  status: DrawOfferStatus;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  wallet_address: string | null;
  tx_hash: string | null;
  status: WithdrawalStatus;
  created_at: string;
}

export interface Deposit {
  id: string;
  user_id: string;
  tx_hash: string;
  amount: number;
  status: DepositStatus;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  game_id: string | null;
  read: boolean;
  created_at: string;
}

// ---------- Frontend Display Types ----------

export interface LobbyGame {
  id: string;
  creator_username: string;
  creator_avatar: string | null;
  bet_amount: number;
  created_at: string;
  invite_code: string | null;
}

export interface GameState {
  game: Game;
  moves: Move[];
  currentFen: string;
  isMyTurn: boolean;
  myColor: PlayerColor;
  myTimeMs: number;
  opponentTimeMs: number;
  isGameOver: boolean;
}

export interface GameOverInfo {
  result: GameResult;
  winner_id: string | null;
  my_color: PlayerColor;
  opponent_username: string;
  opponent_avatar: string | null;
  bet_amount: number;
  payout: number;
}
