import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { App as AntApp, ConfigProvider, Layout, Select } from 'antd';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { CurrencyProvider } from './contexts/CurrencyContext.jsx';
import { withPermission } from './components/common/PermissionWrapper.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import { filterSelectOption } from './utils/selectFilter';
import Login from './pages/auth/Login.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import Header from './components/layout/Header.jsx';
import OnboardingWizard from './pages/onboarding/OnboardingWizard.jsx';
import {
  PageLoader,
  Dashboard,
  Inventory,
  Packages,
  Items,
  InventoryAdjustments,
  MoveOrders,
  Shipments,
  Putaways,
  Warehouses,
  WarehouseLocations,
  PurchaseOrders,
  SalesOrders,
  Users,
  Reports,
  Settings,
  CompanySettings,
  AccountSettings,
  Documents,
  Vendors,
  NewVendor,
  ViewVendor,
  EditVendor,
  Customers,
  NewCustomer,
  ViewCustomer,
  EditCustomer,
  ProfitLoss,
  InvoiceDashboard,
  PurchaseInvoices,
  SalesInvoices,
  ThirdPartyInvoices,
  OutstandingInvoices,
  ItemGroups,
  ItemTrash,
  DeliveryChallans,
  PaymentReceived,
  SalesReturns,
  CreditNotes,
  PurchasesReceives,
  PurchasesBills,
  PurchasesPaymentMade,
  VendorCredits,
  InvoicePayments,
  StockCount,
  ReorderLevels,
  KitAssembly,
  BatchTracking,
  PurchaseReturns,
  ExchangeRateSettings,
  MobileScanner,
  Accounting,
  AuditDashboard,
  TaxManagement,
  PriceLists,
  SubscriptionManagement,
  WorkflowAutomation,
  UserGuides,
  PlatformAdminLogin,
  PlatformAdminShell,
  PlatformDashboard,
  PlatformTenants,
  PlatformTenantDetail,
  PlatformPlans,
  PlatformActivity,
  PlatformActiveSessionDetail,
  PlatformProfile,
  PlatformSubscriptionRequests,
  preloadRoute,
} from './routes/lazyPages.jsx';
import './App.css';

const { Content } = Layout;

if (!Select.__imsSearchPatched) {
  Select.defaultProps = {
    ...(Select.defaultProps || {}),
    showSearch: true,
    filterOption: filterSelectOption,
  };
  Select.__imsSearchPatched = true;
}

const ProtectedInventory = withPermission('inventory_view')(Inventory);
const ProtectedPackages = withPermission('inventory_view')(Packages);
const ProtectedItems = withPermission('item_view')(Items);
const ProtectedItemGroups = withPermission(null, ['item_view', 'item_management'])(ItemGroups);
const ProtectedItemTrash = withPermission('item_view')(ItemTrash);
const ProtectedWarehouses = withPermission('warehouse_view')(Warehouses);
const ProtectedWarehouseLocations = withPermission('warehouse_view')(WarehouseLocations);
const ProtectedInventoryAdjustments = withPermission('inventory_adjust')(InventoryAdjustments);
const ProtectedKitAssembly = withPermission('inventory_adjust')(KitAssembly);
const ProtectedInventoryShipments = withPermission('inventory_ship')(Shipments);
const ProtectedPutaways = withPermission('inventory_receive')(Putaways);
const ProtectedMoveOrders = withPermission('inventory_transfer')(MoveOrders);
const ProtectedPurchaseOrders = withPermission('purchase_view')(PurchaseOrders);
const ProtectedSalesOrders = withPermission('sales_view')(SalesOrders);
const ProtectedUsers = withPermission('user_management')(Users);
const ProtectedVendors = withPermission(null, ['vendor_view', 'vendor_management'])(Vendors);
const ProtectedNewVendor = withPermission('vendor_management')(NewVendor);
const ProtectedViewVendor = withPermission(null, ['vendor_view', 'vendor_management'])(ViewVendor);
const ProtectedEditVendor = withPermission('vendor_management')(EditVendor);
const ProtectedCustomers = withPermission(null, ['customer_view', 'customer_management'])(Customers);
const ProtectedNewCustomer = withPermission('customer_management')(NewCustomer);
const ProtectedViewCustomer = withPermission(null, ['customer_view', 'customer_management'])(ViewCustomer);
const ProtectedEditCustomer = withPermission('customer_management')(EditCustomer);
const ProtectedInvoiceDashboard = withPermission('invoice_view')(InvoiceDashboard);
const ProtectedPurchaseInvoices = withPermission('invoice_view')(PurchaseInvoices);
const ProtectedSalesInvoices = withPermission('invoice_view')(SalesInvoices);
const ProtectedThirdPartyInvoices = withPermission('invoice_view')(ThirdPartyInvoices);
const ProtectedOutstandingInvoices = withPermission('invoice_view')(OutstandingInvoices);
const ProtectedStockCount = withPermission('inventory_adjust')(StockCount);
const ProtectedBatchTracking = withPermission('inventory_view')(BatchTracking);
const ProtectedPurchaseReturns = withPermission('purchase_view')(PurchaseReturns);
const ProtectedAccounting = withPermission('invoice_view')(Accounting);
const ProtectedAuditDashboard = withPermission('audit_view')(AuditDashboard);
const ProtectedReports = withPermission(null, ['inventory_view', 'sales_view', 'purchase_view', 'invoice_view'])(Reports);
const ProtectedProfitLoss = withPermission('inventory_view')(ProfitLoss);

