-- Dynamic item field configuration table used by itemField.service.js
-- Missing in older schemas; add idempotently.

CREATE TABLE IF NOT EXISTS `item_field_configs` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `item_type` varchar(100) NOT NULL,
  `field_name` varchar(100) NOT NULL,
  `field_label` varchar(255) NOT NULL,
  `field_type` varchar(50) NOT NULL,
  `is_required` tinyint(1) NOT NULL DEFAULT '0',
  `validation_rules` text,
  `options` text,
  `default_value` text,
  `display_order` int NOT NULL DEFAULT '0',
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ifc_inst_type_field` (`institution_id`,`item_type`,`field_name`),
  KEY `idx_ifc_lookup` (`institution_id`,`item_type`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
