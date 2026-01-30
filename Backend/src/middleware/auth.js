const authService = require('../services/authService');
const logger = require('../utils/logger');

// Extract institution context from request
const extractInstitutionContext = async (req, res, next) => {
  try {
    let institutionId = null;
    let subdomain = null;

    // Method 1: From JWT token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = await authService.verifyToken(token);
        institutionId = decoded.institutionId;
        req.user = decoded;
      } catch (error) {
        // Check if token is expired
        if (error.name === 'TokenExpiredError' || error.message.includes('expired')) {
          return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
        }
        // Token invalid, continue to other methods
      }
    }

    // Method 2: From subdomain
    if (!institutionId) {
      const host = req.get('host');
      if (host) {
        const parts = host.split('.');
        if (parts.length > 2) {
          subdomain = parts[0];
          const institution = await authService.getInstitutionByEmail(subdomain);
          if (institution) {
            institutionId = institution.id;
            req.institution = institution;
          }
        }
      }
    }

    // Method 3: From header
    if (!institutionId) {
      institutionId = req.headers['x-institution-id'];
    }

    if (!institutionId) {
      return res.status(400).json({ error: 'Institution context required' });
    }

    req.institutionId = institutionId;
    next();
  } catch (error) {
    logger.error('Error extracting institution context', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Require authentication
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const decoded = await authService.verifyToken(token);
    
    req.user = decoded;
    req.institutionId = decoded.institutionId;
    
    // Debug logging
    logger.info('Authentication successful', {
      userId: decoded.userId,
      institutionId: decoded.institutionId,
      path: req.path,
      method: req.method
    });
    
    next();
  } catch (error) {
    logger.error('Authentication failed', { error: error.message, path: req.path });
    
    // Check if token is expired
    if (error.name === 'TokenExpiredError' || error.message.includes('expired')) {
      return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
    }
    
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Check permissions
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
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
      userPermissions: Object.keys(userPermissions),
      path: req.path,
      method: req.method
    });

    res.status(403).json({ 
      error: 'Insufficient permissions',
      required: permission
    });
  };
};

// Check warehouse access
const requireWarehouseAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const warehouseId = req.params.warehouseId || req.body.warehouseId;
  if (!warehouseId) {
    return next(); // No warehouse specified, continue
  }

  // Admin has access to all warehouses
  if (req.user.role === 'admin') {
    return next();
  }

  const warehouseAccess = req.user.warehouseAccess || [];
  if (warehouseAccess.length === 0 || warehouseAccess.includes(warehouseId)) {
    return next();
  }

  res.status(403).json({ error: 'Warehouse access denied' });
};

// Validate institution consistency
const validateInstitutionConsistency = (req, res, next) => {
  // Ensure all institution-related data in request matches the authenticated institution
  const authenticatedInstitutionId = req.institutionId;
  
  // Check body
  if (req.body && req.body.institutionId && req.body.institutionId !== authenticatedInstitutionId) {
    return res.status(400).json({ error: 'Institution ID mismatch' });
  }

  // Check params
  if (req.params && req.params.institutionId && req.params.institutionId !== authenticatedInstitutionId) {
    return res.status(400).json({ error: 'Institution ID mismatch' });
  }

  // Ensure institution ID is set in request body for database operations
  if (req.body && typeof req.body === 'object') {
    req.body.institutionId = authenticatedInstitutionId;
  }

  next();
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
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((validRequests[0] - windowStart) / 1000)
      });
    }

    validRequests.push(now);
    rateLimitStore.set(institutionId, validRequests);
    
    next();
  };
};

// Audit logging middleware
const auditLog = (action) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
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
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

module.exports = {
  extractInstitutionContext,
  requireAuth,
  requirePermission,
  requireWarehouseAccess,
  validateInstitutionConsistency,
  createInstitutionRateLimit,
  auditLog
};