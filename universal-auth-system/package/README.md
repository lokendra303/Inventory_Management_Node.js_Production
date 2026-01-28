# Universal Auth Package

A reusable authentication service with multi-tenant support. Write once, use anywhere!

## Features

- ✅ Multi-tenant architecture
- ✅ JWT-based authentication
- ✅ Role-based permissions
- ✅ Session management
- ✅ Password hashing with bcrypt
- ✅ Database agnostic (works with any SQL database)
- ✅ Express.js middleware included
- ✅ TypeScript support ready

## Installation

```bash
npm install @yourcompany/universal-auth
```

## Quick Start

### 1. Setup Database

```javascript
const mysql = require('mysql2/promise');
const { migrations } = require('@yourcompany/universal-auth');

// Create database connection
const db = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'your_app_db'
});

// Run migrations
await migrations.runMigrations(db);
```

### 2. Initialize Auth Service

```javascript
const { UniversalAuth, AuthController, AuthMiddleware } = require('@yourcompany/universal-auth');

// Initialize auth service
const authService = new UniversalAuth({
  jwtSecret: 'your-super-secret-key',
  jwtExpiresIn: '24h',
  database: db, // Your database connection
  logger: console, // Optional: your logger
  sessionTimeout: 15 * 60 * 1000 // 15 minutes
});

// Initialize controller and middleware
const authController = new AuthController(authService);
const authMiddleware = new AuthMiddleware(authService);
```

### 3. Setup Routes

```javascript
const express = require('express');
const router = express.Router();

// Public routes
router.post('/register', authController.registerTenant.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/refresh-token', authController.refreshToken.bind(authController));

// Protected routes
router.use(authMiddleware.authenticate());
router.get('/profile', authController.getProfile.bind(authController));
router.post('/change-password', authController.changePassword.bind(authController));

// Admin only routes
router.use(authMiddleware.requireRole('admin'));
router.post('/users', authController.createUser.bind(authController));
router.get('/users', authController.getUsers.bind(authController));
router.put('/users/:userId/permissions', authController.updateUserPermissions.bind(authController));

module.exports = router;
```

## Usage Examples

### Register New Tenant (Company)

```javascript
// POST /auth/register
{
  "name": "Acme Corp",
  "adminEmail": "admin@acme.com",
  "adminPassword": "securePassword123",
  "adminFirstName": "John",
  "adminLastName": "Doe",
  "adminMobile": "+1234567890"
}

// Response
{
  "success": true,
  "message": "Tenant created successfully",
  "data": {
    "tenantId": "uuid-here",
    "userId": "uuid-here"
  }
}
```

### User Login

```javascript
// POST /auth/login
{
  "email": "admin@acme.com",
  "password": "securePassword123",
  "tenantId": "optional-tenant-id"
}

// Response
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "jwt-token-here",
    "user": {
      "id": "uuid",
      "tenantId": "uuid",
      "email": "admin@acme.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "admin",
      "permissions": {"all": true}
    }
  }
}
```

### Create New User

```javascript
// POST /auth/users
// Headers: Authorization: Bearer <token>
{
  "email": "user@acme.com",
  "password": "password123",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "user",
  "permissions": {
    "inventory": true,
    "reports": false
  }
}
```

## Using in Different Applications

### Application 1: E-commerce

```javascript
const express = require('express');
const { UniversalAuth, AuthController, AuthMiddleware } = require('@yourcompany/universal-auth');

const app = express();
const authService = new UniversalAuth({
  jwtSecret: process.env.JWT_SECRET,
  database: require('./database/connection')
});

const authController = new AuthController(authService);
const authMiddleware = new AuthMiddleware(authService);

// E-commerce specific routes
app.use('/auth', require('./routes/auth'));
app.use('/api/products', authMiddleware.authenticate(), require('./routes/products'));
app.use('/api/orders', authMiddleware.requirePermission('orders'), require('./routes/orders'));
```

### Application 2: CRM System

