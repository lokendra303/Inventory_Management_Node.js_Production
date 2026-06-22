-- BOM assemble/disassemble operations (separate from legacy production_orders table)



CREATE TABLE IF NOT EXISTS production_operations (

  id CHAR(36) NOT NULL PRIMARY KEY,

  institution_id CHAR(36) NOT NULL,

  operation_number VARCHAR(50) NOT NULL,

  operation_type ENUM('assemble', 'disassemble') NOT NULL,

  status ENUM('draft', 'done', 'cancelled') NOT NULL DEFAULT 'draft',

  composite_item_id CHAR(36) NOT NULL,

  warehouse_id CHAR(36) NOT NULL,

  quantity DECIMAL(15, 4) NOT NULL,

  notes TEXT NULL,

  payload_json JSON NULL,

  result_json JSON NULL,

  batch_ref VARCHAR(100) NULL,

  output_batch_number VARCHAR(100) NULL,

  estimated_unit_cost DECIMAL(15, 4) NULL,

  created_by CHAR(36) NULL,

  executed_by CHAR(36) NULL,

  executed_at DATETIME NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_production_operations_number (institution_id, operation_number),

  KEY idx_production_operations_inst_status (institution_id, status),

  KEY idx_production_operations_composite (institution_id, composite_item_id),

  KEY idx_production_operations_created (institution_id, created_at)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

