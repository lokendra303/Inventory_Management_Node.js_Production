-- Create BOM mapping table for composite/kit items
CREATE TABLE IF NOT EXISTS `composite_components` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `composite_item_id` varchar(36) NOT NULL,
  `component_item_id` varchar(36) NOT NULL,
  `quantity_required` decimal(15,4) NOT NULL,
  `consumption_timing` enum('order','shipment') NOT NULL DEFAULT 'shipment',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_composite_component` (`institution_id`,`composite_item_id`,`component_item_id`),
  KEY `idx_cc_institution_composite` (`institution_id`,`composite_item_id`),
  KEY `idx_cc_institution_component` (`institution_id`,`component_item_id`),
  CONSTRAINT `fk_cc_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cc_composite_item` FOREIGN KEY (`composite_item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cc_component_item` FOREIGN KEY (`component_item_id`) REFERENCES `items` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
