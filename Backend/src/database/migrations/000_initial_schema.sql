-- =====================================================================
-- 000_initial_schema.sql
-- Baseline schema for fresh installs, dumped from the live development
-- database. All statements use CREATE TABLE IF NOT EXISTS so running
-- this file on an existing database is a safe no-op.
--
-- Regenerate with:  node Backend/scripts/extract-schema.js
-- Do NOT put data or real-tenant rows here. Schema only.
-- Generated: 2026-04-23T07:24:19.591Z
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------
-- Table: accounting_entries
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `accounting_entries` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `institution_id` varchar(36) NOT NULL,
  `entry_type` enum('purchase_invoice','sales_invoice','payment','receipt') NOT NULL,
  `reference_id` varchar(36) NOT NULL,
  `reference_number` varchar(100) DEFAULT NULL,
  `entry_date` date NOT NULL,
  `account_code` varchar(50) NOT NULL,
  `account_name` varchar(255) NOT NULL,
  `debit_amount` decimal(15,2) DEFAULT '0.00',
  `credit_amount` decimal(15,2) DEFAULT '0.00',
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_institution_id` (`institution_id`),
  KEY `idx_reference_id` (`reference_id`),
  KEY `idx_entry_type` (`entry_type`),
  KEY `idx_entry_date` (`entry_date`),
  KEY `idx_account_code` (`account_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: addresses
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `addresses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entity_type` enum('vendor','customer') NOT NULL,
  `entity_id` varchar(36) NOT NULL,
  `address_type` enum('billing','shipping') NOT NULL,
  `attention` varchar(255) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `address1` text,
  `address2` text,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `pin_code` varchar(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_entity` (`entity_type`,`entity_id`),
  KEY `idx_address_type` (`address_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: audit_logs
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `entity_type` varchar(100) DEFAULT NULL,
  `entity_id` varchar(100) DEFAULT NULL,
  `action` varchar(50) DEFAULT NULL,
  `changes` json DEFAULT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `service_account_id` varchar(36) DEFAULT NULL,
  `method` varchar(10) DEFAULT NULL,
  `path` varchar(500) DEFAULT NULL,
  `user_agent` text,
  `status_code` int DEFAULT NULL,
  `duration` int DEFAULT NULL,
  `request_body` json DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_entity` (`institution_id`,`entity_type`,`entity_id`),
  KEY `idx_user` (`institution_id`,`user_id`),
  KEY `idx_created` (`created_at`),
  KEY `idx_audit_logs_institution_id` (`institution_id`),
  KEY `idx_audit_logs_user_id` (`user_id`),
  KEY `idx_audit_logs_entity` (`entity_type`,`entity_id`),
  KEY `idx_audit_logs_action` (`action`),
  KEY `idx_audit_logs_created_at` (`created_at`),
  KEY `idx_audit_logs_institution_created` (`institution_id`,`created_at`),
  KEY `idx_audit_logs_user_created` (`user_id`,`created_at`),
  KEY `idx_audit_inst_time` (`institution_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: bank_details
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `bank_details` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entity_type` enum('vendor','customer') NOT NULL,
  `entity_id` varchar(36) NOT NULL,
  `bank_name` varchar(255) DEFAULT NULL,
  `account_holder_name` varchar(255) DEFAULT NULL,
  `account_number` varchar(50) DEFAULT NULL,
  `ifsc_code` varchar(20) DEFAULT NULL,
  `branch_name` varchar(255) DEFAULT NULL,
  `account_type` enum('savings','current','cc','od') DEFAULT NULL,
  `swift_code` varchar(20) DEFAULT NULL,
  `iban` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_entity` (`entity_type`,`entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: institutions
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `institutions` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `mobile` varchar(20) DEFAULT NULL,
  `address` text,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `postal_code` varchar(20) DEFAULT NULL,
  `institution_type` enum('educational','corporate','government','healthcare','other') DEFAULT 'corporate',
  `registration_number` varchar(100) DEFAULT NULL,
  `tax_id` varchar(100) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `contact_person` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive','pending') DEFAULT 'active',
  `plan` enum('starter','professional','enterprise') DEFAULT 'starter',
  `settings` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `currency` varchar(3) DEFAULT 'USD',
  `currency_symbol` varchar(10) DEFAULT '$',
  `exchange_rate` decimal(15,6) NOT NULL DEFAULT '1.000000',
  `base_currency` varchar(10) NOT NULL DEFAULT 'USD',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_status` (`status`),
  KEY `idx_institution_type` (`institution_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: manufacturers
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `manufacturers` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(50) DEFAULT NULL,
  `description` text,
  `contact_person` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `address` text,
  `country` varchar(100) DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_institution_name` (`institution_id`,`name`),
  UNIQUE KEY `unique_institution_code` (`institution_id`,`code`),
  KEY `idx_institution_status` (`institution_id`,`status`),
  CONSTRAINT `manufacturers_ibfk_1` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: brands
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `brands` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `manufacturer_id` varchar(36) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(50) DEFAULT NULL,
  `description` text,
  `logo_url` varchar(500) DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_institution_name` (`institution_id`,`name`),
  UNIQUE KEY `unique_institution_code` (`institution_id`,`code`),
  KEY `manufacturer_id` (`manufacturer_id`),
  KEY `idx_institution_manufacturer` (`institution_id`,`manufacturer_id`),
  KEY `idx_institution_status` (`institution_id`,`status`),
  CONSTRAINT `brands_ibfk_1` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `brands_ibfk_2` FOREIGN KEY (`manufacturer_id`) REFERENCES `manufacturers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: categories
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `categories` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `parent_id` varchar(36) DEFAULT NULL,
  `level` int DEFAULT '0',
  `sort_order` int DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_category_name` (`name`,`parent_id`),
  KEY `idx_tenant_active` (`is_active`),
  KEY `idx_parent` (`parent_id`),
  KEY `fk_categories_institution` (`institution_id`),
  CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_categories_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: company_addresses
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `company_addresses` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `institution_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Address',
  `address` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_company_addr_inst` (`institution_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table: company_settings
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `company_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `institution_id` varchar(255) NOT NULL,
  `company_name` varchar(255) DEFAULT NULL,
  `address` text,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `bank_name` varchar(255) DEFAULT NULL,
  `account_number` varchar(100) DEFAULT NULL,
  `ifsc_code` varchar(50) DEFAULT NULL,
  `swift_code` varchar(50) DEFAULT NULL,
  `logo_path` varchar(500) DEFAULT NULL,
  `stamp_path` varchar(500) DEFAULT NULL,
  `signature_path` varchar(500) DEFAULT NULL,
  `authorized_signatory_name` varchar(255) DEFAULT NULL,
  `authorized_signatory_designation` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `institution_id` (`institution_id`),
  KEY `idx_institution_id` (`institution_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: company_signatures
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `company_signatures` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `institution_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Signature',
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_company_sig_inst` (`institution_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table: company_stamps
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `company_stamps` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `institution_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Stamp',
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_company_stamp_inst` (`institution_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table: currencies
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `currencies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `institution_id` varchar(36) NOT NULL,
  `code` varchar(10) NOT NULL,
  `name` varchar(100) NOT NULL,
  `symbol` varchar(10) NOT NULL,
  `is_base` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inst_code` (`institution_id`,`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: currency_rate_history
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `currency_rate_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `institution_id` varchar(36) NOT NULL,
  `from_currency` varchar(10) NOT NULL,
  `to_currency` varchar(10) NOT NULL,
  `rate` decimal(15,6) NOT NULL,
  `inverse_rate` decimal(15,6) NOT NULL,
  `changed_by` varchar(36) DEFAULT NULL,
  `changed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `note` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_inst_pair` (`institution_id`,`from_currency`,`to_currency`),
  KEY `idx_changed_at` (`changed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: customers
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `customers` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) DEFAULT NULL,
  `customer_code` varchar(50) DEFAULT NULL,
  `display_name` varchar(255) NOT NULL,
  `company_name` varchar(255) DEFAULT NULL,
  `salutation` varchar(10) DEFAULT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `work_phone` varchar(50) DEFAULT NULL,
  `mobile_phone` varchar(50) DEFAULT NULL,
  `pan` varchar(20) DEFAULT NULL,
  `gstin` varchar(20) DEFAULT NULL,
  `msme_registered` tinyint(1) DEFAULT '0',
  `currency` varchar(3) DEFAULT 'INR',
  `payment_terms` varchar(100) DEFAULT NULL,
  `tds` varchar(50) DEFAULT NULL,
  `website_url` varchar(255) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `designation` varchar(100) DEFAULT NULL,
  `remarks` text,
  `credit_limit` decimal(15,2) DEFAULT '0.00',
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `price_list_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_status` (`status`),
  KEY `idx_tenant_display_name` (`display_name`),
  KEY `fk_customers_institution` (`institution_id`),
  CONSTRAINT `fk_customers_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: delivery_challans
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `delivery_challans` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `challan_number` varchar(50) NOT NULL,
  `so_id` varchar(36) DEFAULT NULL,
  `customer_id` varchar(36) DEFAULT NULL,
  `customer_name` varchar(200) NOT NULL,
  `warehouse_id` varchar(36) DEFAULT NULL,
  `challan_date` date NOT NULL,
  `status` enum('draft','dispatched','delivered','invoiced','cancelled') NOT NULL DEFAULT 'draft',
  `invoice_id` varchar(36) DEFAULT NULL,
  `vehicle_number` varchar(50) DEFAULT NULL,
  `driver_name` varchar(100) DEFAULT NULL,
  `notes` text,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dc_institution` (`institution_id`),
  KEY `idx_dc_so` (`so_id`),
  KEY `idx_dc_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: delivery_challan_lines
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `delivery_challan_lines` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `challan_id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `so_line_id` varchar(36) DEFAULT NULL,
  `quantity` decimal(15,4) NOT NULL,
  `unit_price` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `line_total` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dcl_challan` (`challan_id`),
  CONSTRAINT `delivery_challan_lines_ibfk_1` FOREIGN KEY (`challan_id`) REFERENCES `delivery_challans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: document_folders
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `document_folders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `institution_id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `parent_folder_id` int DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_deleted` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `deleted_by` varchar(36) DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_institution_folder` (`institution_id`,`is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: documents
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `institution_id` varchar(36) NOT NULL,
  `folder_id` int DEFAULT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size` bigint NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  `associated_entity` varchar(50) DEFAULT NULL,
  `associated_entity_id` varchar(36) DEFAULT NULL,
  `uploaded_by` varchar(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_deleted` tinyint(1) DEFAULT '0',
  `deleted_by` varchar(36) DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_institution_doc` (`institution_id`,`is_deleted`),
  KEY `idx_folder` (`folder_id`),
  KEY `idx_entity` (`associated_entity`,`associated_entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: dropdown_options
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dropdown_options` (
  `id` int NOT NULL AUTO_INCREMENT,
  `institution_id` varchar(36) NOT NULL,
  `type` varchar(100) NOT NULL,
  `options` json NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dropdown` (`institution_id`,`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: event_store
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `event_store` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) DEFAULT NULL,
  `aggregate_type` varchar(100) NOT NULL,
  `aggregate_id` varchar(255) NOT NULL,
  `aggregate_version` int NOT NULL,
  `event_type` varchar(100) NOT NULL,
  `event_data` json NOT NULL,
  `metadata` json DEFAULT NULL,
  `idempotency_key` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_idempotency` (`idempotency_key`),
  UNIQUE KEY `unique_aggregate_version` (`aggregate_type`,`aggregate_id`,`aggregate_version`),
  UNIQUE KEY `idx_es_idempotency` (`idempotency_key`),
  KEY `idx_tenant_aggregate` (`aggregate_type`,`aggregate_id`),
  KEY `idx_tenant_event_type` (`event_type`),
  KEY `idx_created_at` (`created_at`),
  KEY `fk_event_store_institution` (`institution_id`),
  KEY `idx_es_aggregate` (`institution_id`,`aggregate_type`,`aggregate_id`,`aggregate_version`),
  KEY `idx_es_type_time` (`institution_id`,`event_type`,`created_at`),
  CONSTRAINT `fk_event_store_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: exchange_rates
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `exchange_rates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `institution_id` varchar(36) NOT NULL,
  `from_currency` varchar(10) NOT NULL,
  `to_currency` varchar(10) NOT NULL,
  `rate` decimal(15,6) NOT NULL DEFAULT '1.000000',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pair` (`institution_id`,`from_currency`,`to_currency`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: expiry_alerts
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `expiry_alerts` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `batch_id` varchar(36) DEFAULT NULL,
  `expiry_date` date NOT NULL,
  `days_to_expiry` int NOT NULL,
  `quantity` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `status` enum('active','acknowledged','expired') NOT NULL DEFAULT 'active',
  `acknowledged_by` varchar(36) DEFAULT NULL,
  `acknowledged_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_expiry_alert` (`institution_id`,`item_id`,`warehouse_id`,`batch_id`),
  KEY `idx_ea_institution` (`institution_id`),
  KEY `idx_ea_expiry` (`expiry_date`),
  KEY `idx_ea_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: vendors
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `vendors` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) DEFAULT NULL,
  `vendor_code` varchar(50) DEFAULT NULL,
  `display_name` varchar(255) NOT NULL,
  `company_name` varchar(255) DEFAULT NULL,
  `salutation` varchar(10) DEFAULT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `work_phone` varchar(50) DEFAULT NULL,
  `mobile_phone` varchar(50) DEFAULT NULL,
  `pan` varchar(20) DEFAULT NULL,
  `gstin` varchar(20) DEFAULT NULL,
  `msme_registered` tinyint(1) DEFAULT '0',
  `currency` varchar(3) DEFAULT 'INR',
  `payment_terms` varchar(100) DEFAULT NULL,
  `tds` varchar(50) DEFAULT NULL,
  `website_url` varchar(255) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `designation` varchar(100) DEFAULT NULL,
  `remarks` text,
  `lead_time_days` int DEFAULT '7',
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_status` (`status`),
  KEY `idx_tenant_display_name` (`display_name`),
  KEY `fk_vendors_institution` (`institution_id`),
  CONSTRAINT `fk_vendors_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: purchase_orders
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) DEFAULT NULL,
  `po_number` varchar(100) NOT NULL,
  `vendor_id` varchar(36) DEFAULT NULL,
  `vendor_name` varchar(255) NOT NULL,
  `status` enum('draft','pending_approval','approved','sent','confirmed','partially_received','received','cancelled') DEFAULT 'draft',
  `currency` varchar(3) DEFAULT 'USD',
  `exchange_rate` decimal(10,4) DEFAULT '1.0000',
  `subtotal` decimal(15,2) DEFAULT '0.00',
  `tax_amount` decimal(15,2) DEFAULT '0.00',
  `total_amount` decimal(15,2) DEFAULT '0.00',
  `expected_date` date DEFAULT NULL,
  `order_date` date DEFAULT (curdate()),
  `notes` text,
  `created_by` varchar(36) DEFAULT NULL,
  `approved_by` varchar(36) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `cancellation_reason` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tenant_po_number` (`po_number`),
  KEY `created_by` (`created_by`),
  KEY `idx_tenant_status` (`status`),
  KEY `idx_tenant_vendor` (`vendor_id`),
  KEY `fk_purchase_orders_institution` (`institution_id`),
  CONSTRAINT `fk_purchase_orders_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `purchase_orders_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: goods_receipt_notes
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `goods_receipt_notes` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) DEFAULT NULL,
  `grn_number` varchar(100) NOT NULL,
  `po_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) DEFAULT NULL,
  `receipt_date` date NOT NULL,
  `received_by` varchar(36) DEFAULT NULL,
  `notes` text,
  `status` enum('draft','confirmed') DEFAULT 'confirmed',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tenant_grn` (`grn_number`),
  KEY `received_by` (`received_by`),
  KEY `idx_tenant_po` (`po_id`),
  KEY `fk_goods_receipt_notes_institution` (`institution_id`),
  CONSTRAINT `fk_goods_receipt_notes_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `goods_receipt_notes_ibfk_2` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: warehouse_types
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `warehouse_types` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tenant_type` (`institution_id`,`name`),
  KEY `idx_tenant` (`institution_id`),
  CONSTRAINT `warehouse_types_ibfk_1` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: warehouses
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `warehouses` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) DEFAULT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` varchar(36) DEFAULT NULL,
  `address` text,
  `contact_person` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `capacity_constraints` json DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tenant_code` (`code`),
  KEY `idx_tenant_status` (`status`),
  KEY `type` (`type`),
  KEY `fk_warehouses_institution` (`institution_id`),
  KEY `idx_wh_inst_status` (`institution_id`,`status`),
  CONSTRAINT `fk_warehouses_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `warehouses_ibfk_2` FOREIGN KEY (`type`) REFERENCES `warehouse_types` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: units
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `units` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `symbol` varchar(20) NOT NULL,
  `type` enum('weight','length','volume','area','count','time','other') DEFAULT 'other',
  `base_unit_id` varchar(36) DEFAULT NULL,
  `conversion_factor` decimal(15,6) DEFAULT '1.000000',
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_institution_name` (`institution_id`,`name`),
  UNIQUE KEY `unique_institution_symbol` (`institution_id`,`symbol`),
  KEY `base_unit_id` (`base_unit_id`),
  KEY `idx_institution_type` (`institution_id`,`type`),
  KEY `idx_institution_status` (`institution_id`,`status`),
  CONSTRAINT `units_ibfk_1` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `units_ibfk_2` FOREIGN KEY (`base_unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: items
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `items` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) DEFAULT NULL,
  `sku` varchar(100) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `image` longtext,
  `type` enum('simple','variant','composite','service') DEFAULT 'simple',
  `category` varchar(255) DEFAULT NULL,
  `unit` varchar(50) DEFAULT 'pcs',
  `unit_id` varchar(36) DEFAULT NULL,
  `barcode` varchar(255) DEFAULT NULL,
  `ean` varchar(20) DEFAULT NULL,
  `upc` varchar(20) DEFAULT NULL,
  `isbn` varchar(20) DEFAULT NULL,
  `mpn` varchar(50) DEFAULT NULL,
  `hsn_code` varchar(50) DEFAULT NULL,
  `custom_fields` json DEFAULT NULL,
  `default_bin_id` varchar(36) DEFAULT NULL,
  `valuation_method` enum('fifo','weighted_average') DEFAULT 'fifo',
  `allow_negative_stock` tinyint(1) DEFAULT '0',
  `default_reorder_level` decimal(15,3) DEFAULT '0.000',
  `status` enum('active','inactive','trashed','draft') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `cost_price` decimal(15,4) DEFAULT '0.0000',
  `selling_price` decimal(15,4) DEFAULT '0.0000',
  `mrp` decimal(15,4) DEFAULT '0.0000',
  `tax_rate` decimal(5,2) DEFAULT '0.00',
  `tax_type` enum('inclusive','exclusive') DEFAULT 'exclusive',
  `weight` decimal(10,3) DEFAULT '0.000',
  `weight_unit` varchar(10) DEFAULT 'kg',
  `dimensions` varchar(100) DEFAULT NULL,
  `brand` varchar(100) DEFAULT NULL,
  `brand_id` varchar(36) DEFAULT NULL,
  `manufacturer` varchar(100) DEFAULT NULL,
  `manufacturer_id` varchar(36) DEFAULT NULL,
  `supplier_code` varchar(100) DEFAULT NULL,
  `min_stock_level` decimal(15,3) DEFAULT '0.000',
  `max_stock_level` decimal(15,3) DEFAULT '0.000',
  `is_serialized` tinyint(1) DEFAULT '0',
  `is_batch_tracked` tinyint(1) DEFAULT '0',
  `has_expiry` tinyint(1) DEFAULT '0',
  `shelf_life_days` int DEFAULT NULL,
  `storage_conditions` text,
  `item_group` varchar(100) DEFAULT NULL,
  `purchase_account` varchar(100) DEFAULT NULL,
  `sales_account` varchar(100) DEFAULT NULL,
  `opening_stock` decimal(15,3) DEFAULT '0.000',
  `opening_value` decimal(15,2) DEFAULT '0.00',
  `as_of_date` date DEFAULT NULL,
  `draft_data` json DEFAULT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tenant_sku` (`sku`),
  KEY `idx_tenant_type` (`type`),
  KEY `idx_tenant_status` (`status`),
  KEY `idx_barcode` (`barcode`),
  KEY `fk_items_institution` (`institution_id`),
  KEY `manufacturer_id` (`manufacturer_id`),
  KEY `brand_id` (`brand_id`),
  KEY `unit_id` (`unit_id`),
  KEY `idx_items_ean` (`ean`),
  KEY `idx_items_upc` (`upc`),
  KEY `idx_items_barcode` (`barcode`),
  KEY `idx_items_inst_status` (`institution_id`,`status`),
  KEY `idx_items_default_bin` (`institution_id`,`default_bin_id`),
  CONSTRAINT `fk_items_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `items_ibfk_1` FOREIGN KEY (`manufacturer_id`) REFERENCES `manufacturers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `items_ibfk_2` FOREIGN KEY (`brand_id`) REFERENCES `brands` (`id`) ON DELETE SET NULL,
  CONSTRAINT `items_ibfk_3` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: purchase_order_lines
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchase_order_lines` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) DEFAULT NULL,
  `po_id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `quantity_ordered` decimal(15,4) NOT NULL,
  `quantity_received` decimal(15,4) DEFAULT '0.0000',
  `unit_cost` decimal(15,4) NOT NULL,
  `line_total` decimal(15,2) NOT NULL,
  `expected_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `line_number` int DEFAULT '1',
  `status` enum('pending','partially_received','received','cancelled') DEFAULT 'pending',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tax_rate` decimal(5,2) DEFAULT '0.00',
  `tax_amount` decimal(15,2) DEFAULT '0.00',
  `discount_rate` decimal(5,2) DEFAULT '0.00',
  `discount_amount` decimal(15,2) DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `idx_po` (`po_id`),
  KEY `idx_tenant_item` (`item_id`),
  KEY `fk_purchase_order_lines_institution` (`institution_id`),
  KEY `fk_pol_warehouse` (`warehouse_id`),
  CONSTRAINT `fk_pol_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `fk_purchase_order_lines_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `purchase_order_lines_ibfk_2` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `purchase_order_lines_ibfk_3` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: grn_lines
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `grn_lines` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) DEFAULT NULL,
  `grn_id` varchar(36) NOT NULL,
  `po_line_id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) DEFAULT NULL,
  `quantity_received` decimal(15,4) NOT NULL,
  `unit_cost` decimal(15,4) NOT NULL,
  `line_total` decimal(15,2) NOT NULL,
  `quality_status` enum('accepted','rejected','pending') DEFAULT 'accepted',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `po_line_id` (`po_line_id`),
  KEY `idx_grn` (`grn_id`),
  KEY `idx_tenant_item` (`item_id`),
  KEY `fk_grn_lines_institution` (`institution_id`),
  CONSTRAINT `fk_grn_lines_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `grn_lines_ibfk_2` FOREIGN KEY (`grn_id`) REFERENCES `goods_receipt_notes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `grn_lines_ibfk_3` FOREIGN KEY (`po_line_id`) REFERENCES `purchase_order_lines` (`id`),
  CONSTRAINT `grn_lines_ibfk_4` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: subscription_plans
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `subscription_plans` (
  `id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `price_monthly` decimal(10,2) DEFAULT '0.00',
  `price_yearly` decimal(10,2) DEFAULT '0.00',
  `max_users` int DEFAULT '5',
  `max_warehouses` int DEFAULT '2',
  `max_items` int DEFAULT '500',
  `features` json DEFAULT (_utf8mb4'[]'),
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `sort_order` int DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: institution_subscriptions
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `institution_subscriptions` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `plan_id` varchar(36) NOT NULL,
  `billing_cycle` enum('monthly','yearly','trial') DEFAULT 'trial',
  `status` enum('active','expired','cancelled','trial') DEFAULT 'trial',
  `trial_ends_at` timestamp NULL DEFAULT NULL,
  `current_period_start` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `current_period_end` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `cancel_reason` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `institution_id` (`institution_id`),
  KEY `plan_id` (`plan_id`),
  CONSTRAINT `institution_subscriptions_ibfk_1` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `institution_subscriptions_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: institution_users
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `institution_users` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `email` varchar(255) NOT NULL,
  `mobile` varchar(20) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `address` text,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `postal_code` varchar(20) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `gender` enum('male','female','other') DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `designation` varchar(100) DEFAULT NULL,
  `employee_id` varchar(50) DEFAULT NULL,
  `role` varchar(100) DEFAULT 'user',
  `permissions` json DEFAULT NULL,
  `warehouse_access` json DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `last_login` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_institution_email` (`institution_id`,`email`),
  KEY `idx_institution_status` (`institution_id`,`status`),
  KEY `idx_role` (`role`),
  KEY `idx_department` (`department`),
  KEY `idx_iu_inst_status` (`institution_id`,`status`),
  CONSTRAINT `institution_users_ibfk_1` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: inventory_adjustments
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventory_adjustments` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `adjustment_type` enum('increase','decrease') NOT NULL,
  `quantity_change` decimal(15,4) NOT NULL,
  `reason` text,
  `loss_type` enum('MANUAL','MISSING','DAMAGED','EXPIRED') DEFAULT 'MANUAL',
  `adjusted_by` varchar(36) NOT NULL,
  `reference_number` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `approval_status` enum('auto_approved','pending','approved','rejected') NOT NULL DEFAULT 'auto_approved',
  `approved_by` varchar(36) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text,
  PRIMARY KEY (`id`),
  KEY `idx_institution_item` (`institution_id`,`item_id`),
  KEY `idx_warehouse` (`warehouse_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: inventory_aging
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventory_aging` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `quantity_0_30` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `quantity_31_60` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `quantity_61_90` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `quantity_91_120` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `quantity_120_plus` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `value_0_30` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `value_31_60` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `value_61_90` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `value_91_120` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `value_120_plus` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `last_receipt_date` date DEFAULT NULL,
  `snapshot_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_aging` (`institution_id`,`item_id`,`warehouse_id`,`snapshot_date`),
  KEY `idx_aging_institution` (`institution_id`),
  KEY `idx_aging_snapshot` (`snapshot_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: inventory_cost_layers
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventory_cost_layers` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `layer_date` datetime NOT NULL,
  `quantity_in` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `quantity_remaining` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `unit_cost` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `reference_type` varchar(50) DEFAULT NULL COMMENT 'grn, adjustment, opening',
  `reference_id` varchar(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cl_item_wh` (`institution_id`,`item_id`,`warehouse_id`),
  KEY `idx_cl_date` (`layer_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: inventory_history
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventory_history` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `operation_type` enum('RECEIVE','ADJUST','TRANSFER_OUT','TRANSFER_IN','RESERVE','SHIP','RETURN') NOT NULL,
  `quantity_change` decimal(15,4) NOT NULL,
  `quantity_before` decimal(15,4) DEFAULT '0.0000',
  `quantity_after` decimal(15,4) DEFAULT '0.0000',
  `unit_cost` decimal(15,4) DEFAULT NULL,
  `reference_id` varchar(36) DEFAULT NULL,
  `reference_number` varchar(100) DEFAULT NULL,
  `notes` text,
  `performed_by` varchar(36) DEFAULT NULL,
  `performed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_item_warehouse` (`institution_id`,`item_id`,`warehouse_id`),
  KEY `idx_tenant_warehouse` (`institution_id`,`warehouse_id`),
  KEY `idx_operation_type` (`operation_type`),
  KEY `idx_performed_at` (`performed_at`),
  KEY `item_id` (`item_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `performed_by` (`performed_by`),
  CONSTRAINT `inventory_history_ibfk_1` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`),
  CONSTRAINT `inventory_history_ibfk_2` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`),
  CONSTRAINT `inventory_history_ibfk_3` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: inventory_projections
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventory_projections` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) DEFAULT NULL,
  `item_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `quantity_on_hand` decimal(15,4) DEFAULT '0.0000',
  `quantity_reserved` decimal(15,4) DEFAULT '0.0000',
  `quantity_available` decimal(15,4) DEFAULT '0.0000',
  `average_cost` decimal(15,4) DEFAULT '0.0000',
  `total_value` decimal(15,2) DEFAULT '0.00',
  `last_movement_date` timestamp NULL DEFAULT NULL,
  `version` int DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tenant_item_warehouse` (`item_id`,`warehouse_id`),
  UNIQUE KEY `idx_ip_lookup` (`institution_id`,`item_id`,`warehouse_id`),
  KEY `idx_tenant_warehouse` (`warehouse_id`),
  KEY `idx_tenant_item` (`item_id`),
  KEY `fk_inventory_projections_institution` (`institution_id`),
  CONSTRAINT `fk_inventory_projections_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_projections_ibfk_2` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_projections_ibfk_3` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: invoice_payments
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `invoice_payments` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `institution_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `invoice_type` enum('purchase','sales') NOT NULL,
  `invoice_id` varchar(36) NOT NULL,
  `payment_date` date NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `payment_method` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `reference` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_institution_id` (`institution_id`),
  KEY `idx_invoice_id` (`invoice_id`),
  KEY `idx_invoice_type` (`invoice_type`),
  KEY `idx_payment_date` (`payment_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: item_batches
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `item_batches` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `batch_number` varchar(100) NOT NULL,
  `manufacture_date` date DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `quantity_received` decimal(15,3) NOT NULL,
  `quantity_remaining` decimal(15,3) NOT NULL,
  `unit_cost` decimal(15,4) NOT NULL,
  `status` enum('active','expired','damaged','recalled') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_batch` (`institution_id`,`item_id`,`warehouse_id`,`batch_number`),
  KEY `item_id` (`item_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `idx_expiry` (`institution_id`,`expiry_date`,`status`),
  CONSTRAINT `item_batches_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `item_batches_ibfk_2` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: item_price_history
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `item_price_history` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `price_type` enum('cost','selling','mrp') NOT NULL,
  `old_price` decimal(15,4) NOT NULL,
  `new_price` decimal(15,4) NOT NULL,
  `effective_date` date NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `changed_by` varchar(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `item_id` (`item_id`),
  KEY `idx_tenant_item_date` (`institution_id`,`item_id`,`effective_date`),
  CONSTRAINT `item_price_history_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: item_serials
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `item_serials` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `serial_number` varchar(100) NOT NULL,
  `batch_id` varchar(36) DEFAULT NULL,
  `status` enum('available','reserved','sold','damaged','returned') DEFAULT 'available',
  `received_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `sold_date` timestamp NULL DEFAULT NULL,
  `customer_reference` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_serial` (`institution_id`,`item_id`,`serial_number`),
  KEY `item_id` (`item_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `batch_id` (`batch_id`),
  KEY `idx_status` (`institution_id`,`status`),
  CONSTRAINT `item_serials_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `item_serials_ibfk_2` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `item_serials_ibfk_3` FOREIGN KEY (`batch_id`) REFERENCES `item_batches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: item_suppliers
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `item_suppliers` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `supplier_item_code` varchar(100) DEFAULT NULL,
  `cost_price` decimal(15,4) NOT NULL,
  `minimum_order_qty` decimal(15,3) DEFAULT '1.000',
  `lead_time_days` int DEFAULT '7',
  `is_preferred` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_item_vendor` (`institution_id`,`item_id`,`vendor_id`),
  KEY `item_id` (`item_id`),
  KEY `vendor_id` (`vendor_id`),
  KEY `idx_tenant_item` (`institution_id`,`item_id`),
  CONSTRAINT `item_suppliers_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `item_suppliers_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: item_variant_attributes
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `item_variant_attributes` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `parent_item_id` varchar(36) NOT NULL,
  `attribute_name` varchar(100) NOT NULL,
  `attribute_values` json NOT NULL DEFAULT (_utf8mb4'[]'),
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `institution_id` (`institution_id`),
  CONSTRAINT `item_variant_attributes_ibfk_1` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: item_variants
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `item_variants` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `parent_item_id` varchar(36) NOT NULL,
  `variant_name` varchar(255) NOT NULL,
  `sku` varchar(100) NOT NULL,
  `barcode` varchar(255) DEFAULT NULL,
  `cost_price` decimal(15,4) DEFAULT '0.0000',
  `selling_price` decimal(15,4) DEFAULT '0.0000',
  `mrp` decimal(15,4) DEFAULT '0.0000',
  `weight` decimal(10,3) DEFAULT '0.000',
  `dimensions` varchar(100) DEFAULT NULL,
  `color` varchar(50) DEFAULT NULL,
  `size` varchar(50) DEFAULT NULL,
  `material` varchar(100) DEFAULT NULL,
  `variant_attributes` json DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_variant_sku` (`institution_id`,`sku`),
  KEY `parent_item_id` (`parent_item_id`),
  KEY `idx_tenant_parent` (`institution_id`,`parent_item_id`),
  CONSTRAINT `item_variants_ibfk_1` FOREIGN KEY (`parent_item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: low_stock_alerts
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `low_stock_alerts` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `current_stock` decimal(15,3) NOT NULL,
  `reorder_level` decimal(15,3) NOT NULL,
  `alert_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('active','acknowledged','resolved') DEFAULT 'active',
  `acknowledged_by` varchar(36) DEFAULT NULL,
  `acknowledged_at` timestamp NULL DEFAULT NULL,
  `resolved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `item_id` (`item_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `idx_tenant_status` (`institution_id`,`status`),
  KEY `idx_alert_date` (`alert_date`),
  CONSTRAINT `low_stock_alerts_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `low_stock_alerts_ibfk_2` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: notifications
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `user_id` varchar(36) DEFAULT NULL COMMENT 'NULL = broadcast to all',
  `type` varchar(50) NOT NULL COMMENT 'low_stock,expiry,transfer_request,system',
  `title` varchar(200) NOT NULL,
  `message` text NOT NULL,
  `reference_type` varchar(50) DEFAULT NULL,
  `reference_id` varchar(36) DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notif_user` (`institution_id`,`user_id`,`is_read`),
  KEY `idx_notif_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: onboarding_progress
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `onboarding_progress` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `completed_steps` json NOT NULL DEFAULT (_utf8mb4'[]'),
  `is_completed` tinyint(1) DEFAULT '0',
  `dismissed` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `institution_id` (`institution_id`),
  CONSTRAINT `onboarding_progress_ibfk_1` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: otp_tokens
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `otp_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `purpose` varchar(30) NOT NULL,
  `email` varchar(255) NOT NULL,
  `institution_id` varchar(36) DEFAULT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `otp_code` varchar(10) NOT NULL,
  `attempts` int NOT NULL DEFAULT '0',
  `expires_at` datetime NOT NULL,
  `consumed_at` datetime DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_otp_tokens_lookup` (`purpose`,`email`,`institution_id`),
  KEY `idx_otp_tokens_expires_at` (`expires_at`),
  KEY `idx_otp_tokens_created_at` (`created_at`),
  KEY `idx_otp_tokens_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: platform_admins
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `platform_admins` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `last_login` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_platform_admins_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table: price_lists
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `price_lists` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `currency` varchar(10) DEFAULT 'USD',
  `pricelist_type` enum('sales','purchase') DEFAULT 'sales',
  `discount_type` enum('percentage','fixed') DEFAULT 'percentage',
  `discount_value` decimal(10,4) DEFAULT '0.0000',
  `is_default` tinyint(1) DEFAULT '0',
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `institution_id` (`institution_id`),
  CONSTRAINT `price_lists_ibfk_1` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: price_list_items
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `price_list_items` (
  `id` varchar(36) NOT NULL,
  `price_list_id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `custom_price` decimal(15,4) DEFAULT NULL,
  `discount_type` enum('percentage','fixed') DEFAULT 'percentage',
  `discount_value` decimal(10,4) DEFAULT '0.0000',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pricelist_item` (`price_list_id`,`item_id`),
  CONSTRAINT `price_list_items_ibfk_1` FOREIGN KEY (`price_list_id`) REFERENCES `price_lists` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: purchase_invoices
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchase_invoices` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `institution_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `invoice_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `vendor_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `vendor_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `po_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `grn_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `invoice_date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `currency` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `exchange_rate` decimal(10,4) DEFAULT '1.0000',
  `subtotal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `tax_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `paid_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `balance_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `status` enum('draft','posted','partially_paid','paid','cancelled') DEFAULT 'draft',
  `reference` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(36) DEFAULT NULL,
  `updated_by` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_invoice_number_institution` (`invoice_number`,`institution_id`),
  KEY `idx_institution_id` (`institution_id`),
  KEY `idx_vendor_id` (`vendor_id`),
  KEY `idx_po_id` (`po_id`),
  KEY `idx_grn_id` (`grn_id`),
  KEY `idx_status` (`status`),
  KEY `idx_invoice_date` (`invoice_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: purchase_invoice_lines
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchase_invoice_lines` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `invoice_id` varchar(36) NOT NULL,
  `po_line_id` varchar(36) DEFAULT NULL,
  `grn_line_id` varchar(36) DEFAULT NULL,
  `item_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `item_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `warehouse_id` varchar(36) DEFAULT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `unit_cost` decimal(10,2) NOT NULL,
  `line_total` decimal(15,2) NOT NULL,
  `tax_rate` decimal(5,2) DEFAULT '0.00',
  `tax_amount` decimal(15,2) DEFAULT '0.00',
  `discount_rate` decimal(5,2) DEFAULT '0.00',
  `discount_amount` decimal(15,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_invoice_id` (`invoice_id`),
  KEY `idx_item_id` (`item_id`),
  KEY `idx_po_line_id` (`po_line_id`),
  KEY `idx_grn_line_id` (`grn_line_id`),
  CONSTRAINT `purchase_invoice_lines_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `purchase_invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: purchase_returns
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchase_returns` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `return_number` varchar(50) NOT NULL,
  `po_id` varchar(36) DEFAULT NULL,
  `grn_id` varchar(36) DEFAULT NULL,
  `vendor_id` varchar(36) DEFAULT NULL,
  `vendor_name` varchar(200) NOT NULL,
  `return_date` date NOT NULL,
  `status` enum('draft','confirmed','cancelled') NOT NULL DEFAULT 'draft',
  `subtotal` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `tax_amount` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `total_amount` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `reason` text,
  `debit_note_number` varchar(50) DEFAULT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pr_institution` (`institution_id`),
  KEY `idx_pr_vendor` (`vendor_id`),
  KEY `idx_pr_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: purchase_return_lines
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchase_return_lines` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `return_id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `quantity` decimal(15,4) NOT NULL,
  `unit_cost` decimal(15,4) NOT NULL,
  `line_total` decimal(15,4) NOT NULL,
  `return_reason` varchar(200) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_prl_return` (`return_id`),
  KEY `idx_prl_item` (`item_id`),
  CONSTRAINT `purchase_return_lines_ibfk_1` FOREIGN KEY (`return_id`) REFERENCES `purchase_returns` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: reorder_levels
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `reorder_levels` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) DEFAULT NULL,
  `item_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `reorder_level` decimal(15,3) NOT NULL DEFAULT '0.000',
  `reorder_quantity` decimal(15,3) NOT NULL DEFAULT '0.000',
  `max_stock_level` decimal(15,3) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_item_warehouse` (`item_id`,`warehouse_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `idx_tenant_active` (`is_active`),
  KEY `fk_reorder_levels_institution` (`institution_id`),
  CONSTRAINT `fk_reorder_levels_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reorder_levels_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reorder_levels_ibfk_2` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: roles
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `roles` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `permissions` json NOT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tenant_role` (`institution_id`,`name`),
  KEY `idx_tenant` (`institution_id`),
  CONSTRAINT `roles_institution_fk` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: sales_invoices
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales_invoices` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `institution_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `invoice_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `customer_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `customer_name` varchar(255) NOT NULL,
  `so_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `delivery_note_id` varchar(36) DEFAULT NULL,
  `invoice_date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `currency` varchar(3) DEFAULT 'USD',
  `exchange_rate` decimal(10,4) DEFAULT '1.0000',
  `subtotal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `tax_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `paid_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `balance_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `status` enum('draft','posted','partially_paid','paid','cancelled') DEFAULT 'draft',
  `reference` varchar(255) DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(36) DEFAULT NULL,
  `updated_by` varchar(36) DEFAULT NULL,
  `is_auto_generated` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_invoice_number_institution` (`invoice_number`,`institution_id`),
  KEY `idx_institution_id` (`institution_id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_so_id` (`so_id`),
  KEY `idx_delivery_note_id` (`delivery_note_id`),
  KEY `idx_status` (`status`),
  KEY `idx_invoice_date` (`invoice_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: sales_invoice_lines
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales_invoice_lines` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `invoice_id` varchar(36) NOT NULL,
  `so_line_id` varchar(36) DEFAULT NULL,
  `delivery_line_id` varchar(36) DEFAULT NULL,
  `item_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `item_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `line_total` decimal(15,2) NOT NULL,
  `tax_rate` decimal(5,2) DEFAULT '0.00',
  `tax_amount` decimal(15,2) DEFAULT '0.00',
  `discount_rate` decimal(5,2) DEFAULT '0.00',
  `discount_amount` decimal(15,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_invoice_id` (`invoice_id`),
  KEY `idx_item_id` (`item_id`),
  KEY `idx_so_line_id` (`so_line_id`),
  KEY `idx_delivery_line_id` (`delivery_line_id`),
  CONSTRAINT `sales_invoice_lines_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `sales_invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: sales_orders
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales_orders` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) DEFAULT NULL,
  `so_number` varchar(100) NOT NULL,
  `customer_id` varchar(36) DEFAULT NULL,
  `customer_name` varchar(255) NOT NULL,
  `warehouse_id` char(36) DEFAULT NULL,
  `channel` varchar(100) DEFAULT 'direct',
  `status` enum('draft','confirmed','partially_shipped','shipped','delivered','cancelled') DEFAULT 'draft',
  `currency` varchar(3) DEFAULT 'USD',
  `subtotal` decimal(15,2) DEFAULT '0.00',
  `tax_amount` decimal(15,2) DEFAULT '0.00',
  `total_amount` decimal(15,2) DEFAULT '0.00',
  `expected_ship_date` date DEFAULT NULL,
  `is_preorder` tinyint(1) DEFAULT '0',
  `committed_demand` decimal(15,3) DEFAULT '0.000',
  `notes` text,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `order_date` date DEFAULT (curdate()),
  `estimated_shipping_cost` decimal(15,2) DEFAULT '0.00',
  `fulfillment_cost` decimal(15,2) DEFAULT '0.00',
  `shipping_method` varchar(50) DEFAULT 'standard',
  `distance_km` decimal(10,2) DEFAULT NULL,
  `cancellation_reason` text COMMENT 'Reason for cancelling the sales order',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tenant_so_number` (`so_number`),
  KEY `created_by` (`created_by`),
  KEY `idx_tenant_status` (`status`),
  KEY `idx_tenant_customer` (`customer_id`),
  KEY `fk_sales_orders_institution` (`institution_id`),
  KEY `idx_sales_orders_warehouse` (`warehouse_id`,`status`),
  KEY `idx_sales_orders_shipping_method` (`shipping_method`),
  CONSTRAINT `fk_sales_orders_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sales_orders_warehouse_fk` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: sales_order_lines
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales_order_lines` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) DEFAULT NULL,
  `so_id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `warehouse_id` char(36) DEFAULT NULL,
  `quantity_ordered` decimal(15,4) NOT NULL,
  `quantity_reserved` decimal(15,4) DEFAULT '0.0000',
  `quantity_shipped` decimal(15,4) DEFAULT '0.0000',
  `unit_price` decimal(15,4) NOT NULL,
  `line_total` decimal(15,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `line_number` int DEFAULT '1',
  `status` enum('pending','reserved','shipped','delivered','cancelled') DEFAULT 'pending',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tax_amount` decimal(15,4) DEFAULT '0.0000',
  `tax_rate` decimal(10,4) DEFAULT '0.0000',
  `discount_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(15,4) NOT NULL DEFAULT '0.0000',
  PRIMARY KEY (`id`),
  KEY `idx_so` (`so_id`),
  KEY `idx_tenant_item` (`item_id`),
  KEY `fk_sales_order_lines_institution` (`institution_id`),
  KEY `idx_sol_warehouse` (`warehouse_id`),
  CONSTRAINT `fk_sales_order_lines_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sales_order_lines_ibfk_2` FOREIGN KEY (`so_id`) REFERENCES `sales_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sales_order_lines_ibfk_3` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: service_accounts
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `service_accounts` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `jti` varchar(36) NOT NULL,
  `permissions` text,
  `status` varchar(20) DEFAULT 'active',
  `expires_at` datetime DEFAULT NULL,
  `last_used_at` datetime DEFAULT NULL,
  `usage_count` int DEFAULT '0',
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `jti` (`jti`),
  KEY `idx_institution_id` (`institution_id`),
  KEY `idx_jti` (`jti`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: stock_counts
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_counts` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `count_number` varchar(50) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `count_type` enum('full','cycle','spot') NOT NULL DEFAULT 'full',
  `status` enum('draft','in_progress','pending_approval','approved','cancelled') NOT NULL DEFAULT 'draft',
  `scheduled_date` date DEFAULT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `approved_by` varchar(36) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `notes` text,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sc_institution` (`institution_id`),
  KEY `idx_sc_warehouse` (`warehouse_id`),
  KEY `idx_sc_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: stock_count_lines
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_count_lines` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `stock_count_id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `system_qty` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `counted_qty` decimal(15,4) DEFAULT NULL,
  `variance_qty` decimal(15,4) GENERATED ALWAYS AS ((`counted_qty` - `system_qty`)) STORED,
  `unit_cost` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `variance_value` decimal(15,4) GENERATED ALWAYS AS (((`counted_qty` - `system_qty`) * `unit_cost`)) STORED,
  `status` enum('pending','counted','approved') NOT NULL DEFAULT 'pending',
  `counted_by` varchar(36) DEFAULT NULL,
  `counted_at` timestamp NULL DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_scl_count` (`stock_count_id`),
  KEY `idx_scl_item` (`item_id`),
  CONSTRAINT `stock_count_lines_ibfk_1` FOREIGN KEY (`stock_count_id`) REFERENCES `stock_counts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: stock_movements
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `institution_id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `movement_type` varchar(30) NOT NULL,
  `quantity` decimal(15,4) NOT NULL,
  `reference_type` varchar(50) DEFAULT NULL,
  `reference_id` varchar(36) DEFAULT NULL,
  `reference_number` varchar(100) DEFAULT NULL,
  `created_by` varchar(64) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_stock_movements_institution` (`institution_id`),
  KEY `idx_stock_movements_item` (`institution_id`,`item_id`),
  KEY `idx_stock_movements_reference` (`reference_type`,`reference_id`),
  KEY `idx_stock_movements_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: subscription_billing_history
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `subscription_billing_history` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `plan_id` varchar(36) NOT NULL,
  `plan_name` varchar(100) NOT NULL,
  `billing_cycle` enum('monthly','yearly','trial') NOT NULL,
  `amount` decimal(10,2) DEFAULT '0.00',
  `currency` varchar(10) DEFAULT 'INR',
  `status` enum('paid','pending','failed','refunded') DEFAULT 'paid',
  `payment_method` varchar(50) DEFAULT 'manual',
  `payment_reference` varchar(100) DEFAULT NULL,
  `period_start` timestamp NOT NULL,
  `period_end` timestamp NOT NULL,
  `invoice_number` varchar(50) DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: subscription_upgrade_requests
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `subscription_upgrade_requests` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `requested_plan_id` varchar(36) NOT NULL,
  `billing_cycle` enum('monthly','yearly') NOT NULL DEFAULT 'monthly',
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `request_message` text,
  `admin_notes` text,
  `reviewed_by` varchar(36) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sub_upg_inst` (`institution_id`),
  KEY `idx_sub_upg_status` (`status`),
  CONSTRAINT `subscription_upgrade_requests_ibfk_1` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `subscription_upgrade_requests_ibfk_2` FOREIGN KEY (`requested_plan_id`) REFERENCES `subscription_plans` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: tax_groups
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `tax_groups` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `institution_id` (`institution_id`),
  CONSTRAINT `tax_groups_ibfk_1` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: tax_rates
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `tax_rates` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `tax_group_id` varchar(36) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `rate` decimal(10,4) NOT NULL,
  `tax_type` varchar(50) DEFAULT 'custom',
  `is_compound` tinyint(1) DEFAULT '0',
  `is_inclusive` tinyint(1) DEFAULT '0',
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `institution_id` (`institution_id`),
  KEY `tax_group_id` (`tax_group_id`),
  CONSTRAINT `tax_rates_ibfk_1` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tax_rates_ibfk_2` FOREIGN KEY (`tax_group_id`) REFERENCES `tax_groups` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: tax_types
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `tax_types` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inst_type` (`institution_id`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: temp_access_tokens
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `temp_access_tokens` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `target_user_id` varchar(36) NOT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  `temp_password` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `used_at` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `target_user_id` (`target_user_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_tenant_user` (`institution_id`,`target_user_id`),
  KEY `idx_expires` (`expires_at`),
  KEY `idx_active` (`is_active`),
  CONSTRAINT `temp_access_tokens_ibfk_1` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: transfer_requests
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `transfer_requests` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `transfer_number` varchar(50) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `from_warehouse_id` varchar(36) NOT NULL,
  `to_warehouse_id` varchar(36) NOT NULL,
  `quantity` decimal(15,4) NOT NULL,
  `reason` text,
  `status` enum('pending','approved','rejected','completed','cancelled') NOT NULL DEFAULT 'pending',
  `requested_by` varchar(36) NOT NULL,
  `approved_by` varchar(36) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text,
  `transfer_id` varchar(36) DEFAULT NULL COMMENT 'set after execution',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tr_institution` (`institution_id`),
  KEY `idx_tr_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: vendor_price_lists
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `vendor_price_lists` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `unit_cost` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `currency` varchar(10) NOT NULL DEFAULT 'USD',
  `min_order_qty` decimal(15,4) NOT NULL DEFAULT '1.0000',
  `lead_time_days` int NOT NULL DEFAULT '0',
  `valid_from` date DEFAULT NULL,
  `valid_to` date DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `notes` text,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vendor_item` (`institution_id`,`vendor_id`,`item_id`),
  KEY `idx_vpl_vendor` (`institution_id`,`vendor_id`),
  KEY `idx_vpl_item` (`institution_id`,`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: warehouse_bin_types
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `warehouse_bin_types` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bin_type_code` (`institution_id`,`code`),
  KEY `idx_bin_type_institution` (`institution_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: warehouse_zones
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `warehouse_zones` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `zone_type` varchar(50) NOT NULL DEFAULT 'storage',
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_zone_code` (`warehouse_id`,`code`),
  KEY `idx_wh_zones_institution` (`institution_id`,`warehouse_id`),
  CONSTRAINT `fk_zone_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: warehouse_racks
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `warehouse_racks` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `zone_id` varchar(36) NOT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `total_levels` int NOT NULL DEFAULT '1',
  `total_columns` int NOT NULL DEFAULT '1',
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rack_code` (`zone_id`,`code`),
  KEY `idx_wh_racks_institution` (`institution_id`,`warehouse_id`),
  KEY `idx_wh_racks_zone` (`zone_id`),
  KEY `fk_rack_warehouse` (`warehouse_id`),
  CONSTRAINT `fk_rack_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rack_zone` FOREIGN KEY (`zone_id`) REFERENCES `warehouse_zones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: warehouse_bins
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `warehouse_bins` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `zone_id` varchar(36) NOT NULL,
  `rack_id` varchar(36) NOT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(150) DEFAULT NULL,
  `bin_level` int DEFAULT NULL,
  `bin_column` int DEFAULT NULL,
  `bin_type` varchar(50) NOT NULL DEFAULT 'standard',
  `capacity_qty` decimal(15,4) DEFAULT NULL,
  `capacity_unit` varchar(50) DEFAULT NULL,
  `barcode` varchar(100) DEFAULT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('active','inactive','blocked','full') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bin_code` (`rack_id`,`code`),
  KEY `idx_wh_bins_institution` (`institution_id`,`warehouse_id`),
  KEY `idx_wh_bins_zone` (`zone_id`),
  KEY `idx_wh_bins_rack` (`rack_id`),
  KEY `idx_wh_bins_barcode` (`institution_id`,`barcode`),
  KEY `fk_bin_warehouse` (`warehouse_id`),
  CONSTRAINT `fk_bin_rack` FOREIGN KEY (`rack_id`) REFERENCES `warehouse_racks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bin_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bin_zone` FOREIGN KEY (`zone_id`) REFERENCES `warehouse_zones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: warehouse_zone_types
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `warehouse_zone_types` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_zone_type_code` (`institution_id`,`code`),
  KEY `idx_zone_type_institution` (`institution_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: workflow_rules
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `workflow_rules` (
  `id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `module` enum('inventory','sales_order','purchase_order','invoice','item') NOT NULL,
  `trigger_event` varchar(100) NOT NULL,
  `conditions` json DEFAULT (_utf8mb4'[]'),
  `actions` json DEFAULT (_utf8mb4'[]'),
  `is_active` tinyint(1) DEFAULT '1',
  `execution_count` int DEFAULT '0',
  `last_executed_at` timestamp NULL DEFAULT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `institution_id` (`institution_id`),
  CONSTRAINT `workflow_rules_ibfk_1` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------
-- Table: workflow_logs
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `workflow_logs` (
  `id` varchar(36) NOT NULL,
  `rule_id` varchar(36) NOT NULL,
  `institution_id` varchar(36) NOT NULL,
  `trigger_data` json DEFAULT NULL,
  `actions_executed` json DEFAULT NULL,
  `status` enum('success','failed','partial') DEFAULT 'success',
  `error_message` text,
  `executed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `rule_id` (`rule_id`),
  CONSTRAINT `workflow_logs_ibfk_1` FOREIGN KEY (`rule_id`) REFERENCES `workflow_rules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
