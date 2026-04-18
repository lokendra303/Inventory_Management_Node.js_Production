import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Tag, Progress, Row, Col, Modal, Radio,
  message, Spin, Table, Divider, Popconfirm, Alert, List
} from 'antd';
import {
  CrownOutlined, CheckCircleFilled, RocketOutlined,
  TeamOutlined, DatabaseOutlined, ShopOutlined,
  HistoryOutlined, CloseCircleOutlined, InfoCircleOutlined,
  CalendarOutlined, DollarOutlined, CheckOutlined, WarningOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/apiService';

const FEATURE_LABELS = {
  inventory:   'Inventory Management',
  sales:       'Sales Orders & Invoices',
  purchases:   'Purchase Orders',
  reports:     'Advanced Reports',
  workflows:   'Workflow Automation',
  price_lists: 'Price Lists',
  all:         'All Features Unlimited',
};

const STATUS_COLOR = { trial: 'orange', active: 'green', expired: 'red', cancelled: 'default' };

const fmt = (n) => n === -1 ? '∞' : n?.toLocaleString('en-IN') ?? '—';
const fmtPrice = (n) => n === 0 ? 'Free' : `₹${Number(n).toLocaleString('en-IN')}`;

export default function SubscriptionManagement() {
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans]               = useState([]);
  const [usage, setUsage]               = useState(null);
  const [history, setHistory]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [upgradeModal, setUpgradeModal] = useState(false);
  const [cancelModal, setCancelModal]   = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab]       = useState('overview');
  const [conflicts, setConflicts]       = useState(null);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null); // order data from backend

  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, plansRes, usageRes, histRes] = await Promise.all([
        apiService.get('/subscription'),
        apiService.get('/subscription/plans'),
        apiService.get('/subscription/usage'),
        apiService.get('/subscription/billing-history'),
      ]);
      if (subRes.success)   setSubscription(subRes.data);
      if (plansRes.success) setPlans(plansRes.data);
      if (usageRes.success) setUsage(usageRes.data);
      if (histRes.success)  setHistory(histRes.data);
    } catch { message.error('Failed to load subscription data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpgrade = async () => {
    if (!selectedPlan) return message.warning('Please select a plan');
    setActionLoading(true);
    try {
      const orderRes = await apiService.post('/subscription/payment/create-order', {
        planId: selectedPlan, billingCycle,
      });
      if (!orderRes.success) throw new Error(orderRes.error || 'Failed to initiate payment');
      const orderData = orderRes.data;

      // Free plan — activate directly
      if (orderData.free) {
        await apiService.post('/subscription/upgrade', { planId: selectedPlan, billingCycle });
        message.success(`Switched to ${orderData.planName} plan!`);
        setUpgradeModal(false);
        setSelectedPlan(null);
        load();
        return;
      }

      // Paid plan — show payment modal
      setUpgradeModal(false);
      setPaymentOrder(orderData);
      setPaymentModal(true);

    } catch (e) {
      const data = e?.response?.data;
      if (data?.error === 'DOWNGRADE_BLOCKED') {
        setUpgradeModal(false);
        setConflicts({ planName: data.planName, items: data.conflicts });
      } else {
        message.error(data?.error || e?.message || 'Failed to process upgrade');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayNow = async () => {
    if (!paymentOrder) return;
    setActionLoading(true);
    try {
      if (paymentOrder.gatewayReady && paymentOrder.orderId) {
        // Real Razorpay flow
        if (!window.Razorpay) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load payment gateway'));
            document.body.appendChild(script);
          });
        }
        const options = {
          key:         paymentOrder.keyId,
          amount:      paymentOrder.amount * 100,
          currency:    paymentOrder.currency,
          name:        'IMS SEPCUNE',
          description: `${paymentOrder.planName} Plan — ${paymentOrder.billingCycle}`,
          order_id:    paymentOrder.orderId,
          theme:       { color: '#667eea' },
          handler: async (response) => {
            try {
              await apiService.post('/subscription/payment/verify', {
                planId:            paymentOrder.planId,
                billingCycle:      paymentOrder.billingCycle,
                razorpayOrderId:   response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              message.success('Payment successful! Plan activated.');
              setPaymentModal(false);
              setPaymentOrder(null);
              setSelectedPlan(null);
              load();
            } catch (err) {
              message.error(err?.response?.data?.error || 'Payment verification failed.');
            }
          },
          modal: { ondismiss: () => setActionLoading(false) },
        };
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (resp) => {
          message.error(`Payment failed: ${resp.error.description}`);
          setActionLoading(false);
        });
        rzp.open();
      } else {
        // Gateway not configured — show info, don't activate
        message.warning('Payment gateway not configured. Please add Razorpay keys to enable payments.');
        setActionLoading(false);
      }
    } catch (e) {
      message.error(e?.message || 'Payment failed');
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await apiService.post('/subscription/cancel', { reason: 'User requested cancellation' });
      message.success('Subscription cancelled. Access continues until end of billing period.');
      setCancelModal(false);
      load();
    } catch (e) {
      message.error(e?.response?.data?.error || e?.message || 'Failed to cancel subscription');
    } finally { setActionLoading(false); }
  };

  const usagePct   = (used, max) => max === -1 ? 0 : Math.round((used / max) * 100);
  const isOverLimit = (used, max) => max !== -1 && used > max;
  const usageColor  = (used, max) => {
    if (max === -1) return '#52c41a';
    if (used > max) return '#ff4d4f';
    const pct = Math.round((used / max) * 100);
    return pct >= 90 ? '#ff4d4f' : pct >= 70 ? '#fa8c16' : '#52c41a';
  };

  const features = subscription?.features
    ? (typeof subscription.features === 'string' ? JSON.parse(subscription.features) : subscription.features)
    : [];

  const isExpiredOrCancelled = ['expired', 'cancelled'].includes(subscription?.status);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <Spin size="large" />
    </div>
  );

  // ── Billing history columns ──────────────────────────────────────────────
  const historyColumns = [
    { title: 'Invoice',      dataIndex: 'invoice_number', key: 'invoice_number',
      render: v => <strong>{v || '—'}</strong> },
    { title: 'Plan',         dataIndex: 'plan_name',      key: 'plan_name' },
    { title: 'Cycle',        dataIndex: 'billing_cycle',  key: 'billing_cycle',
      render: v => <Tag color="blue">{v}</Tag> },
    { title: 'Amount',       dataIndex: 'amount',         key: 'amount',
      render: v => <strong style={{ color: '#52c41a' }}>{fmtPrice(v)}</strong> },
    { title: 'Status',       dataIndex: 'status',         key: 'status',
      render: v => <Tag color={v === 'paid' ? 'green' : v === 'failed' ? 'red' : 'orange'}>{v}</Tag> },
    { title: 'Period',       key: 'period',
      render: (_, r) => `${new Date(r.period_start).toLocaleDateString('en-IN')} → ${new Date(r.period_end).toLocaleDateString('en-IN')}` },
    { title: 'Date',         dataIndex: 'created_at',     key: 'created_at',
      render: v => new Date(v).toLocaleDateString('en-IN') },
  ];

  return (
    <div style={{ padding: 24, background: '#f5f6fa', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg,#f7971e,#ffd200)',
        borderRadius: 16, padding: '24px 28px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 12, padding: '10px 14px' }}>
            <CrownOutlined style={{ fontSize: 28, color: '#fff' }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>Subscription</div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>Manage your plan and billing</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {subscription?.status === 'active' && subscription?.plan_id !== 'plan-free' && (
            <Button danger ghost onClick={() => setCancelModal(true)} style={{ borderRadius: 10 }}>
              Cancel Plan
            </Button>
          )}
          <Button icon={<RocketOutlined />} size="large" onClick={() => { setSelectedPlan(null); setUpgradeModal(true); }}
            style={{ background: '#fff', color: '#f7971e', border: 'none', fontWeight: 700, borderRadius: 10 }}>
            {isExpiredOrCancelled ? 'Reactivate' : 'Upgrade Plan'}
          </Button>
        </div>
      </div>

      {/* ── Trial Banner ── */}
      {subscription?.status === 'trial' && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 20, borderRadius: 10 }}
          message={`Free Trial — ${subscription.days_remaining} day${subscription.days_remaining !== 1 ? 's' : ''} remaining`}
          description="You have full access to all features during your 14-day trial. After the trial ends, your account will move to the free Free plan (2 users, 1 warehouse, 100 items). Upgrade anytime to keep full access."
          action={
            <Button size="small" type="primary" onClick={() => setUpgradeModal(true)}
              style={{ background: 'linear-gradient(135deg,#f7971e,#ffd200)', border: 'none' }}>
              Upgrade Now
            </Button>
          }
        />
      )}

      {/* ── Expired / Cancelled Banner ── */}
      {isExpiredOrCancelled && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 20, borderRadius: 10 }}
          message={`Subscription ${subscription.status}`}
          description={
            subscription.status === 'expired'
              ? 'Your subscription has expired. Upgrade to a plan to restore full access.'
              : `Your subscription was cancelled. Access continues until ${subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('en-IN') : 'end of period'}.`
          }
          action={
            <Button size="small" type="primary" danger onClick={() => setUpgradeModal(true)}>
              Reactivate Now
            </Button>
          }
        />
      )}

      {/* ── Tab Nav ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { key: 'overview', label: 'Overview', icon: <CrownOutlined /> },
          { key: 'billing',  label: 'Billing History', icon: <HistoryOutlined /> },
        ].map(t => (
          <Button key={t.key} type={activeTab === t.key ? 'primary' : 'default'}
            icon={t.icon} onClick={() => setActiveTab(t.key)}
            style={{ borderRadius: 10, fontWeight: activeTab === t.key ? 700 : 400 }}>
            {t.label}
          </Button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <Row gutter={[16, 16]}>

          {/* Current Plan Card */}
          <Col xs={24} lg={10}>
            <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', height: '100%' }}>
              <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
                <CrownOutlined style={{ fontSize: 44, color: '#f7971e' }} />
                <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>{subscription?.plan_name}</div>
                <Tag color={STATUS_COLOR[subscription?.status] || 'default'}
                  style={{ marginTop: 8, fontSize: 13, padding: '2px 14px' }}>
                  {subscription?.status?.toUpperCase()}
                </Tag>

                {/* Trial countdown */}
                {subscription?.status === 'trial' && subscription?.days_remaining != null && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ padding: '8px 16px', background: '#fff7e6',
                      borderRadius: 8, display: 'inline-block', marginBottom: 8 }}>
                      <CalendarOutlined style={{ color: '#fa8c16', marginRight: 6 }} />
                      <span style={{ color: '#fa8c16', fontWeight: 600 }}>
                        {subscription.days_remaining} day{subscription.days_remaining !== 1 ? 's' : ''} left in trial
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                      Full access to all features during trial.
                      After trial ends, you'll be on the <strong>Free</strong> plan.
                    </div>
                  </div>
                )}

                {/* Active period end */}
                {subscription?.status === 'active' && subscription?.current_period_end && (
                  <div style={{ marginTop: 10, color: '#8c8c8c', fontSize: 13 }}>
                    <CalendarOutlined style={{ marginRight: 4 }} />
                    Renews {new Date(subscription.current_period_end).toLocaleDateString('en-IN')}
                  </div>
                )}

                <div style={{ marginTop: 10, color: '#8c8c8c', fontSize: 13 }}>
                  {subscription?.plan_description}
                </div>
              </div>

              <Divider style={{ margin: '12px 0' }} />

              {/* Pricing */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 8, color: '#374151' }}>
                  <DollarOutlined style={{ marginRight: 6 }} />Pricing
                </div>
                <Row gutter={8}>
                  <Col span={12}>
                    <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#f7971e' }}>
                        {fmtPrice(subscription?.price_monthly)}
                      </div>
                      <div style={{ fontSize: 11, color: '#8c8c8c' }}>per month</div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#52c41a' }}>
                        {fmtPrice(subscription?.price_yearly)}
                      </div>
                      <div style={{ fontSize: 11, color: '#8c8c8c' }}>per year</div>
                    </div>
                  </Col>
                </Row>
              </div>

              <Divider style={{ margin: '12px 0' }} />

              {/* Features */}
              <div>
                <div style={{ fontWeight: 700, marginBottom: 10, color: '#374151' }}>Included Features</div>
                {features.includes('all') ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#52c41a', fontWeight: 600 }}>
                    <CheckCircleFilled /> All features included
                  </div>
                ) : features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
                    <CheckCircleFilled style={{ color: '#52c41a' }} />
                    {FEATURE_LABELS[f] || f}
                  </div>
                ))}
              </div>

              {/* Plan limits */}
              <Divider style={{ margin: '12px 0' }} />
              <div>
                <div style={{ fontWeight: 700, marginBottom: 10, color: '#374151' }}>Plan Limits</div>
                {[
                  { label: 'Users',       icon: <TeamOutlined />,     val: subscription?.max_users },
                  { label: 'Warehouses',  icon: <ShopOutlined />,     val: subscription?.max_warehouses },
                  { label: 'Items',       icon: <DatabaseOutlined />, val: subscription?.max_items },
                ].map(({ label, icon, val }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 6, fontSize: 13 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#595959' }}>
                      {icon} {label}
                    </span>
                    <strong style={{ color: val === -1 ? '#52c41a' : '#374151' }}>{fmt(val)}</strong>
                  </div>
                ))}
              </div>
            </Card>
          </Col>

          {/* Usage Meters */}
          <Col xs={24} lg={14}>
            <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}
              title={<strong>Current Usage</strong>}>
              {usage && subscription && [
                { label: 'Users',      icon: <TeamOutlined />,     used: usage.users,      max: subscription.max_users },
                { label: 'Warehouses', icon: <ShopOutlined />,     used: usage.warehouses, max: subscription.max_warehouses },
                { label: 'Items',      icon: <DatabaseOutlined />, used: usage.items,      max: subscription.max_items },
              ].map(({ label, icon, used, max }) => {
                const pct  = usagePct(used, max);
                const over = isOverLimit(used, max);
                const color = usageColor(used, max);
                return (
                  <div key={label} style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                        {icon} {label}
                      </span>
                      <span style={{ color, fontWeight: 700 }}>
                        {used} / {fmt(max)}
                        {max !== -1 && (
                          <span style={{ color: '#8c8c8c', fontWeight: 400, fontSize: 12, marginLeft: 6 }}>
                            ({pct}%)
                          </span>
                        )}
                      </span>
                    </div>
                    <Progress
                      percent={max === -1 ? 0 : Math.min(100, pct)}
                      strokeColor={color}
                      showInfo={false}
                      trailColor="#f0f0f0"
                      strokeWidth={10}
                    />
                    {over && (
                      <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4, fontWeight: 600 }}>
                        🚫 Over limit by {used - max} — upgrade your plan to continue using this resource
                      </div>
                    )}
                    {!over && max !== -1 && pct >= 90 && (
                      <div style={{ color: '#fa8c16', fontSize: 12, marginTop: 4 }}>
                        ⚠ Approaching limit — consider upgrading your plan
                      </div>
                    )}
                    {max === -1 && (
                      <div style={{ color: '#52c41a', fontSize: 12, marginTop: 4 }}>✓ Unlimited</div>
                    )}
                  </div>
                );
              })}
            </Card>

            {/* Quick plan comparison */}
            <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', marginTop: 16 }}
              title={<strong>Available Plans</strong>}
              extra={
                <Button type="primary" size="small" onClick={() => setUpgradeModal(true)}
                  style={{ background: 'linear-gradient(135deg,#f7971e,#ffd200)', border: 'none', borderRadius: 8 }}>
                  Change Plan
                </Button>
              }>

              {/* Plan cards grid */}
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                {plans.map((plan, idx) => {
                  const isCurrent = subscription?.plan_id === plan.id;
                  const planFeats = typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features;
                  const ACCENTS   = ['#52c41a', '#1890ff', '#f7971e', '#9c27b0', '#ffd200'];
                  const BG        = [
                    'linear-gradient(145deg,#f6ffed,#e8f5e9)',
                    'linear-gradient(145deg,#e6f7ff,#e8eaf6)',
                    'linear-gradient(145deg,#fff7e6,#fff0f6)',
                    'linear-gradient(145deg,#f9f0ff,#ede7f6)',
                    'linear-gradient(145deg,#1a1a2e,#16213e)',
                  ];
                  const accent = ACCENTS[idx] || '#f7971e';
                  const isDark = idx === 4;
                  const isPopular = plan.id === 'plan-professional';

                  return (
                    <div
                      key={plan.id}
                      onClick={() => { setSelectedPlan(plan.id); setUpgradeModal(true); }}
                      style={{
                        flex: '0 0 150px', minWidth: 150,
                        borderRadius: 14,
                        border: isCurrent ? `2px solid ${accent}` : '2px solid transparent',
                        background: BG[idx],
                        boxShadow: isCurrent ? `0 4px 16px ${accent}33` : '0 2px 8px rgba(0,0,0,0.06)',
                        cursor: 'pointer', transition: 'all 0.2s',
                        padding: '14px 12px',
                        position: 'relative', overflow: 'hidden',
                      }}
                    >
                      {/* Popular ribbon */}
                      {isPopular && (
                        <div style={{
                          position: 'absolute', top: 0, right: 0,
                          background: accent, color: '#fff',
                          fontSize: 9, fontWeight: 800, padding: '2px 8px',
                          borderBottomLeftRadius: 8,
                        }}>POPULAR</div>
                      )}

                      {/* Current badge */}
                      {isCurrent && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: accent, color: '#fff',
                          fontSize: 9, fontWeight: 700, padding: '2px 7px',
                          borderRadius: 20, marginBottom: 6,
                        }}>
                          <CheckCircleFilled style={{ fontSize: 9 }} /> Current
                        </div>
                      )}

                      {/* Plan name */}
                      <div style={{ fontWeight: 800, fontSize: 13, color: isDark ? '#fff' : '#1a1a2e', marginBottom: 4 }}>
                        {plan.name}
                      </div>

                      {/* Price */}
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: 20, fontWeight: 900, color: accent, lineHeight: 1 }}>
                          {plan.price_monthly === 0 ? 'Free' : `₹${Number(plan.price_monthly).toLocaleString('en-IN')}`}
                        </span>
                        {plan.price_monthly > 0 && (
                          <span style={{ fontSize: 10, color: isDark ? '#aaa' : '#8c8c8c', marginLeft: 2 }}>/mo</span>
                        )}
                      </div>

                      {/* Limits */}
                      <div style={{ borderTop: `1px solid ${isDark ? '#ffffff18' : '#0000000a'}`, paddingTop: 8, marginBottom: 8 }}>
                        {[
                          { emoji: '👤', val: plan.max_users,      label: 'users' },
                          { emoji: '🏭', val: plan.max_warehouses, label: 'wh' },
                          { emoji: '📦', val: plan.max_items,      label: 'items' },
                        ].map(({ emoji, val, label }) => (
                          <div key={label} style={{
                            fontSize: 11, color: isDark ? '#ddd' : '#374151',
                            display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3,
                          }}>
                            <span style={{ fontSize: 11 }}>{emoji}</span>
                            <span style={{ fontWeight: 600, color: val === -1 ? accent : isDark ? '#fff' : '#1a1a2e' }}>
                              {fmt(val)}
                            </span>
                            <span style={{ color: isDark ? '#aaa' : '#8c8c8c' }}>{label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Top feature */}
                      <div style={{ fontSize: 10, color: isDark ? '#ccc' : '#595959' }}>
                        {planFeats.includes('all')
                          ? <span style={{ color: accent, fontWeight: 700 }}>✦ All features</span>
                          : <span style={{ color: accent }}>✓ {planFeats.length} feature{planFeats.length !== 1 ? 's' : ''}</span>
                        }
                      </div>

                      {/* Hover CTA */}
                      {!isCurrent && (
                        <div style={{
                          marginTop: 10, textAlign: 'center',
                          fontSize: 11, fontWeight: 700,
                          color: accent, opacity: 0.8,
                        }}>
                          Select →
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Feature comparison row */}
              <div style={{ marginTop: 14, padding: '10px 12px', background: '#f9fafb', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 8, fontWeight: 600 }}>FEATURES INCLUDED</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Object.entries(FEATURE_LABELS).filter(([k]) => k !== 'all').map(([key, label]) => {
                    const included = features.includes('all') || features.includes(key);
                    return (
                      <div key={key} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 20, fontSize: 11,
                        background: included ? '#f6ffed' : '#fafafa',
                        border: `1px solid ${included ? '#b7eb8f' : '#f0f0f0'}`,
                        color: included ? '#389e0d' : '#bfbfbf',
                        fontWeight: included ? 600 : 400,
                      }}>
                        {included ? '✓' : '✗'} {label}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* ── Billing History Tab ── */}
      {activeTab === 'billing' && (
        <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}
          title={<strong><HistoryOutlined style={{ marginRight: 8 }} />Billing History</strong>}>
          <Table
            dataSource={history}
            columns={historyColumns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            size="small"
            locale={{ emptyText: 'No billing history yet.' }}
            scroll={{ x: 700 }}
          />
        </Card>
      )}

      {/* ── Upgrade Modal ── */}
      <Modal
        title={<span><RocketOutlined style={{ marginRight: 8, color: '#f7971e' }} />Choose a Plan</span>}
        open={upgradeModal}
        onCancel={() => { setUpgradeModal(false); setSelectedPlan(null); }}
        footer={[
          <Button key="cancel" onClick={() => { setUpgradeModal(false); setSelectedPlan(null); }}>Cancel</Button>,
          <Button key="upgrade" type="primary" loading={actionLoading} onClick={handleUpgrade}
            disabled={!selectedPlan}
            style={{ background: 'linear-gradient(135deg,#f7971e,#ffd200)', border: 'none' }}>
            {(() => {
              if (!selectedPlan) return isExpiredOrCancelled ? 'Reactivate' : 'Confirm Plan';
              const p = plans.find(pl => pl.id === selectedPlan);
              const price = billingCycle === 'yearly' ? p?.price_yearly : p?.price_monthly;
              return price === 0 ? 'Switch to Free' : isExpiredOrCancelled ? 'Pay & Reactivate' : 'Pay & Activate';
            })()}
          </Button>,
        ]}
        width={1100}
        styles={{ body: { padding: '16px 24px' } }}>

        {/* Billing toggle */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <Radio.Group value={billingCycle} onChange={e => setBillingCycle(e.target.value)} buttonStyle="solid" size="middle">
            <Radio.Button value="monthly">Monthly</Radio.Button>
            <Radio.Button value="yearly">
              Yearly&nbsp;<Tag color="green" style={{ margin: 0, fontSize: 11 }}>Save ~17%</Tag>
            </Radio.Button>
          </Radio.Group>
        </div>

        {/* Plan cards — horizontal scroll on small screens */}
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
          {plans.map((plan, idx) => {
            const price     = billingCycle === 'yearly' ? plan.price_yearly  : plan.price_monthly;
            const perMonth  = billingCycle === 'yearly' ? Math.round(plan.price_yearly / 12) : plan.price_monthly;
            const planFeats = typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features;
            const isCurrent = subscription?.plan_id === plan.id;
            const isSelected = selectedPlan === plan.id;
            const isPopular  = plan.id === 'plan-professional';
            // gradient per plan tier
            const GRADIENTS = [
              '#e8f5e9,#f1f8e9', // free   — light green
              '#e3f2fd,#e8eaf6', // std    — light blue
              '#fff3e0,#fce4ec', // pro    — orange/pink
              '#f3e5f5,#ede7f6', // premium— purple
              '#1a1a2e,#16213e', // ent    — dark
            ];
            const ACCENT = ['#52c41a','#1890ff','#f7971e','#9c27b0','#ffd200'];
            const accent  = ACCENT[idx] || '#f7971e';
            const isDark  = idx === 4;

            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                style={{
                  flex: '0 0 190px', minWidth: 190,
                  borderRadius: 16,
                  border: isSelected ? `2px solid ${accent}` : isCurrent ? `2px solid ${accent}` : '2px solid transparent',
                  background: isDark ? 'linear-gradient(160deg,#1a1a2e,#16213e)' : `linear-gradient(160deg,${GRADIENTS[idx]})`,
                  boxShadow: isSelected ? `0 6px 24px ${accent}44` : '0 2px 8px rgba(0,0,0,0.08)',
                  cursor: 'pointer', transition: 'all 0.2s',
                  position: 'relative', overflow: 'hidden',
                  padding: '18px 14px 14px',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                {/* Popular badge */}
                {isPopular && (
                  <div style={{
                    position: 'absolute', top: 0, right: 0,
                    background: accent, color: '#fff',
                    fontSize: 10, fontWeight: 700, padding: '3px 10px',
                    borderBottomLeftRadius: 10,
                  }}>POPULAR</div>
                )}

                {/* Current / Selected badge */}
                {isCurrent && !isSelected && (
                  <Tag color="default" style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, margin: 0 }}>Current</Tag>
                )}
                {isSelected && (
                  <div style={{
                    position: 'absolute', top: 8, left: 8,
                    background: accent, borderRadius: 20, width: 20, height: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CheckOutlined style={{ color: '#fff', fontSize: 11 }} />
                  </div>
                )}

                {/* Plan name */}
                <div style={{ fontWeight: 800, fontSize: 16, color: isDark ? '#fff' : '#1a1a2e', marginTop: 8 }}>
                  {plan.name}
                </div>

                {/* Price */}
                <div style={{ margin: '10px 0 4px' }}>
                  <span style={{ fontSize: 28, fontWeight: 900, color: accent, lineHeight: 1 }}>
                    {price === 0 ? 'Free' : `₹${Number(price).toLocaleString('en-IN')}`}
                  </span>
                  {price > 0 && (
                    <span style={{ fontSize: 11, color: isDark ? '#aaa' : '#8c8c8c', marginLeft: 4 }}>
                      /{billingCycle === 'yearly' ? 'yr' : 'mo'}
                    </span>
                  )}
                </div>
                {billingCycle === 'yearly' && price > 0 && (
                  <div style={{ fontSize: 11, color: isDark ? '#aaa' : '#8c8c8c', marginBottom: 4 }}>
                    ≈ ₹{perMonth.toLocaleString('en-IN')}/mo
                  </div>
                )}

                {/* Description */}
                <div style={{ fontSize: 11, color: isDark ? '#ccc' : '#595959', marginBottom: 12, lineHeight: 1.4 }}>
                  {plan.description}
                </div>

                <div style={{ borderTop: `1px solid ${isDark ? '#ffffff22' : '#00000010'}`, paddingTop: 10, marginBottom: 10 }}>
                  {/* Limits */}
                  {[
                    { icon: '👤', label: `${fmt(plan.max_users)} users` },
                    { icon: '🏭', label: `${fmt(plan.max_warehouses)} warehouse${plan.max_warehouses !== 1 ? 's' : ''}` },
                    { icon: '📦', label: `${fmt(plan.max_items)} items` },
                  ].map(({ icon, label }) => (
                    <div key={label} style={{ fontSize: 11, color: isDark ? '#ddd' : '#374151',
                      marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span>{icon}</span>{label}
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: `1px solid ${isDark ? '#ffffff22' : '#00000010'}`, paddingTop: 10, flex: 1 }}>
                  {/* Features */}
                  {planFeats.includes('all') ? (
                    <div style={{ fontSize: 11, color: accent, fontWeight: 700 }}>✦ All features</div>
                  ) : planFeats.map(f => (
                    <div key={f} style={{ fontSize: 11, color: isDark ? '#ccc' : '#595959',
                      marginBottom: 3, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                      <span style={{ color: accent, flexShrink: 0 }}>✓</span>
                      {FEATURE_LABELS[f] || f}
                    </div>
                  ))}
                </div>

                {/* Select button */}
                <button
                  style={{
                    marginTop: 14, width: '100%', padding: '7px 0',
                    borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12,
                    background: isSelected ? accent : isDark ? '#ffffff22' : `${accent}22`,
                    color: isSelected ? '#fff' : isDark ? '#fff' : accent,
                    transition: 'all 0.2s',
                  }}
                >
                  {isCurrent ? 'Current Plan' : isSelected ? 'Selected ✓' : 'Select'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Summary bar */}
        {selectedPlan && (() => {
          const p = plans.find(pl => pl.id === selectedPlan);
          const price = billingCycle === 'yearly' ? p?.price_yearly : p?.price_monthly;
          const saving = p?.price_monthly > 0 && billingCycle === 'yearly'
            ? (p.price_monthly * 12) - p.price_yearly : 0;
          return (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#fffbe6',
              borderRadius: 10, border: '1px solid #ffe58f', fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span>
                <InfoCircleOutlined style={{ color: '#fa8c16', marginRight: 6 }} />
                <strong>{p?.name}</strong> plan · {billingCycle} ·{' '}
                <strong style={{ color: '#f7971e' }}>
                  {price === 0 ? 'Free' : `₹${Number(price).toLocaleString('en-IN')}`}
                </strong>
              </span>
              {saving > 0 && (
                <Tag color="green">You save ₹{saving.toLocaleString('en-IN')} vs monthly</Tag>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* ── Cancel Modal ── */}
      <Modal
        title={<span style={{ color: '#ff4d4f' }}><CloseCircleOutlined style={{ marginRight: 8 }} />Cancel Subscription</span>}
        open={cancelModal}
        onCancel={() => setCancelModal(false)}
        footer={[
          <Button key="back" onClick={() => setCancelModal(false)}>Keep Subscription</Button>,
          <Popconfirm
            key="confirm"
            title="Are you sure you want to cancel?"
            description="You will lose access to premium features at the end of your billing period."
            onConfirm={handleCancel}
            okText="Yes, Cancel"
            okButtonProps={{ danger: true, loading: actionLoading }}
            cancelText="No, Keep It"
          >
            <Button danger loading={actionLoading}>Cancel Subscription</Button>
          </Popconfirm>,
        ]}>
        <Alert
          type="warning"
          showIcon
          message="What happens when you cancel?"
          description={
            <ul style={{ paddingLeft: 18, marginTop: 8 }}>
              <li>Your account is <strong>immediately switched to the Free plan</strong>.</li>
              <li>Free plan limits apply right away (2 users, 1 warehouse, 100 items).</li>
              <li>You can upgrade again at any time.</li>
              <li>Your data is preserved — nothing is deleted.</li>
            </ul>
          }
          style={{ borderRadius: 8 }}
        />
        {/* No period end shown — cancellation switches to Free immediately */}
      </Modal>
      {/* ── Payment Modal ── */}
      <Modal
        title={null}
        open={paymentModal}
        onCancel={() => { setPaymentModal(false); setPaymentOrder(null); setActionLoading(false); }}
        footer={null}
        width={480}
        centered
        styles={{ body: { padding: 0 } }}
      >
        {paymentOrder && (
          <div>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg,#667eea,#764ba2)',
              borderRadius: '8px 8px 0 0',
              padding: '28px 28px 20px',
              color: '#fff',
            }}>
              <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>Complete your purchase</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{paymentOrder.planName} Plan</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4, textTransform: 'capitalize' }}>
                {paymentOrder.billingCycle} billing
              </div>
            </div>

            <div style={{ padding: '24px 28px' }}>

              {/* Order summary */}
              <div style={{ background: '#f9fafb', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600, marginBottom: 10 }}>ORDER SUMMARY</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                  <span style={{ color: '#595959' }}>{paymentOrder.planName} Plan ({paymentOrder.billingCycle})</span>
                  <span style={{ fontWeight: 700 }}>₹{Number(paymentOrder.amount).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: '#8c8c8c' }}>
                  <span>GST (18%)</span>
                  <span>Included</span>
                </div>
                <Divider style={{ margin: '10px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800 }}>
                  <span>Total</span>
                  <span style={{ color: '#667eea' }}>₹{Number(paymentOrder.amount).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Payment methods */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 600, marginBottom: 12 }}>PAY WITH</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    { label: 'UPI', icon: '📱' },
                    { label: 'Card', icon: '💳' },
                    { label: 'Net Banking', icon: '🏦' },
                    { label: 'Wallet', icon: '👛' },
                  ].map(m => (
                    <div key={m.label} style={{
                      flex: '1 1 80px', padding: '10px 8px', textAlign: 'center',
                      border: '1px solid #f0f0f0', borderRadius: 8,
                      background: '#fafafa', fontSize: 12, color: '#595959',
                    }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{m.icon}</div>
                      {m.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Gateway status */}
              {!paymentOrder.gatewayReady && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16, borderRadius: 8, fontSize: 12 }}
                  message="Payment gateway not configured"
                  description="Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env file to enable live payments."
                />
              )}

              {/* Security badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
                fontSize: 11, color: '#8c8c8c', justifyContent: 'center' }}>
                <span>🔒 256-bit SSL</span>
                <span>·</span>
                <span>🛡️ PCI DSS Compliant</span>
                <span>·</span>
                <span>⚡ Powered by Razorpay</span>
              </div>

              {/* Action buttons */}
              <Button
                type="primary" block size="large"
                loading={actionLoading}
                disabled={!paymentOrder.gatewayReady}
                onClick={handlePayNow}
                style={{
                  background: paymentOrder.gatewayReady
                    ? 'linear-gradient(135deg,#667eea,#764ba2)'
                    : '#d9d9d9',
                  border: 'none', borderRadius: 10, height: 48,
                  fontWeight: 700, fontSize: 15,
                }}
              >
                {paymentOrder.gatewayReady
                  ? `Pay ₹${Number(paymentOrder.amount).toLocaleString('en-IN')}`
                  : 'Payment Gateway Not Configured'}
              </Button>

              <Button block size="large" onClick={() => { setPaymentModal(false); setPaymentOrder(null); }}
                style={{ marginTop: 10, borderRadius: 10, height: 44 }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Payment Modal ── */}
      <Modal
        title={null}
        open={paymentModal}
        onCancel={() => { setPaymentModal(false); setPaymentOrder(null); setActionLoading(false); }}
        footer={null}
        width={460}
        centered
        styles={{ body: { padding: 0 } }}
      >
        {paymentOrder && (
          <div>
            {/* Gradient header */}
            <div style={{
              background: 'linear-gradient(135deg,#667eea,#764ba2)',
              borderRadius: '8px 8px 0 0',
              padding: '28px 28px 22px',
              color: '#fff',
            }}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4, letterSpacing: 1 }}>COMPLETE YOUR PURCHASE</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{paymentOrder.planName} Plan</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4, textTransform: 'capitalize' }}>
                {paymentOrder.billingCycle} billing
              </div>
            </div>

            <div style={{ padding: '24px 28px' }}>

              {/* Order summary box */}
              <div style={{ background: '#f9fafb', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 700, marginBottom: 10, letterSpacing: 0.5 }}>ORDER SUMMARY</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
                  <span style={{ color: '#595959' }}>{paymentOrder.planName} ({paymentOrder.billingCycle})</span>
                  <span style={{ fontWeight: 700 }}>₹{Number(paymentOrder.amount).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8c8c8c', marginBottom: 6 }}>
                  <span>GST (18%)</span>
                  <span>Included</span>
                </div>
                <Divider style={{ margin: '10px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800 }}>
                  <span>Total</span>
                  <span style={{ color: '#667eea' }}>₹{Number(paymentOrder.amount).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Payment method icons */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 700, marginBottom: 12, letterSpacing: 0.5 }}>PAY WITH</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[{ label: 'UPI', icon: '📱' }, { label: 'Card', icon: '💳' },
                    { label: 'Net Banking', icon: '🏦' }, { label: 'Wallet', icon: '👛' }].map(m => (
                    <div key={m.label} style={{
                      flex: 1, padding: '10px 6px', textAlign: 'center',
                      border: '1px solid #f0f0f0', borderRadius: 8,
                      background: '#fafafa', fontSize: 11, color: '#595959',
                    }}>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</div>
                      {m.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Gateway not configured warning */}
              {!paymentOrder.gatewayReady && (
                <Alert
                  type="warning" showIcon
                  style={{ marginBottom: 16, borderRadius: 8, fontSize: 12 }}
                  message="Payment gateway not configured"
                  description="Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env to enable live payments."
                />
              )}

              {/* Security row */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12,
                fontSize: 11, color: '#8c8c8c', marginBottom: 20 }}>
                <span>🔒 256-bit SSL</span>
                <span>·</span>
                <span>🛡️ PCI DSS</span>
                <span>·</span>
                <span>⚡ Razorpay</span>
              </div>

              {/* Pay button */}
              <Button
                type="primary" block size="large"
                loading={actionLoading}
                disabled={!paymentOrder.gatewayReady}
                onClick={handlePayNow}
                style={{
                  background: paymentOrder.gatewayReady
                    ? 'linear-gradient(135deg,#667eea,#764ba2)' : '#d9d9d9',
                  border: 'none', borderRadius: 10, height: 48,
                  fontWeight: 700, fontSize: 15,
                }}
              >
                {paymentOrder.gatewayReady
                  ? `Pay ₹${Number(paymentOrder.amount).toLocaleString('en-IN')}`
                  : 'Configure Razorpay to Enable Payments'}
              </Button>

              <Button block size="large"
                onClick={() => { setPaymentModal(false); setPaymentOrder(null); }}
                style={{ marginTop: 10, borderRadius: 10, height: 44 }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Downgrade Conflict Modal ── */}
      <Modal
        title={<span style={{ color: '#fa8c16' }}><WarningOutlined style={{ marginRight: 8 }} />Cannot Switch to {conflicts?.planName}</span>}
        open={!!conflicts}
        onCancel={() => setConflicts(null)}
        footer={[
          <Button key="close" onClick={() => setConflicts(null)}>Close</Button>,
          <Button key="upgrade" type="primary"
            style={{ background: 'linear-gradient(135deg,#f7971e,#ffd200)', border: 'none' }}
            onClick={() => { setConflicts(null); setUpgradeModal(true); }}>
            Choose a Different Plan
          </Button>,
        ]}>
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8 }}
          message="Usage exceeds the selected plan's limits"
          description={`Before switching to the ${conflicts?.planName} plan, you need to reduce your usage to fit within its limits.`}
        />
        <List
          dataSource={conflicts?.items || []}
          renderItem={item => {
            const RESOURCE_LABEL = { users: 'Users', warehouses: 'Warehouses', items: 'Items' };
            const RESOURCE_PATH  = { users: '/users', warehouses: '/warehouses', items: '/items' };
            const RESOURCE_ICON  = { users: <TeamOutlined />, warehouses: <ShopOutlined />, items: <DatabaseOutlined /> };
            return (
              <List.Item
                actions={[
                  <Button size="small" type="link"
                    onClick={() => { setConflicts(null); navigate(RESOURCE_PATH[item.resource]); }}>
                    Go to {RESOURCE_LABEL[item.resource]}
                  </Button>
                ]}>
                <List.Item.Meta
                  avatar={<span style={{ fontSize: 20, color: '#fa8c16' }}>{RESOURCE_ICON[item.resource]}</span>}
                  title={
                    <span>
                      {RESOURCE_LABEL[item.resource]}:
                      <Tag color="red" style={{ marginLeft: 8 }}>Current: {item.current}</Tag>
                      <Tag color="green">Allowed: {item.allowed}</Tag>
                    </span>
                  }
                  description={`Reduce ${RESOURCE_LABEL[item.resource].toLowerCase()} from ${item.current} to ${item.allowed} or fewer.`}
                />
              </List.Item>
            );
          }}
        />
      </Modal>
    </div>
  );
}
