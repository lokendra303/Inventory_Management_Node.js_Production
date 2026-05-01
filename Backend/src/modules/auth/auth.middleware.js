const jwt = require('jsonwebtoken');
const authService = require('./auth.service');
const serviceAccountService = require('./serviceAccount.service');
const logger = require('../../utils/logger');

// Extract institution context from JWT token (supports both user and service account tokens)
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
    
    // Try to decode token to check type
    let decoded;
    try {
      decoded = jwt.decode(token);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token format'
      });
    }

    // Check if it's a service account token
    if (decoded && decoded.type === 'service_account') {
      const serviceDecoded = await serviceAccountService.verifyServiceToken(token);
      
      req.institutionId = serviceDecoded.institutionId;
      req.serviceAccount = {
        jti: serviceDecoded.jti,
        name: serviceDecoded.serviceName,
        permissions: serviceDecoded.permissions || {}
      };

      logger.debug('Service account authenticated', {
        serviceName: serviceDecoded.serviceName,
        institutionId: serviceDecoded.institutionId
      });
    } else {
      // Regular user JWT
      const userDecoded = await authService.verifyToken(token);
      
      req.institutionId = userDecoded.institutionId;
      req.user = {
        userId: userDecoded.userId,
        institutionId: userDecoded.institutionId,
        email: userDecoded.email,
        role: userDecoded.role,
        permissions: userDecoded.permissions || {},
        warehouseAccess: userDecoded.warehouseAccess || []
      };

      logger.debug('User authenticated', {
        userId: userDecoded.userId,
        institutionId: userDecoded.institutionId,
        email: userDecoded.email,
        role: userDecoded.role
      });
    }

    next();
  } catch (error) {
    logger.error('Failed to extract institution context', { error: error.message });
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

// Require authentication (accepts both user and service account)
const requireAuth = async (req, res, next) => {
  if (!req.user && !req.serviceAccount) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  next();
};

// Require specific permission (supports both user and service account)
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user && !req.serviceAccount) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check service account permissions
    if (req.serviceAccount) {
      const servicePermissions = req.serviceAccount.permissions || {};
      
      if (servicePermissions.all === true || servicePermissions[permission] === true) {
        return next();
      }
      
      logger.warn('Service account permission denied', {
        serviceName: req.serviceAccount.name,
        institutionId: req.institutionId,
        requiredPermission: permission,
        servicePermissions: Object.keys(servicePermissions)
      });
      
      return res.status(403).json({ 
        success: false,
        error: 'Insufficient permissions',
        required: permission
      });
    }

    // Check user permissions
    const userPermissions = req.user.permissions || {};
    
    // Admin has all permissions
    if (req.user.role === 'admin' || req.user.role === 'super_admin' || userPermissions.all === true) {
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

// Validate institution consistency (ensure user/service account belongs to the institution)
const validateInstitutionConsistency = async (req, res, next) => {
  try {
    if (!req.institutionId) {
      return next();
    }

    // Service accounts are already validated by their JWT
    if (req.serviceAccount) {
      return next();
    }

    // Verify user belongs to the institution
    if (req.user && req.user.institutionId !== req.institutionId) {
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
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
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
    // Use IP as primary key, userId as secondary if available
    // This prevents issues when rate limit runs before auth middleware
    const userId = req.user?.userId || req.serviceAccount?.jti || 'anon';
    const key = `${req.ip}:${userId}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old entries
    if (requests.has(key)) {
      const userRequests = requests.get(key).filter(time => time > windowStart);
      if (userRequests.length === 0) {
        requests.delete(key);
      } else {
        requests.set(key, userRequests);
      }
    } else {
      requests.set(key, []);
    }
    
    const userRequests = requests.get(key) || [];
    
    if (userRequests.length >= maxRequests) {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userId: req.user?.userId,
        serviceAccount: req.serviceAccount?.name,
        requests: userRequests.length,
        maxRequests,
        windowMs,
        key
      });
      
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    userRequests.push(now);
    requests.set(key, userRequests);
    
    // Periodic cleanup of stale entries (every 100th request)
    if (Math.random() < 0.01) {
      for (const [k, reqs] of requests.entries()) {
        if (reqs.every(timestamp => timestamp <= windowStart)) {
          requests.delete(k);
        }
      }
    }
    
    next();
  };
};

// Rate limiting per institution
const createInstitutionRateLimit = (windowMs, max) => {
  const rateLimitStore = new Map();

  return (req, res, next) => {
    const institutionId = req.institutionId;
    if (!institutionId) {
      return next();
    }

    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!rateLimitStore.has(institutionId)) {
      rateLimitStore.set(institutionId, []);
    }

    const requests = rateLimitStore.get(institutionId);
    
    // Remove old requests
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length >= max) {
      logger.warn('Institution rate limit exceeded', {
        institutionId,
        requests: validRequests.length,
        max,
        windowMs,
        userId: req.user?.userId,
        serviceAccount: req.serviceAccount?.name
      });
      
      return res.status(429).json({ 
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((validRequests[0] + windowMs - now) / 1000)
      });
    }

    validRequests.push(now);
    rateLimitStore.set(institutionId, validRequests);
    
    // Periodic cleanup of empty entries (every 100th request)
    if (Math.random() < 0.01) {
      for (const [id, reqs] of rateLimitStore.entries()) {
        if (reqs.every(timestamp => timestamp <= windowStart)) {
          rateLimitStore.delete(id);
        }
      }
    }
    
    next();
  };
};

// Audit logging middleware
const auditLog = (action) => {
  return (req, res, next) => {
    // Used by auditMiddleware (DB audit_logs): semantic action from route (e.g. item_updated).
    req.auditRouteAction = action;

    const originalSend = res.send;
    
    res.send = function(data) {
      res.send = originalSend;
      
      // Log the action after response
      setImmediate(() => {
        logger.info('Audit log', {
          action,
          institutionId: req.institutionId,
          userId: req.user?.userId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      });
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

module.exports = {
  extractInstitutionContext,
  requireAuth,
  requirePermission,
  requireRole,
  validateInstitutionConsistency,
  requireWarehouseAccess,
  rateLimit,
  checkSessionTimeout: (timeoutMs = parseInt(process.env.SESSION_TIMEOUT_MS)) => {
    return (req, res, next) => {
      if (!req.user || !req.user.sessionTimestamp) {
        return next();
      }

      const now = Date.now();
      const sessionAge = now - req.user.sessionTimestamp;

      if (sessionAge > timeoutMs) {
        logger.warn('Session timeout', {
          userId: req.user.userId,
          sessionAge,
          timeoutMs
        });
        
        return res.status(401).json({
          success: false,
          error: 'Session expired due to inactivity',
          code: 'SESSION_TIMEOUT'
        });
      }

      next();
    };
  },
  createInstitutionRateLimit,
  auditLog
};