const jwt = require('jsonwebtoken');
const platformAdminService = require('./platformAdmin.service');
const logger = require('../../utils/logger');

/**
 * Attach req.platformAdmin from Bearer JWT (type: platform_admin).
 */
async function requirePlatformAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authorization token required' });
    }
    const token = authHeader.substring(7);
    const ctx = await platformAdminService.verifyPlatformToken(token);
    req.platformAdmin = {
      id: ctx.admin.id,
      email: ctx.admin.email,
      name: ctx.admin.name,
    };
    next();
  } catch (error) {
    logger.warn('Platform auth failed', { error: error.message });
    return res.status(401).json({ success: false, error: 'Invalid or expired platform session' });
  }
}

/**
 * Optional: decode without DB lookup (for logging only).
 */
function decodePlatformToken(token) {
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
}

module.exports = { requirePlatformAuth, decodePlatformToken };
