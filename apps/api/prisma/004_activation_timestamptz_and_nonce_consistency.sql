-- ============================================================================
-- Migration 004: Normalize activation timestamps + nonce consistency guard
-- ============================================================================
-- Why:
-- 1) Avoid mixing TIMESTAMP and TIMESTAMPTZ in `activations` comparisons.
-- 2) Enforce nonce integrity so rollback guard cannot be bypassed by empty nonce.
--
-- Nonce policy (documentation):
-- - server_nonce: random hex string (min 16 chars), rotated on each successful
--   online validation.
-- - nonce_issued_at: server UTC timestamp.
-- - Client should revalidate online regularly (recommended <= 24h).
-- - If client_time < nonce_issued_at - threshold => clock rollback suspected.
-- ============================================================================

BEGIN;

-- 1) Normalize all activation timestamps to TIMESTAMPTZ (UTC semantics)
--    only when legacy schema still uses "timestamp without time zone".
--    This makes the migration safe/no-op on already-patched environments.
DO $$
DECLARE
  activated_type text;
BEGIN
  SELECT data_type INTO activated_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'activations'
    AND column_name = 'activated_at';

  IF activated_type = 'timestamp without time zone' THEN
    EXECUTE $sql$
      ALTER TABLE activations
        ALTER COLUMN activated_at TYPE TIMESTAMPTZ USING activated_at AT TIME ZONE 'UTC',
        ALTER COLUMN last_validated_at TYPE TIMESTAMPTZ USING last_validated_at AT TIME ZONE 'UTC',
        ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC',
        ALTER COLUMN rebind_last_at TYPE TIMESTAMPTZ USING rebind_last_at AT TIME ZONE 'UTC'
    $sql$;
  END IF;
END;
$$;

-- 2) Enforce nonce and nonce_issued_at consistency
ALTER TABLE activations
  DROP CONSTRAINT IF EXISTS chk_activations_nonce_consistency;

ALTER TABLE activations
  ADD CONSTRAINT chk_activations_nonce_consistency CHECK (
    (server_nonce IS NULL AND nonce_issued_at IS NULL)
    OR (server_nonce IS NOT NULL AND LENGTH(TRIM(server_nonce)) >= 16 AND nonce_issued_at IS NOT NULL)
  );

COMMIT;
