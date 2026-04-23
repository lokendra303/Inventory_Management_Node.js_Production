-- Fix: sales invoice controller inserts into `stock_movements` as an audit trail,
-- but the table was never migrated to the schema. Missing table causes every
-- sales invoice create to roll back with "Table 'stock_movements' doesn't exist".
-- The event_store already captures the SALE_SHIPPED event; stock_movements is
-- just a flat reference log. Create it to restore the audit INSERT path.

CREATE TABLE IF NOT EXISTS stock_movements (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  institution_id  VARCHAR(36)  NOT NULL,
  item_id         VARCHAR(36)  NOT NULL,
  movement_type   VARCHAR(30)  NOT NULL,        -- 'in' | 'out' | 'transfer' | 'adjust' | 'receipt' | ...
  quantity        DECIMAL(15,4) NOT NULL,
  reference_type  VARCHAR(50)  NULL,             -- 'sales_invoice' | 'grn' | 'transfer' | 'adjustment' | ...
  reference_id    VARCHAR(36)  NULL,
  reference_number VARCHAR(100) NULL,
  created_by      VARCHAR(64)  NULL,             -- userId (varchar to tolerate legacy '1' fallback)
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CREATE INDEX IF NOT EXISTS isn't supported in all MySQL versions; use
-- information_schema guards so the migration is fully idempotent.
SET @db := DATABASE();

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='stock_movements' AND INDEX_NAME='idx_stock_movements_institution');
SET @sql := IF(@has=0, 'CREATE INDEX idx_stock_movements_institution ON stock_movements(institution_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='stock_movements' AND INDEX_NAME='idx_stock_movements_item');
SET @sql := IF(@has=0, 'CREATE INDEX idx_stock_movements_item ON stock_movements(institution_id, item_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='stock_movements' AND INDEX_NAME='idx_stock_movements_reference');
SET @sql := IF(@has=0, 'CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='stock_movements' AND INDEX_NAME='idx_stock_movements_created_at');
SET @sql := IF(@has=0, 'CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
