SET @batch_number_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'items'
    AND COLUMN_NAME = 'batch_number'
);

SET @batch_number_sql := IF(
  @batch_number_exists = 0,
  'ALTER TABLE items ADD COLUMN batch_number VARCHAR(100) NULL AFTER barcode',
  'SELECT 1'
);

PREPARE stmt FROM @batch_number_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
