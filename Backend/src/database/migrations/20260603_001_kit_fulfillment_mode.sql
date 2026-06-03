-- Kit fulfillment: prebuilt (sell finished kit stock) vs explode_on_ship (consume BOM components)
-- Idempotent: safe if column already exists (e.g. applied via npm run db:migrate)

SET @has := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'items'
    AND COLUMN_NAME = 'kit_fulfillment_mode'
);
SET @sql := IF(@has = 0,
  'ALTER TABLE `items` ADD COLUMN `kit_fulfillment_mode` enum(''prebuilt'',''explode_on_ship'') NOT NULL DEFAULT ''prebuilt'' AFTER `type`',
  'SELECT 1 AS kit_fulfillment_mode_already_present'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
