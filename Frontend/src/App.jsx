import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ConfigProvider, Layout, message } from 'antd';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { CurrencyProvider } from './contexts/CurrencyContext.jsx';
import { withPermission } from './components/common/PermissionWrapper.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import Login from './pages/auth/Login.jsx';
import PlatformAdminLogin from './pages/auth/PlatformAdminLogin.jsx';
import PlatformAdminShell from './platform/PlatformAdminShell.jsx';
import PlatformDashboard from './platform/PlatformDashboard.jsx';
import PlatformTenants from './platform/PlatformTenants.jsx';
import PlatformTenantDetail from './platform/PlatformTenantDetail.jsx';
import PlatformPlans from './platform/PlatformPlans.jsx';
import PlatformActivity from './platform/PlatformActivity.jsx';
import Dashboard from './pages/dashboard/Dashboard.jsx';
import Inventory from './pages/inventory/Inventory.jsx';
import Packages from './pages/inventory/Packages.jsx';
import Items from './pages/inventory/Items.jsx';
import InventoryAdjustments from './pages/inventory/InventoryAdjustments.jsx';
import MoveOrders from './pages/inventory/MoveOrders.jsx';
import Shipments from './pages/inventory/Shipments.jsx';
import Putaways from './pages/inventory/Putaways.jsx';
import Warehouses from './pages/settings/Warehouses.jsx';
import WarehouseLocations from './pages/settings/WarehouseLocations.jsx';
import PurchaseOrders from './pages/purchases/PurchaseOrders.jsx';
import SalesOrders from './pages/sales/SalesOrders.jsx';
import Users from './pages/settings/Users.jsx';
import Reports from './pages/reports/Reports.jsx';
import Settings from './pages/settings/Settings.jsx';
import CompanySettings from './pages/settings/CompanySettings.jsx';
import AccountSettings from './pages/settings/AccountSettings.jsx';
import Documents from './pages/documents/Documents.jsx';
import Vendors from './pages/entities/vendors/Vendors.jsx';
import NewVendor from './pages/entities/vendors/NewVendor.jsx';
import ViewVendor from './pages/entities/vendors/ViewVendor.jsx';
import EditVendor from './pages/entities/vendors/EditVendor.jsx';
import Customers from './pages/entities/customers/Customers.jsx';
import NewCustomer from './pages/entities/customers/NewCustomer.jsx';
import ViewCustomer from './pages/entities/customers/ViewCustomer.jsx';
import EditCustomer from './pages/entities/customers/EditCustomer.jsx';
import ProfitLoss from './pages/reports/ProfitLoss.jsx';
import InvoiceDashboard from './pages/sales/InvoiceDashboard.jsx';
import PurchaseInvoices from './pages/purchases/PurchaseInvoices.jsx';
import SalesInvoices from './pages/sales/SalesInvoices.jsx';
import OutstandingInvoices from './pages/sales/OutstandingInvoices.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import Header from './components/layout/Header.jsx';
import ItemGroups from './pages/inventory/ItemGroups.jsx';
import './App.css';
import DeliveryChallans from './pages/sales/DeliveryChallans.jsx';
import PaymentReceived from './pages/sales/PaymentReceived.jsx';
import SalesReturns from './pages/sales/SalesReturns.jsx';
import CreditNotes from './pages/sales/CreditNotes.jsx';
import PurchasesReceives from './pages/purchases/PurchasesReceives.jsx';
import PurchasesBills from './pages/purchases/PurchasesBills.jsx';
import PurchasesPaymentMade from './pages/purchases/PurchasesPayamentMade.jsx';
import VendorCredits from './pages/purchases/VendorCredits.jsx';  
import InvoicePayments from './pages/sales/InvoiceMayments.jsx';
import StockCount from './pages/inventory/StockCount.jsx';
import ReorderLevels from './pages/inventory/ReorderLevels.jsx';
import BatchTracking from './pages/inventory/BatchTracking.jsx';
import PurchaseReturns from './pages/purchases/PurchaseReturns.jsx';
import ExchangeRateSettings from './pages/settings/ExchangeRateSettings.jsx';
import MobileScanner from './pages/scanner/MobileScanner.jsx';
import Accounting from './pages/accounting/Accounting.jsx';
import AuditDashboard from './pages/audit/AuditDashboard.jsx';
import OnboardingWizard from './pages/onboarding/OnboardingWizard.jsx';
import TaxManagement from './pages/tax/TaxManagement.jsx';
import PriceLists from './pages/price-lists/PriceLists.jsx';
import SubscriptionManagement from './pages/subscription/SubscriptionManagement.jsx';
import WorkflowAutomation from './pages/workflows/WorkflowAutomation.jsx';
import UserGuides from './pages/workflows/UserGuides.jsx';

