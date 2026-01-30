# Institution-Based User System Implementation Guide

## Overview

This guide explains how to migrate from the current institution-based user system to a new institution-based system where:
- **Institutions** replace institutions as the primary organizational entity
- **Institution Users** are users created and managed by institutions
- Better separation of concerns between institutional registration and user management

## Database Changes

### New Tables Structure

#### 1. Institutions Table (replaces institutions)
```sql
CREATE TABLE institutions (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  mobile VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  institution_type ENUM('educational', 'corporate', 'government', 'healthcare', 'other') DEFAULT 'corporate',
  registration_number VARCHAR(100),
  tax_id VARCHAR(100),
  website VARCHAR(255),
  contact_person VARCHAR(255),
  status ENUM('active', 'inactive', 'pending') DEFAULT 'active',
  plan ENUM('starter', 'professional', 'enterprise') DEFAULT 'starter',
  settings JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### 2. Institution Users Table (replaces users)
```sql
CREATE TABLE institution_users (
  id VARCHAR(36) PRIMARY KEY,
  institution_id VARCHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  mobile VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  date_of_birth DATE,
  gender ENUM('male', 'female', 'other'),
  department VARCHAR(100),
  designation VARCHAR(100),
  employee_id VARCHAR(50),
  role VARCHAR(100) DEFAULT 'user',
  permissions JSON,
  warehouse_access JSON,
  status ENUM('active', 'inactive') DEFAULT 'active',
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  UNIQUE KEY unique_institution_email (institution_id, email),
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
);
```

## Migration Steps

### Step 1: Run Database Migration
```bash
node migrate-user-table-split.js
```

This script will:
- Create new `institutions` and `institution_users` tables
- Migrate existing data from `institutions` and `users`
- Update foreign key references in all related tables
- Create backup tables for safety

### Step 2: Update Service Layer

Replace the current `authService.js` with `authService-new.js`:

```bash
# Backup current service
cp src/services/authService.js src/services/authService-backup.js

# Replace with new service
cp src/services/authService-new.js src/services/authService.js
```

### Step 3: Update Controller Layer

Replace the current `authController.js` with `authController-new.js`:

```bash
# Backup current controller
cp src/controllers/authController.js src/controllers/authController-backup.js

# Replace with new controller
cp src/controllers/authController-new.js src/controllers/authController.js
```

### Step 4: Update Middleware

Replace the current auth middleware with `auth-new.js`:

```bash
# Backup current middleware
cp src/middleware/auth.js src/middleware/auth-backup.js

# Replace with new middleware
cp src/middleware/auth-new.js src/middleware/auth.js
```

### Step 5: Update All Service References

Update all services that reference `institution_id` to use `institution_id`:

```javascript
// Before
const items = await db.query('SELECT * FROM items WHERE institution_id = ?', [institutionId]);

// After
const items = await db.query('SELECT * FROM items WHERE institution_id = ?', [institutionId]);
```

## API Changes

### New Registration Endpoint

#### Institution Registration
```javascript
POST /api/auth/register-institution
{
  // Institution details
  "institutionName": "ABC Corporation",
  "institutionEmail": "contact@abc.com",
  "institutionMobile": "+1234567890",
  "institutionAddress": "123 Business St",
  "institutionCity": "New York",
  "institutionState": "NY",
  "institutionCountry": "USA",
  "institutionType": "corporate",
  "registrationNumber": "REG123456",
  "taxId": "TAX789012",
  "website": "https://abc.com",
  "contactPerson": "John Doe",
  
  // Admin user details
  "adminEmail": "admin@abc.com",
  "adminPassword": "securePassword123",
  "adminFirstName": "John",
  "adminLastName": "Doe",
  "adminMobile": "+1234567890",
  "adminDepartment": "Administration",
  "adminDesignation": "System Administrator"
}
```

### Updated Login
```javascript
POST /api/auth/login
{
  "email": "admin@abc.com",
  "password": "securePassword123",
  "institutionId": "optional-institution-id" // For multi-institution users
}
```

### JWT Token Structure
```javascript
{
  "userId": "user-uuid",
  "institutionId": "institution-uuid", 
  "email": "user@example.com",
  "role": "admin|user",
  "permissions": {
    "inventory_view": true,
    "inventory_create": true
  },
  "warehouseAccess": ["warehouse-id-1", "warehouse-id-2"],
  "sessionTimestamp": 1234567890
}
```

## Backward Compatibility

The new system maintains backward compatibility by:

1. **Dual Property Support**: Both `institutionId` and `institutionId` are available in requests
2. **Alias Methods**: Old method names redirect to new implementations
3. **Gradual Migration**: Old endpoints continue to work during transition

### Compatibility Mappings
```javascript
// In middleware
req.institutionId = req.institutionId; // Backward compatibility
req.user.institutionId = req.user.institutionId;

