-- =============================================================================
-- 020_subscription_upgrade_requests.sql
-- Tenant-initiated plan upgrade requests reviewed by platform administrators.
-- Depends on: institutions, subscription_plans
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscription_upgrade_requests (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  institution_id VARCHAR(36) NOT NULL,
  requested_plan_id VARCHAR(36) NOT NULL,
  billing_cycle ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  request_message TEXT NULL,
  admin_notes TEXT NULL,
  reviewed_by VARCHAR(36) NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_sub_upg_inst (institution_id),
  KEY idx_sub_upg_status (status),
  CONSTRAINT fk_sub_upg_institution FOREIGN KEY (institution_id) REFERENCES institutions (id) ON DELETE CASCADE,
  CONSTRAINT fk_sub_upg_plan FOREIGN KEY (requested_plan_id) REFERENCES subscription_plans (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
