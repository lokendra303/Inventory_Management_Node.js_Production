const authService = require('../services/authService');

/**
 * Example script showing how to create users with different category permissions
 */

// Example 1: Create Manager with Category Management Permission
async function createCategoryManager(institutionId) {
  const managerData = {
    email: "category.manager@company.com",
    password: "SecurePass123!",
    firstName: "Category",
    lastName: "Manager",
    role: "manager",
    permissions: {
      "category_management": true,
      "category_view": true,
      "inventory_management": true,
      "inventory_view": true,
      "purchase_view": true,
      "sales_view": true
    },
    warehouseAccess: [] // Access to all warehouses
  };

  try {
    const userId = await authService.createUser(institutionId, managerData, 'system');
    console.log('Category Manager created:', userId);
    return userId;
  } catch (error) {
    console.error('Error creating category manager:', error.message);
  }
}

// Example 2: Create Regular User with View-Only Permission
async function createViewOnlyUser(institutionId) {
  const userData = {
    email: "viewer@company.com",
    password: "SecurePass123!",
    firstName: "View",
    lastName: "User",
    role: "user",
    permissions: {
      "category_view": true,
      "inventory_view": true,
      "purchase_view": true,
      "sales_view": true
    },
    warehouseAccess: ["warehouse-id-1"] // Limited warehouse access
  };

  try {
    const userId = await authService.createUser(institutionId, userData, 'system');
    console.log('View-only user created:', userId);
    return userId;
  } catch (error) {
    console.error('Error creating view-only user:', error.message);
  }
}

// Example 3: Update Existing User to Add Category Management Permission
async function grantCategoryPermission(institutionId, userId) {
  const newPermissions = {
    "category_management": true,
    "category_view": true,
    "inventory_view": true,
    "purchase_view": true,
    "sales_view": true
  };

  try {
    await authService.updateUserPermissions(institutionId, userId, newPermissions, []);
    console.log('Category permissions granted to user:', userId);
  } catch (error) {
    console.error('Error updating permissions:', error.message);
  }
}

// Example 4: Remove Category Management Permission
async function revokeCategoryPermission(institutionId, userId) {
  const newPermissions = {
    "category_view": true, // Keep view permission
    "inventory_view": true,
    "purchase_view": true,
    "sales_view": true
    // category_management removed
  };

  try {
    await authService.updateUserPermissions(institutionId, userId, newPermissions, []);
    console.log('Category management permission revoked from user:', userId);
  } catch (error) {
    console.error('Error updating permissions:', error.message);
  }
}

module.exports = {
  createCategoryManager,
  createViewOnlyUser,
  grantCategoryPermission,
  revokeCategoryPermission
};