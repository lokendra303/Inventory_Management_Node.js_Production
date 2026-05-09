-- Ensure variant attribute library exists for variant builder APIs.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS `variant_attribute_library` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `values_json` json NOT NULL,
  `usage_count` int NOT NULL DEFAULT '0',
  `last_used_at` timestamp NULL DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_variant_library_name` (`institution_id`,`name`),
  KEY `idx_variant_library_inst_status` (`institution_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
