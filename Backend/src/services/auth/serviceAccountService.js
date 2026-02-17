const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const config = require('../../config');
const logger = require('../../utils/logger');

class ServiceAccountService {
  // Generate long-lived JWT for service accounts
  generateServiceToken(serviceAccountData) {
    const { institutionId, serviceName, permissions, expiresInDays = 365 } = serviceAccountData;
    
    const payload = {
      type: 'service_account',
      jti: uuidv4(), // JWT ID for revocation
      institutionId,
      serviceName,
      permissions: permissions || {}
    };

    const options = {
      expiresIn: `${expiresInDays}d`
    };

    const token = jwt.sign(payload, config.jwt.secret, options);
    
    logger.info('Service account token generated', { 
      institutionId, 
      serviceName,
      expiresInDays 
    });
    
    return { token, jti: payload.jti };
  }

  // Verify service account JWT
  async verifyServiceToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      
      // Check if it's a service account token
      if (decoded.type !== 'service_account') {
        throw new Error('Not a service account token');
      }

      // Check if token is revoked
      const revoked = await this.isTokenRevoked(decoded.jti);
      if (revoked) {
        throw new Error('Token has been revoked');
      }

      // Verify institution still exists and is active
      const institutions = await db.query(
        'SELECT id, status FROM institutions WHERE id = ?',
        [decoded.institutionId]
      );

      if (institutions.length === 0 || institutions[0].status !== 'active') {
        throw new Error('Institution not found or inactive');
      }

      // Update last used timestamp
      await this.updateTokenUsage(decoded.jti);

      return decoded;
    } catch (error) {
      logger.error('Service token verification failed', { error: error.message });
      throw new Error('Invalid or expired service token');
    }
  }

  // Create service account in database
  async createServiceAccount(institutionId, serviceAccountData, createdBy) {
    const { name, permissions = {}, expiresInDays = 365 } = serviceAccountData;
    
    const serviceAccountId = uuidv4();
    const { token, jti } = this.generateServiceToken({
      institutionId,
      serviceName: name,
      permissions,
      expiresInDays
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    await db.query(
      `INSERT INTO service_accounts (id, institution_id, name, jti, permissions, status, expires_at, created_by) 
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
      [serviceAccountId, institutionId, name, jti, JSON.stringify(permissions), expiresAt, createdBy]
    );

    logger.info('Service account created', { serviceAccountId, institutionId, name });
    
    return {
      id: serviceAccountId,
      name,
      token,
      permissions,
      expiresAt
    };
  }

  // Get all service accounts for institution
  async getServiceAccounts(institutionId) {
    const accounts = await db.query(
      `SELECT id, name, permissions, status, expires_at, created_at, last_used_at, usage_count 
       FROM service_accounts 
       WHERE institution_id = ? 
       ORDER BY created_at DESC`,
      [institutionId]
    );

    return accounts;
  }

  // Revoke service account token
  async revokeServiceAccount(institutionId, serviceAccountId) {
    const result = await db.query(
      'UPDATE service_accounts SET status = "revoked", updated_at = NOW() WHERE id = ? AND institution_id = ?',
      [serviceAccountId, institutionId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Service account not found');
    }

    logger.info('Service account revoked', { serviceAccountId, institutionId });
  }

  // Delete service account
  async deleteServiceAccount(institutionId, serviceAccountId) {
    const result = await db.query(
      'DELETE FROM service_accounts WHERE id = ? AND institution_id = ?',
      [serviceAccountId, institutionId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Service account not found');
    }

    logger.info('Service account deleted', { serviceAccountId, institutionId });
  }

  // Check if token is revoked
  async isTokenRevoked(jti) {
    const accounts = await db.query(
      'SELECT status FROM service_accounts WHERE jti = ?',
      [jti]
    );

    if (accounts.length === 0) {
      return false; // Token not in database, let JWT expiration handle it
    }

    return accounts[0].status === 'revoked';
  }

  // Update token usage statistics
  async updateTokenUsage(jti) {
    await db.query(
      'UPDATE service_accounts SET last_used_at = NOW(), usage_count = usage_count + 1 WHERE jti = ?',
      [jti]
    );
  }

  // Rotate service account token (generate new token, revoke old one)
  async rotateServiceAccount(institutionId, serviceAccountId) {
    // Get existing service account
    const accounts = await db.query(
      'SELECT name, permissions, expires_at FROM service_accounts WHERE id = ? AND institution_id = ?',
      [serviceAccountId, institutionId]
    );

    if (accounts.length === 0) {
      throw new Error('Service account not found');
    }

    const account = accounts[0];
    
    // Calculate remaining days until expiration
    const now = new Date();
    const expiresAt = new Date(account.expires_at);
    const remainingDays = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
    const expiresInDays = remainingDays > 0 ? remainingDays : 365;

    // Generate new token
    const { token, jti } = this.generateServiceToken({
      institutionId,
      serviceName: account.name,
      permissions: JSON.parse(account.permissions || '{}'),
      expiresInDays
    });

    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + expiresInDays);

    // Update with new JTI and reset usage stats
    await db.query(
      `UPDATE service_accounts 
       SET jti = ?, expires_at = ?, last_used_at = NULL, usage_count = 0, updated_at = NOW() 
       WHERE id = ? AND institution_id = ?`,
      [jti, newExpiresAt, serviceAccountId, institutionId]
    );

    logger.info('Service account token rotated', { serviceAccountId, institutionId });
    
    return {
      id: serviceAccountId,
      name: account.name,
      token,
      expiresAt: newExpiresAt
    };
  }
}

module.exports = new ServiceAccountService();
