import React from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import CurrencySelector from './CurrencySelector';
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
  FileOutlined
} from '@ant-design/icons';

const { Sider } = Layout;

const Sidebar = ({ collapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Helper function to check permissions
  const hasPermission = (permission) => {
    if (!user?.permissions) return false;
    return user.permissions.all || user.permissions[permission];
  };

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard'
    },
    hasPermission('inventory_view') && {
      key: 'inventory',
      icon: <InboxOutlined />,
      label: 'Inventory',
      children: [
        { key: '/inventory', label: 'Overview' },
        { key: '/inventory/adjustments', label: 'Inventory Adjustments' },
        { key: '/inventory/packages', label: 'Packages' },
        { key: '/inventory/shipments', label: 'Shipments' },
        { key: '/inventory/move-orders', label: 'Move Orders' },
        { key: '/inventory/putaways', label: 'Putaways' }
      ]
    },
    hasPermission('item_view') && {
      key: 'items',
      icon: <AppstoreOutlined />,
      label: 'Items',
      children: [
        {
          key: '/items',
          label: 'Items'
        },
        {
          key: '/item-groups',
          label: 'Item Groups'
        }
      ]
    },
    hasPermission('warehouse_view') && {
      key: '/warehouses',
      icon: <ShopOutlined />,
      label: 'Warehouses'
    },
    
    hasPermission('sales_view') && {
      key: 'sales',
      icon: <FileTextOutlined />,
      label: 'Sales',
      children: [
        { key: '/sales/customers', label: 'Customers' },
        { key: '/sales-orders', label: 'Sales Orders' },
        { key: '/sales/invoices', label: 'Invoices' },
        { key: '/sales/delivery-challans', label: 'Delivery Challans' },
        { key: '/sales/payments-received', label: 'Payments Received' },
        { key: '/sales/returns', label: 'Sales Returns' },
        { key: '/sales/credit-notes', label: 'Credit Notes' }
      ]
    },
    hasPermission('purchase_view') && {
      key: 'purchases',
      icon: <ShoppingCartOutlined />,
      label: 'Purchases',
      children: [
        { key: '/purchases/vendors', label: 'Vendors' },
        { key: '/purchase-orders', label: 'Purchase Orders' },
        { key: '/purchases/receives', label: 'Purchase Receives' },
        { key: '/purchases/bills', label: 'Bills' },
        { key: '/purchases/payments-made', label: 'Payments Made' },
        { key: '/purchases/vendor-credits', label: 'Vendor Credits' }
      ]
    },
    hasPermission('user_management') && {
      key: '/users',
      icon: <UserOutlined />,
      label: 'User Management'
    },
    {
      key: 'reports',
      icon: <BarChartOutlined />,
      label: 'Reports',
      children: [
        { key: '/reports', label: 'Home' },
        { key: '/reports/favorites', label: 'Favorites' },
        { key: '/reports/shared', label: 'Shared Reports' },
        { key: '/reports/scheduled', label: 'Scheduled Reports' },
        { key: '/reports/sales', label: 'Sales' },
        { key: '/reports/inventory', label: 'Inventory' },
        { key: '/reports/inventory-valuation', label: 'Inventory Valuation' },
        { key: '/reports/receivables', label: 'Receivables' },
        { key: '/reports/payments-received', label: 'Payments Received' },
        { key: '/reports/payables', label: 'Payables' },
        { key: '/reports/purchases', label: 'Purchases' },
        { key: '/reports/activity', label: 'Activity' },
        { key: '/reports/automation', label: 'Automation' }
      ]
    },
    {
      key: '/documents',
      icon: <FileOutlined />,
      label: 'Documents'
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Settings'
    }
  ].filter(Boolean); // Remove false values

  return (
    <Sider trigger={null} collapsible collapsed={collapsed}>
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
        {collapsed ? 'IMS' : 'IMS SEPCUNE'}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => {
          if (typeof key === 'string' && key.startsWith('/')) {
            navigate(key);
          }
        }}
      />
      {!collapsed && <CurrencySelector />}
    </Sider>
  );
};

export default Sidebar;