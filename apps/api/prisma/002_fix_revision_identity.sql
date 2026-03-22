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
-- ============================================================================

BEGIN;

-- 1. Xoá index cũ (sẽ được thay bằng UNIQUE constraint + index mới)
DROP INDEX IF EXISTS idx_mapping_revisions_mapping_id_revision;

-- 2. Đổi kiểu cột từ SMALLINT → INTEGER (bước tiên quyết cho IDENTITY)
ALTER TABLE mapping_revisions
  ALTER COLUMN revision TYPE INTEGER;

-- 3. Xoá default cũ nếu có
ALTER TABLE mapping_revisions
  ALTER COLUMN revision DROP DEFAULT;

-- 4. Gắn GENERATED ALWAYS AS IDENTITY — toàn bộ INSERT sau đây sẽ
--    nhận revision từ sequence nội bộ, không thể bị override từ application.
ALTER TABLE mapping_revisions
  ALTER COLUMN revision ADD GENERATED ALWAYS AS IDENTITY;

-- 5. Đồng bộ sequence về max hiện tại + 1 (tránh xung đột với dữ liệu cũ)
DO $$
DECLARE
  max_rev  INTEGER;
  seq_name TEXT;
BEGIN
  SELECT MAX(revision) INTO max_rev FROM mapping_revisions;
  IF max_rev IS NOT NULL THEN
    seq_name := pg_get_serial_sequence('mapping_revisions', 'revision');
    EXECUTE format('ALTER SEQUENCE %s RESTART WITH %s', seq_name, max_rev + 1);
  END IF;
END;
$$;

-- 6. Thêm UNIQUE constraint: đảm bảo mỗi (mapping_id, revision) là duy nhất
--    ngay cả khi có bug ở tầng application trong tương lai.
ALTER TABLE mapping_revisions
  ADD CONSTRAINT uq_mapping_revisions_mapping_revision UNIQUE (mapping_id, revision);

-- 7. Index nhanh tra cứu lịch sử theo mapping_id
CREATE INDEX idx_mapping_revisions_mapping_id ON mapping_revisions(mapping_id);

-- 8. Cập nhật trigger: bỏ cột revision khỏi INSERT vì giờ do IDENTITY tự sinh.
--    Giữ nguyên trigger increment_product_mapping_revision trên product_mappings
--    (vẫn cần để tracking version hiện tại của mapping row).
CREATE OR REPLACE FUNCTION record_product_mapping_revision()
RETURNS TRIGGER AS $$
BEGIN
  -- revision bị loại khỏi INSERT: GENERATED ALWAYS AS IDENTITY tự sinh giá trị,
  -- loại bỏ hoàn toàn nguy cơ duplicate revision_no khi 2 transaction đồng thời.
  INSERT INTO mapping_revisions (mapping_id, snapshot, changed_by)
  VALUES (NEW.id, to_jsonb(NEW), NEW.approved_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
