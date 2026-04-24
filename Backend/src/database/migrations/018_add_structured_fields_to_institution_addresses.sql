-- =============================================================================
-- 018_add_structured_fields_to_institution_addresses.sql
-- Add structured location fields to institution_addresses and backfill defaults
-- from institutions for better reporting/filtering.
-- =============================================================================

SET @db_name := DATABASE();

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = @db_name AND table_name = 'institution_addresses' AND column_name = 'address_line1'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE institution_addresses ADD COLUMN address_line1 VARCHAR(255) NULL AFTER address', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = @db_name AND table_name = 'institution_addresses' AND column_name = 'address_line2'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE institution_addresses ADD COLUMN address_line2 VARCHAR(255) NULL AFTER address_line1', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = @db_name AND table_name = 'institution_addresses' AND column_name = 'city'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE institution_addresses ADD COLUMN city VARCHAR(100) NULL AFTER address_line2', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = @db_name AND table_name = 'institution_addresses' AND column_name = 'state'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE institution_addresses ADD COLUMN state VARCHAR(100) NULL AFTER city', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = @db_name AND table_name = 'institution_addresses' AND column_name = 'country'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE institution_addresses ADD COLUMN country VARCHAR(100) NULL AFTER state', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = @db_name AND table_name = 'institution_addresses' AND column_name = 'postal_code'
);
SET @sql := IF(@col_exists = 0, 'ALTER TABLE institution_addresses ADD COLUMN postal_code VARCHAR(20) NULL AFTER country', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE institution_addresses ia
JOIN institutions i ON i.id COLLATE utf8mb4_unicode_ci = ia.institution_id COLLATE utf8mb4_unicode_ci
SET
  ia.city = COALESCE(ia.city, i.city),
  ia.state = COALESCE(ia.state, i.state),
  ia.country = COALESCE(ia.country, i.country),
  ia.postal_code = COALESCE(ia.postal_code, i.postal_code),
  ia.address_line1 = COALESCE(ia.address_line1, i.address)
WHERE ia.is_default = 1;
