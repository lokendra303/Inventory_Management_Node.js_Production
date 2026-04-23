-- Create otp_tokens table for persisting one-time passwords
-- Replaces the in-memory OTP map previously used by auth.service.js.
-- NOTE: OTPs are stored in plaintext (`otp_code`) for now — protect DB access.
--
-- `id` is a plain AUTO_INCREMENT BIGINT (not a UUID). OTP rows are ephemeral
-- (5-minute TTL) and never referenced by any other table, so a UUID bought
-- us nothing. The monotonic id doubles as the "latest OTP" marker —
-- ORDER BY id DESC LIMIT 1.
--
-- Idempotent: on a fresh install 000_initial_schema.sql already contains
-- this table. The guards below mean this file is safe to re-run.

CREATE TABLE IF NOT EXISTS otp_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  purpose VARCHAR(30) NOT NULL,
  email VARCHAR(255) NOT NULL,
  institution_id VARCHAR(36) NULL,
  user_id VARCHAR(36) NULL,
  otp_code VARCHAR(10) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Guard each CREATE INDEX against information_schema so this is
-- compatible with MySQL versions that don't support IF NOT EXISTS on indexes.
SET @db := DATABASE();

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='otp_tokens' AND INDEX_NAME='idx_otp_tokens_lookup');
SET @sql := IF(@has=0, 'CREATE INDEX idx_otp_tokens_lookup ON otp_tokens(purpose, email, institution_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='otp_tokens' AND INDEX_NAME='idx_otp_tokens_expires_at');
SET @sql := IF(@has=0, 'CREATE INDEX idx_otp_tokens_expires_at ON otp_tokens(expires_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='otp_tokens' AND INDEX_NAME='idx_otp_tokens_created_at');
SET @sql := IF(@has=0, 'CREATE INDEX idx_otp_tokens_created_at ON otp_tokens(created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='otp_tokens' AND INDEX_NAME='idx_otp_tokens_user_id');
SET @sql := IF(@has=0, 'CREATE INDEX idx_otp_tokens_user_id ON otp_tokens(user_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
