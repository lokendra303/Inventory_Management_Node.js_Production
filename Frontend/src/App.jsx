import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Layout, message } from 'antd';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { CurrencyProvider } from './contexts/CurrencyContext.jsx';
import { withPermission } from './components/PermissionWrapper.jsx';
import useSessionManager from './hooks/useSessionManager.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Inventory from './pages/Inventory.jsx';
import Packages from './pages/Packages.jsx';
import Items from './pages/Items.jsx';
import Warehouses from './pages/Warehouses.jsx';
import PurchaseOrders from './pages/PurchaseOrders.jsx';
import SalesOrders from './pages/SalesOrders.jsx';
import Users from './pages/Users.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import Documents from './pages/Documents.jsx';
import Vendors from './pages/Vendors.jsx';
import NewVendor from './pages/NewVendor.jsx';
import ViewVendor from './pages/ViewVendor.jsx';
import Customers from './pages/Customers.jsx';
import NewCustomer from './pages/NewCustomer.jsx';
import ViewCustomer from './pages/ViewCustomer.jsx';
import EditCustomer from './pages/EditCustomer.jsx';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import './App.css';

const { Content } = Layout;

// Protected components
const ProtectedInventory = withPermission('inventory_view')(Inventory);
const ProtectedPackages = withPermission('inventory_view')(Packages);
const ProtectedItems = withPermission('item_view')(Items);
const ProtectedWarehouses = withPermission('warehouse_view')(Warehouses);
const ProtectedPurchaseOrders = withPermission('purchase_view')(PurchaseOrders);
const ProtectedSalesOrders = withPermission('sales_view')(SalesOrders);
const ProtectedUsers = withPermission('user_management')(Users);
const ProtectedVendors = withPermission('purchase_view')(Vendors);
const ProtectedNewVendor = withPermission('purchase_view')(NewVendor);
const ProtectedViewVendor = withPermission('purchase_view')(ViewVendor);
const ProtectedCustomers = withPermission('sales_view')(Customers);
const ProtectedNewCustomer = withPermission('sales_view')(NewCustomer);
const ProtectedViewCustomer = withPermission('sales_view')(ViewCustomer);
const ProtectedEditCustomer = withPermission('customer_management')(EditCustomer);

function AppContent() {
  const { user, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Initialize session manager for authenticated users
  useSessionManager();

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
            <Route path="/inventory/packages" element={<ProtectedPackages />} />
            <Route path="/items" element={<ProtectedItems />} />
            <Route path="/warehouses" element={<ProtectedWarehouses />} />
            <Route path="/purchase-orders" element={<ProtectedPurchaseOrders />} />
            <Route path="/sales-orders" element={<ProtectedSalesOrders />} />
            <Route path="/users" element={<ProtectedUsers />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/purchases/vendors" element={<ProtectedVendors />} />
            <Route path="/purchases/vendors/new" element={<ProtectedNewVendor />} />
            <Route path="/purchases/vendors/:vendorId" element={<ProtectedViewVendor />} />
            <Route path="/sales/customers" element={<ProtectedCustomers />} />
            <Route path="/sales/customers/new" element={<ProtectedNewCustomer />} />
            <Route path="/sales/customers/:id" element={<ProtectedViewCustomer />} />
            <Route path="/sales/customers/:id/edit" element={<ProtectedEditCustomer />} />
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
      <Router>
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