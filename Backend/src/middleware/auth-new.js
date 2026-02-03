const jwt = require('jsonwebtoken');
const config = require('../config');
const authService = require('../services/authService-new');
const logger = require('../utils/logger');

// Extract institution context from JWT token
const extractInstitutionContext = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    const token = authHeader.substring(7);
    const decoded = await authService.verifyToken(token);
    
    // Set both new and old properties for backward compatibility
    req.institutionId = decoded.institutionId;
    req.institutionId = decoded.institutionId; // Backward compatibility
    req.user = {
      userId: decoded.userId,
      institutionId: decoded.institutionId,
      institutionId: decoded.institutionId, // Backward compatibility
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || {},
      warehouseAccess: decoded.warehouseAccess || []
    };

    logger.debug('Institution context extracted', {
      userId: decoded.userId,
      institutionId: decoded.institutionId,
      email: decoded.email,
      role: decoded.role
    });

    next();
  } catch (error) {
    logger.error('Failed to extract institution context', { error: error.message });
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

// Backward compatibility - alias for extractInstitutionContext
const extractinstitutionContext = extractInstitutionContext;

// Require authentication
const requireAuth = async (req, res, next) => {
  if (!req.user || !req.user.userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  next();
};

// Require specific permission
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userPermissions = req.user.permissions || {};
    
    // Admin has all permissions
    if (req.user.role === 'admin' || userPermissions.all === true) {
      return next();
    }
    
    // Check specific permission
    if (userPermissions[permission] === true) {
      return next();
    }
    
    logger.warn('Permission denied', {
      userId: req.user.userId,
      institutionId: req.institutionId,
      requiredPermission: permission,
      userPermissions: Object.keys(userPermissions)
    });
    
    res.status(403).json({ 
      success: false,
      error: 'Insufficient permissions',
      required: permission
    });
  };
};

// Require specific role
const requireRole = (roles) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Role access denied', {
        userId: req.user.userId,
        institutionId: req.institutionId,
        userRole: req.user.role,
        requiredRoles: allowedRoles
      });
      
      return res.status(403).json({
        success: false,
        error: 'Insufficient role permissions',
        required: allowedRoles
      });
    }
    
    next();
  };
};

// Validate institution consistency (ensure user belongs to the institution)
const validateInstitutionConsistency = async (req, res, next) => {
  try {
    if (!req.institutionId || !req.user) {
      return next();
    }

    // Verify user belongs to the institution
    if (req.user.institutionId !== req.institutionId) {
      logger.error('Institution consistency violation', {
        userId: req.user.userId,
        userInstitutionId: req.user.institutionId,
        requestInstitutionId: req.institutionId
      });
      
      return res.status(403).json({
        success: false,
        error: 'Institution access violation'
      });
    }

    next();
  } catch (error) {
    logger.error('Institution consistency check failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Backward compatibility - alias for validateInstitutionConsistency
const validateinstitutionConsistency = validateInstitutionConsistency;

// Check warehouse access for inventory operations
const requireWarehouseAccess = (warehouseIdParam = 'warehouseId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Admin has access to all warehouses
    if (req.user.role === 'admin') {
      return next();
    }

    const warehouseId = req.params[warehouseIdParam] || req.body.warehouseId || req.query.warehouseId;
    const userWarehouseAccess = req.user.warehouseAccess || [];

    // If no specific warehouse is being accessed, allow (will be filtered in service layer)
    if (!warehouseId) {
      return next();
    }

    // Check if user has access to this warehouse
    if (!userWarehouseAccess.includes(warehouseId)) {
      logger.warn('Warehouse access denied', {
        userId: req.user.userId,
        institutionId: req.institutionId,
        requestedWarehouse: warehouseId,
        userWarehouseAccess
      });
      
      return res.status(403).json({
        success: false,
        error: 'Warehouse access denied',
        warehouseId
      });
    }

    next();
  };
};

// Rate limiting middleware (basic implementation)
const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const key = req.ip + ':' + (req.user?.userId || 'anonymous');
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old entries
    if (requests.has(key)) {
      const userRequests = requests.get(key).filter(time => time > windowStart);
      requests.set(key, userRequests);
    } else {
      requests.set(key, []);
    }
    
    const userRequests = requests.get(key);
    
    if (userRequests.length >= maxRequests) {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userId: req.user?.userId,
        requests: userRequests.length,
        maxRequests
      });
      
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    userRequests.push(now);
    next();
  };
};

// Session timeout check
const checkSessionTimeout = (timeoutMs = 15 * 60 * 1000) => {
  return (req, res, next) => {
    if (!req.user || !req.user.sessionTimestamp) {
      return next();
    }
    
    const sessionAge = Date.now() - req.user.sessionTimestamp;
    if (sessionAge > timeoutMs) {
      logger.info('Session expired due to timeout', {
        userId: req.user.userId,
        sessionAge: Math.floor(sessionAge / 1000) + 's'
      });
      
      return res.status(401).json({
        success: false,
        error: 'Session expired due to inactivity',
        code: 'SESSION_TIMEOUT'
      });
    }
    
    next();
  };
};

module.exports = {
  extractInstitutionContext,
  extractinstitutionContext, // Backward compatibility
  requireAuth,
  requirePermission,
  requireRole,
  validateInstitutionConsistency,
  validateinstitutionConsistency, // Backward compatibility
  requireWarehouseAccess,
  rateLimit,
  checkSessionTimeout
};