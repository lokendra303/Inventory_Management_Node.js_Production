import React from 'react';
import { Layout, Button, Dropdown, Avatar, Space, Typography } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

const Header = ({ collapsed, setCollapsed, user }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Account Settings',
      onClick: () => navigate('/settings')
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: logout
    }
  ];

  return (
    <AntHeader style={{ 
      padding: '0 24px', 
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      borderBottom: '1px solid #f0f0f0',
      height: '64px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => setCollapsed(!collapsed)}
          style={{ 
            fontSize: '16px', 
            width: '48px', 
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        />
      </div>
      
      <Space size="middle" align="center">
        <div style={{ 
          textAlign: 'right', 
          lineHeight: '1.2',
          marginRight: '8px'
        }}>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: '600', 
            color: '#262626',
            marginBottom: '2px'
          }}>
            {user?.firstName} {user?.lastName}
          </div>
          <div style={{ 
            fontSize: '12px', 
            color: '#8c8c8c',
            textTransform: 'capitalize'
          }}>
            {user?.role}
          </div>
        </div>
        <Dropdown 
          menu={{ items: userMenuItems }} 
          placement="bottomRight"
          trigger={['click']}
        >
          <Avatar 
            size={40}
            icon={<UserOutlined />} 
            style={{ 
              cursor: 'pointer',
              backgroundColor: '#1890ff',
              border: '2px solid #f0f0f0'
            }} 
          />
        </Dropdown>
      </Space>
    </AntHeader>
  );
};

export default Header;