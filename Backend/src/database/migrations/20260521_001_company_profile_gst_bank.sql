-- =============================================================================
-- Company profile: GSTIN / tax id, bank account holder, branch (for invoices & PDFs)
-- =============================================================================

SET @tbl := (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'institution_profiles'
);

-- tax_id (GSTIN)
SET @col_tax := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'institution_profiles' AND column_name = 'tax_id'
);
SET @sql_tax := IF(
  @tbl > 0 AND @col_tax = 0,
  'ALTER TABLE institution_profiles ADD COLUMN tax_id VARCHAR(100) NULL COMMENT ''GSTIN / tax registration'' AFTER email',
  'SELECT 1'
);
PREPARE s1 FROM @sql_tax;
EXECUTE s1;
DEALLOCATE PREPARE s1;

-- account_holder_name
SET @col_holder := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'institution_profiles' AND column_name = 'account_holder_name'
);
SET @sql_holder := IF(
  @tbl > 0 AND @col_holder = 0,
  'ALTER TABLE institution_profiles ADD COLUMN account_holder_name VARCHAR(255) NULL AFTER bank_name',
  'SELECT 1'
);
PREPARE s2 FROM @sql_holder;
EXECUTE s2;
DEALLOCATE PREPARE s2;

-- branch_name
SET @col_branch := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'institution_profiles' AND column_name = 'branch_name'
);
SET @sql_branch := IF(
  @tbl > 0 AND @col_branch = 0,
  'ALTER TABLE institution_profiles ADD COLUMN branch_name VARCHAR(255) NULL AFTER ifsc_code',
  'SELECT 1'
);
PREPARE s3 FROM @sql_branch;
EXECUTE s3;
DEALLOCATE PREPARE s3;

-- Backfill GST from institutions (collation-safe join + WHERE on profile PK for safe-update mode)
SET @sql_backfill_tax := IF(
  @tbl > 0,
  'UPDATE institution_profiles p
     INNER JOIN institutions i
       ON i.id COLLATE utf8mb4_unicode_ci = p.institution_id COLLATE utf8mb4_unicode_ci
   SET p.tax_id = i.tax_id
   WHERE p.id > 0
     AND (p.tax_id IS NULL OR TRIM(p.tax_id) = '''')
     AND i.tax_id IS NOT NULL AND TRIM(i.tax_id) <> ''''',
  'SELECT 1'
);
PREPARE s4 FROM @sql_backfill_tax;
EXECUTE s4;
DEALLOCATE PREPARE s4;
