CREATE TABLE IF NOT EXISTS `item_groups` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_item_groups_institution_name` (`institution_id`, `name`),
  KEY `idx_item_groups_institution_active` (`institution_id`, `is_active`),
  CONSTRAINT `fk_item_groups_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET @has_item_group_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'items'
    AND COLUMN_NAME = 'item_group_id'
);
SET @sql := IF(
  @has_item_group_id = 0,
  'ALTER TABLE `items` ADD COLUMN `item_group_id` varchar(36) DEFAULT NULL AFTER `item_group`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_item_group_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'items'
    AND INDEX_NAME = 'idx_items_item_group_id'
);
SET @sql := IF(
  @has_item_group_idx = 0,
  'ALTER TABLE `items` ADD KEY `idx_items_item_group_id` (`item_group_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_item_group_fk := (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'fk_items_item_group'
);
SET @sql := IF(
  @has_item_group_fk = 0,
  'ALTER TABLE `items` ADD CONSTRAINT `fk_items_item_group` FOREIGN KEY (`item_group_id`) REFERENCES `item_groups` (`id`) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO `item_groups` (`id`, `institution_id`, `name`, `description`, `is_active`, `created_by`)
SELECT
  UUID(),
  src.institution_id,
  src.item_group,
  NULL,
  1,
  NULL
FROM (
  SELECT DISTINCT institution_id, TRIM(item_group) AS item_group
  FROM items
  WHERE item_group IS NOT NULL AND TRIM(item_group) <> ''
) AS src
LEFT JOIN item_groups ig
  ON ig.institution_id = src.institution_id
 AND ig.name = src.item_group
WHERE ig.id IS NULL;

UPDATE items i
JOIN item_groups ig
  ON ig.institution_id = i.institution_id
 AND ig.name = i.item_group
SET i.item_group_id = ig.id
WHERE i.item_group IS NOT NULL
  AND TRIM(i.item_group) <> ''
  AND i.item_group_id IS NULL;
