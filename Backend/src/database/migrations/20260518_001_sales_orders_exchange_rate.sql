-- Persist document → base FX on sales orders (matches purchase_orders)
SET @db := DATABASE();

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sales_orders' AND COLUMN_NAME = 'exchange_rate');
SET @sql := IF(@has = 0, 'ALTER TABLE sales_orders ADD COLUMN exchange_rate DECIMAL(10,4) NOT NULL DEFAULT 1.0000 AFTER currency', 'SELECT 1 AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
