-- SPARELINK Database Schema
-- Full migration script for PostgreSQL
-- This creates all tables, indexes, extensions, and constraints

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext"; -- Case-insensitive text for emails
CREATE EXTENSION IF NOT EXISTS "unaccent"; -- Remove accents for searching
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Trigram index for fuzzy matching

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role_enum AS ENUM ('USER', 'SALES', 'SENIOR_SALES', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE license_status_enum AS ENUM ('PENDING', 'ACTIVATED', 'SUSPENDED', 'EXPIRED', 'REVOKED');
CREATE TYPE activation_status_enum AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
CREATE TYPE quote_status_enum AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED');
CREATE TYPE approval_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE import_status_enum AS ENUM ('NEW', 'VALIDATED', 'CONFLICT', 'STAGED', 'APPLIED', 'REJECTED');

-- ============================================================================
-- AUTHENTICATION & AUTHORIZATION
-- ============================================================================

CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  level INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (name, description, level) VALUES
  ('USER', 'Basic user - read-only access', 0),
  ('SALES', 'Sales representative - create quotes', 1),
  ('SENIOR_SALES', 'Senior sales - approve AI suggestions', 2),
  ('ADMIN', 'System administrator', 3),
  ('SUPER_ADMIN', 'Super administrator - full access', 4);

CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resource, action)
);

INSERT INTO permissions (resource, action, description) VALUES
  ('quotes', 'create', 'Create quotations'),
  ('quotes', 'read', 'View quotations'),
  ('quotes', 'update', 'Edit quotations'),
  ('quotes', 'delete', 'Delete quotations'),
  ('quotes', 'approve', 'Approve quotations'),
  ('products', 'read', 'View products'),
  ('products', 'import', 'Import product data'),
  ('mappings', 'approve', 'Approve product mappings'),
  ('users', 'manage', 'Manage users'),
  ('licenses', 'manage', 'Manage licenses');

CREATE TABLE role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);

-- Assign permissions to roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'USER'),
  id
FROM permissions WHERE resource IN ('quotes', 'products') AND action IN ('read');

INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'SALES'),
  id
FROM permissions WHERE resource IN ('quotes', 'products') AND action IN ('read', 'create', 'update');

INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'SENIOR_SALES'),
  id
FROM permissions WHERE action IN ('read', 'create', 'update', 'approve');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email CITEXT UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

CREATE TABLE user_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  role_id INT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE(user_id, role_id)
);

-- ============================================================================
-- LICENSE MANAGEMENT
-- ============================================================================

CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_key VARCHAR(255) UNIQUE NOT NULL,
  encrypted_metadata TEXT NOT NULL,
  status license_status_enum DEFAULT 'PENDING',
  purchase_date TIMESTAMP,
  expiry_date TIMESTAMP,
  is_trial BOOLEAN DEFAULT FALSE,
  trial_end_date TIMESTAMP,
  max_activations INT DEFAULT 3,
  activation_count INT DEFAULT 0,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_expiry_date ON licenses(expiry_date);
CREATE INDEX idx_licenses_license_key ON licenses(license_key);

CREATE TABLE activations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_id UUID NOT NULL,
  machine_id VARCHAR(255) NOT NULL,
  fingerprint TEXT NOT NULL,
  activated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_validated_at TIMESTAMPTZ,
  -- Server-issued nonce metadata to detect client clock rollback attacks
  -- server_nonce should be random hex (>= 16 chars) and rotate after each successful
  -- online validation. nonce_issued_at is server UTC timestamp used for rollback checks.
  server_nonce TEXT,
  nonce_issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  rebind_count INT DEFAULT 0,
  rebind_last_at TIMESTAMPTZ,
  status activation_status_enum DEFAULT 'ACTIVE',
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
  CONSTRAINT chk_activations_nonce_consistency CHECK (
    (server_nonce IS NULL AND nonce_issued_at IS NULL)
    OR (server_nonce IS NOT NULL AND LENGTH(TRIM(server_nonce)) >= 16 AND nonce_issued_at IS NOT NULL)
  ),
  UNIQUE(license_id, machine_id)
);

