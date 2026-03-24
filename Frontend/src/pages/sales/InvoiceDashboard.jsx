import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Spin, Tag } from 'antd';
import {
  DollarOutlined, FileTextOutlined, BarChartOutlined,
  ShoppingCartOutlined, ArrowRightOutlined, ClockCircleOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatPrice } from '../../utils/currency';
import { useNavigate } from 'react-router-dom';

const StatCard = ({ label, value, sub, subValue, gradient, shadow, icon }) => (
  <div style={{
    background: gradient, borderRadius: 16, padding: '16px 14px',
    display: 'flex', alignItems: 'center', gap: 10,
    boxShadow: `0 4px 20px ${shadow}`,
    transition: 'transform 0.2s', cursor: 'default',
    minHeight: 80, overflow: 'hidden',
  }}
    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
  >
    <div style={{
      background: 'rgba(255,255,255,0.2)', borderRadius: 10,
      width: 40, height: 40, display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: 0,
    }}>
      {icon}
    </div>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{
        fontSize: 'clamp(12px,3vw,18px)', fontWeight: 700, color: '#fff',
        lineHeight: 1.2, wordBreak: 'break-word',
      }}>{value}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.82)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}: {subValue}</div>}
    </div>
  </div>
);

const QuickCard = ({ title, desc, icon, gradient, href, navigate }) => (
  <div
    onClick={() => navigate(href)}
    style={{
      background: '#fff', borderRadius: 16, padding: '18px 16px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)', cursor: 'pointer',
      transition: 'all 0.2s', border: '1px solid #f0f0f0',
      display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14,
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.12)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.07)'; }}
  >
    <div style={{
      width: 46, height: 46, borderRadius: 13, flexShrink: 0,
      background: gradient, display: 'flex', alignItems: 'center',
      justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    }}>
      {icon}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e', marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#888', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</div>
    </div>
    <ArrowRightOutlined style={{ fontSize: 12, color: '#667eea', flexShrink: 0 }} />
  </div>
);

const InvoiceDashboard = () => {
  const { currency } = useCurrency();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await apiService.get('/invoices/dashboard/summary');
      if (response.success) setDashboardData(response.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <Spin size="large" />
    </div>
  );

  const p = dashboardData?.purchase || {};
  const s = dashboardData?.sales    || {};

  const statCards = [
    { label: 'Purchase Invoices',    value: p.total_invoices || 0,                       sub: 'Amount',      subValue: formatPrice(p.total_amount || 0, currency),      gradient: 'linear-gradient(135deg,#667eea,#764ba2)', shadow: 'rgba(102,126,234,0.35)', icon: <ShoppingCartOutlined style={{ fontSize: 24, color: '#fff' }} /> },
    { label: 'Purchase Outstanding', value: formatPrice(p.outstanding_amount || 0, currency), sub: null, subValue: null, gradient: 'linear-gradient(135deg,#f093fb,#f5576c)', shadow: 'rgba(245,87,108,0.35)', icon: <ClockCircleOutlined style={{ fontSize: 24, color: '#fff' }} /> },
    { label: 'Sales Invoices',       value: s.total_invoices || 0,                       sub: 'Amount',      subValue: formatPrice(s.total_amount || 0, currency),      gradient: 'linear-gradient(135deg,#11998e,#38ef7d)', shadow: 'rgba(17,153,142,0.35)', icon: <FileTextOutlined style={{ fontSize: 24, color: '#fff' }} /> },
    { label: 'Sales Outstanding',    value: formatPrice(s.outstanding_amount || 0, currency), sub: null, subValue: null, gradient: 'linear-gradient(135deg,#f7971e,#ffd200)', shadow: 'rgba(247,151,30,0.35)', icon: <DollarOutlined style={{ fontSize: 24, color: '#fff' }} /> },
  ];

  const quickCards = [
    { title: 'Purchase Invoices', desc: 'Manage vendor bills and purchase invoice payments', icon: <ShoppingCartOutlined style={{ fontSize: 22, color: '#fff' }} />, gradient: 'linear-gradient(135deg,#667eea,#764ba2)', href: '/invoices/purchase' },
    { title: 'Sales Invoices',    desc: 'Manage customer invoices and sales receipts',       icon: <FileTextOutlined    style={{ fontSize: 22, color: '#fff' }} />, gradient: 'linear-gradient(135deg,#11998e,#38ef7d)', href: '/invoices/sales' },
    { title: 'Outstanding',       desc: 'Track overdue and pending invoice payments',        icon: <BarChartOutlined    style={{ fontSize: 22, color: '#fff' }} />, gradient: 'linear-gradient(135deg,#f7971e,#ffd200)', href: '/invoices/outstanding' },
    { title: 'Payments',          desc: 'View all sales and purchase payment history',       icon: <CheckCircleOutlined style={{ fontSize: 22, color: '#fff' }} />, gradient: 'linear-gradient(135deg,#f093fb,#f5576c)', href: '/invoices/payments' },
  ];

  return (
    <div style={{ padding: '16px 16px 32px', background: '#f5f6fa', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 'clamp(18px,4vw,26px)', fontWeight: 700, margin: 0, color: '#1a1a2e' }}>
          💰 Invoice Dashboard
        </h1>
        <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>Overview of all purchase and sales invoices</p>
      </div>

      {/* Stat Cards */}
      {dashboardData && (
        <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
          {statCards.map(card => (
            <Col xs={24} sm={12} md={6} key={card.label}>
              <StatCard {...card} />
            </Col>
          ))}
        </Row>
      )}

      {/* Quick Access */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e', marginBottom: 14 }}>Quick Access</div>
        <Row gutter={[12, 12]}>
          {quickCards.map(card => (
            <Col xs={24} sm={12} lg={6} key={card.title}>
              <QuickCard {...card} navigate={navigate} />
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
};

export default InvoiceDashboard;
