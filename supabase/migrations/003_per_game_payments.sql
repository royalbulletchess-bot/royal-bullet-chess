-- ============================================================
-- Royal Bullet Chess — Per-Game Payments (Phase 3)
-- Tracks on-chain USDC payments for each game.
-- Replaces the off-chain balance system.
-- ============================================================

-- ===================== GAME PAYMENTS =====================
-- Records every on-chain USDC transaction related to a game:
--   BET_IN    — Player pays to create/join a game
--   PAYOUT    — Winner receives winnings
--   REFUND    — Player receives refund (draw, cancel)
--   COMMISSION — Platform commission on wins

CREATE TABLE IF NOT EXISTS game_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       UUID REFERENCES games(id) NOT NULL,
  user_id       UUID REFERENCES users(id) NOT NULL,
  tx_hash       TEXT UNIQUE NOT NULL,
  amount        NUMERIC(10,2) NOT NULL,
  payment_type  TEXT NOT NULL CHECK (payment_type IN ('BET_IN', 'PAYOUT', 'REFUND', 'COMMISSION')),
  status        TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED')),
  from_address  TEXT NOT NULL DEFAULT '',
  to_address    TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_game_payments_game_id ON game_payments(game_id);
CREATE INDEX IF NOT EXISTS idx_game_payments_user_id ON game_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_game_payments_tx_hash ON game_payments(tx_hash);

-- Enable Realtime on game_payments (optional, for future UI updates)
ALTER PUBLICATION supabase_realtime ADD TABLE game_payments;

-- NOTE: The balance_usdc column in users table is kept for backward compatibility
-- but will no longer be actively updated. On-chain balance is the source of truth.
-- The deposits table from migration 002 also remains but is no longer used.
