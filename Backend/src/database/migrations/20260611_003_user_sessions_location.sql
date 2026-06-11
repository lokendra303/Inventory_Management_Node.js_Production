-- Approximate login location from IP (city / region / country)
SET @db := DATABASE();

SET @has := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'user_sessions' AND COLUMN_NAME = 'location_label'
);
SET @sql := IF(
  @has = 0,
  'ALTER TABLE user_sessions
     ADD COLUMN location_city VARCHAR(100) NULL AFTER user_agent,
     ADD COLUMN location_region VARCHAR(100) NULL AFTER location_city,
     ADD COLUMN location_country VARCHAR(100) NULL AFTER location_region,
     ADD COLUMN location_country_code VARCHAR(8) NULL AFTER location_country,
     ADD COLUMN location_label VARCHAR(255) NULL AFTER location_country_code',
  'SELECT "user_sessions location columns already exist" AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