CREATE INDEX idx_activations_machine_id ON activations(machine_id);
CREATE INDEX idx_activations_license_id ON activations(license_id);
CREATE INDEX idx_activations_nonce_issued_at ON activations(nonce_issued_at);

-- ============================================================================
-- BUSINESS DATA
-- ============================================================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email CITEXT,
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  tax_id VARCHAR(50),
  industry VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_name ON customers(name);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  specs_jsonb JSONB DEFAULT '{}',
  in_stock INT DEFAULT 0,
  unit_price DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_specs_gin ON products USING GIN (specs_jsonb jsonb_path_ops);

CREATE TABLE product_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  code_normalized VARCHAR(50) UNIQUE NOT NULL,
  tokens TEXT[] DEFAULT ARRAY[]::TEXT[],
  alternate_code VARCHAR(50),
  source_system VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Trigram index for fuzzy search on normalized codes
CREATE INDEX idx_product_codes_trgm ON product_codes USING GIN (code_normalized gin_trgm_ops);
CREATE INDEX idx_product_codes_tokens ON product_codes USING GIN (tokens);
CREATE INDEX idx_product_codes_product_id ON product_codes(product_id);

-- ============================================================================
-- QUOTES & MAPPINGS
-- ============================================================================

CREATE TABLE product_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  primary_product_id UUID NOT NULL,
  alternate_product_id UUID,
  mapping_type VARCHAR(100) NOT NULL,
  confidence INT DEFAULT 100,
  requires_approval BOOLEAN DEFAULT FALSE,
  ai_model VARCHAR(100),
  ai_prompt TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(50) DEFAULT 'PENDING',
  rejection_reason TEXT,
  submitted_by VARCHAR(255),
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (primary_product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (alternate_product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE INDEX idx_product_mappings_type ON product_mappings(mapping_type);
CREATE INDEX idx_product_mappings_status ON product_mappings(status);
CREATE INDEX idx_product_mappings_confidence ON product_mappings(confidence);

CREATE TABLE mapping_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mapping_id UUID NOT NULL,
  -- Option A: GENERATED ALWAYS AS IDENTITY bảo đảm atomic increment,
  -- tránh race condition khi dùng MAX(revision) + 1 trong môi trường concurrent.
  -- NOTE: revision là global sequence, KHÔNG sequential per-mapping.
  -- Ví dụ: mapping_A có thể có revision 1, 5, 9; mapping_B có 2, 3, 4, 6, 7, 8.
  -- Dùng thứ tự revision hoặc created_at để xác định version mới nhất của mapping.
  revision INTEGER NOT NULL GENERATED ALWAYS AS IDENTITY,
  snapshot JSONB DEFAULT '{}' NOT NULL,
  changed_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mapping_id) REFERENCES product_mappings(id) ON DELETE CASCADE,
  CONSTRAINT uq_mapping_revisions_mapping_revision UNIQUE (mapping_id, revision)
);

CREATE INDEX idx_mapping_revisions_mapping_id ON mapping_revisions(mapping_id);

CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID NOT NULL,
  created_by_id UUID NOT NULL,
  status quote_status_enum DEFAULT 'DRAFT',
  customer_po VARCHAR(100),
  notes TEXT,
  valid_from TIMESTAMP NOT NULL,
  valid_until TIMESTAMP NOT NULL,
  total_price DECIMAL(12, 2) DEFAULT 0,
  sent_at TIMESTAMP,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (created_by_id) REFERENCES users(id)
);

CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX idx_quotes_created_by_id ON quotes(created_by_id);

