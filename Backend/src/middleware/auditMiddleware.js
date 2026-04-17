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
  // req.path is relative to the router mount point (e.g. /exchange-rates, not /api/settings/exchange-rates)
  // req.originalUrl contains the full path — use that for matching
  const fullPath = req.originalUrl.split('?')[0]; // strip query string

  const patterns = [
    // Items
    { regex: /\/items\/draft/,                    type: 'item_draft',       idGroup: null },
    { regex: /\/items\/([a-f0-9-]{36})/,          type: 'item',             idGroup: 1 },
    { regex: /\/items/,                            type: 'item',             idGroup: null },
    // Customers
    { regex: /\/customers\/([a-f0-9-]{36})/,      type: 'customer',         idGroup: 1 },
    { regex: /\/customers/,                        type: 'customer',         idGroup: null },
    // Vendors
    { regex: /\/vendors\/([a-f0-9-]{36})/,        type: 'vendor',           idGroup: 1 },
    { regex: /\/vendors/,                          type: 'vendor',           idGroup: null },
    // Invoices
    { regex: /\/sales-invoices\/([a-f0-9-]{36})/, type: 'sales_invoice',    idGroup: 1 },
    { regex: /\/sales-invoices/,                   type: 'sales_invoice',    idGroup: null },
    { regex: /\/purchase-invoices\/([a-f0-9-]{36})/, type: 'purchase_invoice', idGroup: 1 },
    { regex: /\/purchase-invoices/,                type: 'purchase_invoice', idGroup: null },
    // Orders
    { regex: /\/sales-orders\/([a-f0-9-]{36})/,   type: 'sales_order',      idGroup: 1 },
    { regex: /\/sales-orders/,                     type: 'sales_order',      idGroup: null },
    { regex: /\/purchase-orders\/([a-f0-9-]{36})/, type: 'purchase_order',  idGroup: 1 },
    { regex: /\/purchase-orders/,                  type: 'purchase_order',   idGroup: null },
    // Inventory
    { regex: /\/inventory\/adjust/,               type: 'inventory',        idGroup: null },
    { regex: /\/inventory\/receive/,              type: 'inventory',        idGroup: null },
    { regex: /\/inventory\/transfer/,             type: 'inventory',        idGroup: null },
    { regex: /\/inventory\/([a-f0-9-]{36})/,      type: 'inventory',        idGroup: 1 },
    { regex: /\/inventory/,                        type: 'inventory',        idGroup: null },
    // Warehouses
    { regex: /\/warehouses\/([a-f0-9-]{36})/,     type: 'warehouse',        idGroup: 1 },
    { regex: /\/warehouses/,                       type: 'warehouse',        idGroup: null },
    // Users
    { regex: /\/users\/([a-f0-9-]{36})/,          type: 'user',             idGroup: 1 },
    { regex: /\/users/,                            type: 'user',             idGroup: null },
    // Settings
    { regex: /\/exchange-rates\/live-sync/,        type: 'exchange_rate',    idGroup: null },
    { regex: /\/exchange-rates\/live/,             type: 'exchange_rate',    idGroup: null },
    { regex: /\/exchange-rates/,                   type: 'exchange_rate',    idGroup: null },
    { regex: /\/company-settings/,                 type: 'company_settings', idGroup: null },
    { regex: /\/settings/,                         type: 'settings',         idGroup: null },
    // Tax
    { regex: /\/tax\/rates\/([a-f0-9-]{36})/,     type: 'tax_rate',         idGroup: 1 },
    { regex: /\/tax\/rates/,                       type: 'tax_rate',         idGroup: null },
    { regex: /\/tax\/groups\/([a-f0-9-]{36})/,    type: 'tax_group',        idGroup: 1 },
    { regex: /\/tax\/groups/,                      type: 'tax_group',        idGroup: null },
    // Price lists
    { regex: /\/price-lists\/([a-f0-9-]{36})\/items/, type: 'price_list_item', idGroup: 1 },
    { regex: /\/price-lists\/([a-f0-9-]{36})/,    type: 'price_list',       idGroup: 1 },
    { regex: /\/price-lists/,                      type: 'price_list',       idGroup: null },
    // Workflows
    { regex: /\/workflows\/([a-f0-9-]{36})\/toggle/, type: 'workflow',      idGroup: 1 },
    { regex: /\/workflows\/([a-f0-9-]{36})/,      type: 'workflow',         idGroup: 1 },
    { regex: /\/workflows/,                        type: 'workflow',         idGroup: null },
    // Subscription
    { regex: /\/subscription\/upgrade/,            type: 'subscription',     idGroup: null },
    { regex: /\/subscription/,                     type: 'subscription',     idGroup: null },
    // Onboarding
    { regex: /\/onboarding\/complete/,             type: 'onboarding',       idGroup: null },
    { regex: /\/onboarding\/dismiss/,              type: 'onboarding',       idGroup: null },
    { regex: /\/onboarding/,                       type: 'onboarding',       idGroup: null },
    // Audit
    { regex: /\/audit/,                            type: 'audit',            idGroup: null },
    // Reports
    { regex: /\/reports/,                          type: 'report',           idGroup: null },
    { regex: /\/analytics/,                        type: 'analytics',        idGroup: null },
    { regex: /\/profit-loss/,                      type: 'profit_loss',      idGroup: null },
    // Accounting
    { regex: /\/accounting/,                       type: 'accounting',       idGroup: null },
    // Documents
    { regex: /\/documents\/([a-f0-9-]{36})/,      type: 'document',         idGroup: 1 },
    { regex: /\/documents/,                        type: 'document',         idGroup: null },
    // Notifications
    { regex: /\/notifications/,                    type: 'notification',     idGroup: null },
    // Delivery challans
    { regex: /\/delivery-challans\/([a-f0-9-]{36})/, type: 'delivery_challan', idGroup: 1 },
    { regex: /\/delivery-challans/,                type: 'delivery_challan', idGroup: null },
    // Purchase returns
    { regex: /\/purchase-returns\/([a-f0-9-]{36})/, type: 'purchase_return', idGroup: 1 },
    { regex: /\/purchase-returns/,                 type: 'purchase_return',  idGroup: null },
    // Stock counts
    { regex: /\/stock-counts\/([a-f0-9-]{36})/,   type: 'stock_count',      idGroup: 1 },
    { regex: /\/stock-counts/,                     type: 'stock_count',      idGroup: null },
    // Reorder levels
    { regex: /\/reorder-levels/,                   type: 'reorder_level',    idGroup: null },
    // Batch serial
    { regex: /\/batch-serial/,                     type: 'batch_serial',     idGroup: null },
    // Transfer approvals
    { regex: /\/transfer-approvals/,               type: 'transfer_approval',idGroup: null },
    // Roles
    { regex: /\/roles/,                            type: 'role',             idGroup: null },
    // Categories / brands / manufacturers / units
    { regex: /\/categories/,                       type: 'category',         idGroup: null },
    { regex: /\/brands/,                           type: 'brand',            idGroup: null },
    { regex: /\/manufacturers/,                    type: 'manufacturer',     idGroup: null },
    { regex: /\/units/,                            type: 'unit',             idGroup: null },
  ];

  for (const pattern of patterns) {
    const match = fullPath.match(pattern.regex);
    if (match) {
      return {
        type: pattern.type,
        id: pattern.idGroup !== null ? (match[pattern.idGroup] || null) : null
      };
    }
  }

  // Last resort: extract from request body
  if (req.body) {
    if (req.body.itemId)     return { type: 'item',     id: req.body.itemId };
    if (req.body.customerId) return { type: 'customer', id: req.body.customerId };
    if (req.body.vendorId)   return { type: 'vendor',   id: req.body.vendorId };
    if (req.body.invoiceId)  return { type: 'invoice',  id: req.body.invoiceId };
  }

  return { type: 'system', id: null };
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
  const entityLabels = {
    item:              'Item',
    item_draft:        'Item Draft',
    customer:          'Customer',
    vendor:            'Vendor',
    sales_invoice:     'Sales Invoice',
    purchase_invoice:  'Purchase Invoice',
    sales_order:       'Sales Order',
    purchase_order:    'Purchase Order',
    inventory:         'Inventory',
    warehouse:         'Warehouse',
    user:              'User',
    exchange_rate:     'Exchange Rate',
    company_settings:  'Company Settings',
    settings:          'Settings',
    tax_rate:          'Tax Rate',
    tax_group:         'Tax Group',
    price_list:        'Price List',
    price_list_item:   'Price List Item',
    workflow:          'Workflow Rule',
    subscription:      'Subscription',
    onboarding:        'Onboarding',
    audit:             'Audit',
    report:            'Report',
    analytics:         'Analytics',
    profit_loss:       'Profit & Loss',
    accounting:        'Accounting',
    document:          'Document',
    notification:      'Notification',
    delivery_challan:  'Delivery Challan',
    purchase_return:   'Purchase Return',
    stock_count:       'Stock Count',
    reorder_level:     'Reorder Level',
    batch_serial:      'Batch/Serial',
    transfer_approval: 'Transfer Approval',
    role:              'Role',
    category:          'Category',
    brand:             'Brand',
    manufacturer:      'Manufacturer',
    unit:              'Unit',
    system:            'System',
  };

  const label = entityLabels[entityInfo.type] || entityInfo.type;
  const entityName = entityInfo.id ? `${label} (${entityInfo.id.substring(0, 8)}...)` : label;

  const actionDescriptions = {
    create:     `Created ${entityName}`,
    update:     `Updated ${entityName}`,
    delete:     `Deleted ${entityName}`,
    view:       `Viewed ${entityName}`,
    login:      'User logged in',
    logout:     'User logged out',
    approve:    `Approved ${entityName}`,
    reject:     `Rejected ${entityName}`,
    cancel:     `Cancelled ${entityName}`,
    confirm:    `Confirmed ${entityName}`,
    payment:    `Processed payment for ${entityName}`,
    transfer:   `Transferred ${entityName}`,
    adjustment: `Adjusted ${entityName}`,
  };

  return actionDescriptions[action] || `Performed ${action} on ${entityName}`;
};

module.exports = auditMiddleware;