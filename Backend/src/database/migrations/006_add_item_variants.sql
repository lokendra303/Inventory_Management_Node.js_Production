-- =============================================================================
-- Item Variants feature (Zoho-style "Item containing Variants")
-- =============================================================================
-- Adds two new `items.type` values at the application layer:
--   'variant_parent' = container item (not sold, no stock, holds shared metadata)
--   'variant'        = sellable leaf with its own SKU / stock / prices / barcode
-- Existing types ('simple', 'composite', 'service') are unchanged.
--
-- Idempotent: all ALTERs are guarded against information_schema so re-running
-- (or running against a DB that already has these columns) is a no-op.
-- =============================================================================

SET @db := DATABASE();

-- 1. Widen items.type to VARCHAR(30) if still ENUM.
SET @curr := (SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='items' AND COLUMN_NAME='type');
SET @sql := IF(@curr LIKE 'varchar(30)%', 'SELECT 1', 'ALTER TABLE items MODIFY COLUMN `type` VARCHAR(30) NOT NULL DEFAULT ''simple''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. items.parent_item_id
SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='items' AND COLUMN_NAME='parent_item_id');
SET @sql := IF(@has=0, 'ALTER TABLE items ADD COLUMN parent_item_id VARCHAR(36) NULL AFTER institution_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. items.variant_attributes
SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='items' AND COLUMN_NAME='variant_attributes');
SET @sql := IF(@has=0, 'ALTER TABLE items ADD COLUMN variant_attributes JSON NULL AFTER custom_fields', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. items index for "list variants of parent X".
SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='items' AND INDEX_NAME='idx_items_parent');
SET @sql := IF(@has=0, 'ALTER TABLE items ADD INDEX idx_items_parent (institution_id, parent_item_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5. Per-parent attribute definitions.
CREATE TABLE IF NOT EXISTS item_variant_attributes (
  id VARCHAR(36) PRIMARY KEY,
  institution_id VARCHAR(36) NOT NULL,
  parent_item_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  options JSON NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_iva_parent (institution_id, parent_item_id),
  UNIQUE KEY uq_iva_parent_name (institution_id, parent_item_id, name)
);
