import { lazy } from 'react';

export const PageLoader = () => (
  <div className="loading-container">
    <div className="loading-spinner">Loading...</div>
  </div>
);

/** Dynamic import fn — shared by React.lazy and hover prefetch. */
export const routeImports = {
  '/platform/login': () => import('../pages/auth/PlatformAdminLogin.jsx'),
  '/platform/dashboard': () => import('../platform/PlatformDashboard.jsx'),
  '/platform/institutions': () => import('../platform/PlatformTenants.jsx'),
  '/platform/plans': () => import('../platform/PlatformPlans.jsx'),
  '/platform/subscription-requests': () => import('../platform/PlatformSubscriptionRequests.jsx'),
  '/platform/activity': () => import('../platform/PlatformActivity.jsx'),
  '/platform/profile': () => import('../platform/PlatformProfile.jsx'),
  '/dashboard': () => import('../pages/dashboard/Dashboard.jsx'),
  '/inventory': () => import('../pages/inventory/Inventory.jsx'),
  '/inventory/adjustments': () => import('../pages/inventory/InventoryAdjustments.jsx'),
  '/inventory/kit-assembly': () => import('../pages/production/KitAssembly.jsx'),
  '/production/bom-items': () => import('../pages/production/BomItems.jsx'),
  '/production/batch-rules': () => import('../pages/production/BatchRulesPage.jsx'),
  '/items/sku-rules': () => import('../pages/inventory/SkuRulesPage.jsx'),
  '/production/kit-assembly': () => import('../pages/production/KitAssembly.jsx'),
  '/inventory/shipments': () => import('../pages/inventory/Shipments.jsx'),
  '/inventory/putaways': () => import('../pages/inventory/Putaways.jsx'),
  '/inventory/move-orders': () => import('../pages/inventory/MoveOrders.jsx'),
  '/inventory/packages': () => import('../pages/inventory/Packages.jsx'),
  '/inventory/stock-count': () => import('../pages/inventory/StockCount.jsx'),
  '/inventory/batch-tracking': () => import('../pages/inventory/BatchTracking.jsx'),
  '/inventory/reorder-levels': () => import('../pages/inventory/ReorderLevels.jsx'),
  '/items': () => import('../pages/inventory/Items.jsx'),
  '/items/trash': () => import('../pages/inventory/ItemTrash.jsx'),
  '/item-groups': () => import('../pages/inventory/ItemGroups.jsx'),
  '/warehouses': () => import('../pages/settings/Warehouses.jsx'),
  '/warehouses/locations': () => import('../pages/settings/WarehouseLocations.jsx'),
  '/purchase-orders': () => import('../pages/purchases/PurchaseOrders.jsx'),
  '/sales-orders': () => import('../pages/sales/SalesOrders.jsx'),
  '/users': () => import('../pages/settings/Users.jsx'),
  '/reports': () => import('../pages/reports/Reports.jsx'),
  '/profit-loss': () => import('../pages/reports/ProfitLoss.jsx'),
  '/settings': () => import('../pages/settings/Settings.jsx'),
  '/settings/exchange-rate': () => import('../pages/settings/ExchangeRateSettings.jsx'),
  '/account-settings': () => import('../pages/settings/AccountSettings.jsx'),
  '/company-settings': () => import('../pages/settings/CompanySettings.jsx'),
  '/documents': () => import('../pages/documents/Documents.jsx'),
  '/purchases/vendors': () => import('../pages/entities/vendors/Vendors.jsx'),
  '/sales/customers': () => import('../pages/entities/customers/Customers.jsx'),
  '/invoices/dashboard': () => import('../pages/sales/InvoiceDashboard.jsx'),
  '/invoices/purchase': () => import('../pages/purchases/PurchaseInvoices.jsx'),
  '/invoices/sales': () => import('../pages/sales/SalesInvoices.jsx'),
  '/invoices/third-party': () => import('../pages/sales/ThirdPartyInvoices.jsx'),
  '/invoices/outstanding': () => import('../pages/sales/OutstandingInvoices.jsx'),
  '/accounting': () => import('../pages/accounting/Accounting.jsx'),
  '/audit': () => import('../pages/audit/AuditDashboard.jsx'),
  '/tax': () => import('../pages/tax/TaxManagement.jsx'),
  '/price-lists': () => import('../pages/price-lists/PriceLists.jsx'),
  '/subscription': () => import('../pages/subscription/SubscriptionManagement.jsx'),
  '/workflows': () => import('../pages/workflows/WorkflowAutomation.jsx'),
  '/user-guides': () => import('../pages/workflows/UserGuides.jsx'),
  '/sales/delivery-challans': () => import('../pages/sales/DeliveryChallans.jsx'),
  '/sales/payments-received': () => import('../pages/sales/PaymentReceived.jsx'),
  '/sales/returns': () => import('../pages/sales/SalesReturns.jsx'),
  '/sales/credit-notes': () => import('../pages/sales/CreditNotes.jsx'),
  '/sales/proforma-invoices': () => import('../pages/sales/ProformaInvoices.jsx'),
  '/purchases/receives': () => import('../pages/purchases/PurchasesReceives.jsx'),
  '/purchases/bills': () => import('../pages/purchases/PurchasesBills.jsx'),
  '/purchases/payments-made': () => import('../pages/purchases/PurchasesPayamentMade.jsx'),
  '/purchases/vendor-credits': () => import('../pages/purchases/VendorCredits.jsx'),
  '/purchases/returns': () => import('../pages/purchases/PurchaseReturns.jsx'),
  '/invoices/payments': () => import('../pages/sales/InvoiceMayments.jsx'),
  '/purchase-invoices': () => import('../pages/purchases/PurchaseInvoices.jsx'),
  '/sales-invoices': () => import('../pages/sales/SalesInvoices.jsx'),
  '/scan': () => import('../pages/scanner/MobileScanner.jsx'),
};

