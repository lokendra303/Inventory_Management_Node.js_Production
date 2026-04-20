import React from 'react';
import { Layout, Dropdown } from 'antd';
import {
  MenuFoldOutlined, MenuUnfoldOutlined,
  LogoutOutlined, ClockCircleOutlined, ControlOutlined,
  BankOutlined, CaretDownOutlined,
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

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
};

const ROLE_COLORS = {
  super_admin: { bg: 'rgba(118,75,162,0.25)', text: '#c084fc', border: 'rgba(192,132,252,0.3)' },
  admin:       { bg: 'rgba(102,126,234,0.25)', text: '#818cf8', border: 'rgba(129,140,248,0.3)' },
  manager:     { bg: 'rgba(17,153,142,0.25)',  text: '#34d399', border: 'rgba(52,211,153,0.3)' },
  staff:       { bg: 'rgba(247,151,30,0.25)',  text: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
};

const Header = ({ collapsed, setCollapsed, user, isMobile }) => {
  const { logout, sessionSecondsLeft } = useAuth();
  const navigate = useNavigate();
  const isWarning = sessionSecondsLeft != null && sessionSecondsLeft <= 120;
  const roleStyle = ROLE_COLORS[user?.role] || { bg: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.6)', border: 'rgba(255,255,255,0.15)' };

  const userMenuItems = [
    {
      key: 'user-info',
      label: (
        <div style={{ padding: '8px 4px', minWidth: 180 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>
            {user?.firstName} {user?.lastName}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{user?.email}</div>
          {user?.institutionName && (
            <div style={{
              marginTop: 6, fontSize: 11, fontWeight: 600,
              color: '#667eea', display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <BankOutlined style={{ fontSize: 10 }} />
              {user.institutionName}
            </div>
          )}
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
    <>
      <style>{`
        @keyframes pulse-warn {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,77,79,0.4); }
          50%       { box-shadow: 0 0 0 4px rgba(255,77,79,0); }
        }
        .header-toggle-btn:hover {
          background: rgba(255,255,255,0.12) !important;
          color: #fff !important;
        }
        .header-avatar-wrap:hover .header-avatar {
          transform: scale(1.06);
          box-shadow: 0 0 0 3px rgba(102,126,234,0.5), 0 4px 16px rgba(102,126,234,0.4) !important;
        }
      `}</style>

      <AntHeader style={{
        padding: isMobile ? '0 12px' : '0 20px 0 16px',
        background: 'linear-gradient(90deg, #0f0c29 0%, #302b63 60%, #24243e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 20px rgba(0,0,0,0.35)',
        borderBottom: '1px solid rgba(102,126,234,0.2)',
        height: 64,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>

        {/* ── LEFT ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

          {/* Toggle */}
          <button
            className="header-toggle-btn"
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: 38, height: 38, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.07)',
              borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.7)', fontSize: 16,
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>

          {/* Mobile brand */}
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: 10, color: '#fff',
                boxShadow: '0 2px 10px rgba(102,126,234,0.5)',
              }}>IMS</div>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#fff', letterSpacing: 0.5 }}>SEPCUNE</span>
            </div>
          )}

          {/* Session timer */}
          {sessionSecondsLeft != null && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 12px',
              height: 34,
              borderRadius: 8,
              background: isWarning
                ? 'linear-gradient(135deg, rgba(255,77,79,0.22), rgba(255,120,80,0.15))'
                : 'linear-gradient(135deg, rgba(82,196,26,0.18), rgba(56,239,125,0.1))',
              border: `1px solid ${isWarning ? 'rgba(255,77,79,0.45)' : 'rgba(82,196,26,0.4)'}`,
              animation: isWarning ? 'pulse-warn 1.4s ease-in-out infinite' : 'none',
              transition: 'all 0.3s',
            }}>
              <ClockCircleOutlined style={{ fontSize: 12, color: isWarning ? '#ff6b6b' : '#73d13d' }} />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <span style={{ fontSize: 9, fontWeight: 500, color: isWarning ? 'rgba(255,107,107,0.7)' : 'rgba(115,209,61,0.7)', letterSpacing: 0.8, textTransform: 'uppercase' }}>Session</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: isWarning ? '#ff6b6b' : '#73d13d', fontVariantNumeric: 'tabular-nums', letterSpacing: 0.5 }}>
                  {formatCountdown(sessionSecondsLeft)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12 }}>

          {/* Institution name */}
          {!isMobile && user?.institutionName && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '0 12px',
              height: 34,
              borderRadius: 8,
              background: 'linear-gradient(135deg, rgba(102,126,234,0.18), rgba(118,75,162,0.12))',
              border: '1px solid rgba(102,126,234,0.35)',
            }}>
              <BankOutlined style={{ fontSize: 12, color: '#818cf8' }} />
              <span style={{
                fontSize: 15, fontWeight: 700,
                color: 'rgba(255,255,255,0.9)',
                letterSpacing: 0.2,
                maxWidth: 150,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user.institutionName}
              </span>
            </div>
          )}

          {/* Divider */}
          {!isMobile && (
            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />
          )}

          {/* User dropdown */}
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
            <div
              className="header-avatar-wrap"
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
            >
              {/* Avatar */}
              <div
                className="header-avatar"
                style={{
                  width: isMobile ? 34 : 38, height: isMobile ? 34 : 38,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: isMobile ? 12 : 14,
                  color: '#fff',
                  boxShadow: '0 0 0 2px rgba(102,126,234,0.35), 0 4px 12px rgba(102,126,234,0.3)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  flexShrink: 0,
                }}
              >
                {getInitials(user)}
              </div>

              {/* Name + role (desktop) */}
              {!isMobile && (
                <div style={{ lineHeight: 1.3 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>
                    {user?.firstName} {user?.lastName}
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center',
                    marginTop: 2,
                    padding: '1px 7px',
                    borderRadius: 10,
                    background: roleStyle.bg,
                    border: `1px solid ${roleStyle.border}`,
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: roleStyle.text, textTransform: 'capitalize' }}>
                      {ROLE_LABELS[user?.role] || user?.role?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              )}

              <CaretDownOutlined style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: -4 }} />
            </div>
          </Dropdown>
        </div>

      </AntHeader>
    </>
  );
};

export default Header;
