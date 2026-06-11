-- Per-platform-admin optional two-factor authentication (login OTP when enabled)
SET @db := DATABASE();

SET @has := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'platform_admins' AND COLUMN_NAME = 'two_factor_enabled'
);
SET @sql := IF(
  @has = 0,
  'ALTER TABLE platform_admins ADD COLUMN two_factor_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER status',
  'SELECT "platform_admins.two_factor_enabled already exists" AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
