-- Create audit_logs table for user-action tracking across the app.
--
-- Idempotent: on a fresh install 000_initial_schema.sql already contains
-- this table. The guards below make this file safe to re-run.

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  institution_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36),
  service_account_id VARCHAR(36),
  entity_type VARCHAR(100),
  entity_id VARCHAR(100),
  action VARCHAR(50),
  method VARCHAR(10),
  path VARCHAR(500),
  changes JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  status_code INT,
  duration INT,
  request_body JSON,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

SET @db := DATABASE();

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='audit_logs' AND INDEX_NAME='idx_audit_logs_institution_id');
SET @sql := IF(@has=0, 'CREATE INDEX idx_audit_logs_institution_id ON audit_logs(institution_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='audit_logs' AND INDEX_NAME='idx_audit_logs_user_id');
SET @sql := IF(@has=0, 'CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='audit_logs' AND INDEX_NAME='idx_audit_logs_entity');
SET @sql := IF(@has=0, 'CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='audit_logs' AND INDEX_NAME='idx_audit_logs_action');
SET @sql := IF(@has=0, 'CREATE INDEX idx_audit_logs_action ON audit_logs(action)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='audit_logs' AND INDEX_NAME='idx_audit_logs_created_at');
SET @sql := IF(@has=0, 'CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='audit_logs' AND INDEX_NAME='idx_audit_logs_institution_created');
SET @sql := IF(@has=0, 'CREATE INDEX idx_audit_logs_institution_created ON audit_logs(institution_id, created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='audit_logs' AND INDEX_NAME='idx_audit_logs_user_created');
SET @sql := IF(@has=0, 'CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Intentionally no FK to institution_users: audit rows must survive user
-- deletion, and `ON DELETE SET NULL` would conflict with institution_id
-- being NOT NULL. Orphaned user_ids are tolerated by the reader.
