-- =============================================================================
-- Batch / lot auto-generator rules (batch coding machine)
-- Mirrors sku_generator_rules with context for kit assembly, disassembly, etc.
-- =============================================================================

CREATE TABLE IF NOT EXISTS batch_generator_rules (
  id                 VARCHAR(36) PRIMARY KEY,
  institution_id     VARCHAR(36) NOT NULL,

  -- When the rule applies: kit assembly output, disassembly component restore, or general receive.
  context            ENUM('general','kit_assembly','kit_disassembly','opening_stock') NOT NULL DEFAULT 'general',

  scope              ENUM('default','category') NOT NULL DEFAULT 'default',
  scope_value        VARCHAR(150) NULL,

  name               VARCHAR(150) NOT NULL,

  prefix_mode        ENUM('static','derived') NOT NULL DEFAULT 'static',
  prefix_static      VARCHAR(255) NULL,
  prefix_source      ENUM('category','brand','name','sku') NULL,
  prefix_length      TINYINT UNSIGNED NOT NULL DEFAULT 3,

  `separator`        VARCHAR(3) NOT NULL DEFAULT '-',

  use_date           TINYINT(1) NOT NULL DEFAULT 0,
  date_format        VARCHAR(10) NULL,

  use_counter        TINYINT(1) NOT NULL DEFAULT 1,
  counter_start      INT UNSIGNED NOT NULL DEFAULT 1,
  counter_current    INT UNSIGNED NOT NULL DEFAULT 0,
  counter_padding    TINYINT UNSIGNED NOT NULL DEFAULT 4,

  is_default         TINYINT(1) NOT NULL DEFAULT 0,
  status             ENUM('active','inactive') NOT NULL DEFAULT 'active',

  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_batchg_institution (institution_id, status, context),
  UNIQUE KEY uq_batchg_scope (institution_id, context, scope, scope_value)
);
