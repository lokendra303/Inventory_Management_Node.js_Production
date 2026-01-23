/**
 * System Permissions Constants
 * These permissions control access to different parts of the IMS system
 */

const PERMISSIONS = {
  // Admin permissions
  ALL: 'all', // Super admin - access to everything
  
  // User Management
  USER_MANAGEMENT: 'user_management',
  
  // Inventory Operations
  INVENTORY_VIEW: 'inventory_view',
  INVENTORY_RECEIVE: 'inventory_receive',
  INVENTORY_RESERVE: 'inventory_reserve', 
  INVENTORY_SHIP: 'inventory_ship',
  INVENTORY_ADJUST: 'inventory_adjust',
  INVENTORY_TRANSFER: 'inventory_transfer',
  INVENTORY_MANAGEMENT: 'inventory_management', // For reorder levels, alerts
  
  // Item Management
  ITEM_VIEW: 'item_view',
  ITEM_MANAGEMENT: 'item_management',
  
  // Warehouse Management
  WAREHOUSE_VIEW: 'warehouse_view',
  WAREHOUSE_MANAGEMENT: 'warehouse_management',
  WAREHOUSE_TYPE_VIEW: 'warehouse_type_view',
  WAREHOUSE_TYPE_MANAGEMENT: 'warehouse_type_management',
  
  // Category Management
  CATEGORY_VIEW: 'category_view',
  CATEGORY_MANAGEMENT: 'category_management',
  
  // Purchase Management
  PURCHASE_VIEW: 'purchase_view',
  PURCHASE_MANAGEMENT: 'purchase_management',
  
  // Sales Management
  SALES_VIEW: 'sales_view',
  SALES_MANAGEMENT: 'sales_management',
  
  // Vendor Management
  VENDOR_VIEW: 'vendor_view',
  VENDOR_MANAGEMENT: 'vendor_management'
};

/**
 * Default role permissions
 */
const ROLE_PERMISSIONS = {
  admin: {
    [PERMISSIONS.ALL]: true
  },
  
  manager: {
    [PERMISSIONS.INVENTORY_VIEW]: true,
    [PERMISSIONS.INVENTORY_RECEIVE]: true,
    [PERMISSIONS.INVENTORY_RESERVE]: true,
    [PERMISSIONS.INVENTORY_SHIP]: true,
    [PERMISSIONS.INVENTORY_ADJUST]: true,
    [PERMISSIONS.INVENTORY_TRANSFER]: true,
    [PERMISSIONS.INVENTORY_MANAGEMENT]: true,
    [PERMISSIONS.ITEM_VIEW]: true,
    [PERMISSIONS.ITEM_MANAGEMENT]: true,
    [PERMISSIONS.WAREHOUSE_VIEW]: true,
    [PERMISSIONS.WAREHOUSE_MANAGEMENT]: true,
    [PERMISSIONS.WAREHOUSE_TYPE_VIEW]: true,
    [PERMISSIONS.WAREHOUSE_TYPE_MANAGEMENT]: true,
    [PERMISSIONS.CATEGORY_VIEW]: true,
    [PERMISSIONS.CATEGORY_MANAGEMENT]: true,
    [PERMISSIONS.PURCHASE_VIEW]: true,
    [PERMISSIONS.PURCHASE_MANAGEMENT]: true,
    [PERMISSIONS.SALES_VIEW]: true,
    [PERMISSIONS.SALES_MANAGEMENT]: true,
    [PERMISSIONS.VENDOR_VIEW]: true,
    [PERMISSIONS.VENDOR_MANAGEMENT]: true
  },
  
  user: {
    [PERMISSIONS.INVENTORY_VIEW]: true,
    [PERMISSIONS.ITEM_VIEW]: true,
    [PERMISSIONS.WAREHOUSE_VIEW]: true,
    [PERMISSIONS.WAREHOUSE_TYPE_VIEW]: true,
    [PERMISSIONS.CATEGORY_VIEW]: true,
    [PERMISSIONS.CATEGORY_MANAGEMENT]: true,
    [PERMISSIONS.PURCHASE_VIEW]: true,
    [PERMISSIONS.SALES_VIEW]: true,
    [PERMISSIONS.VENDOR_VIEW]: true
  }
};

/**
 * Permission groups for easier management
 */
const PERMISSION_GROUPS = {
  'All Permissions (Admin)': [PERMISSIONS.ALL],
  
  'User Management': [PERMISSIONS.USER_MANAGEMENT],
  
  'Inventory Operations': [
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_RECEIVE,
    PERMISSIONS.INVENTORY_RESERVE,
    PERMISSIONS.INVENTORY_SHIP,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_TRANSFER,
    PERMISSIONS.INVENTORY_MANAGEMENT
  ],
  
  'Item Management': [
    PERMISSIONS.ITEM_VIEW,
    PERMISSIONS.ITEM_MANAGEMENT
  ],
  
  'Warehouse Management': [
    PERMISSIONS.WAREHOUSE_VIEW,
    PERMISSIONS.WAREHOUSE_MANAGEMENT,
    PERMISSIONS.WAREHOUSE_TYPE_VIEW,
    PERMISSIONS.WAREHOUSE_TYPE_MANAGEMENT
  ],
  
  'Category Management': [
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.CATEGORY_MANAGEMENT
  ],
  
  'Purchase Management': [
    PERMISSIONS.PURCHASE_VIEW,
    PERMISSIONS.PURCHASE_MANAGEMENT,
    PERMISSIONS.VENDOR_VIEW,
    PERMISSIONS.VENDOR_MANAGEMENT
  ],
  
  'Sales Management': [
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_MANAGEMENT
  ]
};

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  PERMISSION_GROUPS
};