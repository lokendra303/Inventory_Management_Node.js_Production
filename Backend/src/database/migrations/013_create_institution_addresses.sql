-- =============================================================================
-- 013_create_institution_addresses.sql
-- Normalize company addresses into institution_addresses.
--
-- Non-breaking:
-- - Keeps company_addresses untouched for backward compatibility.
-- - Backfills institution_addresses from company_addresses if missing.
-- =============================================================================

CREATE TABLE IF NOT EXISTS institution_addresses (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  institution_id VARCHAR(36) NOT NULL,
  label VARCHAR(120) NOT NULL DEFAULT 'Address',
  address TEXT NOT NULL,
  address_line1 VARCHAR(255) NULL,
  address_line2 VARCHAR(255) NULL,
  city VARCHAR(100) NULL,
  state VARCHAR(100) NULL,
  country VARCHAR(100) NULL,
  postal_code VARCHAR(20) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_inst_addr_inst (institution_id),
  KEY idx_inst_addr_default (institution_id, is_default),
  KEY idx_inst_addr_sort (institution_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

