-- ============================================================================
-- Migration 002: Khắc phục race condition revision_no trong mapping_revisions
-- ============================================================================
-- Vấn đề: revision SMALLINT NOT NULL được tính bằng MAX(revision) + 1 thủ công
--         (qua trigger increment_product_mapping_revision). Khi 2 transaction
--         concurrent cùng đọc OLD.revision = N, cả hai ghi N+1 → duplicate.
--
-- Giải pháp (Option A – Sprint 1 MVP):
--   Chuyển mapping_revisions.revision sang INTEGER GENERATED ALWAYS AS IDENTITY.
--   PostgreSQL tự sinh số thứ tự qua sequence nội bộ — atomic, không tranh chấp.
--
-- Idempotency: Migration này an toàn khi chạy trên DB đã được seed từ
--   001_init.sql đã patch (revision đã là IDENTITY, constraint và index đã tồn tại).
--   Mỗi bước đều kiểm tra trạng thái trước khi thực hiện.
-- ============================================================================

BEGIN;

-- 1. Drop OLD index (chỉ tồn tại trong schema chưa patch: idx_mapping_revisions_mapping_id_revision).
--    IF NOT EXISTS đảm bảo không lỗi nếu index đã bị xoá hoặc chưa từng tồn tại.
DROP INDEX IF EXISTS idx_mapping_revisions_mapping_id_revision;

-- 2–4. Chuyển revision sang IDENTITY — bọc trong DO block để bỏ qua nếu cột
--      đã là IDENTITY (DB seed từ 001_init.sql đã patch).
--      attidentity: 'a' = GENERATED ALWAYS, 'd' = BY DEFAULT, '' = không phải IDENTITY.
DO $$
DECLARE
  col_identity "char";
BEGIN
  SELECT attidentity INTO col_identity
  FROM pg_attribute
  WHERE attrelid = 'mapping_revisions'::regclass
    AND attname   = 'revision'
    AND NOT attisdropped;

  IF COALESCE(col_identity::text, '') NOT IN ('a', 'd') THEN
    -- Step 2: SMALLINT → INTEGER (tiên quyết cho IDENTITY)
    EXECUTE 'ALTER TABLE mapping_revisions ALTER COLUMN revision TYPE INTEGER';

    -- Step 3: Xoá default cũ nếu có (bỏ qua lỗi nếu không tồn tại)
    BEGIN
      EXECUTE 'ALTER TABLE mapping_revisions ALTER COLUMN revision DROP DEFAULT';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- Step 4: Gắn GENERATED ALWAYS AS IDENTITY
    EXECUTE 'ALTER TABLE mapping_revisions ALTER COLUMN revision ADD GENERATED ALWAYS AS IDENTITY';
  END IF;
END;
$$;

-- 5. Sync sequence về max revision hiện tại + 1 (tránh xung đột với dữ liệu cũ).
--    Dùng ALTER TABLE ... ALTER COLUMN ... RESTART WITH — đây là cách idiomatic
--    cho cột IDENTITY. pg_get_serial_sequence() được thiết kế cho SERIAL/BIGSERIAL,
--    không phải IDENTITY, và có thể trả về NULL cho cột IDENTITY.
DO $$
DECLARE
  max_rev INTEGER;
BEGIN
  SELECT COALESCE(MAX(revision), 0) + 1 INTO max_rev FROM mapping_revisions;
  EXECUTE format(
    'ALTER TABLE mapping_revisions ALTER COLUMN revision RESTART WITH %s',
    max_rev
  );
END;
$$;

-- 6. UNIQUE constraint — DROP trước (idempotent), rồi ADD để đảm bảo tồn tại.
ALTER TABLE mapping_revisions
  DROP CONSTRAINT IF EXISTS uq_mapping_revisions_mapping_revision;
ALTER TABLE mapping_revisions
  ADD CONSTRAINT uq_mapping_revisions_mapping_revision UNIQUE (mapping_id, revision);

-- 7. Index tra cứu nhanh theo mapping_id.
--    IF NOT EXISTS — idempotent khi DB đã seed từ 001_init.sql đã patch.
CREATE INDEX IF NOT EXISTS idx_mapping_revisions_mapping_id ON mapping_revisions(mapping_id);

-- 8. Cập nhật trigger function: bỏ cột revision khỏi INSERT, IDENTITY tự sinh.
--    NOTE: revision là global sequence, KHÔNG sequential per-mapping.
--    Ví dụ: mapping_A có revision 1, 5, 9; mapping_B có 2, 3, 4, 6, 7, 8.
--    Dùng thứ tự revision hoặc created_at để xác định version mới nhất.
CREATE OR REPLACE FUNCTION record_product_mapping_revision()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO mapping_revisions (mapping_id, snapshot, changed_by)
  VALUES (NEW.id, to_jsonb(NEW), NEW.approved_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Cập nhật trigger UPDATE: chỉ ghi history khi trường nghiệp vụ thực sự thay đổi.
--    Trigger cũ kích hoạt trên MỌI UPDATE (kể cả updated_at timestamp tự động),
--    tạo ra revision rác. Thêm column filter + WHEN clause để khắc phục.
DROP TRIGGER IF EXISTS record_product_mapping_revision_update ON product_mappings;
CREATE TRIGGER record_product_mapping_revision_update
  AFTER UPDATE OF status, confidence, approved_by, rejection_reason ON product_mappings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status
     OR OLD.confidence IS DISTINCT FROM NEW.confidence
     OR OLD.approved_by IS DISTINCT FROM NEW.approved_by)
  EXECUTE FUNCTION record_product_mapping_revision();

COMMIT;
