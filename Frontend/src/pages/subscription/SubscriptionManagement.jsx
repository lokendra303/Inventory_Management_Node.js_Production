import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Tag, Progress, Row, Col, Modal, Radio, message, Spin } from 'antd';
import {
  CrownOutlined, CheckCircleFilled, RocketOutlined,
  TeamOutlined, DatabaseOutlined, ShopOutlined
} from '@ant-design/icons';
import apiService from '../../services/apiService';

const FEATURE_LABELS = {
  inventory: 'Inventory Management',
  sales: 'Sales Orders & Invoices',
  purchases: 'Purchase Orders',
  reports: 'Advanced Reports',
  workflows: 'Workflow Automation',
  price_lists: 'Price Lists',
  all: 'All Features Unlimited',
};

export default function SubscriptionManagement() {
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgradeModal, setUpgradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [upgrading, setUpgrading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, plansRes, usageRes] = await Promise.all([
        apiService.get('/subscription'),
        apiService.get('/subscription/plans'),
        apiService.get('/subscription/usage'),
      ]);
      if (subRes.success) setSubscription(subRes.data);
      if (plansRes.success) setPlans(plansRes.data);
      if (usageRes.success) setUsage(usageRes.data);
    } catch { message.error('Failed to load subscription data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpgrade = async () => {
    if (!selectedPlan) return message.warning('Please select a plan');
    setUpgrading(true);
    try {
      await apiService.post('/subscription/upgrade', { planId: selectedPlan, billingCycle });
      message.success('Plan upgraded successfully!');
      setUpgradeModal(false);
      load();
    } catch { message.error('Failed to upgrade plan'); }
    finally { setUpgrading(false); }
  };

  const usagePercent = (used, max) => max === -1 ? 0 : Math.min(100, Math.round((used / max) * 100));
  const usageColor = (pct) => pct >= 90 ? '#ff4d4f' : pct >= 70 ? '#fa8c16' : '#52c41a';

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <Spin size="large" />
    </div>
  );

  const features = subscription?.features
    ? (typeof subscription.features === 'string' ? JSON.parse(subscription.features) : subscription.features)
    : [];

  return (
    <div style={{ padding: 24, background: '#f5f6fa', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#f7971e,#ffd200)',
        borderRadius: 16, padding: '24px 28px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 12, padding: '10px 14px' }}>
            <CrownOutlined style={{ fontSize: 28, color: '#fff' }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>Subscription</div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
              Manage your plan and billing
            </div>
          </div>
        </div>
        <Button icon={<RocketOutlined />} size="large" onClick={() => setUpgradeModal(true)}
          style={{ background: '#fff', color: '#f7971e', border: 'none', fontWeight: 700, borderRadius: 10 }}>
          Upgrade Plan
        </Button>
      </div>

      <Row gutter={16}>
        {/* Current Plan */}
        <Col xs={24} lg={10}>
          <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', marginBottom: 16 }}>
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <CrownOutlined style={{ fontSize: 40, color: '#f7971e' }} />
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>{subscription?.plan_name}</div>
              <Tag color={subscription?.status === 'trial' ? 'orange' : 'green'}
                style={{ marginTop: 8, fontSize: 13, padding: '2px 12px' }}>
                {subscription?.status?.toUpperCase()}
              </Tag>
              {subscription?.days_remaining !== null && subscription?.days_remaining !== undefined && (
                <div style={{ marginTop: 8, color: '#fa8c16', fontWeight: 600 }}>
                  {subscription.days_remaining} days remaining in trial
                </div>
              )}
              <div style={{ marginTop: 12, color: '#8c8c8c', fontSize: 13 }}>
                {subscription?.plan_description}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 10, color: '#374151' }}>Included Features</div>
              {features.includes('all') ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#52c41a', fontWeight: 600 }}>
                  <CheckCircleFilled /> All features included
                </div>
              ) : (
                features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
                    <CheckCircleFilled style={{ color: '#52c41a' }} />
                    {FEATURE_LABELS[f] || f}
                  </div>
                ))
              )}
            </div>
          </Card>
        </Col>

        {/* Usage Meters */}
        <Col xs={24} lg={14}>
          <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', marginBottom: 16 }}
            title={<strong>Usage</strong>}>
            {usage && subscription && [
              { label: 'Users', icon: <TeamOutlined />, used: usage.users, max: subscription.max_users },
              { label: 'Warehouses', icon: <ShopOutlined />, used: usage.warehouses, max: subscription.max_warehouses },
              { label: 'Items', icon: <DatabaseOutlined />, used: usage.items, max: subscription.max_items },
            ].map(({ label, icon, used, max }) => {
              const pct = usagePercent(used, max);
              return (
                <div key={label} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                      {icon} {label}
                    </span>
                    <span style={{ color: usageColor(pct), fontWeight: 700 }}>
                      {used} / {max === -1 ? '∞' : max}
                    </span>
                  </div>
                  <Progress
                    percent={max === -1 ? 0 : pct}
                    strokeColor={usageColor(pct)}
                    showInfo={false}
                    trailColor="#f0f0f0"
                  />
                  {max !== -1 && pct >= 90 && (
                    <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>
                      ⚠ Approaching limit — consider upgrading
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        </Col>
      </Row>

      {/* Upgrade Modal */}
      <Modal title="Choose a Plan" open={upgradeModal}
        onCancel={() => setUpgradeModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setUpgradeModal(false)}>Cancel</Button>,
          <Button key="upgrade" type="primary" loading={upgrading} onClick={handleUpgrade}
            style={{ background: 'linear-gradient(135deg,#f7971e,#ffd200)', border: 'none' }}>
            Upgrade Now
          </Button>
        ]}
        width={700}>
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <Radio.Group value={billingCycle} onChange={e => setBillingCycle(e.target.value)}
            buttonStyle="solid">
            <Radio.Button value="monthly">Monthly</Radio.Button>
            <Radio.Button value="yearly">Yearly <Tag color="green" style={{ marginLeft: 4 }}>Save 17%</Tag></Radio.Button>
          </Radio.Group>
        </div>
        <Row gutter={16}>
          {plans.map(plan => {
            const price = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
            const features = typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features;
            const isCurrent = subscription?.plan_id === plan.id;
            return (
              <Col span={8} key={plan.id}>
                <Card
                  onClick={() => setSelectedPlan(plan.id)}
                  style={{
                    borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s',
                    border: selectedPlan === plan.id ? '2px solid #f7971e' : '1px solid #f0f0f0',
                    background: selectedPlan === plan.id ? '#fffbe6' : '#fff',
                    boxShadow: selectedPlan === plan.id ? '0 4px 20px rgba(247,151,30,0.25)' : 'none',
                  }}
                  bodyStyle={{ padding: 16 }}
                >
                  {isCurrent && <Tag color="blue" style={{ marginBottom: 8 }}>Current Plan</Tag>}
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{plan.name}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#f7971e', margin: '8px 0' }}>
                    ${price}<span style={{ fontSize: 13, color: '#8c8c8c', fontWeight: 400 }}>
                      /{billingCycle === 'yearly' ? 'yr' : 'mo'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 12 }}>{plan.description}</div>
                  {features.includes('all') ? (
                    <div style={{ fontSize: 12, color: '#52c41a', fontWeight: 600 }}>✓ All features</div>
                  ) : (
                    features.slice(0, 4).map(f => (
                      <div key={f} style={{ fontSize: 12, color: '#595959', marginBottom: 3 }}>
                        ✓ {FEATURE_LABELS[f] || f}
                      </div>
                    ))
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      </Modal>
    </div>
  );
}
