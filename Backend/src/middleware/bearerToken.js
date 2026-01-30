const crypto = require('crypto');
const db = require('../database/connection');
const logger = require('../utils/logger');

// Generate random Bearer token
const generateBearerToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Validate Bearer token middleware
const validateBearerToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Bearer token required'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Check if token exists and is active
    const tokens = await db.query(
      'SELECT bt.*, t.id as institution_id, t.name as institution_name FROM bearer_tokens bt JOIN institutions t ON bt.institution_id = t.id WHERE bt.token_value = ? AND bt.status = "active" AND (bt.expires_at IS NULL OR bt.expires_at > NOW())',
      [token]
    );

    if (tokens.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired Bearer token'
      });
    }

    const tokenData = tokens[0];

    // Update last used timestamp
    await db.query(
      'UPDATE bearer_tokens SET last_used_at = NOW(), usage_count = usage_count + 1 WHERE id = ?',
      [tokenData.id]
    );

    // Set institution context
    req.institutionId = tokenData.institution_id;
    req.bearerToken = {
      id: tokenData.id,
      name: tokenData.name,
      permissions: JSON.parse(tokenData.permissions || '{}')
    };

    logger.info('Bearer token authenticated', {
      tokenId: tokenData.id,
      institutionId: tokenData.institution_id,
      path: req.path
    });

    next();
  } catch (error) {
    logger.error('Bearer token validation failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

module.exports = {
  generateBearerToken,
  validateBearerToken
};