-- Variant-aware stock: projections and SO lines reference item_variants.id when selling a specific combination.
-- inv_variant_slot: one row per (institution, item, warehouse, variant-or-base).
-- Idempotent via information_schema checks (MySQL 5.7+ / MariaDB 10.x).
--
-- Run the whole file at once, or: cd Backend && npm run db:migrate
-- DEALLOCATE PREPARE is omitted on purpose: stray "execute current line" on DEALLOCATE causes Error 1243;
-- closing the connection drops prepared statements (migrate.js does this after each migration).

SET @db := DATABASE();

-- inventory_projections.item_variant_id
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'inventory_projections' AND COLUMN_NAME = 'item_variant_id');
SET @sql := IF(@c = 0,
  'ALTER TABLE `inventory_projections` ADD COLUMN `item_variant_id` varchar(36) DEFAULT NULL AFTER `warehouse_id`',
  'SELECT 1');
PREPARE ims_iv_01 FROM @sql;
EXECUTE ims_iv_01;

-- inventory_projections.inv_variant_slot (generated)
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'inventory_projections' AND COLUMN_NAME = 'inv_variant_slot');
SET @sql := IF(@c = 0,
  'ALTER TABLE `inventory_projections` ADD COLUMN `inv_variant_slot` varchar(40) GENERATED ALWAYS AS (IFNULL(`item_variant_id`, ''__BASE_STOCK__'')) STORED',
  'SELECT 1');
PREPARE ims_iv_02 FROM @sql;
EXECUTE ims_iv_02;

-- Drop legacy indexes if present
SET @c := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'inventory_projections' AND INDEX_NAME = 'unique_tenant_item_warehouse');
SET @sql := IF(@c > 0,
  'ALTER TABLE `inventory_projections` DROP INDEX `unique_tenant_item_warehouse`',
  'SELECT 1');
PREPARE ims_iv_03 FROM @sql;
EXECUTE ims_iv_03;

SET @c := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'inventory_projections' AND INDEX_NAME = 'idx_ip_lookup');
SET @sql := IF(@c > 0,
  'ALTER TABLE `inventory_projections` DROP INDEX `idx_ip_lookup`',
  'SELECT 1');
PREPARE ims_iv_04 FROM @sql;
EXECUTE ims_iv_04;

SET @need_uq_ip := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'inventory_projections' AND INDEX_NAME = 'uq_inst_item_wh_variant_slot'
) = 0;
SET @sql := IF(@need_uq_ip,
  'ALTER TABLE `inventory_projections` ADD UNIQUE KEY `uq_inst_item_wh_variant_slot` (`institution_id`, `item_id`, `warehouse_id`, `inv_variant_slot`)',
  'SELECT 1');
PREPARE ims_iv_05 FROM @sql;
EXECUTE ims_iv_05;

SET @need_ix_ip := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'inventory_projections' AND INDEX_NAME = 'idx_ip_item_variant'
) = 0;
SET @sql := IF(@need_ix_ip,
  'ALTER TABLE `inventory_projections` ADD KEY `idx_ip_item_variant` (`item_variant_id`)',
  'SELECT 1');
PREPARE ims_iv_06 FROM @sql;
EXECUTE ims_iv_06;

SET @need_fk_ip := (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE CONSTRAINT_SCHEMA = @db AND TABLE_NAME = 'inventory_projections'
    AND CONSTRAINT_NAME = 'fk_ip_item_variant' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
) = 0;
SET @sql := IF(@need_fk_ip,
  'ALTER TABLE `inventory_projections` ADD CONSTRAINT `fk_ip_item_variant` FOREIGN KEY (`item_variant_id`) REFERENCES `item_variants` (`id`) ON DELETE RESTRICT',
  'SELECT 1');
PREPARE ims_iv_07 FROM @sql;
EXECUTE ims_iv_07;

-- sales_order_lines.item_variant_id
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sales_order_lines' AND COLUMN_NAME = 'item_variant_id');
SET @sql := IF(@c = 0,
  'ALTER TABLE `sales_order_lines` ADD COLUMN `item_variant_id` varchar(36) DEFAULT NULL AFTER `item_id`',
  'SELECT 1');
PREPARE ims_iv_08 FROM @sql;
EXECUTE ims_iv_08;

SET @need_ix_sol := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sales_order_lines' AND INDEX_NAME = 'idx_sol_item_variant'
) = 0;
SET @sql := IF(@need_ix_sol,
  'ALTER TABLE `sales_order_lines` ADD KEY `idx_sol_item_variant` (`item_variant_id`)',
  'SELECT 1');
PREPARE ims_iv_09 FROM @sql;
EXECUTE ims_iv_09;

SET @need_fk_sol := (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE CONSTRAINT_SCHEMA = @db AND TABLE_NAME = 'sales_order_lines'
    AND CONSTRAINT_NAME = 'fk_sol_item_variant' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
) = 0;
SET @sql := IF(@need_fk_sol,
  'ALTER TABLE `sales_order_lines` ADD CONSTRAINT `fk_sol_item_variant` FOREIGN KEY (`item_variant_id`) REFERENCES `item_variants` (`id`) ON DELETE SET NULL',
  'SELECT 1');
PREPARE ims_iv_10 FROM @sql;
EXECUTE ims_iv_10;
