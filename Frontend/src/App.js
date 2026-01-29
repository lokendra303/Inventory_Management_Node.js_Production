import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Layout, message } from 'antd';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { withPermission } from './components/PermissionWrapper';
import useSessionManager from './hooks/useSessionManager';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Packages from './pages/Packages';
import Items from './pages/Items';
import Warehouses from './pages/Warehouses';
import PurchaseOrders from './pages/PurchaseOrders';
import SalesOrders from './pages/SalesOrders';
import Users from './pages/Users';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Documents from './pages/Documents';
import Vendors from './pages/Vendors';
import NewVendor from './pages/NewVendor';
import ViewVendor from './pages/ViewVendor';
import Customers from './pages/Customers';
import NewCustomer from './pages/NewCustomer';
import ViewCustomer from './pages/ViewCustomer';
import EditCustomer from './pages/EditCustomer';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
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
  
  // Initialize session manager for authenticated users
  useSessionManager();

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
      <Sidebar collapsed={collapsed} />
      <Layout>
        <Header 
          collapsed={collapsed} 
          setCollapsed={setCollapsed}
          user={user}
        />
        <Content style={{ margin: '16px' }}>
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