-- Phase 1 Production / BOM tables

CREATE TABLE IF NOT EXISTS production_masters (
  id                  VARCHAR(36)  NOT NULL,
  institution_id      VARCHAR(36)  NOT NULL,
  production_item_id  VARCHAR(36)  NOT NULL,
  default_warehouse_id VARCHAR(36) DEFAULT NULL,
  title               VARCHAR(255) DEFAULT NULL,
  tagline             VARCHAR(255) DEFAULT NULL,
  status              ENUM('draft','active','inactive') NOT NULL DEFAULT 'draft',
  created_by          VARCHAR(36)  DEFAULT NULL,
  updated_by          VARCHAR(36)  DEFAULT NULL,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pm_inst_status (institution_id, status),
  KEY idx_pm_inst_item (institution_id, production_item_id),
  CONSTRAINT fk_pm_inst FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
  CONSTRAINT fk_pm_item FOREIGN KEY (production_item_id) REFERENCES items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS production_bom_versions (
  id                  VARCHAR(36)  NOT NULL,
  institution_id      VARCHAR(36)  NOT NULL,
  master_id           VARCHAR(36)  NOT NULL,
  version_no          INT          NOT NULL DEFAULT 1,
  output_quantity     DECIMAL(15,4) NOT NULL DEFAULT 1.0000,
  status              ENUM('draft','active','retired') NOT NULL DEFAULT 'draft',
  effective_from      DATE         DEFAULT NULL,
  effective_to        DATE         DEFAULT NULL,
  notes               TEXT         DEFAULT NULL,
  created_by          VARCHAR(36)  DEFAULT NULL,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pbv_master_version (master_id, version_no),
  KEY idx_pbv_inst_status (institution_id, status),
  CONSTRAINT fk_pbv_inst FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
  CONSTRAINT fk_pbv_master FOREIGN KEY (master_id) REFERENCES production_masters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS production_bom_lines (
  id                  VARCHAR(36)  NOT NULL,
  institution_id      VARCHAR(36)  NOT NULL,
  bom_version_id      VARCHAR(36)  NOT NULL,
  component_item_id   VARCHAR(36)  NOT NULL,
  quantity_required   DECIMAL(15,4) NOT NULL,
  wastage_percent     DECIMAL(8,4)  NOT NULL DEFAULT 0.0000,
  sequence_no         INT          NOT NULL DEFAULT 1,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pbl_inst_bom (institution_id, bom_version_id),
  KEY idx_pbl_component (institution_id, component_item_id),
  CONSTRAINT fk_pbl_inst FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
  CONSTRAINT fk_pbl_bom FOREIGN KEY (bom_version_id) REFERENCES production_bom_versions(id) ON DELETE CASCADE,
  CONSTRAINT fk_pbl_component FOREIGN KEY (component_item_id) REFERENCES items(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS production_orders (
  id                  VARCHAR(36)  NOT NULL,
  institution_id      VARCHAR(36)  NOT NULL,
  master_id           VARCHAR(36)  NOT NULL,
  bom_version_id      VARCHAR(36)  NOT NULL,
  production_item_id  VARCHAR(36)  NOT NULL,
  warehouse_id        VARCHAR(36)  NOT NULL,
  order_number        VARCHAR(100) DEFAULT NULL,
  planned_quantity    DECIMAL(15,4) NOT NULL,
  actual_quantity     DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  process_cost_total  DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  material_cost_total DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  total_cost          DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  status              ENUM('draft','released','in_progress','completed','cancelled') NOT NULL DEFAULT 'draft',
  availability_checked_at TIMESTAMP NULL DEFAULT NULL,
  completed_at        TIMESTAMP NULL DEFAULT NULL,
  created_by          VARCHAR(36) DEFAULT NULL,
  updated_by          VARCHAR(36) DEFAULT NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_po_inst_orderno (institution_id, order_number),
  KEY idx_po_inst_status (institution_id, status),
  KEY idx_po_inst_item (institution_id, production_item_id),
  CONSTRAINT fk_po_inst FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
  CONSTRAINT fk_po_master FOREIGN KEY (master_id) REFERENCES production_masters(id) ON DELETE RESTRICT,
  CONSTRAINT fk_po_bom FOREIGN KEY (bom_version_id) REFERENCES production_bom_versions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_po_item FOREIGN KEY (production_item_id) REFERENCES items(id) ON DELETE RESTRICT,
  CONSTRAINT fk_po_wh FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS production_order_materials (
  id                  VARCHAR(36)  NOT NULL,
  institution_id      VARCHAR(36)  NOT NULL,
  order_id            VARCHAR(36)  NOT NULL,
  component_item_id   VARCHAR(36)  NOT NULL,
  quantity_planned    DECIMAL(15,4) NOT NULL,
  quantity_issued     DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  unit_cost           DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  line_cost           DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pom_inst_order (institution_id, order_id),
  KEY idx_pom_inst_component (institution_id, component_item_id),
  CONSTRAINT fk_pom_inst FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
  CONSTRAINT fk_pom_order FOREIGN KEY (order_id) REFERENCES production_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_pom_component FOREIGN KEY (component_item_id) REFERENCES items(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS production_receipts (
  id                  VARCHAR(36)  NOT NULL,
  institution_id      VARCHAR(36)  NOT NULL,
  order_id            VARCHAR(36)  NOT NULL,
  received_quantity   DECIMAL(15,4) NOT NULL,
  unit_cost           DECIMAL(15,4) NOT NULL,
  total_cost          DECIMAL(15,4) NOT NULL,
  notes               TEXT         DEFAULT NULL,
  created_by          VARCHAR(36)  DEFAULT NULL,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pr_inst_order (institution_id, order_id),
  CONSTRAINT fk_pr_inst FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
  CONSTRAINT fk_pr_order FOREIGN KEY (order_id) REFERENCES production_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS production_audit_logs (
  id                  VARCHAR(36)  NOT NULL,
  institution_id      VARCHAR(36)  NOT NULL,
  entity_type         VARCHAR(50)  NOT NULL,
  entity_id           VARCHAR(36)  NOT NULL,
  action              VARCHAR(100) NOT NULL,
  payload             JSON         DEFAULT NULL,
  performed_by        VARCHAR(36)  DEFAULT NULL,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pal_inst_entity (institution_id, entity_type, entity_id),
  KEY idx_pal_inst_action (institution_id, action),
  CONSTRAINT fk_pal_inst FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Extend item type to support dedicated production classification.
SET @db := DATABASE();
SET @colType := (
  SELECT COLUMN_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'items' AND COLUMN_NAME = 'type'
  LIMIT 1
);
SET @sql := IF(
  @colType IS NOT NULL AND @colType NOT LIKE '%manufactured%',
  'ALTER TABLE items MODIFY COLUMN type ENUM(''simple'',''variant'',''composite'',''service'',''manufactured'') DEFAULT ''simple''',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
