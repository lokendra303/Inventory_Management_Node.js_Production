CREATE TABLE IF NOT EXISTS `item_types` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_item_types_institution_name` (`institution_id`,`name`),
  KEY `idx_item_types_institution_active` (`institution_id`,`is_active`),
  CONSTRAINT `fk_item_types_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE `items`
  MODIFY COLUMN `type` varchar(100) DEFAULT 'simple';
