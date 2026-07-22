-- Pack breakable: 1 = BOM may consume partial pack content (e.g. 3g of 7g);
-- 0 = BOM must use full packs only.
ALTER TABLE `items`
  ADD COLUMN `is_breakable` TINYINT(1) NOT NULL DEFAULT 1
    COMMENT '1=allow partial pack content in BOM, 0=full pack only'
    AFTER `is_manufacturable`;
