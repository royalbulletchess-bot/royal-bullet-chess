-- ============================================================
-- Royal Bullet Chess — Wallet Authentication Support
-- Adds index on wallet_address for wallet-based user lookup
-- ============================================================

-- Index for fast wallet_address lookups (used by /api/auth/wallet)
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users (wallet_address);

-- Note: farcaster_id stays NOT NULL. Wallet-only users use format "wallet:0x..."
-- This keeps the UNIQUE constraint working and distinguishes wallet vs Farcaster users.
