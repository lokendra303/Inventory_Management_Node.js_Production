const auditLogService = require('../modules/audit/auditLog.service');
const logger = require('../utils/logger');

/** Body as sent/parsed after route handlers (multer, etc.); snapshot taken at res.json time. */
function getAuditRequestBody(req) {
  if (req._auditBodySnapshot !== undefined) return req._auditBodySnapshot;
  return req.body;
}

// Enhanced audit middleware that captures all user actions
const auditMiddleware = (options = {}) => {
  return (req, res, next) => {
    // Skip audit for certain routes
    const skipRoutes = options.skipRoutes || ['/health', '/api/auth/verify'];
    if (skipRoutes.some(route => req.path.includes(route))) {
      return next();
    }

    const startTime = Date.now();
    let auditCaptured = false; // guard — ensure only ONE audit log per request

    const originalJson = res.json.bind(res);

    // Only override res.json — this is the single entry point for all JSON responses
    // Do NOT override res.send because res.json() calls res.send() internally,
    // which would cause captureAuditLog to fire twice per request.
    res.json = function(data) {
      res.json = originalJson; // restore immediately before calling
      if (!auditCaptured) {
        auditCaptured = true;
        // Snapshot body here so multer and other parsers have finished populating req.body
        try {
          if (req.body && typeof req.body === 'object') {
            req._auditBodySnapshot = JSON.parse(JSON.stringify(req.body));
          }
        } catch {
          if (req.body && typeof req.body === 'object') {
            req._auditBodySnapshot = { ...req.body };
          }
        }
        captureAuditLog(req, res, data, startTime);
      }
      return originalJson(data);
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
    
    // Prefer semantic action from route (auditLog('item_updated')), else HTTP-method-based action
    const action = req.auditRouteAction || determineAction(req.method, req.path, responseData);
    
    // Capture changes if available (includes route params, file meta, optional res.locals.auditExtra)
    let changes = captureChanges(req, responseData);
    if (res.locals && res.locals.auditExtra && typeof res.locals.auditExtra === 'object') {
      changes = { ...(changes || {}), serverSnapshot: res.locals.auditExtra };
    }
    if (changes && Object.keys(changes).length === 0) changes = null;

    // Create audit log entry
    await auditLogService.logUserAction({
      institutionId: req.institutionId,
      userId: req.user?.userId || null,
      serviceAccountId: req.serviceAccount?.jti || null,
      entityType: entityInfo.type,
      entityId: entityInfo.id,
      action: action,
      method: req.method,
      path: req.originalUrl.split('?')[0], // store full path, not router-relative
      changes: changes,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration: duration,
      requestBody: sanitizeRequestBody(getAuditRequestBody(req)),
      description: generateDescription(action, entityInfo, req.user, req, responseData, changes)
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
    { regex: /\/company-settings\/addresses\/([a-f0-9-]{36})/i, type: 'company_address', idGroup: 1 },
    { regex: /\/company-settings\/addresses\/?$/i, type: 'company_address', idGroup: null },
    { regex: /\/company-settings\/bank-accounts\/([a-f0-9-]{36})/i, type: 'company_bank_account', idGroup: 1 },
    { regex: /\/company-settings\/bank-accounts\/?$/i, type: 'company_bank_account', idGroup: null },
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
  const b = getAuditRequestBody(req);
  if (b) {
    if (b.itemId)     return { type: 'item',     id: b.itemId };
    if (b.customerId) return { type: 'customer', id: b.customerId };
    if (b.vendorId)   return { type: 'vendor',   id: b.vendorId };
    if (b.invoiceId)  return { type: 'invoice',  id: b.invoiceId };
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

// Flatten object keys up to maxDepth for audit summaries (dot paths)
const flattenBodyKeys = (obj, prefix = '', maxDepth = 3, depth = 0) => {
  if (!obj || typeof obj !== 'object' || depth >= maxDepth) return [];
  const keys = [];
  for (const k of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenBodyKeys(v, path, maxDepth, depth + 1));
    } else {
      keys.push(path);
    }
  }
  return keys;
};

// Capture changes from request and response
const captureChanges = (req, responseData) => {
  const changes = {};
  const body = getAuditRequestBody(req);

  if (req.params && typeof req.params === 'object' && Object.keys(req.params).length > 0) {
    changes.routeParams = { ...req.params };
  }
  if (req.query && typeof req.query === 'object' && Object.keys(req.query).length > 0) {
    changes.query = { ...req.query };
  }
  if (req.file && typeof req.file === 'object') {
    changes.uploadedFile = {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    };
  }

  if (body && typeof body === 'object' && Object.keys(body).length > 0) {
    const input = sanitizeRequestBody(body);
    changes.input = input;
    changes.inputFields = flattenBodyKeys(input, '', 3, 0).slice(0, 50);
  }

  if (responseData && typeof responseData === 'object') {
    try {
      const parsed = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      if (parsed.message) changes.responseMessage = String(parsed.message).slice(0, 500);
      if (parsed.success !== undefined) changes.success = parsed.success;

      if (parsed.data !== undefined && parsed.data !== null) {
        const d = parsed.data;
        if (typeof d === 'object' && !Array.isArray(d)) {
          changes.result = sanitizeResponseData(d);
          const id = d.id || d.uuid || d._id;
          if (id) changes.affectedId = String(id);
        } else if (Array.isArray(d)) {
          changes.resultSummary = { recordCount: d.length };
          if (d.length === 1 && d[0] && typeof d[0] === 'object') {
            changes.result = sanitizeResponseData(d[0]);
          }
        } else {
          changes.result = d;
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  changes.operation = { method: req.method, path: req.originalUrl.split('?')[0] };
  return Object.keys(changes).length > 0 ? changes : null;
};

const SENSITIVE_KEY_REGEX = /password|passwd|pass|token|secret|apikey|api_key|authorization|auth|credential/i;

// Sanitize request body to remove sensitive information
const sanitizeRequestBody = (body) => {
  if (!body || typeof body !== 'object') return body;

  let clone;
  try {
    clone = JSON.parse(JSON.stringify(body));
  } catch {
    clone = Array.isArray(body) ? [...body] : { ...body };
  }
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      if (SENSITIVE_KEY_REGEX.test(k)) {
        o[k] = '[REDACTED]';
        continue;
      }
      if (o[k] !== null && typeof o[k] === 'object' && !Array.isArray(o[k])) {
        walk(o[k]);
      }
    }
  };
  walk(clone);
  return clone;
};

// Sanitize response data (shallow; avoid huge payloads in audit JSON)
const sanitizeResponseData = (data) => {
  if (!data || typeof data !== 'object') return data;

  const sanitized = { ...data };
  const walk = (o, depth = 0) => {
    if (!o || typeof o !== 'object' || depth > 2) return;
    for (const k of Object.keys(o)) {
      if (SENSITIVE_KEY_REGEX.test(k)) {
        o[k] = '[REDACTED]';
        continue;
      }
      if (o[k] !== null && typeof o[k] === 'object' && !Array.isArray(o[k])) {
        walk(o[k], depth + 1);
      }
    }
  };
  walk(sanitized, 0);
  return sanitized;
};

// Extract a human-readable name from request body or response data
const extractEntityName = (req, responseData, entityType) => {
  // 1. Try request body first — most reliable for create/update
  const body = getAuditRequestBody(req);
  if (body) {
    // Direct name fields
    if (body.name)          return body.name;
    if (body.companyName)   return body.companyName;
    if (body.title)         return body.title;
    if (body.invoiceNumber) return body.invoiceNumber;
    if (body.soNumber)      return body.soNumber;
    if (body.poNumber)      return body.poNumber;
    if (body.itemName)      return body.itemName;
    if (body.customerName)  return body.customerName;
    if (body.vendorName)    return body.vendorName;
    if (body.displayName)   return body.displayName;
    if (body.firstName && body.lastName) return `${body.firstName} ${body.lastName}`;
    if (body.firstName)     return body.firstName;
    if (body.email)         return body.email;
  }

  // 2. Try response data — for cases where name comes back in response
  try {
    const parsed = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
    const d = parsed?.data;
    if (d) {
      if (d.name)          return d.name;
      if (d.companyName)   return d.companyName;
      if (d.invoiceNumber) return d.invoiceNumber;
      if (d.soNumber)      return d.soNumber;
      if (d.poNumber)      return d.poNumber;
      if (d.displayName)   return d.displayName;
      if (d.firstName && d.lastName) return `${d.firstName} ${d.lastName}`;
      if (d.email)         return d.email;
    }
  } catch { /* ignore */ }

  return null;
};

// Generate human-readable description
const generateDescription = (action, entityInfo, user, req, responseData, changes) => {
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
    company_address:   'Company address',
    company_bank_account: 'Company bank account',
    settings:          'Settings',
    tax_rate:          'Tax Rate',
    tax_group:         'Tax Group',
    tax_type:          'Tax Type',
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

  // Try to get actual name — prefer name over UUID
  const actualName = extractEntityName(req, responseData, entityInfo.type);
  const entityName = actualName
    ? `${label} "${actualName}"`
    : entityInfo.id
      ? `${label} (${entityInfo.id.substring(0, 8)}...)`
      : label;

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

  let base = actionDescriptions[action] || `${String(action).replace(/_/g, ' ')} — ${entityName}`;

  const fields = changes && Array.isArray(changes.inputFields) ? changes.inputFields : [];
  if (fields.length > 0) {
    base += `. Payload fields: ${fields.slice(0, 20).join(', ')}${fields.length > 20 ? '…' : ''}`;
  }
  if (changes && changes.responseMessage) {
    base += `. Response: ${changes.responseMessage}`;
  }
  if (changes && changes.affectedId && !base.includes(changes.affectedId)) {
    base += `. Record id: ${changes.affectedId}`;
  }

  const snap = changes && changes.serverSnapshot;
  if (snap) {
    if (snap.deleted && typeof snap.deleted === 'object') {
      const d = snap.deleted;
      const bits = [d.label, d.address || d.address_line1, d.city].filter(Boolean).join(' · ');
      base += bits ? `. Removed: ${bits}` : '. Address removed (see detail for full record).';
    } else if (snap.before && typeof snap.before === 'object' && snap.submitted) {
      base += '. Previous vs submitted values are in the audit detail (server snapshot).';
    } else if (snap.createdId) {
      base += `. New record id: ${snap.createdId}`;
    }
  }

  return base;
};

module.exports = auditMiddleware;