-- =============================================================================
-- 20260515_001_add_invoice_pdf_template.sql
-- Per-institution invoice PDF layout (classic | minimal | modern).
-- =============================================================================

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'institution_profiles'
    AND column_name = 'invoice_pdf_template'
);

SET @alter_sql := IF(
  @col_exists = 0,
  'ALTER TABLE institution_profiles ADD COLUMN invoice_pdf_template VARCHAR(32) NOT NULL DEFAULT ''classic'' AFTER authorized_signatory_designation',
  'SELECT 1'
);

PREPARE stmt FROM @alter_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
