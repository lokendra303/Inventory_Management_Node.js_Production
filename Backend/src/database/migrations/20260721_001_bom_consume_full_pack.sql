-- BOM line: consume one full pack (item size) per kit — stock qty is pack count (e.g. 5140 sachets of 7g).
ALTER TABLE `composite_components`
  ADD COLUMN `consume_full_pack` TINYINT(1) NOT NULL DEFAULT 0 AFTER `consumption_unit_id`;
