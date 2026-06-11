import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Typography, Space, Drawer } from 'antd';
import {
  DashboardOutlined, TeamOutlined, LogoutOutlined, SafetyCertificateOutlined,
  CreditCardOutlined, HistoryOutlined, SendOutlined, MenuOutlined, UserOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { platformToken } from '../services/platformApi';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export default function PlatformAdminShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!platformToken.get()) {
      navigate('/platform/login', { replace: true });
    }
  }, [navigate]);

  const logout = () => {
    platformToken.clear();
    navigate('/platform/login', { replace: true });
  };

  const path = location.pathname;
  const selected = (() => {
    if (path.startsWith('/platform/institutions')) return ['/platform/institutions'];
    if (path.startsWith('/platform/plans')) return ['/platform/plans'];
    if (path.startsWith('/platform/subscription-requests')) return ['/platform/subscription-requests'];
    if (path.startsWith('/platform/activity')) return ['/platform/activity'];
    if (path.startsWith('/platform/profile')) return ['/platform/profile'];
    return ['/platform/dashboard'];
  })();

  if (!platformToken.get()) {
    return null;
  }

  const closeMobileNav = () => setMobileNavOpen(false);

  const menuItems = [
    {
      key: '/platform/dashboard',
      icon: <DashboardOutlined />,
      label: 'Overview',
      onClick: () => { navigate('/platform/dashboard'); closeMobileNav(); },
    },
    {
      key: '/platform/institutions',
      icon: <TeamOutlined />,
      label: 'Institutions',
      onClick: () => { navigate('/platform/institutions'); closeMobileNav(); },
    },
    {
      key: '/platform/plans',
      icon: <CreditCardOutlined />,
      label: 'Plans',
      onClick: () => { navigate('/platform/plans'); closeMobileNav(); },
    },
    {
      key: '/platform/subscription-requests',
      icon: <SendOutlined />,
      label: 'Subscription requests',
      onClick: () => { navigate('/platform/subscription-requests'); closeMobileNav(); },
    },
    {
      key: '/platform/activity',
      icon: <HistoryOutlined />,
      label: 'Sessions & activity',
      onClick: () => { navigate('/platform/activity'); closeMobileNav(); },
    },
    {
      key: '/platform/profile',
      icon: <UserOutlined />,
      label: 'My profile',
      onClick: () => { navigate('/platform/profile'); closeMobileNav(); },
    },
  ];

  const siderBrand = (
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
          <Text type="secondary" style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Admin console</Text>
        </div>
      </Space>
    </div>
  );

  const sideMenu = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={selected}
      style={{ background: '#0f172a', border: 'none', marginTop: 8 }}
      items={menuItems}
    />
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile && (
        <Sider width={220} theme="dark" style={{ background: '#0f172a' }}>
          {siderBrand}
          {sideMenu}
        </Sider>
      )}
      {isMobile && (
        <Drawer
          placement="left"
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          width={280}
          styles={{ body: { padding: 0, background: '#0f172a' } }}
          style={{ background: '#0f172a' }}
        >
          {siderBrand}
          {sideMenu}
        </Drawer>
      )}
      <Layout style={{ minWidth: 0 }}>
        <Header
          style={{
            background: '#fff',
            padding: isMobile ? '0 12px' : '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            lineHeight: '64px',
          }}
        >
          <Space align="center" style={{ minWidth: 0 }}>
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
              />
            )}
            {isMobile && (
              <Text strong ellipsis style={{ maxWidth: 'min(200px, 45vw)' }}>
                Platform admin
              </Text>
            )}
          </Space>
          <Button type="text" danger icon={<LogoutOutlined />} onClick={logout}>
            Sign out
          </Button>
        </Header>
        <Content
          style={{
            margin: isMobile ? 12 : 24,
            background: 'transparent',
            minWidth: 0,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
