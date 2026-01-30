# Universal Auth - Complete Implementation Guide

## 🚀 Quick Setup (2 Minutes)

### Option 1: Auto-Migration (Existing Project)
```bash
# Copy universal-auth-package to your project
# Update .env with database credentials
node check-database-compatibility.js    # Check what needs migration
node auto-migrate-existing-project.js   # Auto-fix everything
```

### Option 2: New Project Setup
```bash
npm install @yourcompany/universal-auth bcryptjs jsonwebtoken uuid mysql2
node universal-auth-package/setup-wizard.js
```

### Option 3: Manual Setup
```javascript
const { OptionalAuth } = require('./universal-auth-package');
const auth = new OptionalAuth({
  enabled: true,
  jwtSecret: process.env.JWT_SECRET,
  database: db
});

// Add auth routes
app.use('/api/auth', auth.getAuthRoutes());

// Protect routes
app.use('/api/protected', auth.authenticate());
```

## 🛠️ Auto-Migration for Existing Projects

### Check Database Compatibility
```bash
node check-database-compatibility.js
```
**Output:**
```
📊 COMPATIBILITY REPORT
❌ Missing Auth Tables: institutions, users
⚠️  Tables Needing institution_id: products, orders, inventory
💡 Run: node auto-migrate-existing-project.js
```

### Auto-Fix Everything
```bash
node auto-migrate-existing-project.js
```
**What it does:**
- ✅ Creates missing auth tables
- ✅ Adds `institution_id` to existing tables
- ✅ Migrates existing data to default institution
- ✅ Adds missing fields (mobile, permissions, etc.)
- ✅ Preserves all existing data

### Database Structure (Auto-Created)

#### Auth Tables
- `institutions` - Companies/organizations
- `users` - User accounts with multi-institution support
- `temp_access_tokens` - Password reset tokens

#### Your Existing Tables
- Auto-adds `institution_id VARCHAR(36)` to all tables
- Auto-adds `created_by VARCHAR(36)` where needed
- Maintains all existing data and structure

## 🔧 Environment Configuration

```bash
# production.env (copy to .env)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=your_app_db

# Auth Configuration
AUTH_ENABLED=true
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=3000
NODE_ENV=production

# To disable auth completely:
# AUTH_ENABLED=false
```

## 📱 Complete API Reference

### Public Endpoints (No Authentication)

#### Register Company
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Acme Corp",
  "adminEmail": "admin@acme.com",
  "adminPassword": "securePassword123",
  "adminFirstName": "John",
  "adminLastName": "Doe",
  "adminMobile": "+1234567890"
}
```
**Response:**
```json
{
  "success": true,
  "message": "institution created successfully",
  "data": {
    "institutionId": "uuid-here",
    "userId": "uuid-here"
  }
}
```

#### User Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@acme.com",
  "password": "securePassword123",
  "institutionId": "optional-institution-id"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "jwt-token-here",
    "user": {
      "id": "uuid",
      "institutionId": "uuid",
      "email": "admin@acme.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "admin",
      "permissions": {"all": true}
    }
  }
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Authorization: Bearer <current-token>
```
**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "token": "new-jwt-token",
    "user": { /* user data */ }
  }
}
```

### Protected Endpoints (Requires Authentication)

#### Get User Profile
```http
GET /api/auth/profile
Authorization: Bearer <token>
```
**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "institutionId": "uuid",
    "email": "admin@acme.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "admin",
    "permissions": {"all": true}
  }
}
```

#### Change Password
```http
POST /api/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### Admin Endpoints (Requires Admin Role)

#### Create New User
```http
POST /api/auth/users
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "email": "user@acme.com",
  "password": "password123",
  "firstName": "Jane",
  "lastName": "Smith",
  "mobile": "+1234567890",
  "role": "user",
  "permissions": {
    "inventory": true,
    "reports": false
  },
  "warehouseAccess": ["warehouse-1", "warehouse-2"]
}
```
**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "userId": "uuid-here"
  }
}
```

#### Get All Users
```http
GET /api/auth/users?limit=50&offset=0
Authorization: Bearer <admin-token>
```
**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "user@acme.com",
      "first_name": "Jane",
      "last_name": "Smith",
      "role": "user",
      "permissions": {"inventory": true},
      "status": "active",
      "last_login": "2024-01-15T10:30:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1
  }
}
```

#### Update User Permissions
```http
PUT /api/auth/users/:userId/permissions
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "permissions": {
    "inventory": true,
    "reports": true,
    "users": false
  },
  "warehouseAccess": ["warehouse-1"],
  "role": "manager"
}
```
**Response:**
```json
{
  "success": true,
  "message": "User permissions updated successfully"
}
```

## 🧪 Testing & Validation

### Run System Tests
```bash
node auth-system-test.js
```
**Output:**
```
🧪 Testing Universal Auth API...
✅ Company registered: uuid-here
✅ Login successful
✅ Profile: admin@test.com
✅ Protected route: This is a protected route!
🎉 All tests passed! Universal Auth is working correctly.
```

### Manual API Testing

#### 1. Register Company
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Company",
    "adminEmail": "admin@test.com",
    "adminPassword": "password123",
    "adminFirstName": "John",
    "adminLastName": "Doe"
  }'
```

