import React from 'react';
import { Modal, Button } from 'antd';
import {
  RocketOutlined, CrownOutlined, TeamOutlined,
  ShopOutlined, DatabaseOutlined, CheckCircleFilled,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const RESOURCE_META = {
  warehouses: { icon: <ShopOutlined />,     color: '#667eea', label: 'Warehouses' },
  users:      { icon: <TeamOutlined />,     color: '#f7971e', label: 'Users'      },
  items:      { icon: <DatabaseOutlined />, color: '#11998e', label: 'Items'      },
};

const PLAN_HIGHLIGHTS = [
  { plan: 'Standard',     price: '₹999/mo',  users: 5,  warehouses: 3,  items: '1,000'  },
  { plan: 'Professional', price: '₹2,499/mo', users: 15, warehouses: 10, items: '5,000'  },
  { plan: 'Premium',      price: '₹4,999/mo', users: 50, warehouses: 25, items: '25,000' },
];

export default function UpgradePlanModal({ open, onClose, resource, currentLimit, currentPlan }) {
  const navigate = useNavigate();
  const meta = RESOURCE_META[resource] || RESOURCE_META.warehouses;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      centered
      closable
      styles={{ body: { padding: 0 } }}
    >
      {/* Top gradient banner */}
      <div style={{
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        borderRadius: '8px 8px 0 0',
        padding: '32px 28px 24px',
        textAlign: 'center',
        color: '#fff',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px',
          fontSize: 28,
        }}>
          {React.cloneElement(meta.icon, { style: { color: '#fff', fontSize: 28 } })}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
          {meta.label} Limit Reached
        </div>
        <div style={{ fontSize: 13, opacity: 0.88, lineHeight: 1.5 }}>
          Your <strong>{currentPlan || 'current'}</strong> plan allows{' '}
          <strong>{currentLimit} {meta.label.toLowerCase()}</strong>.
          Upgrade to add more.
        </div>
      </div>

      {/* Plan comparison */}
      <div style={{ padding: '20px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>
          <RocketOutlined style={{ marginRight: 6, color: '#667eea' }} />
          Available upgrades
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PLAN_HIGHLIGHTS.map((p, i) => (
            <div key={p.plan} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 10,
              border: i === 1 ? '2px solid #667eea' : '1px solid #f0f0f0',
              background: i === 1 ? '#f5f3ff' : '#fafafa',
              position: 'relative',
            }}>
              {i === 1 && (
                <div style={{
                  position: 'absolute', top: -10, left: 14,
                  background: '#667eea', color: '#fff',
                  fontSize: 10, fontWeight: 700, padding: '2px 10px',
                  borderRadius: 20,
                }}>POPULAR</div>
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>{p.plan}</div>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                  {p.users} users · {p.warehouses} warehouses · {p.items} items
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#667eea' }}>{p.price}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Benefits */}
        <div style={{ marginTop: 16, padding: '12px 14px', background: '#f0fdf4', borderRadius: 10 }}>
          {[
            'No data loss — all existing records are preserved',
            'Instant activation — upgrade takes effect immediately',
            'Downgrade anytime if needed',
          ].map(t => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, color: '#374151', marginBottom: 4 }}>
              <CheckCircleFilled style={{ color: '#52c41a', flexShrink: 0 }} />
              {t}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <Button
            type="primary" block size="large" icon={<CrownOutlined />}
            style={{
              background: 'linear-gradient(135deg,#667eea,#764ba2)',
              border: 'none', borderRadius: 10, fontWeight: 700, height: 44,
            }}
            onClick={() => { onClose(); navigate('/subscription'); }}
          >
            View Plans & Upgrade
          </Button>
          <Button block size="large" onClick={onClose}
            style={{ borderRadius: 10, height: 44 }}>
            Maybe Later
          </Button>
        </div>
      </div>
    </Modal>
  );
}
