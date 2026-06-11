-- Track institution user login sessions for platform-admin visibility and force logout
CREATE TABLE IF NOT EXISTS user_sessions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  institution_id VARCHAR(36) NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(512) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  revoked_by VARCHAR(36) NULL COMMENT 'platform_admin id when force-logged out',
  revoke_reason VARCHAR(255) NULL,
  INDEX idx_user_sessions_user (user_id),
  INDEX idx_user_sessions_institution (institution_id),
  INDEX idx_user_sessions_active (revoked_at, last_activity_at),
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES institution_users (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_sessions_institution FOREIGN KEY (institution_id) REFERENCES institutions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
