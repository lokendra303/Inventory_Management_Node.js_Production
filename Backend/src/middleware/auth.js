const authService = require('../services/authService');
const logger = require('../utils/logger');

// Extract tenant context from request
const extractTenantContext = async (req, res, next) => {
  try {
    let tenantId = null;
    let subdomain = null;

    // Method 1: From JWT token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = await authService.verifyToken(token);
        tenantId = decoded.tenantId;
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
    if (!tenantId) {
      const host = req.get('host');
      if (host) {
        const parts = host.split('.');
        if (parts.length > 2) {
          subdomain = parts[0];
          const tenant = await authService.getTenantBySubdomain(subdomain);
          if (tenant) {
            tenantId = tenant.id;
            req.tenant = tenant;
          }
        }
      }
    }

    // Method 3: From header
    if (!tenantId) {
      tenantId = req.headers['x-tenant-id'];
    }

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    req.tenantId = tenantId;
    next();
  } catch (error) {
    logger.error('Error extracting tenant context', { error: error.message });
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
    req.tenantId = decoded.tenantId;
    
    // Debug logging
    logger.info('Authentication successful', {
      userId: decoded.userId,
      tenantId: decoded.tenantId,
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
      tenantId: req.tenantId,
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

// Validate tenant consistency
const validateTenantConsistency = (req, res, next) => {
  // Ensure all tenant-related data in request matches the authenticated tenant
  const authenticatedTenantId = req.tenantId;
  
  // Check body
  if (req.body && req.body.tenantId && req.body.tenantId !== authenticatedTenantId) {
    return res.status(400).json({ error: 'Tenant ID mismatch' });
  }

  // Check params
  if (req.params && req.params.tenantId && req.params.tenantId !== authenticatedTenantId) {
    return res.status(400).json({ error: 'Tenant ID mismatch' });
  }

  // Ensure tenant ID is set in request body for database operations
  if (req.body && typeof req.body === 'object') {
    req.body.tenantId = authenticatedTenantId;
  }

  next();
};

// Rate limiting per tenant
const createTenantRateLimit = (windowMs, max) => {
  const rateLimitStore = new Map();

  return (req, res, next) => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return next();
    }

    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!rateLimitStore.has(tenantId)) {
      rateLimitStore.set(tenantId, []);
    }

    const requests = rateLimitStore.get(tenantId);
    
    // Remove old requests
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length >= max) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((validRequests[0] - windowStart) / 1000)
      });
    }

    validRequests.push(now);
    rateLimitStore.set(tenantId, validRequests);
    
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
          tenantId: req.tenantId,
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
  extractTenantContext,
  requireAuth,
  requirePermission,
  requireWarehouseAccess,
  validateTenantConsistency,
  createTenantRateLimit,
  auditLog
};