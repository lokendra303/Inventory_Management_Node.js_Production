# JWT Authentication System - Complete Guide

## Overview
This project implements a comprehensive JWT-based authentication system with multi-tenant support, role-based access control, and session management.

## 1. JWT Token Generation & Configuration

### Backend Configuration
```javascript
// config/index.js
jwt: {
  secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
  expiresIn: '999y' // No expiration (handled by session timeout)
}
```

### Token Creation
```javascript
// authService.js - Token generation
const sessionTimestamp = Date.now();
const token = jwt.sign(
  {
    userId: user.id,
    institutionId: user.institution_id,
    email: user.email,
    role: user.role,
    permissions: user.permissions || {},
    warehouseAccess: user.warehouse_access || [],
    sessionTimestamp
  },
  config.jwt.secret,
  { expiresIn: config.jwt.expiresIn }
);
```

## 2. Token Storage (Frontend)

### Storage Location
```javascript
// Stored in sessionStorage for security
sessionStorage.setItem('token', token);
sessionStorage.setItem('lastActivity', Date.now().toString());
sessionStorage.setItem('institutionId', userData.institutionId);
```

### Why sessionStorage?
- **Security**: Cleared when browser tab closes
- **Session-based**: Prevents persistent storage vulnerabilities
- **Automatic cleanup**: No manual cleanup needed

## 3. Authentication Flow

### Step 1: Login Process (Backend)
```javascript
// authController.js
async login(req, res) {
  try {
    const { email, password, institutionId } = req.body;
    const result = await authService.authenticateUser(email, password, institutionId);
    
    res.json({
      success: true,
      message: 'Login successful',
      data: result // Contains token and user data
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
}
```

### Step 2: Frontend Login
```javascript
// useAuth.jsx
const login = async (credentials) => {
  try {
    const response = await apiService.post('/auth/login', credentials);
    
    if (response.success) {
      const { token, user: userData } = response.data;
      
      // Store token and user data
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('lastActivity', Date.now().toString());
      sessionStorage.setItem('institutionId', userData.institutionId);
      
      // Set token for API calls
      apiService.setAuthToken(token);
      setUser({ ...userData, token });
      
      return { success: true };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

## 4. Token Usage in API Requests

### Automatic Token Injection
```javascript
// apiService.js - Request interceptor
this.api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      
      // Extract institution ID from token
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.institutionId) {
          config.headers['x-institution-id'] = payload.institutionId;
        }
      } catch (error) {
        // Fallback to sessionStorage
        const institutionId = sessionStorage.getItem('institutionId');
        if (institutionId) {
          config.headers['x-institution-id'] = institutionId;
        }
      }
    }
    return config;
  }
);
```

## 5. Backend Token Verification

### Authentication Middleware
```javascript
// auth.js - Extract institution context
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
    
    // Set user context for request
    req.institutionId = decoded.institutionId;
    req.user = {
      userId: decoded.userId,
      institutionId: decoded.institutionId,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || {},
      warehouseAccess: decoded.warehouseAccess || []
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};
```

### Token Verification
```javascript
// authService.js
async verifyToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Check session timeout (15 minutes)
    if (decoded.sessionTimestamp) {
      const sessionAge = Date.now() - decoded.sessionTimestamp;
      if (sessionAge > 15 * 60 * 1000) {
        throw new Error('Session expired due to inactivity');
      }
    }
    
    // Verify user still exists and is active
    const users = await db.query(
      `SELECT u.*, i.status as institution_status 
       FROM institution_users u 
       JOIN institutions i ON u.institution_id = i.id 
       WHERE u.id = ?`,
      [decoded.userId]
    );

    if (users.length === 0 || users[0].status !== 'active') {
      throw new Error('Invalid token');
    }

    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}
```

## 6. Authorization System

### Permission-Based Access Control
```javascript
// auth.js
const requirePermission = (permission) => {
  return (req, res, next) => {
    const userPermissions = req.user.permissions || {};
    
    // Admin has all permissions
    if (req.user.role === 'admin' || userPermissions.all === true) {
      return next();
    }
    
    // Check specific permission
    if (userPermissions[permission] === true) {
      return next();
    }
    
    res.status(403).json({ 
      success: false,
      error: 'Insufficient permissions',
      required: permission
    });
  };
};
```

### Role-Based Access Control
```javascript
const requireRole = (roles) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient role permissions',
        required: allowedRoles
      });
    }
    next();
  };
};
```

## 7. Middleware Usage in Routes

### Route Protection Examples

#### Public Routes (No Authentication)
```javascript
// routes/index.js - Public routes
router.post('/auth/register-institution', 
  validate(schemas.registerinstitutionSchema),
  auditLog('institution_registration'),
  authController.registerInstitution
);

router.post('/auth/login', 
  validate(schemas.loginSchema),
  auditLog('user_login'),
  authController.login
);
```

#### Protected Routes (Authentication Required)
```javascript
// Apply authentication to all routes below this line
router.use(requireAuth);
router.use(validateInstitutionConsistency);

// Now all routes require authentication
router.get('/auth/profile', authController.getProfile);
```

#### Permission-Based Route Protection
```javascript
// routes/items.js - Item management routes
router.get('/',
  requirePermission('item_view'),  // Requires 'item_view' permission
  itemController.getItems
);

router.post('/',
  requirePermission('item_management'),  // Requires 'item_management' permission
  auditLog('item_created'),             // Logs the action
  itemController.createItem
);

router.delete('/:id',
  requirePermission('item_management'),
  auditLog('item_deleted'),
  itemController.deleteItem
);
```

#### Inventory Operations with Multiple Middleware
```javascript
// routes/inventory.js - Inventory operations
router.post('/receive', 
  validate(schemas.receiveStockSchema),    // Validate request data
  requirePermission('inventory_receive'),  // Check permission
  auditLog('stock_received'),             // Log action
  inventoryController.receiveStock        // Execute controller
);

