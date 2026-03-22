-- ============================================================================
-- Migration 003: Anti-clock-skew guard for offline license token validation
-- ============================================================================
-- Adds server-issued nonce metadata on activation tokens to detect rollback:
-- - server_nonce: random challenge issued by server on successful validation
-- - nonce_issued_at: trusted server UTC timestamp when nonce was issued
--
-- NOTE:
-- The current schema stores license tokens on `activations` (not a separate
-- `license_tokens` table), so the new columns are added to `activations`.
-- ============================================================================

BEGIN;

ALTER TABLE activations
  ADD COLUMN IF NOT EXISTS server_nonce TEXT,
  ADD COLUMN IF NOT EXISTS nonce_issued_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_activations_nonce_issued_at ON activations(nonce_issued_at);

COMMIT;