function AppContent() {
  const { user, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (user) preloadRoute('/dashboard');
  }, [user]);

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar
        collapsed={collapsed}
        isMobile={isMobile}
        onClose={() => setCollapsed(true)}
      />
      <Layout>
        <Header
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          user={user}
          isMobile={isMobile}
        />
        <Content className="ant-layout-content">
          <OnboardingWizard />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/inventory" element={<ProtectedInventory />} />
              <Route path="/inventory/adjustments" element={<ProtectedInventoryAdjustments />} />
              <Route path="/inventory/kit-assembly" element={<ProtectedKitAssembly />} />
              <Route path="/inventory/shipments" element={<ProtectedInventoryShipments />} />
              <Route path="/inventory/putaways" element={<ProtectedPutaways />} />
              <Route path="/inventory/move-orders" element={<ProtectedMoveOrders />} />
              <Route path="/inventory/packages" element={<ProtectedPackages />} />
              <Route path="/inventory/stock-count" element={<ProtectedStockCount />} />
              <Route path="/inventory/batch-tracking" element={<ProtectedBatchTracking />} />
              <Route path="/inventory/reorder-levels" element={<ReorderLevels />} />
              <Route path="/items" element={<ProtectedItems />} />
              <Route path="/items/trash" element={<ProtectedItemTrash />} />
              <Route path="/item-groups" element={<ProtectedItemGroups />} />
              <Route path="/sales/delivery-challans" element={<DeliveryChallans />} />
              <Route path="/sales/payments-received" element={<PaymentReceived />} />
              <Route path="/sales/returns" element={<SalesReturns />} />
              <Route path="/sales/credit-notes" element={<CreditNotes />} />
              <Route path="/purchases/receives" element={<PurchasesReceives />} />
              <Route path="/purchases/bills" element={<PurchasesBills />} />
              <Route path="/purchases/payments-made" element={<PurchasesPaymentMade />} />
              <Route path="/purchases/vendor-credits" element={<VendorCredits />} />
              <Route path="/purchases/returns" element={<ProtectedPurchaseReturns />} />
              <Route path="/invoices/payments" element={<InvoicePayments />} />
              <Route path="/warehouses" element={<ProtectedWarehouses />} />
              <Route path="/warehouses/locations" element={<ProtectedWarehouseLocations />} />
              <Route path="/purchase-orders" element={<ProtectedPurchaseOrders />} />
              <Route path="/sales-orders" element={<ProtectedSalesOrders />} />
              <Route path="/users" element={<ProtectedUsers />} />
              <Route path="/roles" element={<ProtectedUsers />} />
              <Route path="/reports" element={<ProtectedReports />} />
              <Route path="/reports/*" element={<ProtectedReports />} />
              <Route path="/profit-loss" element={<ProtectedProfitLoss />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/pdf-templates" element={<Navigate to="/company-settings" replace />} />
              <Route path="/settings/exchange-rate" element={<ExchangeRateSettings />} />
              <Route path="/account-settings" element={<AccountSettings />} />
              <Route path="/company-settings" element={<CompanySettings />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/purchases/vendors" element={<ProtectedVendors />} />
              <Route path="/purchases/vendors/new" element={<ProtectedNewVendor />} />
              <Route path="/purchases/vendors/:vendorId" element={<ProtectedViewVendor />} />
              <Route path="/purchases/vendors/:vendorId/edit" element={<ProtectedEditVendor />} />
              <Route path="/sales/customers" element={<ProtectedCustomers />} />
              <Route path="/sales/customers/new" element={<ProtectedNewCustomer />} />
              <Route path="/sales/customers/:id" element={<ProtectedViewCustomer />} />
              <Route path="/sales/customers/:id/edit" element={<ProtectedEditCustomer />} />
              <Route path="/invoices/dashboard" element={<ProtectedInvoiceDashboard />} />
              <Route path="/invoices/purchase" element={<ProtectedPurchaseInvoices />} />
              <Route path="/invoices/sales" element={<ProtectedSalesInvoices />} />
              <Route path="/invoices/third-party" element={<ProtectedThirdPartyInvoices />} />
              <Route path="/invoices/outstanding" element={<ProtectedOutstandingInvoices />} />
              <Route path="/accounting" element={<ProtectedAccounting />} />
              <Route path="/audit" element={<ProtectedAuditDashboard />} />
              <Route path="/tax" element={<TaxManagement />} />
              <Route path="/price-lists" element={<PriceLists />} />
              <Route path="/subscription" element={<SubscriptionManagement />} />
              <Route path="/workflows" element={<WorkflowAutomation />} />
              <Route path="/user-guides" element={<UserGuides />} />
              <Route path="/purchase-invoices" element={<ProtectedPurchaseInvoices />} />
              <Route path="/sales-invoices" element={<ProtectedSalesInvoices />} />
              <Route path="/scan" element={<MobileScanner />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  );
}

function PlatformLegacyTenantsRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/platform/institutions/${id}` : '/platform/institutions'} replace />;
}

function App() {
  const path = window.location.pathname;
  if (path === '/scan') {
    return (
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/scan" element={<MobileScanner />} />
          </Routes>
        </Suspense>
      </Router>
    );
  }
  if (path.startsWith('/platform')) {
    return (
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/platform/login" element={<PlatformAdminLogin />} />
            <Route path="/platform" element={<PlatformAdminShell />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<PlatformDashboard />} />
              <Route path="institutions" element={<PlatformTenants />} />
              <Route path="institutions/:id" element={<PlatformTenantDetail />} />
              <Route path="tenants" element={<Navigate to="/platform/institutions" replace />} />
              <Route path="tenants/:id" element={<PlatformLegacyTenantsRedirect />} />
              <Route path="plans" element={<PlatformPlans />} />
              <Route path="subscription-requests" element={<PlatformSubscriptionRequests />} />
              <Route path="activity" element={<PlatformActivity />} />
              <Route path="activity/sessions/:sessionId" element={<PlatformActiveSessionDetail />} />
              <Route path="profile" element={<PlatformProfile />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/platform/login" replace />} />
          </Routes>
        </Suspense>
      </Router>
    );
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#667eea',
          colorLink: '#667eea',
          borderRadius: 8,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
        },
      }}
    >
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <CurrencyProvider>
            <AntApp>
              <ErrorBoundary>
                <AppContent />
              </ErrorBoundary>
            </AntApp>
          </CurrencyProvider>
        </AuthProvider>
      </Router>
    </ConfigProvider>
  );
}

export default App;
