# Category Management Permissions Guide

## Overview
The IMS system uses role-based permissions to control who can create, view, and manage categories.

## Permission Types

### Category Permissions
- `category_management` - Create, update, delete categories
- `category_view` - View categories and category tree

## Default Role Permissions

### Admin Role
```json
{
  "all": true
}
```
- Has all permissions including category management

### Manager Role (Example)
```json
{
  "category_management": true,
  "category_view": true,
  "inventory_management": true,
  "inventory_view": true,
  "purchase_management": true,
  "sales_management": true
}
```

### User Role (Example)
```json
{
  "category_view": true,
  "inventory_view": true,
  "purchase_view": true,
  "sales_view": true
}
```

## Setting Up User Permissions

### 1. Create User with Category Management Permission
```javascript
// When creating a user
const userData = {
  email: "manager@company.com",
  password: "password123",
  firstName: "John",
  lastName: "Manager",
  role: "manager",
  permissions: {
    "category_management": true,
    "category_view": true,
    "inventory_management": true,
    "inventory_view": true
  }
};
```

### 2. Update Existing User Permissions
```javascript
// Update user permissions via API
PUT /api/users/{userId}/permissions
{
  "permissions": {
    "category_management": true,
    "category_view": true
  }
}
```

## API Endpoints with Permissions

### Category Management Endpoints
- `POST /api/categories` - Requires `category_management`
- `PUT /api/categories/:id` - Requires `category_management`  
- `DELETE /api/categories/:id` - Requires `category_management`
- `GET /api/categories` - Requires `category_view`
- `GET /api/categories/tree` - Requires `category_view`

## Frontend Permission Checks

The frontend should check user permissions before showing category management features:

```javascript
// Check if user can manage categories
const canManageCategories = user.permissions?.category_management || user.permissions?.all;

// Check if user can view categories
const canViewCategories = user.permissions?.category_view || user.permissions?.all;

// Show/hide UI elements based on permissions
{canManageCategories && (
  <Button onClick={showCreateCategoryModal}>
    Create Category
  </Button>
)}
```

## Permission Hierarchy

1. **Admin** - Full access (all: true)
2. **Manager** - Specific permissions including category_management
3. **User** - Limited permissions, typically only category_view

## Security Notes

- All API endpoints are protected with permission middleware
- Frontend permission checks are for UX only - backend enforces security
- Permissions are validated on every API request
- institution isolation ensures users can only manage categories in their institution