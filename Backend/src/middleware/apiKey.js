const crypto = require('crypto');
const db = require('../database/connection');
const logger = require('../utils/logger');

// Generate API key
const generateApiKey = () => {
  return 'ims_' + crypto.randomBytes(32).toString('hex');
};

// Validate API key middleware
const validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required'
      });
    }

    // Check if API key exists and is active
    const keys = await db.query(
      'SELECT ak.*, t.id as tenant_id, t.name as tenant_name FROM api_keys ak JOIN tenants t ON ak.tenant_id = t.id WHERE ak.key_value = ? AND ak.status = "active"',
      [apiKey]
    );

    if (keys.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    const keyData = keys[0];

    // Update last used timestamp
    await db.query(
      'UPDATE api_keys SET last_used_at = NOW(), usage_count = usage_count + 1 WHERE id = ?',
      [keyData.id]
    );

    // Set tenant context
    req.tenantId = keyData.tenant_id;
    req.apiKey = {
      id: keyData.id,
      name: keyData.name,
      permissions: JSON.parse(keyData.permissions || '{}')
    };

    logger.info('API key authenticated', {
      keyId: keyData.id,
      tenantId: keyData.tenant_id,
      path: req.path
    });

    next();
  } catch (error) {
    logger.error('API key validation failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

module.exports = {
  generateApiKey,
  validateApiKey
};