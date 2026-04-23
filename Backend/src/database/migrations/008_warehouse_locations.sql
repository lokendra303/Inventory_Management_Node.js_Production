-- =============================================================================
-- Warehouse Locations feature: Zones / Racks / Bins
-- =============================================================================
-- Introduces a three-level storage hierarchy inside each warehouse:
--   warehouse_zones  (e.g. "Receiving", "Bulk Storage", "Pick Face A")
--     └── warehouse_racks   (e.g. "R-01", "R-02")
--           └── warehouse_bins (smallest storage unit, optionally barcoded)
--
-- Also adds `items.default_bin_id` so a preferred putaway bin can be stored
-- per item and used as the default destination by GRN / Putaway flows.
--
-- Run manually against the target schema, e.g.:
--   USE ims_sepcune;
--   SOURCE Backend/src/database/migrations/warehouse_locations.sql;
-- =============================================================================

-- 1. Zones: top-level subdivision of a warehouse
CREATE TABLE IF NOT EXISTS warehouse_zones (
  id VARCHAR(36) PRIMARY KEY,
  institution_id VARCHAR(36) NOT NULL,
  warehouse_id VARCHAR(36) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(255) NULL,
  zone_type ENUM(
    'storage','receiving','shipping','quarantine',
    'picking','bulk','cold_storage','hazmat','returns','other'
  ) NOT NULL DEFAULT 'storage',
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_zone_code (warehouse_id, code),
  INDEX idx_wh_zones_institution (institution_id, warehouse_id),
  CONSTRAINT fk_zone_warehouse FOREIGN KEY (warehouse_id)
    REFERENCES warehouses(id) ON DELETE CASCADE
);

-- 2. Racks: belong to a zone. warehouse_id denormalized for faster filtering.
CREATE TABLE IF NOT EXISTS warehouse_racks (
  id VARCHAR(36) PRIMARY KEY,
  institution_id VARCHAR(36) NOT NULL,
  warehouse_id VARCHAR(36) NOT NULL,
  zone_id VARCHAR(36) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(255) NULL,
  total_levels INT NOT NULL DEFAULT 1,
  total_columns INT NOT NULL DEFAULT 1,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_rack_code (zone_id, code),
  INDEX idx_wh_racks_institution (institution_id, warehouse_id),
  INDEX idx_wh_racks_zone (zone_id),
  CONSTRAINT fk_rack_zone FOREIGN KEY (zone_id)
    REFERENCES warehouse_zones(id) ON DELETE CASCADE,
  CONSTRAINT fk_rack_warehouse FOREIGN KEY (warehouse_id)
    REFERENCES warehouses(id) ON DELETE CASCADE
);

-- 3. Bins: smallest storage unit inside a rack. warehouse_id + zone_id are
--    denormalized for cheap cross-warehouse queries and bin scans.
CREATE TABLE IF NOT EXISTS warehouse_bins (
  id VARCHAR(36) PRIMARY KEY,
  institution_id VARCHAR(36) NOT NULL,
  warehouse_id VARCHAR(36) NOT NULL,
  zone_id VARCHAR(36) NOT NULL,
  rack_id VARCHAR(36) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NULL,
  bin_level INT NULL,
  bin_column INT NULL,
  bin_type ENUM(
    'standard','shelf','pallet','floor','carton','bulk','other'
  ) NOT NULL DEFAULT 'standard',
  capacity_qty DECIMAL(15,4) NULL,
  capacity_unit VARCHAR(50) NULL,
  barcode VARCHAR(100) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active','inactive','blocked','full') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_bin_code (rack_id, code),
  INDEX idx_wh_bins_institution (institution_id, warehouse_id),
  INDEX idx_wh_bins_zone (zone_id),
  INDEX idx_wh_bins_rack (rack_id),
  INDEX idx_wh_bins_barcode (institution_id, barcode),
  CONSTRAINT fk_bin_rack FOREIGN KEY (rack_id)
    REFERENCES warehouse_racks(id) ON DELETE CASCADE,
  CONSTRAINT fk_bin_zone FOREIGN KEY (zone_id)
    REFERENCES warehouse_zones(id) ON DELETE CASCADE,
  CONSTRAINT fk_bin_warehouse FOREIGN KEY (warehouse_id)
    REFERENCES warehouses(id) ON DELETE CASCADE
);

-- 4. items.default_bin_id — preferred putaway bin for an item.
--    Added without FK so dropping a bin does not orphan items; the application
--    layer treats stale IDs as "no default".
--    Guarded so re-running this migration is a safe no-op.
SET @db := DATABASE();

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='items' AND COLUMN_NAME='default_bin_id');
SET @sql := IF(@has=0, 'ALTER TABLE items ADD COLUMN default_bin_id VARCHAR(36) NULL AFTER custom_fields', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='items' AND INDEX_NAME='idx_items_default_bin');
SET @sql := IF(@has=0, 'ALTER TABLE items ADD INDEX idx_items_default_bin (institution_id, default_bin_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