CREATE TABLE quote_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity INT DEFAULT 1,
  unit_price DECIMAL(12, 2) NOT NULL,
  total_price DECIMAL(12, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX idx_quote_line_items_quote_id ON quote_line_items(quote_id);

-- ============================================================================
-- SEARCH & ANALYTICS
-- ============================================================================

CREATE TABLE search_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id VARCHAR(255),
  user_id UUID,
  query TEXT NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  result_count INT DEFAULT 0,
  is_offline BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_search_sessions_machine_id ON search_sessions(machine_id);
CREATE INDEX idx_search_sessions_started_at ON search_sessions(started_at);

CREATE TABLE search_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL,
  product_id UUID NOT NULL,
  source VARCHAR(100) NOT NULL,
  confidence INT DEFAULT 100,
  rank INT DEFAULT 0,
  reasoning TEXT,
  clicked_at TIMESTAMP,
  added_to_quote TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES search_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX idx_search_results_session_id ON search_results(session_id);
CREATE INDEX idx_search_results_source ON search_results(source);

CREATE TABLE search_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id VARCHAR(255),
  query VARCHAR(500) NOT NULL,
  result_count INT DEFAULT 0,
  searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_search_history_machine_id ON search_history(machine_id);
CREATE INDEX idx_search_history_searched_at ON search_history(searched_at);

-- ============================================================================
-- DATA IMPORT & STAGING
-- ============================================================================

CREATE TABLE import_row_staging (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id VARCHAR(100) NOT NULL,
  row_number INT NOT NULL,
  raw_data JSONB DEFAULT '{}',
  status import_status_enum DEFAULT 'NEW',
  conflict_type VARCHAR(100),
  conflict_data JSONB DEFAULT '{}',
  processed_by VARCHAR(255),
  processed_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_import_row_staging_batch_id ON import_row_staging(batch_id);
CREATE INDEX idx_import_row_staging_status ON import_row_staging(status);

-- ============================================================================
-- APPROVALS & WORKFLOWS
-- ============================================================================

CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  requested_by UUID NOT NULL,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data JSONB DEFAULT '{}',
  status approval_status_enum DEFAULT 'PENDING',
  approved_by UUID,
  approved_at TIMESTAMP,
  approval_note TEXT,
  rejection_reason TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE INDEX idx_approvals_entity ON approvals(entity_type, entity_id);
CREATE INDEX idx_approvals_status ON approvals(status);

-- ============================================================================
-- AUDIT & COMPLIANCE
-- ============================================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  user_name VARCHAR(255),
  user_email CITEXT,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255),
  changes JSONB DEFAULT '{}',
  reason TEXT,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- INDUSTRY ATTRIBUTES
-- ============================================================================

CREATE TABLE industry_attribute_defs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  industry VARCHAR(100) NOT NULL,
  attribute_name VARCHAR(255) NOT NULL,
  data_type VARCHAR(50) NOT NULL,
  enum_values TEXT[] DEFAULT ARRAY[]::TEXT[],
  description TEXT,
  is_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(industry, attribute_name)
);

-- Sample industry attributes
INSERT INTO industry_attribute_defs (industry, attribute_name, data_type, description, is_required) VALUES
  ('ISO', 'grade', 'ENUM', 'ISO Grade specification', FALSE),
  ('ISO', 'tolerance', 'ENUM', 'ISO Tolerance class', FALSE),
  ('EN', 'material', 'ENUM', 'EN Material designation', FALSE),
  ('API', 'rating', 'ENUM', 'API Pressure Rating', FALSE),
  ('API', 'flange_type', 'ENUM', 'Flange type per API spec', FALSE);

-- Seed demo users
INSERT INTO users (email, name, password_hash, active) VALUES
  ('user@sparelink.local', 'Demo User', '$2b$10$dummyhash', TRUE),
  ('sales@sparelink.local', 'Demo Sales', '$2b$10$dummyhash', TRUE),
  ('admin@sparelink.local', 'Demo Admin', '$2b$10$dummyhash', TRUE);

INSERT INTO user_roles (user_id, role_id)
SELECT users.id, roles.id FROM users, roles
WHERE users.email = 'user@sparelink.local' AND roles.name = 'USER'
UNION ALL
SELECT users.id, roles.id FROM users, roles
WHERE users.email = 'sales@sparelink.local' AND roles.name = 'SALES'
UNION ALL
SELECT users.id, roles.id FROM users, roles
WHERE users.email = 'admin@sparelink.local' AND roles.name = 'SUPER_ADMIN';

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at column
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_product_mapping_revision()
RETURNS TRIGGER AS $$
BEGIN
  NEW.revision = OLD.revision + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION record_product_mapping_revision()
