-- Fix: add discount_rate and discount_amount columns to sales_order_lines.
-- The salesOrder.service.js createSalesOrder() INSERT writes to these columns,
-- but the live schema was missing them, so every SO create failed with
-- "Unknown column 'discount_rate' in 'field list'". Mirrors purchase_order_lines.

-- Guarded with information_schema lookup so the migration is idempotent.
SET @db := DATABASE();

SET @has_discount_rate := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'sales_order_lines'
    AND COLUMN_NAME = 'discount_rate'
);
SET @sql := IF(
  @has_discount_rate = 0,
  'ALTER TABLE sales_order_lines ADD COLUMN discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER tax_rate',
  'SELECT "sales_order_lines.discount_rate already exists" AS note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_discount_amount := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'sales_order_lines'
    AND COLUMN_NAME = 'discount_amount'
);
SET @sql := IF(
  @has_discount_amount = 0,
  'ALTER TABLE sales_order_lines ADD COLUMN discount_amount DECIMAL(15,4) NOT NULL DEFAULT 0 AFTER discount_rate',
  'SELECT "sales_order_lines.discount_amount already exists" AS note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
