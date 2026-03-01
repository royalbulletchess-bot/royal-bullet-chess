-- ============================================================
-- Phase 2g: Deposits table + wallet_address on withdrawals
-- ============================================================

-- ===================== DEPOSITS =====================
CREATE TABLE IF NOT EXISTS deposits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) NOT NULL,
  tx_hash         TEXT UNIQUE NOT NULL,
  amount          NUMERIC(10,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING',
  created_at      TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_deposit_status CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED'))
);

CREATE INDEX idx_deposits_user ON deposits(user_id);
CREATE INDEX idx_deposits_tx_hash ON deposits(tx_hash);

-- RLS for deposits
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own deposits" ON deposits FOR SELECT USING (user_id::text = auth.uid()::text);
CREATE POLICY "Deposits insert via service role" ON deposits FOR INSERT WITH CHECK (true);
CREATE POLICY "Deposits update via service role" ON deposits FOR UPDATE USING (true);

-- Add wallet_address to withdrawals if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'withdrawals' AND column_name = 'wallet_address'
  ) THEN
    ALTER TABLE withdrawals ADD COLUMN wallet_address TEXT;
  END IF;
END
$$;