// In services
async getinstitutionUsers(institutionId) {
  return this.getInstitutionUsers(institutionId);
}

async createinstitution(institutionData) {
  return this.createInstitution(institutionData);
}
```

## Frontend Updates Required

### 1. Update Registration Form
```javascript
// Add institution-specific fields
const institutionFields = [
  'institutionName',
  'institutionEmail', 
  'institutionType',
  'registrationNumber',
  'taxId',
  'website'
];
```

### 2. Update User Context
```javascript
// Before
const { institutionId, institutionName } = useAuth();

// After  
const { institutionId, institutionName, institutionId } = useAuth(); // institutionId for compatibility
```

### 3. Update API Calls
```javascript
// Update all API calls to use institutionId
const response = await api.get(`/api/users?institutionId=${institutionId}`);
```

## Testing Checklist

### Database Migration
- [ ] All existing institutions migrated to institutions
- [ ] All existing users migrated to institution_users
- [ ] Foreign key references updated
- [ ] Backup tables created

### Authentication
- [ ] Institution registration works
- [ ] User login works with new structure
- [ ] JWT tokens contain correct institution data
- [ ] Session management works

### User Management
- [ ] Create new users within institution
- [ ] Update user permissions
- [ ] User status management
- [ ] Profile updates

### Backward Compatibility
- [ ] Old API endpoints still work
- [ ] Existing frontend continues to function
- [ ] Database queries work with both institution_id and institution_id

### Permissions & Access Control
- [ ] Role-based permissions work
- [ ] Warehouse access restrictions work
- [ ] Institution isolation maintained

## Rollback Plan

If issues occur, rollback steps:

1. **Restore Original Files**
```bash
cp src/services/authService-backup.js src/services/authService.js
cp src/controllers/authController-backup.js src/controllers/authController.js
cp src/middleware/auth-backup.js src/middleware/auth.js
```

2. **Restore Database** (if needed)
```sql
-- Drop new tables
DROP TABLE institution_users;
DROP TABLE institutions;

-- Restore from backup
CREATE TABLE institutions AS SELECT * FROM institutions_backup;
CREATE TABLE users AS SELECT * FROM users_backup;
```

## Benefits of New Structure

1. **Better Separation**: Clear distinction between institutional and user data
2. **Enhanced Metadata**: More detailed institution information
3. **Improved Scalability**: Better support for different institution types
4. **Clearer Relationships**: More intuitive data model
5. **Future-Proof**: Easier to extend with additional features

## Next Steps After Migration

1. **Remove Backward Compatibility**: After confirming everything works
2. **Drop Old Tables**: Remove `institutions` and `users` tables
3. **Clean Up Code**: Remove dual property support
4. **Update Documentation**: Reflect new structure in all docs
5. **Performance Optimization**: Add indexes for new query patterns

## Support

For issues during migration:
1. Check logs in `logs/` directory
2. Verify database state with provided scripts
3. Use backup tables for data recovery if needed
4. Test thoroughly in development environment first