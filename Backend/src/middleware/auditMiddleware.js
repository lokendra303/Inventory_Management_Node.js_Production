const auditLogService = require('../modules/audit/auditLog.service');
const logger = require('../utils/logger');

// Enhanced audit middleware that captures all user actions
const auditMiddleware = (options = {}) => {
  return (req, res, next) => {
    // Skip audit for certain routes
    const skipRoutes = options.skipRoutes || ['/health', '/api/auth/verify'];
    if (skipRoutes.some(route => req.path.includes(route))) {
      return next();
    }

    // Store original response methods
    const originalSend = res.send;
    const originalJson = res.json;

    // Capture request start time
    const startTime = Date.now();

    // Override response methods to capture audit data
    res.send = function(data) {
      res.send = originalSend;
      captureAuditLog(req, res, data, startTime);
      return originalSend.call(this, data);
    };

    res.json = function(data) {
      res.json = originalJson;
      captureAuditLog(req, res, data, startTime);
      return originalJson.call(this, data);
    };

    next();
  };
};

// Capture and log audit information
const captureAuditLog = async (req, res, responseData, startTime) => {
  try {
    // Only log if we have user context and it's a modifying operation
    if (!req.user && !req.serviceAccount) return;
    if (!shouldAuditRequest(req, res)) return;

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Extract entity information from request
    const entityInfo = extractEntityInfo(req);
    
    // Determine action type
    const action = determineAction(req.method, req.path, responseData);
    
    // Capture changes if available
    const changes = captureChanges(req, responseData);

    // Create audit log entry
    await auditLogService.logUserAction({
      institutionId: req.institutionId,
      userId: req.user?.userId || null,
      serviceAccountId: req.serviceAccount?.jti || null,
      entityType: entityInfo.type,
      entityId: entityInfo.id,
      action: action,
      method: req.method,
      path: req.path,
      changes: changes,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration: duration,
      requestBody: sanitizeRequestBody(req.body),
      description: generateDescription(action, entityInfo, req.user)
    });

  } catch (error) {
    logger.error('Audit logging failed', { 
      error: error.message,
      path: req.path,
      method: req.method,
      userId: req.user?.userId
    });
  }
};

// Determine if request should be audited
const shouldAuditRequest = (req, res) => {
  // Only audit successful operations and client errors (not server errors)
  if (res.statusCode >= 500) return false;
  
  // Audit all modifying operations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return true;
  
  // Audit sensitive GET operations
  const sensitiveGetPaths = [
    '/api/reports',
    '/api/accounting',
    '/api/audit',
    '/api/users',
    '/api/settings'
  ];
  
  return sensitiveGetPaths.some(path => req.path.includes(path));
};

// Extract entity information from request
const extractEntityInfo = (req) => {
  const path = req.path;
  
  // Common entity patterns
  const patterns = [
    { regex: /\/api\/items\/([^\/]+)/, type: 'item' },
    { regex: /\/api\/customers\/([^\/]+)/, type: 'customer' },
    { regex: /\/api\/vendors\/([^\/]+)/, type: 'vendor' },
    { regex: /\/api\/invoices\/([^\/]+)/, type: 'invoice' },
    { regex: /\/api\/purchase-orders\/([^\/]+)/, type: 'purchase_order' },
    { regex: /\/api\/sales-orders\/([^\/]+)/, type: 'sales_order' },
    { regex: /\/api\/inventory\/([^\/]+)/, type: 'inventory' },
    { regex: /\/api\/warehouses\/([^\/]+)/, type: 'warehouse' },
    { regex: /\/api\/users\/([^\/]+)/, type: 'user' },
    { regex: /\/api\/categories\/([^\/]+)/, type: 'category' },
    { regex: /\/api\/brands\/([^\/]+)/, type: 'brand' },
    { regex: /\/api\/manufacturers\/([^\/]+)/, type: 'manufacturer' }
  ];

  for (const pattern of patterns) {
    const match = path.match(pattern.regex);
    if (match) {
      return { type: pattern.type, id: match[1] };
    }
  }

  // Extract from request body if available
  if (req.body) {
    if (req.body.itemId) return { type: 'item', id: req.body.itemId };
    if (req.body.customerId) return { type: 'customer', id: req.body.customerId };
    if (req.body.vendorId) return { type: 'vendor', id: req.body.vendorId };
    if (req.body.invoiceId) return { type: 'invoice', id: req.body.invoiceId };
  }

  // Default to path-based type
  const pathParts = path.split('/').filter(p => p);
  if (pathParts.length >= 2) {
    return { type: pathParts[1], id: pathParts[2] || null };
  }

  return { type: 'unknown', id: null };
};

// Determine action type based on method and response
const determineAction = (method, path, responseData) => {
  const baseAction = {
    'POST': 'create',
    'PUT': 'update',
    'PATCH': 'update',
    'DELETE': 'delete',
    'GET': 'view'
  }[method] || 'unknown';

  // Special cases
  if (path.includes('/login')) return 'login';
  if (path.includes('/logout')) return 'logout';
  if (path.includes('/approve')) return 'approve';
  if (path.includes('/reject')) return 'reject';
  if (path.includes('/cancel')) return 'cancel';
  if (path.includes('/confirm')) return 'confirm';
  if (path.includes('/payment')) return 'payment';
  if (path.includes('/transfer')) return 'transfer';
  if (path.includes('/adjustment')) return 'adjustment';

  return baseAction;
};

// Capture changes from request and response
const captureChanges = (req, responseData) => {
  const changes = {};

  // Capture request body changes
  if (req.body && typeof req.body === 'object') {
    changes.input = sanitizeRequestBody(req.body);
  }

  // Capture response data if it contains useful change information
  if (responseData && typeof responseData === 'object') {
    try {
      const parsed = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      if (parsed.data && typeof parsed.data === 'object') {
        changes.result = sanitizeResponseData(parsed.data);
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
};

// Sanitize request body to remove sensitive information
const sanitizeRequestBody = (body) => {
  if (!body || typeof body !== 'object') return body;

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
};

// Sanitize response data
const sanitizeResponseData = (data) => {
  if (!data || typeof data !== 'object') return data;

  const sanitized = { ...data };
  const sensitiveFields = ['password', 'token', 'secret', 'key'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
};

// Generate human-readable description
const generateDescription = (action, entityInfo, user) => {
  const userName = user ? `${user.email}` : 'System';
  const entityName = entityInfo.id ? `${entityInfo.type} (${entityInfo.id})` : entityInfo.type;
  
  const actionDescriptions = {
    'create': `Created ${entityName}`,
    'update': `Updated ${entityName}`,
    'delete': `Deleted ${entityName}`,
    'view': `Viewed ${entityName}`,
    'login': 'User logged in',
    'logout': 'User logged out',
    'approve': `Approved ${entityName}`,
    'reject': `Rejected ${entityName}`,
    'payment': `Processed payment for ${entityName}`,
    'transfer': `Transferred ${entityName}`,
    'adjustment': `Made adjustment to ${entityName}`
  };

  return actionDescriptions[action] || `Performed ${action} on ${entityName}`;
};

module.exports = auditMiddleware;