const db = require('../../database/connection');
const logger = require('../../utils/logger');

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * OtpService — persists one-time passwords to the `otp_tokens` MySQL table
 * instead of keeping them in process memory.
 *
 * The table must be created manually via the migration file:
 *   Backend/src/database/migrations/create_otp_tokens_table.sql
 * This service does NOT auto-create the table at runtime.
 *
 * NOTE: OTPs are stored in plaintext (`otp_code`). Anyone with read access
 * to the `otp_tokens` table can see active codes — protect DB access
 * accordingly. Revisit to hash if/when security requirements tighten.
 *
 * Each record tracks purpose ('login' | 'registration' | 'password_reset' | 'two_factor_enable'),
 * the target email/institution/user, attempt count, expiry, and consumption.
 */
class OtpService {
  /**
   * Store a freshly-issued OTP. Any prior un-consumed OTP for the same
   * (purpose, email, institutionId) is invalidated so only the newest one
   * can be redeemed.
   */
  async createOtp({
    purpose,
    email,
    otp,
    institutionId = null,
    userId = null,
    ttlMs = DEFAULT_TTL_MS,
    ipAddress = null
  }) {
    if (!purpose || !email || !otp) {
      throw new Error('purpose, email, and otp are required to create an OTP');
    }

    await db.query(
      `DELETE FROM otp_tokens 
       WHERE purpose = ? AND email = ? AND (institution_id <=> ?) AND consumed_at IS NULL`,
      [purpose, email, institutionId]
    );

    const expiresAt = new Date(Date.now() + ttlMs);

    const result = await db.query(
      `INSERT INTO otp_tokens 
       (purpose, email, institution_id, user_id, otp_code, expires_at, ip_address, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [purpose, email, institutionId, userId, otp, expiresAt, ipAddress]
    );

    return result.insertId;
  }

  /**
   * Verify an OTP. On success the record is marked consumed and returned.
   * On failure the attempt counter is incremented; once it hits
   * `maxAttempts` the record is purged so the user must request a new OTP.
   */
  async verifyOtp({
    purpose,
    email,
    otp,
    institutionId = null,
    maxAttempts = DEFAULT_MAX_ATTEMPTS
  }) {
    const rows = await db.query(
      `SELECT id, user_id, institution_id, otp_code, attempts, expires_at, consumed_at
         FROM otp_tokens 
        WHERE purpose = ? AND email = ? AND (institution_id <=> ?) AND consumed_at IS NULL
        ORDER BY id DESC LIMIT 1`,
      [purpose, email, institutionId]
    );

    if (rows.length === 0) {
      throw new Error('OTP not found or already used. Please request a new OTP.');
    }

    const record = rows[0];

    if (new Date() > new Date(record.expires_at)) {
      await db.query('DELETE FROM otp_tokens WHERE id = ?', [record.id]);
      throw new Error('OTP has expired. Please request a new OTP.');
    }

    if (record.attempts >= maxAttempts) {
      await db.query('DELETE FROM otp_tokens WHERE id = ?', [record.id]);
      throw new Error('Too many failed attempts. Please request a new OTP.');
    }

    if (String(record.otp_code) !== String(otp)) {
      await db.query(
        'UPDATE otp_tokens SET attempts = attempts + 1 WHERE id = ?',
        [record.id]
      );
      throw new Error('Invalid OTP.');
    }

    await db.query(
      'UPDATE otp_tokens SET consumed_at = NOW() WHERE id = ?',
      [record.id]
    );

    return {
      userId: record.user_id,
      institutionId: record.institution_id
    };
  }

  /**
   * Housekeeping helper: drops expired and long-consumed OTP rows.
   * Safe to call periodically from a cron job.
   */
  async cleanupExpired() {
    try {
      const result = await db.query(
        `DELETE FROM otp_tokens 
          WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)
             OR (consumed_at IS NOT NULL AND consumed_at < DATE_SUB(NOW(), INTERVAL 1 DAY))`
      );
      return result.affectedRows || 0;
    } catch (error) {
      logger.error('Failed to cleanup expired OTPs', { error: error.message });
      return 0;
    }
  }
}

module.exports = new OtpService();