```javascript
const express = require('express');
const { UniversalAuth, AuthController, AuthMiddleware } = require('@yourcompany/universal-auth');

const app = express();
const authService = new UniversalAuth({
  jwtSecret: process.env.JWT_SECRET,
  database: require('./database/connection')
});

const authController = new AuthController(authService);
const authMiddleware = new AuthMiddleware(authService);

// CRM specific routes
app.use('/auth', require('./routes/auth'));
app.use('/api/contacts', authMiddleware.requirePermission('contacts'), require('./routes/contacts'));
app.use('/api/deals', authMiddleware.requireRole(['admin', 'sales']), require('./routes/deals'));
```

### Application 3: Inventory Management (Your Current App)

```javascript
// In your existing app, replace your auth logic with:
const { UniversalAuth, AuthController, AuthMiddleware } = require('@yourcompany/universal-auth');

// Initialize
const authService = new UniversalAuth({
  jwtSecret: config.jwt.secret,
  database: db,
  logger: logger
});

const authController = new AuthController(authService);
const authMiddleware = new AuthMiddleware(authService);

// Replace your existing auth routes
app.use('/api/auth', authRoutes); // Use the universal auth routes
app.use('/api/inventory', authMiddleware.authenticate(), inventoryRoutes);
app.use('/api/warehouses', authMiddleware.requirePermission('warehouses'), warehouseRoutes);
```

## Advanced Usage

### Custom Permissions

```javascript
// Check multiple permissions
app.use('/api/admin', 
  authMiddleware.authenticate(),
  authMiddleware.requireRole('admin'),
  (req, res, next) => {
    // Additional custom checks
    if (!req.user.permissions.superAdmin) {
      return res.status(403).json({ error: 'Super admin required' });
    }
    next();
  }
);
```

### Tenant Isolation

```javascript
// Ensure all operations are tenant-scoped
app.use('/api/*', 
  authMiddleware.authenticate(),
  authMiddleware.requireTenant(),
  (req, res, next) => {
    // All database queries should use req.tenantId
    next();
  }
);
```

### Optional Authentication

```javascript
// For public endpoints that can benefit from user context
app.use('/api/public/products', 
  authMiddleware.optionalAuth(),
  (req, res) => {
    // req.user will be available if token provided
    const showPricing = req.user ? true : false;
    // ... rest of logic
  }
);
```

## Configuration Options

```javascript
const authService = new UniversalAuth({
  jwtSecret: 'your-secret-key',        // Required
  jwtExpiresIn: '24h',                 // Token expiry
  database: dbConnection,              // Required: Database connection
  logger: customLogger,                // Optional: Custom logger
  sessionTimeout: 15 * 60 * 1000,     // Session timeout in ms
  hashRounds: 12                       // bcrypt hash rounds
});
```

## Database Schema

The package automatically creates these tables:

- `tenants` - Company/organization data
- `users` - User accounts with multi-tenant support
- `temp_access_tokens` - Temporary access for password resets

## Migration to Existing Apps

### Step 1: Install Package
```bash
npm install @yourcompany/universal-auth
```

### Step 2: Run Migrations
```javascript
const { migrations } = require('@yourcompany/universal-auth');
await migrations.runMigrations(yourDatabaseConnection);
```

### Step 3: Replace Auth Logic
```javascript
// Before
const authService = require('./services/authService');
const authController = require('./controllers/authController');

// After
const { UniversalAuth, AuthController } = require('@yourcompany/universal-auth');
const authService = new UniversalAuth({ /* config */ });
const authController = new AuthController(authService);
```

### Step 4: Update Routes
```javascript
// Replace your existing auth routes with universal ones
// Your existing API endpoints will work the same way!
```

## Benefits

1. **Consistency**: Same auth logic across all applications
2. **Maintainability**: Update once, deploy everywhere
3. **Security**: Centralized security updates
4. **Time Saving**: No need to rewrite auth for each app
5. **Multi-tenant**: Built-in support for SaaS applications
6. **Scalable**: Works with any database and framework

## License

MIT

## Support

For issues and questions, please create an issue in the repository.