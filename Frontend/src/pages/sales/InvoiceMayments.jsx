import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Tabs, message, Row, Col } from 'antd';
import { DollarOutlined, ShoppingCartOutlined, FileTextOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatAmount } from '../../utils/numberFormat';
import dayjs from 'dayjs';

const METHOD_CONFIG = {
  bank_transfer: { color: 'blue',    label: 'Bank Transfer' },
  cash:          { color: 'green',   label: 'Cash' },
  cheque:        { color: 'orange',  label: 'Cheque' },
  online:        { color: 'purple',  label: 'Online' },
};

const SummaryCard = ({ label, value, sub, gradient, shadow, icon }) => (
  <div style={{
    background: gradient, borderRadius: 14, padding: '16px 14px',
    display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: `0 4px 16px ${shadow}`,
    transition: 'transform 0.2s',
  }}
    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
  >
    <div style={{
      background: 'rgba(255,255,255,0.2)', borderRadius: 10,
      width: 44, height: 44, display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: 0,
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 'clamp(14px,2.5vw,18px)', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>{sub}</div>}
    </div>
  </div>
);

export default function InvoicePayments() {
  const { currency, formatCurrency } = useCurrency();
  const [salesPayments, setSalesPayments]       = useState([]);
  const [purchasePayments, setPurchasePayments] = useState([]);
  const [loading, setLoading]                   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, pRes] = await Promise.all([
        apiService.get('/sales-invoices'),
        apiService.get('/purchase-invoices')
      ]);
      const salesInvs    = sRes.data?.invoices    || sRes.data    || [];
      const purchaseInvs = pRes.data?.invoices    || pRes.data    || [];
      const sPmts = [], pPmts = [];

      await Promise.all([
        ...salesInvs.filter(i => parseFloat(i.paid_amount) > 0).map(async inv => {
          try {
            const d = await apiService.get(`/sales-invoices/${inv.id}`);
            (d.data?.payments || []).forEach(p => sPmts.push({
              ...p,
              invoice_number: d.data?.invoice?.invoice_number || inv.invoice_number,
              party_name:     d.data?.invoice?.customer_name  || inv.customer_name,
            }));
          } catch {}
        }),
        ...purchaseInvs.filter(i => parseFloat(i.paid_amount) > 0).map(async inv => {
          try {
            const d = await apiService.get(`/purchase-invoices/${inv.id}`);
            (d.data?.payments || []).forEach(p => pPmts.push({
              ...p,
              invoice_number: d.data?.invoice?.invoice_number || inv.invoice_number,
              party_name:     d.data?.invoice?.vendor_name    || inv.vendor_name,
            }));
          } catch {}
        }),
      ]);

      setSalesPayments(sPmts.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date)));
      setPurchasePayments(pPmts.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date)));
    } catch { message.error('Failed to load payment history'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalSales    = salesPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const totalPurchase = purchasePayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  const columns = [
    { title: 'Invoice #', dataIndex: 'invoice_number', key: 'invoice_number', width: 130, ellipsis: true,
      render: v => <span style={{ fontWeight: 600, color: '#667eea' }}>{v}</span>
    },
    { title: 'Party',  dataIndex: 'party_name',    key: 'party_name',    width: 140, ellipsis: true },
    { title: 'Date',   dataIndex: 'payment_date',  key: 'payment_date',  width: 120,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '-'
    },
    { title: 'Amount', dataIndex: 'amount',         key: 'amount',        width: 130,
      render: v => <span style={{ fontWeight: 700, color: '#11998e' }}>{currency} {formatAmount(v)}</span>
    },
    { title: 'Method', dataIndex: 'payment_method', key: 'payment_method', width: 130,
      render: v => {
        const c = METHOD_CONFIG[v] || {};
        return <Tag color={c.color || 'default'} style={{ fontWeight: 600 }}>{c.label || v?.replace('_',' ').toUpperCase()}</Tag>;
      }
    },
    { title: 'Reference', dataIndex: 'reference', key: 'reference', width: 130, ellipsis: true,
      render: v => v || <span style={{ color: '#bbb' }}>—</span>
    },
  ];

  const tabItems = [
    {
      key: 'sales',
      label: (
        <span style={{ fontWeight: 600 }}>
          💰 Sales Payments
          <Tag color="green" style={{ marginLeft: 8, fontWeight: 700 }}>{salesPayments.length}</Tag>
        </span>
      ),
      children: (
        <Table columns={columns} dataSource={salesPayments} rowKey="id"
          loading={loading} size="small"
          pagination={{ pageSize: 20, size: 'small', showSizeChanger: false }}
          scroll={{ x: 'max-content' }}
          rowClassName={(_, i) => i % 2 === 0 ? 'table-row-light' : ''}
        />
      ),
    },
    {
      key: 'purchase',
      label: (
        <span style={{ fontWeight: 600 }}>
          🛒 Purchase Payments
          <Tag color="blue" style={{ marginLeft: 8, fontWeight: 700 }}>{purchasePayments.length}</Tag>
        </span>
      ),
      children: (
        <Table columns={columns} dataSource={purchasePayments} rowKey="id"
          loading={loading} size="small"
          pagination={{ pageSize: 20, size: 'small', showSizeChanger: false }}
          scroll={{ x: 'max-content' }}
          rowClassName={(_, i) => i % 2 === 0 ? 'table-row-light' : ''}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: '16px 16px 32px', background: '#f5f6fa', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 'clamp(18px,4vw,26px)', fontWeight: 700, margin: 0, color: '#1a1a2e' }}>
          💳 Invoice Payments
        </h1>
        <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>Complete payment history for all invoices</p>
      </div>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <SummaryCard label="Sales Payments" value={salesPayments.length}
            sub={`Total: ${formatCurrency(totalSales)}`}
            gradient="linear-gradient(135deg,#11998e,#38ef7d)" shadow="rgba(17,153,142,0.35)"
            icon={<FileTextOutlined style={{ fontSize: 22, color: '#fff' }} />} />
        </Col>
        <Col xs={12} sm={6}>
          <SummaryCard label="Sales Amount" value={formatCurrency(totalSales)}
            gradient="linear-gradient(135deg,#667eea,#764ba2)" shadow="rgba(102,126,234,0.35)"
            icon={<DollarOutlined style={{ fontSize: 22, color: '#fff' }} />} />
        </Col>
        <Col xs={12} sm={6}>
          <SummaryCard label="Purchase Payments" value={purchasePayments.length}
            sub={`Total: ${formatCurrency(totalPurchase)}`}
            gradient="linear-gradient(135deg,#f7971e,#ffd200)" shadow="rgba(247,151,30,0.35)"
            icon={<ShoppingCartOutlined style={{ fontSize: 22, color: '#fff' }} />} />
        </Col>
        <Col xs={12} sm={6}>
          <SummaryCard label="Purchase Amount" value={formatCurrency(totalPurchase)}
            gradient="linear-gradient(135deg,#f093fb,#f5576c)" shadow="rgba(245,87,108,0.35)"
            icon={<DollarOutlined style={{ fontSize: 22, color: '#fff' }} />} />
        </Col>
      </Row>

      {/* Tabs + Tables */}
      <Card style={{ borderRadius: 16, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
        bodyStyle={{ padding: '0 0 8px' }}>
        <Tabs defaultActiveKey="sales" items={tabItems}
          tabBarStyle={{ padding: '0 20px', marginBottom: 0 }} />
      </Card>
    </div>
  );
}
