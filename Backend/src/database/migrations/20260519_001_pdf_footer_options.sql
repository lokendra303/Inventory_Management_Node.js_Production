-- =============================================================================
-- 20260519_001_pdf_footer_options.sql
-- Per-document stamp/signature visibility on PDFs (SI, PI, SO, PO).
-- =============================================================================

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'institution_profiles'
    AND column_name = 'pdf_footer_options'
);

SET @alter_sql := IF(
  @col_exists = 0,
  'ALTER TABLE institution_profiles ADD COLUMN pdf_footer_options JSON NULL COMMENT ''Stamp/signature per doc: si,pi,so,po'' AFTER invoice_pdf_template',
  'SELECT 1'
);

PREPARE stmt FROM @alter_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
