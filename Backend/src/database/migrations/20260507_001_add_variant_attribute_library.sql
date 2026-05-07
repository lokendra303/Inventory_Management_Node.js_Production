-- Reusable Variant Attribute Library (institution-scoped)
-- Create once and reuse in Add Item variant builder.

CREATE TABLE IF NOT EXISTS variant_attribute_library (
  id VARCHAR(36) PRIMARY KEY,
  institution_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  values_json JSON NOT NULL,
  usage_count INT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP NULL DEFAULT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_by VARCHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_variant_library_name (institution_id, name),
  INDEX idx_variant_library_inst_status (institution_id, status)
);
