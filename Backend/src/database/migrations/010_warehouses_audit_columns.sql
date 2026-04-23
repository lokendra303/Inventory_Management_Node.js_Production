-- Track who created / last updated each warehouse (for detail view & audit).
SET @db := DATABASE();

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'warehouses' AND COLUMN_NAME = 'created_by');
SET @sql := IF(@has = 0, 'ALTER TABLE warehouses ADD COLUMN created_by VARCHAR(36) NULL COMMENT ''institution_users.id'' AFTER status', 'SELECT 1 AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'warehouses' AND COLUMN_NAME = 'updated_by');
SET @sql := IF(@has = 0, 'ALTER TABLE warehouses ADD COLUMN updated_by VARCHAR(36) NULL COMMENT ''institution_users.id'' AFTER created_by', 'SELECT 1 AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
