import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Layout, message } from 'antd';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { CurrencyProvider } from './contexts/CurrencyContext.jsx';
import { withPermission } from './components/common/PermissionWrapper.jsx';
import useSessionManager from './hooks/useSessionManager.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import Login from './pages/auth/Login.jsx';
import Dashboard from './pages/dashboard/Dashboard.jsx';
import Inventory from './pages/inventory/Inventory.jsx';
import Packages from './pages/inventory/Packages.jsx';
import Items from './pages/inventory/Items.jsx';
import InventoryAdjustments from './pages/inventory/InventoryAdjustments.jsx';
import MoveOrders from './pages/inventory/MoveOrders.jsx';
import Warehouses from './pages/settings/Warehouses.jsx';
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
import './App.css';

const { Content } = Layout;

// Protected components
const ProtectedInventory = withPermission('inventory_view')(Inventory);
const ProtectedPackages = withPermission('inventory_view')(Packages);
const ProtectedItems = withPermission('item_view')(Items);
const ProtectedWarehouses = withPermission('warehouse_view')(Warehouses);
const ProtectedInventoryAdjustments = withPermission('inventory_adjust')(InventoryAdjustments);
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

function AppContent() {
  const { user, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Session manager disabled - no automatic session expiration
  // useSessionManager();

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

  console.log('AppContent render - user:', user, 'loading:', loading);

  if (loading) {
    console.log('Showing loading spinner');
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (!user) {
    console.log('No user, showing login page');
    return <Login />;
  }

  console.log('User authenticated, showing main app');
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
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/inventory" element={<ProtectedInventory />} />
            <Route path="/inventory/adjustments" element={<ProtectedInventoryAdjustments />} />
            <Route path="/inventory/move-orders" element={<ProtectedMoveOrders />} />
            <Route path="/inventory/packages" element={<ProtectedPackages />} />
            <Route path="/items" element={<ProtectedItems />} />
            <Route path="/warehouses" element={<ProtectedWarehouses />} />
            <Route path="/purchase-orders" element={<ProtectedPurchaseOrders />} />
            <Route path="/sales-orders" element={<ProtectedSalesOrders />} />
            <Route path="/users" element={<ProtectedUsers />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/*" element={<Reports />} />
            <Route path="/profit-loss" element={<ProfitLoss />} />
            <Route path="/settings" element={<Settings />} />
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
            <Route path="/purchase-invoices" element={<ProtectedPurchaseInvoices />} />
            <Route path="/sales-invoices" element={<ProtectedSalesInvoices />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
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