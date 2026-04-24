-- =============================================================================
-- 014_create_institution_profiles.sql
-- Normalize core company profile fields into institution_profiles.
--
-- Non-breaking:
-- - company_settings remains in place for legacy readers.
-- - backfills profile rows from company_settings.
-- =============================================================================

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

INSERT INTO institution_profiles
  (institution_id, company_name, address, phone, email, bank_name, account_number, ifsc_code, swift_code, logo_path, authorized_signatory_name, authorized_signatory_designation)
SELECT
  cs.institution_id COLLATE utf8mb4_unicode_ci,
  cs.company_name,
  cs.address,
  cs.phone,
  cs.email,
  cs.bank_name,
  cs.account_number,
  cs.ifsc_code,
  cs.swift_code,
  cs.logo_path,
  cs.authorized_signatory_name,
  cs.authorized_signatory_designation
FROM company_settings cs
LEFT JOIN institution_profiles p
  ON p.institution_id = (cs.institution_id COLLATE utf8mb4_unicode_ci)
WHERE p.id IS NULL;
