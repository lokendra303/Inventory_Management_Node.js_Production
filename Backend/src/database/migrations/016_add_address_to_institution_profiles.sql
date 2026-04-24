-- =============================================================================
-- 016_add_address_to_institution_profiles.sql
-- Ensure institution_profiles stores profile address for existing databases.
-- =============================================================================

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'institution_profiles'
    AND column_name = 'address'
);

SET @alter_sql := IF(
  @col_exists = 0,
  'ALTER TABLE institution_profiles ADD COLUMN address TEXT NULL AFTER company_name',
  'SELECT 1'
);

PREPARE stmt FROM @alter_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill profile address from legacy company_settings where profile address is missing.
UPDATE institution_profiles p
JOIN company_settings cs
  ON cs.institution_id COLLATE utf8mb4_unicode_ci = p.institution_id
SET p.address = cs.address
WHERE (p.address IS NULL OR p.address = '')
  AND cs.address IS NOT NULL
  AND cs.address <> '';
