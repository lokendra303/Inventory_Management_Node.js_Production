-- =============================================================================
-- Company profile: PAN, CIN, TAN, website (invoices, PO PDFs, legal footer)
-- =============================================================================

SET @tbl := (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'institution_profiles'
);

SET @col_pan := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'institution_profiles' AND column_name = 'pan'
);
SET @sql_pan := IF(
  @tbl > 0 AND @col_pan = 0,
  'ALTER TABLE institution_profiles ADD COLUMN pan VARCHAR(10) NULL COMMENT ''PAN (uppercase)'' AFTER tax_id',
  'SELECT 1'
);
PREPARE s1 FROM @sql_pan;
EXECUTE s1;
DEALLOCATE PREPARE s1;

SET @col_cin := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'institution_profiles' AND column_name = 'cin'
);
SET @sql_cin := IF(
  @tbl > 0 AND @col_cin = 0,
  'ALTER TABLE institution_profiles ADD COLUMN cin VARCHAR(21) NULL COMMENT ''Corporate Identification Number'' AFTER pan',
  'SELECT 1'
);
PREPARE s2 FROM @sql_cin;
EXECUTE s2;
DEALLOCATE PREPARE s2;

SET @col_tan := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'institution_profiles' AND column_name = 'tan'
);
SET @sql_tan := IF(
  @tbl > 0 AND @col_tan = 0,
  'ALTER TABLE institution_profiles ADD COLUMN tan VARCHAR(10) NULL COMMENT ''Tax Deduction Account Number'' AFTER cin',
  'SELECT 1'
);
PREPARE s3 FROM @sql_tan;
EXECUTE s3;
DEALLOCATE PREPARE s3;

SET @col_web := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'institution_profiles' AND column_name = 'website'
);
SET @sql_web := IF(
  @tbl > 0 AND @col_web = 0,
  'ALTER TABLE institution_profiles ADD COLUMN website VARCHAR(255) NULL COMMENT ''Company website URL'' AFTER tan',
  'SELECT 1'
);
PREPARE s4 FROM @sql_web;
EXECUTE s4;
DEALLOCATE PREPARE s4;
