-- Distinguish sellable catalog items from production/BOM-only raw materials.
ALTER TABLE `items`
  ADD COLUMN `is_sellable` tinyint(1) NOT NULL DEFAULT 1
  COMMENT '1=sell on SO/invoice, 0=production/BOM component only'
  AFTER `status`;
