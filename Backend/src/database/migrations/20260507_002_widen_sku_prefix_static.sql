-- Widen SKU rule static/template prefix to support advanced token formats.
-- Old schema had prefix_static VARCHAR(20), which is too small for
-- templates like {BRAND}-{ITEM}-{VARIANT}-{SIZE}-{TYPE}-{SEQ}.

SET @db := DATABASE();
SET @col_type := (
  SELECT COLUMN_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'sku_generator_rules'
    AND COLUMN_NAME = 'prefix_static'
  LIMIT 1
);

SET @sql := IF(
  @col_type IS NULL,
  'SELECT 1',
  IF(
    @col_type LIKE 'varchar(255)%',
    'SELECT 1',
    'ALTER TABLE sku_generator_rules MODIFY COLUMN prefix_static VARCHAR(255) NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
