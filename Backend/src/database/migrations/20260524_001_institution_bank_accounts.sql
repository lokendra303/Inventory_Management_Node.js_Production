-- Multiple bank accounts per institution (company settings), mirrored to institution_profiles default row for PDFs.

CREATE TABLE IF NOT EXISTS institution_bank_accounts (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  institution_id VARCHAR(36) NOT NULL,
  label VARCHAR(120) NOT NULL DEFAULT 'Bank account',
  bank_name VARCHAR(255) NULL,
  account_holder_name VARCHAR(255) NULL,
  account_number VARCHAR(100) NULL,
  ifsc_code VARCHAR(50) NULL,
  branch_name VARCHAR(255) NULL,
  swift_code VARCHAR(50) NULL,
  is_default TINYINT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_inst_bank_inst (institution_id),
  KEY idx_inst_bank_default (institution_id, is_default),
  KEY idx_inst_bank_sort (institution_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
