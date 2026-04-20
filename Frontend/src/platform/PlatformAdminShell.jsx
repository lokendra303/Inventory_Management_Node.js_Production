import React from 'react';
import { Layout, Menu, Button, Typography, Space } from 'antd';
import {
  DashboardOutlined, TeamOutlined, LogoutOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { platformToken } from '../services/platformApi';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export default function PlatformAdminShell() {
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    if (!platformToken.get()) {
      navigate('/platform/login', { replace: true });
    }
  }, [navigate]);

  const logout = () => {
    platformToken.clear();
    navigate('/platform/login', { replace: true });
  };

  const selected = location.pathname.startsWith('/platform/tenants')
    ? ['/platform/tenants']
    : ['/platform/dashboard'];

  if (!platformToken.get()) {
    return null;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark" style={{ background: '#0f172a' }}>
        <div
          style={{
            padding: '20px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Space align="center">
            <SafetyCertificateOutlined style={{ color: '#f87171', fontSize: 22 }} />
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Platform</div>
              <Text type="secondary" style={{ fontSize: 11 }}>Admin console</Text>
            </div>
          </Space>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selected}
          style={{ background: '#0f172a', border: 'none', marginTop: 8 }}
          items={[
            {
              key: '/platform/dashboard',
              icon: <DashboardOutlined />,
              label: 'Overview',
              onClick: () => navigate('/platform/dashboard'),
            },
            {
              key: '/platform/tenants',
              icon: <TeamOutlined />,
              label: 'Tenants',
              onClick: () => navigate('/platform/tenants'),
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          <Button type="text" danger icon={<LogoutOutlined />} onClick={logout}>
            Sign out
          </Button>
        </Header>
        <Content style={{ margin: 24, background: 'transparent' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
