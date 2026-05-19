-- Optional GST invoice / order metadata (e-Way Bill, delivery, dispatch, etc.)
SET @db := DATABASE();

-- sales_invoices
SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sales_invoices' AND COLUMN_NAME = 'document_meta');
SET @sql := IF(@has = 0, 'ALTER TABLE sales_invoices ADD COLUMN document_meta JSON NULL COMMENT ''Optional GST/Tally header fields'' AFTER notes', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- purchase_invoices
SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_invoices' AND COLUMN_NAME = 'document_meta');
SET @sql := IF(@has = 0, 'ALTER TABLE purchase_invoices ADD COLUMN document_meta JSON NULL COMMENT ''Optional GST/Tally header fields'' AFTER notes', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_orders
SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sales_orders' AND COLUMN_NAME = 'document_meta');
SET @sql := IF(@has = 0, 'ALTER TABLE sales_orders ADD COLUMN document_meta JSON NULL COMMENT ''Optional GST/Tally header fields'' AFTER notes', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- purchase_orders
SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'document_meta');
SET @sql := IF(@has = 0, 'ALTER TABLE purchase_orders ADD COLUMN document_meta JSON NULL COMMENT ''Optional GST/Tally header fields'' AFTER notes', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
