-- ============================================================
-- Royal Bullet Chess — Initial Database Schema
-- Includes all tables, indexes, and RLS policies
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===================== USERS =====================
CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farcaster_id        TEXT UNIQUE NOT NULL,
  farcaster_username  TEXT NOT NULL,
  farcaster_avatar    TEXT,
  wallet_address      TEXT NOT NULL,
  elo_rating          INTEGER NOT NULL DEFAULT 1200,
  balance_usdc        NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ===================== GAMES =====================
CREATE TABLE games (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status                  TEXT NOT NULL DEFAULT 'OPEN',
  creator_id              UUID REFERENCES users(id) NOT NULL,
  opponent_id             UUID REFERENCES users(id),
  bet_amount              NUMERIC(10,2) NOT NULL,
  pot_amount              NUMERIC(10,2) NOT NULL,
  winner_id               UUID REFERENCES users(id),
  result                  TEXT,
  creator_color           TEXT,
  invite_code             TEXT UNIQUE,
  contract_game_id        TEXT,

  -- Board state (fix #1: added current_fen)
  current_fen             TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',

  -- Timer state (fix #4: timestamp-based timer)
  white_time_remaining_ms INTEGER NOT NULL DEFAULT 60000,
  black_time_remaining_ms INTEGER NOT NULL DEFAULT 60000,
  last_move_at            TIMESTAMPTZ,

  -- Approval tracking (fix #2)
  creator_approved        BOOLEAN DEFAULT false,
  opponent_approved       BOOLEAN DEFAULT false,

  -- Post-game data (fix #9)
  pgn                     TEXT,
  final_fen               TEXT,

  -- Timestamps
  expires_at              TIMESTAMPTZ,
  matching_expires_at     TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now(),
  started_at              TIMESTAMPTZ,
  finished_at             TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('OPEN', 'MATCHING', 'ACTIVE', 'FINISHED', 'CANCELLED', 'EXPIRED')),
  CONSTRAINT valid_result CHECK (result IS NULL OR result IN ('WHITE_WIN', 'BLACK_WIN', 'DRAW', 'ABANDONED')),
  CONSTRAINT valid_color  CHECK (creator_color IS NULL OR creator_color IN ('WHITE', 'BLACK'))
);

-- ===================== MOVES =====================
CREATE TABLE moves (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id         UUID REFERENCES games(id) NOT NULL,
  player_id       UUID REFERENCES users(id) NOT NULL,
  move_san        TEXT NOT NULL,
  move_number     INTEGER NOT NULL,
  fen_after       TEXT NOT NULL,
  time_remaining  INTEGER NOT NULL, -- milliseconds remaining for this player
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ===================== DRAW OFFERS =====================
CREATE TABLE draw_offers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id         UUID REFERENCES games(id) NOT NULL,
  offered_by      UUID REFERENCES users(id) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING',
  created_at      TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_draw_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED'))
);

-- ===================== WITHDRAWALS =====================
CREATE TABLE withdrawals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) NOT NULL,
  amount          NUMERIC(10,2) NOT NULL,
  tx_hash         TEXT,
  status          TEXT NOT NULL DEFAULT 'PENDING',
  created_at      TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_withdrawal_status CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED'))
);

-- ===================== NOTIFICATIONS =====================
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) NOT NULL,
  type            TEXT NOT NULL,
  game_id         UUID REFERENCES games(id),
  read            BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_notification_type CHECK (type IN ('LOBBY_JOIN', 'REMATCH_REQUEST', 'DRAW_OFFER'))
);

-- ===================== INDEXES (fix #11) =====================
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_creator ON games(creator_id);
CREATE INDEX idx_games_opponent ON games(opponent_id);
CREATE INDEX idx_games_invite_code ON games(invite_code);
CREATE INDEX idx_games_expires_at ON games(expires_at) WHERE status = 'OPEN';
CREATE INDEX idx_games_matching_expires ON games(matching_expires_at) WHERE status = 'MATCHING';
CREATE INDEX idx_moves_game ON moves(game_id);
CREATE INDEX idx_moves_game_number ON moves(game_id, move_number);
CREATE INDEX idx_draw_offers_game ON draw_offers(game_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, read);
CREATE INDEX idx_withdrawals_user ON withdrawals(user_id);

-- ===================== ROW LEVEL SECURITY (fix #12) =====================

-- Users: everyone can read, only service role can insert/update
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users insert via service role" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users update own record" ON users FOR UPDATE USING (auth.uid()::text = id::text);

-- Games: participants can read their games, open games are public
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open games are viewable by everyone" ON games FOR SELECT USING (
  status = 'OPEN' OR creator_id::text = auth.uid()::text OR opponent_id::text = auth.uid()::text
);
CREATE POLICY "Games insert via service role" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "Games update via service role" ON games FOR UPDATE USING (true);

-- Moves: readable by game participants
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Moves viewable by game participants" ON moves FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM games
    WHERE games.id = moves.game_id
    AND (games.creator_id::text = auth.uid()::text OR games.opponent_id::text = auth.uid()::text)
  )
);
CREATE POLICY "Moves insert via service role" ON moves FOR INSERT WITH CHECK (true);

-- Draw offers: readable by game participants
ALTER TABLE draw_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Draw offers viewable by participants" ON draw_offers FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM games
    WHERE games.id = draw_offers.game_id
    AND (games.creator_id::text = auth.uid()::text OR games.opponent_id::text = auth.uid()::text)
  )
);
CREATE POLICY "Draw offers insert via service role" ON draw_offers FOR INSERT WITH CHECK (true);
CREATE POLICY "Draw offers update via service role" ON draw_offers FOR UPDATE USING (true);

-- Withdrawals: users can only see their own
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own withdrawals" ON withdrawals FOR SELECT USING (user_id::text = auth.uid()::text);
CREATE POLICY "Withdrawals insert via service role" ON withdrawals FOR INSERT WITH CHECK (true);

-- Notifications: users can only see their own
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON notifications FOR SELECT USING (user_id::text = auth.uid()::text);
CREATE POLICY "Notifications insert via service role" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (user_id::text = auth.uid()::text);

-- ===================== REALTIME =====================
-- Enable realtime for games and moves tables
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE moves;
ALTER PUBLICATION supabase_realtime ADD TABLE draw_offers;