const { Content } = Layout;

// Protected components
const ProtectedInventory = withPermission('inventory_view')(Inventory);
const ProtectedPackages = withPermission('inventory_view')(Packages);
const ProtectedItems = withPermission('item_view')(Items);
const ProtectedWarehouses = withPermission('warehouse_view')(Warehouses);
const ProtectedWarehouseLocations = withPermission('warehouse_view')(WarehouseLocations);
const ProtectedInventoryAdjustments = withPermission('inventory_adjust')(InventoryAdjustments);
const ProtectedInventoryShipments = withPermission('inventory_shipment')(Shipments);
const ProtectedPutaways = withPermission('inventory_putaway')(Putaways);
const ProtectedMoveOrders = withPermission('inventory_transfer')(MoveOrders);
const ProtectedPurchaseOrders = withPermission('purchase_view')(PurchaseOrders);
const ProtectedSalesOrders = withPermission('sales_view')(SalesOrders);
const ProtectedUsers = withPermission('user_management')(Users);
const ProtectedVendors = withPermission('purchase_view')(Vendors);
const ProtectedNewVendor = withPermission('purchase_view')(NewVendor);
const ProtectedViewVendor = withPermission('purchase_view')(ViewVendor);
const ProtectedEditVendor = withPermission('vendor_management')(EditVendor);
const ProtectedCustomers = withPermission('sales_view')(Customers);
const ProtectedNewCustomer = withPermission('sales_view')(NewCustomer);
const ProtectedViewCustomer = withPermission('sales_view')(ViewCustomer);
const ProtectedEditCustomer = withPermission('customer_management')(EditCustomer);
const ProtectedInvoiceDashboard = withPermission('invoice_view')(InvoiceDashboard);
const ProtectedPurchaseInvoices = withPermission('invoice_view')(PurchaseInvoices);
const ProtectedSalesInvoices = withPermission('invoice_view')(SalesInvoices);
const ProtectedOutstandingInvoices = withPermission('invoice_view')(OutstandingInvoices);
const ProtectedStockCount = withPermission('inventory_adjust')(StockCount);
const ProtectedBatchTracking = withPermission('inventory_view')(BatchTracking);
const ProtectedPurchaseReturns = withPermission('purchase_view')(PurchaseReturns);
const ProtectedAccounting = withPermission('invoice_view')(Accounting);
const ProtectedAuditDashboard = withPermission('audit_view')(AuditDashboard);

function AppContent() {
  const { user, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Handle responsive behavior
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

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
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
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/inventory" element={<ProtectedInventory />} />
            <Route path="/inventory/adjustments" element={<ProtectedInventoryAdjustments />} />
            <Route path="/inventory/shipments" element={<ProtectedInventoryShipments />} />
            <Route path="/inventory/putaways" element={<ProtectedPutaways />} />
            <Route path="/inventory/move-orders" element={<ProtectedMoveOrders />} />
            <Route path="/inventory/packages" element={<ProtectedPackages />} />
            <Route path="/inventory/stock-count" element={<ProtectedStockCount />} />
            <Route path="/inventory/batch-tracking" element={<ProtectedBatchTracking />} />
            <Route path="/inventory/reorder-levels" element={<ReorderLevels />} />
            <Route path="/items" element={<ProtectedItems />} />
            <Route path="/item-groups" element={<ItemGroups />} />
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
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/*" element={<Reports />} />
            <Route path="/profit-loss" element={<ProfitLoss />} />
            <Route path="/settings" element={<Settings />} />
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
  // Render isolated pages BEFORE any providers — no auth, no loading
  const path = window.location.pathname;
  if (path === '/scan') {
    return (
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/scan" element={<MobileScanner />} />
        </Routes>
      </Router>
    );
  }
  if (path.startsWith('/platform')) {
    return (
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
            <Route path="activity" element={<PlatformActivity />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/platform/login" replace />} />
        </Routes>
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
            <ErrorBoundary>
              <AppContent />
            </ErrorBoundary>
          </CurrencyProvider>
        </AuthProvider>
      </Router>
    </ConfigProvider>
  );
}

export default App;