const lazyFrom = (path) => lazy(routeImports[path]);

export const PlatformAdminLogin = lazyFrom('/platform/login');
export const PlatformAdminShell = lazy(() => import('../platform/PlatformAdminShell.jsx'));
export const PlatformDashboard = lazyFrom('/platform/dashboard');
export const PlatformTenants = lazyFrom('/platform/institutions');
export const PlatformTenantDetail = lazy(() => import('../platform/PlatformTenantDetail.jsx'));
export const PlatformPlans = lazyFrom('/platform/plans');
export const PlatformActivity = lazyFrom('/platform/activity');
export const PlatformActiveSessionDetail = lazy(() => import('../platform/PlatformActiveSessionDetail.jsx'));
export const PlatformProfile = lazyFrom('/platform/profile');
export const PlatformSubscriptionRequests = lazyFrom('/platform/subscription-requests');

export const Dashboard = lazyFrom('/dashboard');
export const Inventory = lazyFrom('/inventory');
export const Packages = lazyFrom('/inventory/packages');
export const Items = lazyFrom('/items');
export const InventoryAdjustments = lazyFrom('/inventory/adjustments');
export const MoveOrders = lazyFrom('/inventory/move-orders');
export const Shipments = lazyFrom('/inventory/shipments');
export const Putaways = lazyFrom('/inventory/putaways');
export const Warehouses = lazyFrom('/warehouses');
export const WarehouseLocations = lazyFrom('/warehouses/locations');
export const PurchaseOrders = lazyFrom('/purchase-orders');
export const SalesOrders = lazyFrom('/sales-orders');
export const Users = lazyFrom('/users');
export const Reports = lazyFrom('/reports');
export const Settings = lazyFrom('/settings');
export const CompanySettings = lazyFrom('/company-settings');
export const AccountSettings = lazyFrom('/account-settings');
export const Documents = lazyFrom('/documents');
export const Vendors = lazyFrom('/purchases/vendors');
export const NewVendor = lazy(() => import('../pages/entities/vendors/NewVendor.jsx'));
export const ViewVendor = lazy(() => import('../pages/entities/vendors/ViewVendor.jsx'));
export const EditVendor = lazy(() => import('../pages/entities/vendors/EditVendor.jsx'));
export const Customers = lazyFrom('/sales/customers');
export const NewCustomer = lazy(() => import('../pages/entities/customers/NewCustomer.jsx'));
export const ViewCustomer = lazy(() => import('../pages/entities/customers/ViewCustomer.jsx'));
export const EditCustomer = lazy(() => import('../pages/entities/customers/EditCustomer.jsx'));
export const ProfitLoss = lazyFrom('/profit-loss');
export const InvoiceDashboard = lazyFrom('/invoices/dashboard');
export const PurchaseInvoices = lazyFrom('/invoices/purchase');
export const SalesInvoices = lazyFrom('/invoices/sales');
export const ThirdPartyInvoices = lazyFrom('/invoices/third-party');
export const OutstandingInvoices = lazyFrom('/invoices/outstanding');
export const ItemGroups = lazyFrom('/item-groups');
export const ItemTrash = lazyFrom('/items/trash');
export const DeliveryChallans = lazyFrom('/sales/delivery-challans');
export const PaymentReceived = lazyFrom('/sales/payments-received');
export const SalesReturns = lazyFrom('/sales/returns');
export const CreditNotes = lazyFrom('/sales/credit-notes');
export const ProformaInvoices = lazyFrom('/sales/proforma-invoices');
export const PurchasesReceives = lazyFrom('/purchases/receives');
export const PurchasesBills = lazyFrom('/purchases/bills');
export const PurchasesPaymentMade = lazyFrom('/purchases/payments-made');
export const VendorCredits = lazyFrom('/purchases/vendor-credits');
export const InvoicePayments = lazyFrom('/invoices/payments');
export const StockCount = lazyFrom('/inventory/stock-count');
export const ReorderLevels = lazyFrom('/inventory/reorder-levels');
export const KitAssembly = lazyFrom('/production/kit-assembly');
export const BomItems = lazyFrom('/production/bom-items');
export const BatchRulesPage = lazyFrom('/production/batch-rules');
export const SkuRulesPage = lazyFrom('/items/sku-rules');
export const BatchTracking = lazyFrom('/inventory/batch-tracking');
export const PurchaseReturns = lazyFrom('/purchases/returns');
export const ExchangeRateSettings = lazyFrom('/settings/exchange-rate');
export const MobileScanner = lazyFrom('/scan');
export const Accounting = lazyFrom('/accounting');
export const AuditDashboard = lazyFrom('/audit');
export const TaxManagement = lazyFrom('/tax');
export const PriceLists = lazyFrom('/price-lists');
export const SubscriptionManagement = lazyFrom('/subscription');
export const WorkflowAutomation = lazyFrom('/workflows');
export const UserGuides = lazyFrom('/user-guides');

const preloadKeys = Object.keys(routeImports).sort((a, b) => b.length - a.length);

/** Prefetch a route chunk on sidebar hover so navigation feels instant. */
export function preloadRoute(path) {
  if (!path || typeof path !== 'string' || !path.startsWith('/')) return;
  const normalized = path.split('?')[0];
  const exact = routeImports[normalized];
  if (exact) {
    exact();
    return;
  }
  const prefixKey = preloadKeys.find(
    (key) => normalized === key || normalized.startsWith(`${key}/`)
  );
  if (prefixKey) routeImports[prefixKey]();
}
