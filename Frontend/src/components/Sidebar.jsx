import React from 'react';
import { Layout, Menu, Drawer } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import CurrencySelector from './CurrencySelector.jsx';
import {
  DashboardOutlined,
  InboxOutlined,
  AppstoreOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  BarChartOutlined,
  SettingOutlined,
  UserOutlined,
  FileOutlined,
  DollarOutlined
} from '@ant-design/icons';

const { Sider } = Layout;

const Sidebar = ({ collapsed, isMobile, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Helper function to check permissions
  const hasPermission = (permission) => {
    if (!user?.permissions) return false;
    // Admin and super_admin have all permissions
    if (user.role === 'admin' || user.role === 'super_admin') return true;
    return user.permissions.all || user.permissions[permission];
  };

  // Helper function to check multiple permissions (any)
  const hasAnyPermission = (...permissions) => {
    return permissions.some(permission => hasPermission(permission));
  };

  // Helper function to check role
  const hasRole = (roles) => {
    if (!user?.role) return false;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    return allowedRoles.includes(user.role);
  };

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard'
    },
    // Inventory - Show if user has ANY inventory permission
    hasAnyPermission(
      'inventory_view',
      'inventory_receive',
      'inventory_reserve',
      'inventory_ship',
      'inventory_adjust',
      'inventory_transfer',
      'inventory_management'
    ) && {
      key: 'inventory',
      icon: <InboxOutlined />,
      label: 'Inventory',
      children: [
        hasPermission('inventory_view') && { key: '/inventory', label: 'Overview' },
        hasPermission('inventory_adjust') && { key: '/inventory/adjustments', label: 'Inventory Adjustments' },
        hasPermission('inventory_view') && { key: '/inventory/packages', label: 'Packages' },
        hasPermission('inventory_ship') && { key: '/inventory/shipments', label: 'Shipments' },
        hasPermission('inventory_transfer') && { key: '/inventory/move-orders', label: 'Move Orders' },
        hasPermission('inventory_receive') && { key: '/inventory/putaways', label: 'Putaways' }
      ].filter(Boolean)
    },
    // Items - Show if user has item_view or item_management
    hasAnyPermission('item_view', 'item_management') && {
      key: 'items',
      icon: <AppstoreOutlined />,
      label: 'Items',
      children: [
        hasPermission('item_view') && { key: '/items', label: 'Items' },
        hasPermission('item_view') && { key: '/item-groups', label: 'Item Groups' }
      ].filter(Boolean)
    },
    // Warehouses - Show if user has warehouse_view or warehouse_management
    hasAnyPermission('warehouse_view', 'warehouse_management', 'warehouse_type_view', 'warehouse_type_management') && {
      key: '/warehouses',
      icon: <ShopOutlined />,
      label: 'Warehouses'
    },
    // Sales - Show if user has ANY sales or customer permission
    hasAnyPermission('sales_view', 'sales_management', 'customer_view', 'customer_management') && {
      key: 'sales',
      icon: <FileTextOutlined />,
      label: 'Sales',
      children: [
        hasAnyPermission('customer_view', 'customer_management') && { key: '/sales/customers', label: 'Customers' },
        hasAnyPermission('sales_view', 'sales_management') && { key: '/sales-orders', label: 'Sales Orders' },
        hasAnyPermission('sales_view', 'sales_management') && { key: '/sales-invoices', label: 'Sales Invoices' },
        hasAnyPermission('sales_view', 'sales_management') && { key: '/sales/delivery-challans', label: 'Delivery Challans' },
        hasAnyPermission('sales_view', 'sales_management') && { key: '/sales/payments-received', label: 'Payments Received' },
        hasAnyPermission('sales_view', 'sales_management') && { key: '/sales/returns', label: 'Sales Returns' },
        hasAnyPermission('sales_view', 'sales_management') && { key: '/sales/credit-notes', label: 'Credit Notes' }
      ].filter(Boolean)
    },
    // Purchases - Show if user has ANY purchase or vendor permission
    hasAnyPermission('purchase_view', 'purchase_management', 'vendor_view', 'vendor_management') && {
      key: 'purchases',
      icon: <ShoppingCartOutlined />,
      label: 'Purchases',
      children: [
        hasAnyPermission('vendor_view', 'vendor_management') && { key: '/purchases/vendors', label: 'Vendors' },
        hasAnyPermission('purchase_view', 'purchase_management') && { key: '/purchase-orders', label: 'Purchase Orders' },
        hasAnyPermission('purchase_view', 'purchase_management') && { key: '/purchase-invoices', label: 'Purchase Invoices' },
        hasPermission('inventory_receive') && { key: '/purchases/receives', label: 'Purchase Receives' },
        hasAnyPermission('purchase_view', 'purchase_management') && { key: '/purchases/bills', label: 'Bills' },
        hasAnyPermission('purchase_view', 'purchase_management') && { key: '/purchases/payments-made', label: 'Payments Made' },
        hasAnyPermission('purchase_view', 'purchase_management') && { key: '/purchases/vendor-credits', label: 'Vendor Credits' }
      ].filter(Boolean)
    },
    // Invoices - Show if user has invoice_view or invoice_management
    hasAnyPermission('invoice_view', 'invoice_management') && {
      key: 'invoices',
      icon: <DollarOutlined />,
      label: 'Invoices',
      children: [
        { key: '/invoices/dashboard', label: 'Invoice Dashboard' },
        { key: '/invoices/purchase', label: 'Purchase Invoices' },
        { key: '/invoices/sales', label: 'Sales Invoices' },
        { key: '/invoices/outstanding', label: 'Outstanding Invoices' },
        { key: '/invoices/payments', label: 'Invoice Payments' }
      ]
    },
    // User Management - Show only if user has user_management permission
    hasPermission('user_management') && {
      key: '/users',
      icon: <UserOutlined />,
      label: 'User Management'
    },
    // Reports - Show if user has ANY reporting permission
    hasAnyPermission(
      'inventory_view',
      'sales_view',
      'sales_management',
      'purchase_view',
      'purchase_management',
      'invoice_view',
      'invoice_management'
    ) && {
      key: 'reports',
      icon: <BarChartOutlined />,
      label: 'Reports',
      children: [
        hasAnyPermission('inventory_view', 'sales_view', 'purchase_view', 'invoice_view') && { key: '/reports', label: 'Home' },
        hasAnyPermission('sales_view', 'purchase_view', 'invoice_view') && { key: '/profit-loss', label: 'Profit & Loss' },
        hasAnyPermission('inventory_view', 'sales_view', 'purchase_view', 'invoice_view') && { key: '/reports/favorites', label: 'Favorites' },
        hasAnyPermission('inventory_view', 'sales_view', 'purchase_view', 'invoice_view') && { key: '/reports/shared', label: 'Shared Reports' },
        hasAnyPermission('inventory_view', 'sales_view', 'purchase_view', 'invoice_view') && { key: '/reports/scheduled', label: 'Scheduled Reports' },
        hasAnyPermission('sales_view', 'sales_management') && { key: '/reports/sales', label: 'Sales' },
        hasPermission('inventory_view') && { key: '/reports/inventory', label: 'Inventory' },
        hasPermission('inventory_view') && { key: '/reports/inventory-valuation', label: 'Inventory Valuation' },
        hasPermission('inventory_view') && { key: '/reports/inventory-adjustments', label: 'Inventory Adjustments' },
        hasPermission('inventory_view') && { key: '/reports/stock-transfers', label: 'Stock Transfers' },
        hasAnyPermission('sales_view', 'sales_management') && { key: '/reports/receivables', label: 'Receivables' },
        hasAnyPermission('sales_view', 'sales_management') && { key: '/reports/payments-received', label: 'Payments Received' },
        hasAnyPermission('purchase_view', 'purchase_management') && { key: '/reports/payables', label: 'Payables' },
        hasAnyPermission('purchase_view', 'purchase_management') && { key: '/reports/purchases', label: 'Purchases' },
        hasAnyPermission('inventory_view', 'sales_view', 'purchase_view', 'invoice_view') && { key: '/reports/activity', label: 'Activity' },
        hasAnyPermission('inventory_view', 'sales_view', 'purchase_view', 'invoice_view') && { key: '/reports/automation', label: 'Automation' }
      ].filter(Boolean)
    },
    // Documents - Always visible
    {
      key: '/documents',
      icon: <FileOutlined />,
      label: 'Documents'
    },
    // Settings - Always visible, but Company Settings only for admin and super_admin
    {
      key: 'settings-menu',
      icon: <SettingOutlined />,
      label: 'Settings',
      children: [
        { key: '/settings', label: 'General Settings' },
        hasRole(['admin', 'super_admin']) && { key: '/company-settings', label: 'Company Settings' }
      ].filter(Boolean)
    }
  ].filter(Boolean);

  const handleMenuClick = ({ key }) => {
    if (typeof key === 'string' && key.startsWith('/')) {
      navigate(key);
      if (isMobile && onClose) {
        onClose();
      }
    }
  };

  const sidebarContent = (
    <>
      <div style={{ 
        height: '32px', 
        margin: '16px', 
        background: 'rgba(255, 255, 255, 0.3)',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 'bold'
      }}>
        {collapsed && !isMobile ? 'IMS' : 'IMS SEPCUNE'}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={handleMenuClick}
      />
      {!collapsed && !isMobile && <CurrencySelector />}
    </>
  );

  if (isMobile) {
    return (
      <Drawer
        title="IMS SEPCUNE"
        placement="left"
        onClose={onClose}
        open={!collapsed}
        bodyStyle={{ padding: 0, background: '#001529' }}
        headerStyle={{ background: '#001529', color: 'white' }}
        width={250}
      >
        {sidebarContent}
      </Drawer>
    );
  }

  return (
    <Sider trigger={null} collapsible collapsed={collapsed} breakpoint="lg">
      {sidebarContent}
    </Sider>
  );
};

export default Sidebar;