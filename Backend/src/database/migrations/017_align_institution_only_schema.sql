-- =============================================================================
-- 017_align_institution_only_schema.sql
-- Align running database with institution-first schema.
-- =============================================================================

-- Ensure normalized institution tables exist.
CREATE TABLE IF NOT EXISTS institution_addresses (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  institution_id VARCHAR(36) NOT NULL,
  label VARCHAR(120) NOT NULL DEFAULT 'Address',
  address TEXT NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_inst_addr_inst (institution_id),
  KEY idx_inst_addr_default (institution_id, is_default),
  KEY idx_inst_addr_sort (institution_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS institution_documents (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  institution_id VARCHAR(36) NOT NULL,
  doc_type VARCHAR(30) NOT NULL,
  label VARCHAR(120) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  metadata JSON DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_inst_docs_type (institution_id, doc_type),
  KEY idx_inst_docs_default (institution_id, doc_type, is_default),
  KEY idx_inst_docs_sort (institution_id, doc_type, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS institution_profiles (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  institution_id VARCHAR(36) NOT NULL,
  company_name VARCHAR(255) NULL,
  address TEXT NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  bank_name VARCHAR(255) NULL,
  account_number VARCHAR(100) NULL,
  ifsc_code VARCHAR(50) NULL,
  swift_code VARCHAR(50) NULL,
  logo_path VARCHAR(500) NULL,
  authorized_signatory_name VARCHAR(255) NULL,
  authorized_signatory_designation VARCHAR(255) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_inst_profile (institution_id),
  KEY idx_inst_profile_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Remove legacy company tables.
DROP TABLE IF EXISTS company_addresses;
DROP TABLE IF EXISTS company_signatures;
DROP TABLE IF EXISTS company_stamps;
DROP TABLE IF EXISTS company_settings;