RETURNS TRIGGER AS $$
BEGIN
  -- revision bị loại khỏi INSERT: GENERATED ALWAYS AS IDENTITY tự sinh giá trị,
  -- loại bỏ hoàn toàn nguy cơ duplicate revision_no khi 2 transaction chạy đồng thời.
  INSERT INTO mapping_revisions (mapping_id, snapshot, changed_by)
  VALUES (NEW.id, to_jsonb(NEW), NEW.approved_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_roles_timestamp BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_permissions_timestamp BEFORE UPDATE ON permissions FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_users_timestamp BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_customers_timestamp BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_products_timestamp BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_product_codes_timestamp BEFORE UPDATE ON product_codes FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_product_mappings_timestamp BEFORE UPDATE ON product_mappings FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_licenses_timestamp BEFORE UPDATE ON licenses FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_quotes_timestamp BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_quote_line_items_timestamp BEFORE UPDATE ON quote_line_items FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_search_results_timestamp BEFORE UPDATE ON search_results FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_import_row_staging_timestamp BEFORE UPDATE ON import_row_staging FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_approvals_timestamp BEFORE UPDATE ON approvals FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_industry_attribute_defs_timestamp BEFORE UPDATE ON industry_attribute_defs FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Bump product_mappings.revision chỉ khi trường nghiệp vụ thực sự thay đổi
CREATE TRIGGER increment_product_mapping_revision_trigger
  BEFORE UPDATE OF status, confidence, approved_by, rejection_reason ON product_mappings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status
     OR OLD.confidence IS DISTINCT FROM NEW.confidence
     OR OLD.approved_by IS DISTINCT FROM NEW.approved_by)
  EXECUTE FUNCTION increment_product_mapping_revision();

CREATE TRIGGER record_product_mapping_revision_insert
  AFTER INSERT ON product_mappings
  FOR EACH ROW EXECUTE FUNCTION record_product_mapping_revision();

-- Ghi history chỉ khi trường nghiệp vụ thực sự thay đổi;
-- tránh tạo revision rác khi update_timestamp() cập nhật updated_at.
CREATE TRIGGER record_product_mapping_revision_update
  AFTER UPDATE OF status, confidence, approved_by, rejection_reason ON product_mappings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status
     OR OLD.confidence IS DISTINCT FROM NEW.confidence
     OR OLD.approved_by IS DISTINCT FROM NEW.approved_by)
  EXECUTE FUNCTION record_product_mapping_revision();

-- Normalize product codes
CREATE OR REPLACE FUNCTION normalize_product_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.code_normalized := LOWER(REGEXP_REPLACE(NEW.code, '\s+', '', 'g'));
  NEW.tokens := STRING_TO_ARRAY(REGEXP_REPLACE(NEW.code, '[^A-Za-z0-9]+', ' ', 'g'), ' ');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER normalize_product_code_trigger BEFORE INSERT OR UPDATE ON product_codes FOR EACH ROW EXECUTE FUNCTION normalize_product_code();

-- ============================================================================
-- VIEWS FOR ANALYTICS & REPORTING
-- ============================================================================

CREATE VIEW vw_user_activity AS
SELECT 
  u.id,
  u.email,
  u.name,
  COUNT(DISTINCT al.id) as total_actions,
  MAX(al.created_at) as last_action_at,
  COUNT(DISTINCT q.id) as quotes_created
FROM users u
LEFT JOIN audit_logs al ON u.id = al.user_id
LEFT JOIN quotes q ON u.id = q.created_by_id
GROUP BY u.id, u.email, u.name;

CREATE VIEW vw_license_status AS
SELECT 
  l.id,
  l.license_key,
  l.status,
  l.expiry_date,
  EXTRACT(DAY FROM (l.expiry_date::DATE - NOW()::DATE))::INT as days_until_expiry,
  l.activation_count,
  l.max_activations,
  COUNT(a.id) as actual_activations
FROM licenses l
LEFT JOIN activations a ON l.id = a.license_id
GROUP BY l.id, l.license_key, l.status, l.expiry_date, l.activation_count, l.max_activations;
