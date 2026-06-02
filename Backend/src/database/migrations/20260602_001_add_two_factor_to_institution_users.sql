-- Per-user optional two-factor authentication (login OTP when enabled)

SET @has := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'institution_users'
    AND COLUMN_NAME = 'two_factor_enabled'
);
SET @sql := IF(@has = 0,
  'ALTER TABLE institution_users ADD COLUMN two_factor_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER status',
  'SELECT 1 AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
