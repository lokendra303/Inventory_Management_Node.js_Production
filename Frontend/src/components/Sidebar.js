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
  UserOutlined
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
      key: '/inventory',
      icon: <InboxOutlined />,
      label: 'Inventory'
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
    hasPermission('purchase_view') && {
      key: '/purchase-orders',
      icon: <ShoppingCartOutlined />,
      label: 'Purchase Orders'
    },
    hasPermission('sales_view') && {
      key: '/sales-orders',
      icon: <FileTextOutlined />,
      label: 'Sales Orders'
    },
    hasPermission('user_management') && {
      key: '/users',
      icon: <UserOutlined />,
      label: 'User Management'
    },
    {
      key: '/reports',
      icon: <BarChartOutlined />,
      label: 'Reports'
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
        onClick={({ key }) => navigate(key)}
      />
      {!collapsed && <CurrencySelector />}
    </Sider>
  );
};

export default Sidebar;