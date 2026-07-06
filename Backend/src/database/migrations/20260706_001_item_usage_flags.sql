-- Item usage flags: sell (existing), purchase, and use as BOM sub-assembly.
ALTER TABLE `items`
  ADD COLUMN `is_purchasable` tinyint(1) NOT NULL DEFAULT 1
    COMMENT '1=allow on purchase orders / vendor bills, 0=not purchasable'
    AFTER `is_sellable`,
  ADD COLUMN `is_manufacturable` tinyint(1) NOT NULL DEFAULT 1
    COMMENT '1=can be used as component in another BOM, 0=not allowed as sub-assembly'
    AFTER `is_purchasable`;
