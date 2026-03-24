import React from 'react';
import { Layout, Button, Dropdown, Avatar, Space, Badge } from 'antd';
import {
  MenuFoldOutlined, MenuUnfoldOutlined,
  LogoutOutlined, ClockCircleOutlined, ControlOutlined, IdcardOutlined
} from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';

const { Header: AntHeader } = Layout;

const formatCountdown = (seconds) => {
  if (seconds == null || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const getInitials = (user) => {
  if (!user) return 'U';
  const f = user.firstName?.[0] || '';
  const l = user.lastName?.[0] || '';
  return (f + l).toUpperCase() || 'U';
};

const ROLE_COLORS = {
  super_admin: '#764ba2',
  admin: '#667eea',
  manager: '#11998e',
  staff: '#f7971e',
};

const Header = ({ collapsed, setCollapsed, user, isMobile }) => {
  const { logout, sessionSecondsLeft } = useAuth();
  const navigate = useNavigate();
  const isWarning = sessionSecondsLeft != null && sessionSecondsLeft <= 120;

  const userMenuItems = [
    {
      key: 'user-info',
      label: (
        <div style={{ padding: '4px 0', minWidth: 160 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{user?.firstName} {user?.lastName}</div>
          <div style={{ fontSize: 12, color: '#888', textTransform: 'capitalize' }}>{user?.role}</div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'profile',
      icon: <ControlOutlined />,
      label: 'Account Settings',
      onClick: () => navigate('/account-settings'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: <span style={{ color: '#ff4d4f' }}>Logout</span>,
      onClick: logout,
    },
  ];

  return (
    <AntHeader style={{
      padding: isMobile ? '0 12px' : '0 24px',
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      borderBottom: '1px solid #f0f0f0',
      height: 64,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Left: Toggle + Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => setCollapsed(!collapsed)}
          style={{
            fontSize: 18, width: 44, height: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 10, color: '#555',
          }}
        />
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 11, color: '#fff',
            }}>
              IMS
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>SEPCUNE</span>
          </div>
        )}
      </div>

      {/* Right: Session + User */}
      <Space size={isMobile ? 8 : 16} align="center">
        {/* Session Timer */}
        {sessionSecondsLeft != null && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: isWarning ? '#fff1f0' : '#f6ffed',
            border: `1px solid ${isWarning ? '#ffccc7' : '#b7eb8f'}`,
            borderRadius: 20, padding: '4px 10px',
            fontSize: 12, fontWeight: 600,
            color: isWarning ? '#ff4d4f' : '#52c41a',
            transition: 'all 0.3s',
          }}>
            <ClockCircleOutlined />
            {!isMobile && <span>Session: </span>}
            <span>{formatCountdown(sessionSecondsLeft)}</span>
          </div>
        )}

        {/* User Info (desktop) */}
        {!isMobile && (
          <div style={{ textAlign: 'right', lineHeight: 1.3 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>
              {user?.firstName} {user?.lastName}
            </div>
            <div style={{
              fontSize: 11, textTransform: 'capitalize',
              color: ROLE_COLORS[user?.role] || '#888',
              fontWeight: 500,
            }}>
              {user?.role?.replace('_', ' ')}
            </div>
          </div>
        )}

        {/* Avatar */}
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
          <div style={{
            width: isMobile ? 34 : 40, height: isMobile ? 34 : 40,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontWeight: 700, fontSize: isMobile ? 13 : 15,
            color: '#fff', boxShadow: '0 2px 8px rgba(102,126,234,0.4)',
            border: '2px solid rgba(102,126,234,0.3)',
            userSelect: 'none',
          }}>
            {getInitials(user)}
          </div>
        </Dropdown>
      </Space>
    </AntHeader>
  );
};

export default Header;
