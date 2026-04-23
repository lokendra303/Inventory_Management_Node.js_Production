-- =============================================================================
-- SKU Auto-Generator (Zoho-style) — per-institution rules with category overrides
-- =============================================================================
-- Run manually against the target schema:
--   USE ims_sepcune;
--   SOURCE Backend/src/database/migrations/create_sku_generator_rules.sql;
-- =============================================================================

CREATE TABLE IF NOT EXISTS sku_generator_rules (
  id                 VARCHAR(36) PRIMARY KEY,
  institution_id     VARCHAR(36) NOT NULL,

  -- Rule scoping:
  --   scope='default'  -> one institution-wide fallback rule (is_default=1).
  --   scope='category' -> override for rows whose items.category = scope_value.
  -- Additional scopes can be added later (brand, type) without schema changes.
  scope              ENUM('default','category') NOT NULL DEFAULT 'default',
  scope_value        VARCHAR(150) NULL,

  -- Human label shown in the rules list.
  name               VARCHAR(150) NOT NULL,

  -- Prefix composition:
  --   prefix_mode='static' -> use prefix_static verbatim.
  --   prefix_mode='derived' -> take the first `prefix_length` letters of the
  --     source field (category/brand/name), uppercase, alphanumerics only.
  prefix_mode        ENUM('static','derived') NOT NULL DEFAULT 'static',
  prefix_static      VARCHAR(20) NULL,
  prefix_source      ENUM('category','brand','name') NULL,
  prefix_length      TINYINT UNSIGNED NOT NULL DEFAULT 3,

  -- Character inserted between parts (prefix / date / counter).
  -- `separator` is a reserved word in MySQL (GROUP_CONCAT) — keep it backticked.
  `separator`        VARCHAR(3) NOT NULL DEFAULT '-',

  -- Optional date segment. Supported formats: YY, YYMM, YYYYMM, YYYYMMDD.
  use_date           TINYINT(1) NOT NULL DEFAULT 0,
  date_format        VARCHAR(10) NULL,

  -- Auto-incrementing counter (atomically bumped by the generator).
  use_counter        TINYINT(1) NOT NULL DEFAULT 1,
  counter_start      INT UNSIGNED NOT NULL DEFAULT 1,
  counter_current    INT UNSIGNED NOT NULL DEFAULT 0,
  counter_padding    TINYINT UNSIGNED NOT NULL DEFAULT 4,

  is_default         TINYINT(1) NOT NULL DEFAULT 0,
  status             ENUM('active','inactive') NOT NULL DEFAULT 'active',

  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_skug_institution (institution_id, status),
  -- A single default rule per institution, and a single override per
  -- category within an institution. Scope_value is NULL for default rules,
  -- which is legal under MySQL's unique-null semantics (each NULL is treated
  -- as distinct), so we separately enforce default uniqueness via is_default.
  UNIQUE KEY uq_skug_scope (institution_id, scope, scope_value)
);