router.post('/transfer', 
  validate(schemas.transferStockSchema),
  requirePermission('inventory_transfer'),
  auditLog('stock_transferred'),
  inventoryController.transferStock
);
```

#### Admin-Only Routes
```javascript
// User management (admin only)
router.post('/users', 
  requirePermission('user_management'),  // Only users with user_management permission
  auditLog('user_creation'),
  authController.createUser
);

router.put('/users/:userId/permissions', 
  requirePermission('user_management'),
  validate(schemas.updateUserPermissionsSchema),
  auditLog('user_permission_update'),
  authController.updateUserPermissions
);
```

### Middleware Chain Execution Order
```javascript
// Middleware executes in order:
router.post('/inventory/adjust', 
  validate(schemas.adjustStockSchema),     // 1. Validate input
  requirePermission('inventory_adjust'),   // 2. Check permissions
  auditLog('stock_adjusted'),             // 3. Log the action
  inventoryController.adjustStock         // 4. Execute controller
);
```

### Global Middleware Application
```javascript
// routes/index.js - Apply to all protected routes
router.use(requireAuth);                    // All routes need authentication
router.use(validateInstitutionConsistency); // All routes validate institution access

// Individual route middleware
router.get('/inventory', 
  requirePermission('inventory_view'),      // Specific permission required
  inventoryController.getInstitutionInventory
);
```

### Warehouse Access Control
```javascript
// Warehouse-specific access control
router.get('/inventory/warehouse/:warehouseId', 
  requirePermission('inventory_view'),
  requireWarehouseAccess('warehouseId'),  // Check warehouse access
  inventoryController.getWarehouseStock
);
```

## 8. Session Management

### Session Timeout Handling
```javascript
// Frontend - Check session timeout on app load
useEffect(() => {
  const token = sessionStorage.getItem('token');
  if (token) {
    const lastActivity = sessionStorage.getItem('lastActivity');
    if (lastActivity) {
      const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
      if (timeSinceLastActivity > 15 * 60 * 1000) { // 15 minutes
        // Session expired - logout user
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('lastActivity');
        Modal.warning({
          title: 'Session Expired',
          content: 'Your session has expired. Please login again.'
        });
        return;
      }
    }
  }
}, []);
```

### Token Refresh
```javascript
// authService.js
async refreshToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Generate new token with updated session timestamp
    const sessionTimestamp = Date.now();
    const newToken = jwt.sign(
      {
        userId: user.id,
        institutionId: user.institution_id,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        warehouseAccess: user.warehouseAccess,
        sessionTimestamp
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    return { token: newToken, user: userData };
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}
```

## 9. Logout Process

### Frontend Logout
```javascript
const logout = () => {
  // Clear all stored data
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('lastActivity');
  sessionStorage.removeItem('institutionId');
  
  // Remove token from API service
  apiService.setAuthToken(null);
  
  // Clear user state
  setUser(null);
  
  // Redirect to login
  window.location.href = '/';
};
```

## 10. Security Features

### Multi-tenant Institution Isolation
```javascript
// Ensure user can only access their institution's data
const validateInstitutionConsistency = async (req, res, next) => {
  if (req.user.institutionId !== req.institutionId) {
    return res.status(403).json({
      success: false,
      error: 'Institution access violation'
    });
  }
  next();
};
```

### Rate Limiting
```javascript
const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const key = req.ip + ':' + (req.user?.userId || 'anonymous');
    // Rate limiting logic...
  };
};
```

## 11. Error Handling

### Frontend Error Interceptor
```javascript
// apiService.js
this.api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      const errorData = error.response?.data;
      
      if (errorData?.code === 'SESSION_EXPIRED') {
        sessionStorage.removeItem('token');
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);
```

## Middleware Usage Patterns

### 1. **Global Authentication**
```javascript
// Apply to all routes after this point
router.use(requireAuth);
```

### 2. **Route-Specific Permissions**
```javascript
router.get('/items', requirePermission('item_view'), controller.getItems);
```

### 3. **Multiple Middleware Chain**
```javascript
router.post('/items',
  validate(schema),              // Input validation
  requirePermission('item_mgmt'), // Permission check
  auditLog('item_created'),      // Action logging
  controller.createItem          // Business logic
);
```

### 4. **Conditional Middleware**
```javascript
// Different permissions for different HTTP methods
router.route('/items/:id')
  .get(requirePermission('item_view'), controller.getItem)
  .put(requirePermission('item_management'), controller.updateItem)
  .delete(requirePermission('item_management'), controller.deleteItem);
```

## Key Features

✅ **Secure Token Storage** - sessionStorage for automatic cleanup  
✅ **Automatic Token Injection** - All API requests include token  
✅ **Session Timeout Management** - 15-minute inactivity timeout  
✅ **Multi-tenant Isolation** - Institution-based data separation  
✅ **Role & Permission Authorization** - Granular access control  
✅ **Middleware Chain Protection** - Layered security approach  
✅ **Rate Limiting** - Protection against abuse  
✅ **Graceful Error Handling** - User-friendly error messages  
✅ **Token Refresh** - Seamless session extension  
✅ **Audit Logging** - Track user actions  

## Security Best Practices

1. **Token Expiration**: Uses session timeout instead of token expiration
2. **Secure Storage**: sessionStorage prevents XSS token theft
3. **Institution Isolation**: Multi-tenant security
4. **Permission Validation**: Both role and permission-based access
5. **Rate Limiting**: Prevents brute force attacks
6. **Audit Logging**: Track all user actions
7. **Session Management**: Automatic cleanup on inactivity
8. **Middleware Layering**: Multiple security checks per route