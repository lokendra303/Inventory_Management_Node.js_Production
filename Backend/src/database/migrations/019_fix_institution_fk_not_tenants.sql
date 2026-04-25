-- =============================================================================
-- 019_fix_institution_fk_not_tenants.sql
-- Legacy dumps referenced non-existent `tenants`; institution_id must reference `institutions`.
-- =============================================================================

SET @db := DATABASE();

-- inventory_history.institution_id -> institutions
SET @fk_inv := (
  SELECT kcu.CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE kcu
  JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
    ON rc.CONSTRAINT_SCHEMA = kcu.TABLE_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE kcu.TABLE_SCHEMA = @db
    AND kcu.TABLE_NAME = 'inventory_history'
    AND kcu.COLUMN_NAME = 'institution_id'
    AND rc.REFERENCED_TABLE_NAME = 'tenants'
  LIMIT 1
);
SET @sql := IF(@fk_inv IS NOT NULL,
  CONCAT('ALTER TABLE inventory_history DROP FOREIGN KEY `', @fk_inv, '`'),
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_inv_inst := (
  SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @db AND TABLE_NAME = 'inventory_history'
    AND REFERENCED_TABLE_NAME = 'institutions'
);
SET @sql := IF(@has_inv_inst = 0,
  'ALTER TABLE inventory_history ADD CONSTRAINT inventory_history_institution_fk FOREIGN KEY (institution_id) REFERENCES institutions(id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- temp_access_tokens.institution_id -> institutions
SET @fk_tmp := (
  SELECT kcu.CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE kcu
  JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
    ON rc.CONSTRAINT_SCHEMA = kcu.TABLE_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
  WHERE kcu.TABLE_SCHEMA = @db
    AND kcu.TABLE_NAME = 'temp_access_tokens'
    AND kcu.COLUMN_NAME = 'institution_id'
    AND rc.REFERENCED_TABLE_NAME = 'tenants'
  LIMIT 1
);
SET @sql := IF(@fk_tmp IS NOT NULL,
  CONCAT('ALTER TABLE temp_access_tokens DROP FOREIGN KEY `', @fk_tmp, '`'),
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_tmp_inst := (
  SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @db AND TABLE_NAME = 'temp_access_tokens'
    AND REFERENCED_TABLE_NAME = 'institutions'
);
SET @sql := IF(@has_tmp_inst = 0,
  'ALTER TABLE temp_access_tokens ADD CONSTRAINT temp_access_tokens_institution_fk FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
