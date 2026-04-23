-- Simplify otp_tokens.id: drop the UUID PK and use a plain BIGINT AUTO_INCREMENT.
--
-- Rationale: OTP rows are short-lived (5-minute TTL) and only referenced
-- internally by otp.service.js. A UUID primary key bought us nothing, while
-- an AUTO_INCREMENT id doubles as a monotonic "latest OTP" marker — no
-- separate `seq` column needed.
--
-- Safe because:
--   * OTPs are ephemeral. Truncating clears at most 5 minutes of codes;
--     anyone mid-flow can just click "resend".
--   * No FKs reference otp_tokens anywhere in the schema.
--
-- Idempotent: checks current column type and only rewrites if needed.

SET @db := DATABASE();

-- Drop the previous `seq` helper column if the older migration added it.
SET @has_seq := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'otp_tokens' AND COLUMN_NAME = 'seq'
);
SET @sql := IF(@has_seq > 0, 'ALTER TABLE otp_tokens DROP COLUMN seq', 'SELECT "otp_tokens.seq already absent" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Drop the composite helper index from the seq migration if it exists.
SET @has_idx := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'otp_tokens' AND INDEX_NAME = 'idx_otp_tokens_lookup_seq'
);
SET @sql := IF(@has_idx > 0, 'DROP INDEX idx_otp_tokens_lookup_seq ON otp_tokens', 'SELECT "idx_otp_tokens_lookup_seq already absent" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Convert id from VARCHAR(36) to BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY.
-- Detect the current type; only rewrite when still varchar.
SET @id_type := (
  SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'otp_tokens' AND COLUMN_NAME = 'id'
);

-- Clear ephemeral rows so legacy UUID strings don't block the type change.
SET @sql := IF(@id_type LIKE 'varchar%', 'TRUNCATE TABLE otp_tokens', 'SELECT "otp_tokens.id already numeric" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(@id_type LIKE 'varchar%', 'ALTER TABLE otp_tokens MODIFY COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT', 'SELECT "otp_tokens.id already numeric" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
