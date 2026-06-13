-- Putaway: track GRN lines awaiting bin placement + bin-level stock ledger.

SET @db := DATABASE();

-- 1. grn_lines.quantity_putaway — how much of each GRN line has been put away.
SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'grn_lines' AND COLUMN_NAME = 'quantity_putaway');
SET @sql := IF(@has = 0,
  'ALTER TABLE grn_lines ADD COLUMN quantity_putaway DECIMAL(15,4) NOT NULL DEFAULT 0 AFTER quantity_received',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Putaway audit records (one row per putaway action).
CREATE TABLE IF NOT EXISTS putaway_records (
  id VARCHAR(36) NOT NULL,
  institution_id VARCHAR(36) NOT NULL,
  grn_line_id VARCHAR(36) NOT NULL,
  grn_id VARCHAR(36) NOT NULL,
  item_id VARCHAR(36) NOT NULL,
  warehouse_id VARCHAR(36) NOT NULL,
  bin_id VARCHAR(36) NOT NULL,
  quantity DECIMAL(15,4) NOT NULL,
  notes TEXT NULL,
  putaway_by VARCHAR(36) NULL,
  putaway_date TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_putaway_institution (institution_id),
  KEY idx_putaway_grn_line (grn_line_id),
  KEY idx_putaway_grn (grn_id),
  KEY idx_putaway_bin (bin_id),
  CONSTRAINT fk_putaway_grn_line FOREIGN KEY (grn_line_id) REFERENCES grn_lines (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. Bin-level stock (warehouse inventory unchanged; this tracks physical location).
CREATE TABLE IF NOT EXISTS warehouse_bin_stock (
  id VARCHAR(36) NOT NULL,
  institution_id VARCHAR(36) NOT NULL,
  warehouse_id VARCHAR(36) NOT NULL,
  bin_id VARCHAR(36) NOT NULL,
  item_id VARCHAR(36) NOT NULL,
  quantity DECIMAL(15,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bin_item (institution_id, bin_id, item_id),
  KEY idx_bin_stock_wh_item (institution_id, warehouse_id, item_id),
  KEY idx_bin_stock_bin (bin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. Existing GRN lines (pre-putaway) are treated as already put away.
UPDATE grn_lines
   SET quantity_putaway = quantity_received
 WHERE COALESCE(quantity_putaway, 0) = 0
   AND quantity_received > 0;
