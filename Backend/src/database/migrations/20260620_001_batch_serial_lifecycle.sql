-- Batch/serial lifecycle audit trail for receives, shipments, and returns
-- phpMyAdmin / shared-hosting safe (no information_schema or PREPARE).
-- If a statement fails with "Duplicate column" or "Table already exists", skip it.

CREATE TABLE IF NOT EXISTS `batch_serial_movements` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `movement_type` enum('receive','ship','purchase_return','sales_return') NOT NULL,
  `reference_type` varchar(50) NOT NULL,
  `reference_id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `batch_id` varchar(36) DEFAULT NULL,
  `serial_id` varchar(36) DEFAULT NULL,
  `quantity` decimal(15,4) NOT NULL DEFAULT 0.0000,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bsm_institution` (`institution_id`),
  KEY `idx_bsm_reference` (`reference_type`, `reference_id`),
  KEY `idx_bsm_item_wh` (`institution_id`, `item_id`, `warehouse_id`),
  KEY `idx_bsm_batch` (`batch_id`),
  KEY `idx_bsm_serial` (`serial_id`),
  CONSTRAINT `fk_bsm_item` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bsm_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE `grn_lines`
  ADD COLUMN `batch_number` varchar(100) DEFAULT NULL AFTER `quality_status`;

ALTER TABLE `grn_lines`
  ADD COLUMN `manufacture_date` date DEFAULT NULL AFTER `batch_number`;

ALTER TABLE `grn_lines`
  ADD COLUMN `expiry_date` date DEFAULT NULL AFTER `manufacture_date`;

ALTER TABLE `grn_lines`
  ADD COLUMN `serial_numbers` json DEFAULT NULL AFTER `expiry_date`;

ALTER TABLE `purchase_return_lines`
  ADD COLUMN `batch_allocations` json DEFAULT NULL AFTER `return_reason`;

ALTER TABLE `purchase_return_lines`
  ADD COLUMN `serial_ids` json DEFAULT NULL AFTER `batch_allocations`;
