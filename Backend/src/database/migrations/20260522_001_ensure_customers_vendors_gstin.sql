-- Ensure GSTIN column exists on customers and vendors (older DBs may lack it)

SET @has := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'gstin'
);
SET @sql := IF(@has = 0,
  'ALTER TABLE customers ADD COLUMN gstin VARCHAR(20) NULL COMMENT ''GST identification number'' AFTER pan',
  'SELECT 1 AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vendors' AND COLUMN_NAME = 'gstin'
);
SET @sql := IF(@has = 0,
  'ALTER TABLE vendors ADD COLUMN gstin VARCHAR(20) NULL COMMENT ''GST identification number'' AFTER pan',
  'SELECT 1 AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
