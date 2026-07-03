import { APP_VERSION, semverGte } from '../config/appVersion';
import { hasPermission, hasRole } from '../config/permissions';

/**
 * Single source of truth — mirrors web Sidebar.jsx module groups.
 * route: bottom-tab name | screen: stack screen inside that tab
 */
export const MENU_SECTIONS = [
  {
    id: 'inventory',
    label: 'Inventory',
    icon: 'warehouse',
    accent: '#0EA5E9',
    minVersion: '1.0',
    homeFeatured: true,
    anyPermission: [
      'inventory_view', 'inventory_receive', 'inventory_adjust',
      'inventory_transfer', 'inventory_ship', 'inventory_management',
    ],
    items: [
      { route: 'InventoryTab', screen: 'InventoryMain', label: 'Stock overview', permission: 'inventory_view', version: '1.0', icon: 'view-grid-outline', homeFeatured: true },
      { route: 'InventoryTab', screen: 'GrnList', label: 'Receive (GRN)', permission: 'inventory_receive', version: '1.1', icon: 'truck-delivery-outline', homeFeatured: true },
      { route: 'InventoryTab', screen: 'Putaways', label: 'Putaways', permission: 'inventory_receive', version: '1.1', icon: 'archive-arrow-down-outline', homeFeatured: true },
      { route: 'InventoryTab', screen: 'StockCounts', label: 'Stock count', permission: 'inventory_adjust', version: '1.1', icon: 'clipboard-check-outline', homeFeatured: true },
      { route: 'InventoryTab', screen: 'Adjustments', label: 'Adjustments', permission: 'inventory_adjust', version: '2.0', icon: 'tune-vertical' },
      { route: 'InventoryTab', screen: 'BatchTracking', label: 'Batch / serial', permission: 'inventory_view', version: '1.1', icon: 'layers-outline' },
      { route: 'InventoryTab', screen: 'ReorderLevels', label: 'Reorder levels', permission: 'inventory_view', version: '3.0', icon: 'bell-ring-outline' },
      { route: 'InventoryTab', screen: 'Packages', label: 'Packages', permission: 'inventory_view', version: '3.0', icon: 'package-variant-closed' },
      { route: 'InventoryTab', screen: 'Shipments', label: 'Shipments', permission: 'inventory_ship', version: '3.0', icon: 'truck-fast-outline' },
      { route: 'InventoryTab', screen: 'Transfers', label: 'Move orders', permission: 'inventory_transfer', version: '2.0', icon: 'swap-horizontal' },
      { route: 'InventoryTab', screen: 'TransferApprovals', label: 'Transfer approvals', permission: 'inventory_view', version: '2.0', icon: 'clipboard-check-multiple-outline' },
    ],
  },
  {
    id: 'production',
    label: 'Production',
    icon: 'hammer-screwdriver',
    accent: '#8B5CF6',
    minVersion: '3.0',
    homeFeatured: true,
    anyPermission: ['production_view', 'production_management'],
    items: [
      { route: 'MoreTab', screen: 'ProductionBom', label: 'BOM items', permission: 'production_view', version: '3.0', icon: 'hammer-screwdriver', homeFeatured: true },
      { route: 'MoreTab', screen: 'BatchRules', label: 'Batch coding rules', permission: 'production_management', version: '3.0', icon: 'barcode' },
      { route: 'MoreTab', screen: 'KitAssembly', label: 'Manufacturing', permission: 'production_management', version: '3.0', icon: 'factory' },
    ],
  },
  {
    id: 'items',
    label: 'Items',
    icon: 'cube-outline',
    accent: '#6366F1',
    minVersion: '1.0',
    homeFeatured: true,
    anyPermission: ['item_view', 'item_management'],
    items: [
      { route: 'ItemsTab', screen: 'ItemsList', label: 'All items', permission: 'item_view', version: '1.0', icon: 'format-list-bulleted', homeFeatured: true },
      { route: 'ScanTab', screen: null, label: 'Barcode scan', permission: 'item_view', version: '1.0', icon: 'barcode-scan', homeFeatured: true },
      { route: 'ItemsTab', screen: 'ItemGroups', label: 'Item groups', permission: 'item_view', version: '2.0', icon: 'folder-outline' },
      { route: 'ItemsTab', screen: 'ItemTrash', label: 'Trash', permission: 'item_view', version: '3.0', icon: 'delete-restore' },
      { route: 'MoreTab', screen: 'SkuRules', label: 'SKU rules', permission: 'item_management', version: '1.0', icon: 'tag-outline' },
    ],
  },
  {
    id: 'warehouses',
    label: 'Warehouses',
    icon: 'store-marker-outline',
    accent: '#14B8A6',
    minVersion: '1.1',
    homeFeatured: false,
    anyPermission: ['warehouse_view', 'warehouse_management', 'inventory_view'],
    items: [
      { route: 'InventoryTab', screen: 'Warehouses', label: 'Warehouses', permission: 'warehouse_view', version: '1.1', icon: 'store-marker-outline' },
      { route: 'InventoryTab', screen: 'WarehouseLocations', label: 'Zones / racks / bins', permission: 'warehouse_view', version: '3.0', icon: 'map-marker-radius-outline' },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: 'cart-outline',
    accent: '#F43F5E',
    minVersion: '2.0',
    homeFeatured: true,
    anyPermission: ['sales_view', 'sales_management', 'customer_view', 'customer_management'],
    items: [
      { route: 'MoreTab', screen: 'Customers', label: 'Customers', permission: 'customer_view', version: '2.0', icon: 'account-group-outline' },
      { route: 'MoreTab', screen: 'SalesOrders', label: 'Sales orders', permission: 'sales_view', version: '2.0', icon: 'file-document-outline', homeFeatured: true },
      { route: 'MoreTab', screen: 'SalesInvoices', label: 'Sales invoices', permission: 'sales_view', version: '3.0', icon: 'file-document-outline', homeFeatured: true },
      { route: 'MoreTab', screen: 'DeliveryChallans', label: 'Delivery challans', permission: 'sales_view', version: '2.0', icon: 'truck-fast-outline' },
      { route: 'MoreTab', screen: 'PaymentsReceived', label: 'Payments received', permission: 'sales_view', version: '3.0', icon: 'cash-plus' },
      { route: 'MoreTab', screen: 'SalesReturns', label: 'Sales returns', permission: 'sales_view', version: '3.0', icon: 'keyboard-return' },
      { route: 'MoreTab', screen: 'CreditNotes', label: 'Credit notes', permission: 'sales_view', version: '3.0', icon: 'note-minus-outline' },
    ],
  },
  {
    id: 'purchases',
    label: 'Purchases',
    icon: 'shopping-outline',
    accent: '#F59E0B',
    minVersion: '2.0',
    homeFeatured: true,
    anyPermission: ['purchase_view', 'purchase_management', 'vendor_view', 'vendor_management', 'inventory_receive'],
    items: [
      { route: 'MoreTab', screen: 'Vendors', label: 'Vendors', permission: 'vendor_view', version: '2.0', icon: 'truck-outline' },
      { route: 'MoreTab', screen: 'PurchaseOrders', label: 'Purchase orders', permission: 'purchase_view', version: '2.0', icon: 'file-document-outline', homeFeatured: true },
      { route: 'MoreTab', screen: 'PurchaseInvoices', label: 'Purchase invoices', permission: 'purchase_view', version: '3.0', icon: 'file-document-outline', homeFeatured: true },
      { route: 'MoreTab', screen: 'PurchaseReceives', label: 'Purchase receives', permission: 'inventory_receive', version: '3.0', icon: 'package-down' },
      { route: 'MoreTab', screen: 'PurchaseBills', label: 'Bills', permission: 'purchase_view', version: '3.0', icon: 'receipt' },
      { route: 'MoreTab', screen: 'PaymentsMade', label: 'Payments made', permission: 'purchase_view', version: '3.0', icon: 'cash-minus' },
      { route: 'MoreTab', screen: 'VendorCredits', label: 'Vendor credits', permission: 'purchase_view', version: '3.0', icon: 'note-minus-outline' },
      { route: 'MoreTab', screen: 'PurchaseReturns', label: 'Purchase returns', permission: 'purchase_view', version: '3.0', icon: 'keyboard-return' },
    ],
  },
  {
    id: 'invoices',
    label: 'Invoices',
    icon: 'file-swap-outline',
    accent: '#EC4899',
    minVersion: '3.0',
    homeFeatured: true,
    anyPermission: ['invoice_view', 'invoice_management'],
    items: [
      { route: 'MoreTab', screen: 'InvoiceDashboard', label: 'Invoice dashboard', permission: 'invoice_view', version: '3.0', icon: 'view-dashboard-outline', homeFeatured: true },
      { route: 'MoreTab', screen: 'PurchaseInvoices', label: 'Purchase invoices', permission: 'invoice_view', version: '3.0', icon: 'file-document-outline' },
      { route: 'MoreTab', screen: 'SalesInvoices', label: 'Sales invoices', permission: 'invoice_view', version: '3.0', icon: 'file-document-outline' },
      { route: 'MoreTab', screen: 'ThirdPartyInvoices', label: 'Third-party invoices', permission: 'invoice_view', version: '3.0', icon: 'file-swap-outline' },
      { route: 'MoreTab', screen: 'OutstandingInvoices', label: 'Outstanding', permission: 'invoice_view', version: '3.0', icon: 'clock-alert-outline', homeFeatured: true },
      { route: 'MoreTab', screen: 'InvoicePayments', label: 'Payments', permission: 'invoice_view', version: '3.0', icon: 'cash-multiple' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: 'book-open-outline',
    accent: '#0D9488',
    minVersion: '3.0',
    homeFeatured: true,
    anyPermission: ['invoice_view', 'invoice_management'],
    items: [
      { route: 'MoreTab', screen: 'Accounting', label: 'Accounting', permission: 'invoice_view', version: '3.0', icon: 'book-open-outline', homeFeatured: true },
      { route: 'MoreTab', screen: 'ProfitLoss', label: 'Profit & loss', permission: 'invoice_view', version: '3.0', icon: 'chart-line' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: 'chart-pie',
    accent: '#7C3AED',
    minVersion: '3.0',
    homeFeatured: true,
    anyPermission: [
      'inventory_view', 'sales_view', 'sales_management',
      'purchase_view', 'purchase_management', 'invoice_view', 'invoice_management',
    ],
    items: [
      { route: 'MoreTab', screen: 'ReportsHub', label: 'Reports home', permission: null, version: '3.0', icon: 'chart-pie', homeFeatured: true },
      { route: 'MoreTab', screen: 'ProfitLoss', label: 'Profit & loss', permission: null, version: '3.0', icon: 'chart-line' },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: 'shield-account-outline',
    accent: '#475569',
    minVersion: '3.0',
    homeFeatured: false,
    anyPermission: ['user_management', 'audit_view'],
    anyRole: ['admin', 'super_admin'],
    items: [
      { route: 'MoreTab', screen: 'Users', label: 'User management', permission: 'user_management', version: '3.0', icon: 'account-multiple-outline' },
      { route: 'MoreTab', screen: 'Roles', label: 'Roles', permission: 'user_management', version: '3.0', icon: 'shield-account-outline' },
      { route: 'MoreTab', screen: 'TaxRates', label: 'Tax management', permission: null, roles: ['admin', 'super_admin'], version: '3.0', icon: 'percent-outline' },
      { route: 'MoreTab', screen: 'PriceLists', label: 'Price lists', permission: null, roles: ['admin', 'super_admin'], version: '3.0', icon: 'tag-multiple-outline' },
      { route: 'MoreTab', screen: 'Workflows', label: 'Workflows', permission: null, roles: ['admin', 'super_admin'], version: '3.0', icon: 'lightning-bolt-outline' },
      { route: 'MoreTab', screen: 'Subscription', label: 'Subscription', permission: null, roles: ['admin', 'super_admin'], version: '3.0', icon: 'crown-outline' },
      { route: 'MoreTab', screen: 'AuditTrail', label: 'Audit trail', permission: 'audit_view', version: '3.0', icon: 'shield-search' },
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: 'folder-outline',
    accent: '#2563EB',
    minVersion: '3.0',
    homeFeatured: false,
    anyPermission: [],
    items: [
      { route: 'MoreTab', screen: 'Documents', label: 'Documents', permission: null, version: '3.0', icon: 'folder-outline' },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    icon: 'account-circle-outline',
    accent: '#64748B',
    minVersion: '1.0',
    homeFeatured: false,
    anyPermission: [],
    items: [
      { route: 'MoreTab', screen: 'SettingsMain', label: 'App settings', permission: null, version: '1.0', icon: 'account-cog-outline' },
      { route: 'MoreTab', screen: 'UserGuide', label: 'User guide', permission: null, version: '3.0', icon: 'book-open-page-variant-outline' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'cog-outline',
    accent: '#475569',
    minVersion: '3.0',
    homeFeatured: false,
    anyRole: ['admin', 'super_admin'],
    items: [
      { route: 'MoreTab', screen: 'CompanySettings', label: 'Company settings', permission: null, roles: ['admin', 'super_admin'], version: '3.0', icon: 'office-building-outline' },
      { route: 'MoreTab', screen: 'ExchangeRates', label: 'Exchange rate', permission: null, roles: ['admin', 'super_admin'], version: '3.0', icon: 'swap-horizontal' },
      { route: 'MoreTab', screen: 'AllSettings', label: 'All settings', permission: null, roles: ['admin', 'super_admin'], version: '3.0', icon: 'tune-vertical' },
    ],
  },
];

const MORE_DRAWER_SCREENS = new Set(['SettingsMain', 'SkuRules']);

function canAccessItem(user, item) {
  if (item.roles?.length && !hasRole(user, item.roles)) return false;
  if (item.permission && !hasPermission(user, item.permission)) return false;
  if (!item.permission && item.roles?.length) return hasRole(user, item.roles);
  return true;
}

function canAccessSection(user, section) {
  const roleOk = !section.anyRole?.length || hasRole(user, section.anyRole);
  const permOk = !section.anyPermission?.length || section.anyPermission.some((p) => hasPermission(user, p));
  if (section.anyRole?.length && section.anyPermission?.length) {
    return roleOk || permOk;
  }
  if (section.anyRole?.length) return roleOk;
  if (section.anyPermission?.length) return permOk;
  return true;
}

/** Tab navigator — walk up from drawer / stack children */
export function getTabNavigator(navigation) {
  let nav = navigation;
  for (let i = 0; i < 4; i += 1) {
    const parent = nav?.getParent?.();
    if (!parent) break;
    const state = parent.getState?.();
    if (state?.type === 'tab') return parent;
    nav = parent;
  }
  return navigation.getParent?.() || navigation;
}

export function navigateMenuItem(navigation, item) {
  if (!item) return;

  if (item.route === 'ScanTab') {
    getTabNavigator(navigation).navigate('ScanTab');
    return;
  }

  if (item.route === 'MoreTab') {
    const tabNav = getTabNavigator(navigation);
    if (MORE_DRAWER_SCREENS.has(item.screen)) {
      tabNav.navigate('MoreTab', { screen: 'MoreRoot', params: { screen: item.screen } });
      return;
    }
    tabNav.navigate('MoreTab', { screen: item.screen });
    return;
  }

  getTabNavigator(navigation).navigate(item.route, item.screen ? { screen: item.screen } : undefined);
}

export function buildVisibleMenu(user, appVersion = APP_VERSION) {
  return MENU_SECTIONS
    .filter((section) => semverGte(appVersion, section.minVersion))
    .filter((section) => canAccessSection(user, section))
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => semverGte(appVersion, item.version))
        .filter((item) => canAccessItem(user, item)),
    }))
    .filter((section) => section.items.length > 0);
}

/** Home: only sections flagged homeFeatured, max N items per section */
export function buildHomeSections(user, appVersion = APP_VERSION, maxPerSection = 4) {
  return buildVisibleMenu(user, appVersion)
    .filter((section) => section.homeFeatured !== false)
    .map((section) => {
      const featured = section.items.filter((i) => i.homeFeatured);
      const picks = (featured.length ? featured : section.items).slice(0, maxPerSection);
      return { ...section, items: picks, totalCount: section.items.length };
    })
    .filter((section) => section.items.length > 0);
}
