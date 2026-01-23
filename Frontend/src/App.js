import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Layout, message } from 'antd';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { withPermission } from './components/PermissionWrapper';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Items from './pages/Items';
import Warehouses from './pages/Warehouses';
import PurchaseOrders from './pages/PurchaseOrders';
import SalesOrders from './pages/SalesOrders';
import Users from './pages/Users';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import './App.css';

const { Content } = Layout;

// Protected components
const ProtectedInventory = withPermission('inventory_view')(Inventory);
const ProtectedItems = withPermission('item_view')(Items);
const ProtectedWarehouses = withPermission('warehouse_view')(Warehouses);
const ProtectedPurchaseOrders = withPermission('purchase_view')(PurchaseOrders);
const ProtectedSalesOrders = withPermission('sales_view')(SalesOrders);
const ProtectedUsers = withPermission('user_management')(Users);

function AppContent() {
  const { user, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

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
            <Route path="/items" element={<ProtectedItems />} />
            <Route path="/warehouses" element={<ProtectedWarehouses />} />
            <Route path="/purchase-orders" element={<ProtectedPurchaseOrders />} />
            <Route path="/sales-orders" element={<ProtectedSalesOrders />} />
            <Route path="/users" element={<ProtectedUsers />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
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
            <AppContent />
          </CurrencyProvider>
        </AuthProvider>
      </Router>
    </ConfigProvider>
  );
}

export default App;