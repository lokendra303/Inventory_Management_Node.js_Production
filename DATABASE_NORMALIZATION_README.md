# Database Normalization & Session Management

## Overview
This document outlines the recent improvements made to the inventory management system, focusing on database normalization and automatic session management.

## Database Normalization

### Problem Solved
Previously, vendor and customer tables contained redundant address and bank detail columns, leading to:
- Data duplication
- Maintenance complexity
- Limited scalability (only one address/bank account per entity)

### Solution Implemented
Created normalized database structure with separate tables:

#### New Tables
1. **`addresses`** - Stores all billing and shipping addresses
   - `entity_type` (vendor/customer)
   - `entity_id` (VARCHAR(36) - UUID reference)
   - `address_type` (billing/shipping)
   - Address fields (attention, country, address1, address2, city, state, pin_code)

2. **`bank_details`** - Stores all banking information
   - `entity_type` (vendor/customer)
   - `entity_id` (VARCHAR(36) - UUID reference)
   - Bank fields (bank_name, account_holder_name, account_number, ifsc_code, etc.)

### Benefits
- **Eliminated Redundancy**: No duplicate address/bank columns
- **Scalability**: Support for multiple addresses/bank accounts per entity
- **Maintainability**: Single source of truth for addresses and banking
- **Extensibility**: Easy to add new entity types (suppliers, employees)

### Migration Process
1. Created normalized tables with proper indexes
2. Migrated existing data from vendor/customer tables
3. Updated service layer to use JOIN queries
4. Removed redundant columns from original tables

## Session Management

### Problem Solved
Users were experiencing unexpected session timeouts during active work, leading to:
- Lost work and frustration
- Poor user experience
- Arbitrary timeout regardless of activity

### Solution Implemented
Activity-based session management system:

#### Frontend (`useSessionManager` Hook)
- **Activity Tracking**: Monitors mouse, keyboard, touch, and scroll events
- **Smart Extension**: Extends session automatically when user is active
- **User Warnings**: Shows warning 5 minutes before expiry
- **Graceful Logout**: Auto-logout after true inactivity (25 minutes)

#### Backend API
- **Session Extension Endpoint**: `POST /auth/extend-session`
- **Token Refresh**: Generates new JWT with updated timestamp
- **Security**: Validates user/institution status before extending

### Configuration
```javascript
const ACTIVITY_TIMEOUT = 25 * 60 * 1000; // 25 minutes total
const WARNING_TIME = 5 * 60 * 1000; // Warning 5 minutes before
const EXTEND_THRESHOLD = 5 * 60 * 1000; // Extend if 5+ minutes since last
```

### Benefits
- **User-Friendly**: No interruptions during active work
- **Secure**: Sessions expire after true inactivity
- **Efficient**: Minimal API calls (only when needed)
- **Configurable**: Easy to adjust timeouts

## Technical Implementation

### Service Layer Changes
- **VendorService**: Updated to use normalized tables with transactions
- **CustomerService**: Similar normalization implementation
- **AuthService**: Added session extension functionality

### Database Schema
```sql
-- Addresses table
CREATE TABLE addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_type ENUM('vendor', 'customer') NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  address_type ENUM('billing', 'shipping') NOT NULL,
  -- address fields...
  INDEX idx_entity (entity_type, entity_id)
);

-- Bank details table
CREATE TABLE bank_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_type ENUM('vendor', 'customer') NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  -- bank fields...
  INDEX idx_entity (entity_type, entity_id)
);
```

### API Compatibility
The changes maintain backward compatibility:
- Frontend continues to work with existing field names
- Service layer handles mapping between camelCase and snake_case
- Data is joined and returned in expected format

## Files Modified

### Backend
- `src/services/vendorService.js` - Normalized database operations
- `src/services/customerService.js` - Normalized database operations
- `src/services/authService.js` - Session extension functionality
- `src/controllers/authController.js` - Session extension endpoint
- `src/routes/auth.js` - Added extend-session route

### Frontend
- `src/hooks/useSessionManager.js` - Activity-based session management
- `src/App.js` - Integrated session manager for authenticated users
- `src/hooks/useAuth.js` - Cleaned up conflicting session code

### Database Scripts
- `src/scripts/normalize-tables.js` - Database normalization script

## Usage for Developers

### Adding New Entity Types
To add support for addresses/bank details for new entities:

1. Update ENUM values in table definitions:
```sql
ALTER TABLE addresses MODIFY COLUMN entity_type ENUM('vendor', 'customer', 'supplier');
```

2. Use the same service pattern:
```javascript
// Create address
await connection.execute(
  'INSERT INTO addresses (entity_type, entity_id, address_type, ...) VALUES (?, ?, ?, ...)',
  ['supplier', supplierId, 'billing', ...]
);
```

### Session Management Configuration
To modify session timeouts, update constants in `useSessionManager.js`:
```javascript
const ACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_TIME = 10 * 60 * 1000; // 10 minute warning
```

## Monitoring & Debugging

### Logging
- Vendor/customer operations are logged with context
- Session extensions are logged for monitoring
- Database transactions ensure data consistency

### Error Handling
- Proper error messages for database failures
- Session expiry notifications to users
- Graceful fallbacks for API failures

## Future Enhancements

### Potential Improvements
1. **Multiple Bank Accounts**: Support multiple bank accounts per entity
2. **Address Types**: Add more address types (delivery, pickup, etc.)
3. **Session Analytics**: Track session patterns for optimization
4. **Progressive Warnings**: Multiple warnings before expiry

### Scalability Considerations
- Database indexes optimize query performance
- Connection pooling handles concurrent requests
- Normalized structure supports future growth