#### 2. Login & Get Token
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "password123"
  }'
```

#### 3. Use Token for Protected Routes
```bash
# Get profile
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Create user (admin only)
curl -X POST http://localhost:3000/api/auth/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@test.com",
    "password": "password123",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "user"
  }'
```

## 🔒 Middleware & Route Protection

### Basic Authentication
```javascript
// Require login for all routes
app.use('/api/protected', auth.authenticate());

// Available in route: req.user, req.institutionId
app.get('/api/protected/data', (req, res) => {
  res.json({
    message: 'Protected data',
    user: req.user.email,
    institution: req.institutionId
  });
});
```

### Role-Based Access Control
```javascript
// Admin only
app.use('/api/admin', auth.requireRole('admin'));

// Multiple roles allowed
app.use('/api/management', auth.requireRole(['admin', 'manager']));

// Example usage
app.get('/api/admin/settings', (req, res) => {
  // Only admins can access this
  res.json({ settings: 'admin-only-data' });
});
```

### Permission-Based Access Control
```javascript
// Specific permissions
app.use('/api/inventory', auth.requirePermission('inventory'));
app.use('/api/reports', auth.requirePermission('reports'));
app.use('/api/users', auth.requirePermission('user_management'));

// Example usage
app.post('/api/inventory/items', (req, res) => {
  // Only users with 'inventory' permission can access
  // Create inventory item logic
});
```

### Optional Authentication
```javascript
// Public routes that can benefit from user context
app.use('/api/public', auth.optionalAuth());

app.get('/api/public/products', (req, res) => {
  const showPricing = req.user ? true : false;
  const products = getProducts(showPricing);
  res.json({ products, authenticated: !!req.user });
});
```

### Combined Protection
```javascript
// Multiple middleware layers
app.use('/api/sensitive',
  auth.authenticate(),           // Must be logged in
  auth.requireRole('admin'),     // Must be admin
  auth.requirePermission('sensitive_data'), // Must have permission
  (req, res) => {
    res.json({ data: 'highly-sensitive-data' });
  }
);
```

## 🗄️ Multi-institution Database Patterns

### Auto-Migration Handles This
```bash
# Automatically adds institution_id to existing tables
node auto-migrate-existing-project.js
```

### Manual Multi-institution Queries
```javascript
// Always filter by institution_id
app.get('/api/products', auth.authenticate(), async (req, res) => {
  const products = await db.query(
    'SELECT * FROM products WHERE institution_id = ? ORDER BY created_at DESC',
    [req.institutionId]
  );
  res.json({ success: true, data: products });
});

// Always insert with institution_id
app.post('/api/products', auth.authenticate(), async (req, res) => {
  const { name, price } = req.body;
  const productId = require('uuid').v4();
  
  await db.query(
    'INSERT INTO products (id, institution_id, name, price, created_by) VALUES (?, ?, ?, ?, ?)',
    [productId, req.institutionId, name, price, req.user.userId]
  );
  
  res.json({ success: true, data: { id: productId } });
});
```

### Database Schema After Migration
```sql
-- Your existing tables get updated automatically
ALTER TABLE products ADD COLUMN institution_id VARCHAR(36) DEFAULT 'default';
ALTER TABLE orders ADD COLUMN institution_id VARCHAR(36) DEFAULT 'default';
ALTER TABLE inventory ADD COLUMN institution_id VARCHAR(36) DEFAULT 'default';

-- Indexes added for performance
ALTER TABLE products ADD INDEX idx_products_institution (institution_id);
ALTER TABLE orders ADD INDEX idx_orders_institution (institution_id);
```

## ⚡ Migration Scenarios

### Scenario 1: Brand New Project
```bash
node universal-auth-package/setup-wizard.js
# Creates complete project with auth
```

### Scenario 2: Existing Project (Recommended)
```bash
# 1. Check compatibility
node check-database-compatibility.js

# 2. Auto-migrate everything
node auto-migrate-existing-project.js

# 3. Add auth to your app
const { OptionalAuth } = require('./universal-auth-package');
const auth = new OptionalAuth({ enabled: true, jwtSecret: 'secret', database: db });
app.use('/api/auth', auth.getAuthRoutes());
```

### Scenario 3: Gradual Integration
```javascript
// Start with auth disabled
const auth = new OptionalAuth({ enabled: false });

// All middleware passes through - no breaking changes
app.use('/api/products', auth.authenticate(), productRoutes);

// Later, enable auth by changing config
// AUTH_ENABLED=true in .env
```

## 🚀 Production Deployment

### Environment Setup
```bash
# production.env
DB_HOST=your-prod-db-host
DB_USER=your-prod-user
DB_PASSWORD=your-secure-password
DB_NAME=your-prod-database
JWT_SECRET=your-super-secure-secret-min-32-characters
JWT_EXPIRES_IN=24h
AUTH_ENABLED=true
NODE_ENV=production
```

### Security Checklist
- ✅ Use strong JWT_SECRET (min 32 characters)
- ✅ Enable HTTPS in production
- ✅ Set secure database passwords
- ✅ Configure rate limiting
- ✅ Enable request logging
- ✅ Set up monitoring
- ✅ Regular security updates

### Performance Optimization
```javascript
// Connection pooling
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
  queueLimit: 0
});

// Redis for session storage (optional)
const redis = require('redis');
const client = redis.createClient();
```

## 🆘 Troubleshooting

### Common Issues

#### Database Connection
```javascript
// Test connection
try {
  await db.query('SELECT 1');
  console.log('✅ Database connected');
} catch (error) {
  console.error('❌ Database error:', error.message);
}
```

#### JWT Token Issues
```javascript
// Verify token manually
const jwt = require('jsonwebtoken');
try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log('✅ Token valid:', decoded);
} catch (error) {
  console.error('❌ Token error:', error.message);
}
```

#### Permission Issues
```javascript
// Debug user permissions
console.log('User permissions:', req.user.permissions);
console.log('User role:', req.user.role);
console.log('institution ID:', req.institutionId);
```

### Error Codes
- `401` - Authentication required or invalid token
- `403` - Insufficient permissions or role
- `404` - User or resource not found
- `400` - Invalid request data
- `500` - Server error

## 📞 Support & Resources

### Quick Commands
```bash
# Check system status
node auth-system-test.js

# Check database compatibility
node check-database-compatibility.js

# Auto-fix issues
node auto-migrate-existing-project.js

# Start production app
node universal-auth-app.js
```

### File Structure
```
project/
├── universal-auth-package/     # Auth library
├── universal-auth-app.js       # Production app
├── production.env              # Environment config
├── auth-system-test.js         # System tests
├── check-database-compatibility.js
└── auto-migrate-existing-project.js
```

**🎉 Your authentication system is now production-ready!**ions.runMigrations(yourDb);
```

### Step 3: Replace Auth Files
```javascript
// Replace your authService.js
const { UniversalAuth } = require('@yourcompany/universal-auth');
const authService = new UniversalAuth({ jwtSecret: 'secret', database: db });

// Replace your authController.js  
const { AuthController } = require('@yourcompany/universal-auth');
const authController = new AuthController(authService);

// Replace your auth middleware
const { AuthMiddleware } = require('@yourcompany/universal-auth');
const authMiddleware = new AuthMiddleware(authService);
```

### Step 4: Update Routes
```javascript
// Your existing routes work the same!
app.use('/api/auth', authRoutes);
app.use('/api/inventory', authMiddleware.authenticate(), inventoryRoutes);
```

## 🎯 Production Checklist

- [ ] Set strong JWT_SECRET (min 32 characters)
- [ ] Use environment variables
- [ ] Enable HTTPS
- [ ] Set up database backups
- [ ] Configure rate limiting
- [ ] Add request logging
- [ ] Set up monitoring

## 🆘 Troubleshooting

### Database Connection Issues
```javascript
// Test connection
try {
  await db.query('SELECT 1');
  console.log('✅ Database connected');
} catch (error) {
  console.error('❌ Database error:', error.message);
}
```

### JWT Token Issues
```javascript
// Verify token manually
const jwt = require('jsonwebtoken');
try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log('✅ Token valid:', decoded);
} catch (error) {
  console.error('❌ Token error:', error.message);
}
```

### Permission Issues
```javascript
// Check user permissions
console.log('User permissions:', req.user.permissions);
console.log('User role:', req.user.role);
```

## 📞 Support

For issues:
1. Check database connection
2. Verify JWT_SECRET is set
3. Ensure migrations ran successfully
4. Check user permissions in database

**Ready to use in any application! 🚀**