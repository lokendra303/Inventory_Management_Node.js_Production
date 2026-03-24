import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Progress, Spin, message, Row, Col } from 'antd';
import { ClockCircleOutlined, ExclamationCircleOutlined, CheckCircleOutlined, DollarOutlined } from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';

const BUCKET_CONFIG = {
  current:         { label: 'Current',       gradient: 'linear-gradient(135deg,#11998e,#38ef7d)', shadow: 'rgba(17,153,142,0.35)',  tagColor: 'success', from: '#11998e', to: '#38ef7d' },
  overdue_1_30:    { label: 'Overdue 1–30',  gradient: 'linear-gradient(135deg,#f7971e,#ffd200)', shadow: 'rgba(247,151,30,0.35)',  tagColor: 'warning', from: '#f7971e', to: '#ffd200' },
  overdue_31_60:   { label: 'Overdue 31–60', gradient: 'linear-gradient(135deg,#fa8c16,#ff4d4f)', shadow: 'rgba(250,140,22,0.35)',  tagColor: 'orange',  from: '#fa8c16', to: '#ff4d4f' },
  overdue_61_90:   { label: 'Overdue 61–90', gradient: 'linear-gradient(135deg,#f5222d,#820014)', shadow: 'rgba(245,34,45,0.35)',   tagColor: 'error',   from: '#f5222d', to: '#820014' },
  overdue_90_plus: { label: 'Overdue 90+',   gradient: 'linear-gradient(135deg,#820014,#3d0007)', shadow: 'rgba(130,0,20,0.35)',    tagColor: 'error',   from: '#820014', to: '#3d0007' },
};

const OutstandingInvoices = () => {
  const [outstandingData, setOutstandingData] = useState(null);
  const [loading, setLoading]                 = useState(true);
  const { user }                              = useAuth();
  const { formatCurrency }                    = useCurrency();

  useEffect(() => { fetchOutstandingData(); }, []);

  const fetchOutstandingData = async () => {
    try {
      setLoading(true);
      const token = user?.token || sessionStorage.getItem('token');
      const response = await fetch('/api/invoices/dashboard/outstanding', {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        setOutstandingData(data.data);
      } else {
        message.error('Failed to fetch outstanding invoices');
      }
    } catch (e) {
      console.error(e);
      message.error('Error loading outstanding invoices');
    } finally { setLoading(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <Spin size="large" />
    </div>
  );

  const agingSummary   = outstandingData?.aging_summary   || [];
  const totalOutstanding = outstandingData?.total_outstanding || 0;
  const totalCount     = outstandingData?.total_count     || 0;

  const allInvoices = outstandingData ? [
    ...(outstandingData.aging_detail?.current         || []),
    ...(outstandingData.aging_detail?.overdue_1_30    || []),
    ...(outstandingData.aging_detail?.overdue_31_60   || []),
    ...(outstandingData.aging_detail?.overdue_61_90   || []),
    ...(outstandingData.aging_detail?.overdue_90_plus || []),
  ] : [];

  const columns = [
    { title: 'Type', dataIndex: 'type', key: 'type', width: 90,
      render: t => <Tag color={t === 'sales' ? 'green' : 'blue'} style={{ fontWeight: 600 }}>{t?.toUpperCase()}</Tag>
    },
    { title: 'Invoice #', dataIndex: 'invoice_number', key: 'invoice_number', width: 140,
      render: v => <span style={{ fontWeight: 600, color: '#667eea' }}>{v}</span>
    },
    { title: 'Party',        dataIndex: 'party_name',     key: 'party_name',     ellipsis: true },
    { title: 'Total Amount', dataIndex: 'total_amount',   key: 'total_amount',   align: 'right', width: 130,
      render: v => <span style={{ fontWeight: 500 }}>{formatCurrency(v || 0)}</span>
    },
    { title: 'Balance Due',  dataIndex: 'balance_amount', key: 'balance_amount', align: 'right', width: 130,
      render: v => <span style={{ fontWeight: 700, color: '#f5222d' }}>{formatCurrency(v || 0)}</span>
    },
    { title: 'Due Date', dataIndex: 'due_date', key: 'due_date', width: 110,
      render: d => d ? new Date(d).toLocaleDateString() : '-'
    },
    { title: 'Aging', dataIndex: 'aging_bucket', key: 'aging_bucket', width: 140,
      render: bucket => {
        const c = BUCKET_CONFIG[bucket];
        return c ? <Tag color={c.tagColor} style={{ fontWeight: 600 }}>{c.label}</Tag> : '-';
      }
    },
  ];

  return (
    <div style={{ padding: '16px 16px 32px', background: '#f5f6fa', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(18px,4vw,26px)', fontWeight: 700, margin: 0, color: '#1a1a2e' }}>
            ⏰ Outstanding Invoices
          </h1>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>Track overdue and pending invoice payments</p>
        </div>
        <div style={{
          background: 'linear-gradient(135deg,#f5222d,#820014)',
          borderRadius: 14, padding: '12px 20px', textAlign: 'right',
          boxShadow: '0 4px 16px rgba(245,34,45,0.3)',
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{formatCurrency(totalOutstanding)}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{totalCount} invoice{totalCount !== 1 ? 's' : ''} outstanding</div>
        </div>
      </div>

      {/* Aging Bucket Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {agingSummary.map(bucket => {
          const config = BUCKET_CONFIG[bucket.bucket] || {};
          const percentage = totalOutstanding > 0 ? Math.round((bucket.total_amount / totalOutstanding) * 100) : 0;
          return (
            <Col xs={24} sm={12} lg={8} xl={24 / Math.max(agingSummary.length, 1)} key={bucket.bucket}>
              <div style={{
                background: config.gradient || '#667eea',
                borderRadius: 16, padding: '18px 16px',
                boxShadow: `0 4px 20px ${config.shadow || 'rgba(0,0,0,0.15)'}`,
                transition: 'transform 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {config.label || bucket.bucket}
                </div>
                <div style={{ fontSize: 'clamp(14px,2.5vw,20px)', fontWeight: 800, color: '#fff', marginBottom: 10 }}>
                  {formatCurrency(bucket.total_amount || 0)}
                </div>
                <Progress
                  percent={percentage}
                  strokeColor="rgba(255,255,255,0.9)"
                  trailColor="rgba(255,255,255,0.2)"
                  showInfo={false}
                  strokeWidth={6}
                />
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>
                  {bucket.count} invoice{bucket.count !== 1 ? 's' : ''} · {percentage}%
                </div>
              </div>
            </Col>
          );
        })}
      </Row>

      {/* Invoice Table */}
      <Card
        title={<span style={{ fontWeight: 600 }}><ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />Invoice Details</span>}
        extra={<Tag color="red" style={{ fontWeight: 600 }}>{allInvoices.length} records</Tag>}
        style={{ borderRadius: 16, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
        bodyStyle={{ padding: '0 0 8px' }}
      >
        <Table
          columns={columns}
          dataSource={allInvoices}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `${t} invoices`, size: 'small' }}
          rowKey={(r, i) => `${r.invoice_number}-${i}`}
          size="small"
          scroll={{ x: 'max-content' }}
          rowClassName={(_, i) => i % 2 === 0 ? 'table-row-light' : ''}
          locale={{
            emptyText: (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <CheckCircleOutlined style={{ fontSize: 40, color: '#52c41a', marginBottom: 12 }} />
                <div style={{ color: '#888', fontSize: 14 }}>No outstanding invoices 🎉</div>
              </div>
            )
          }}
        />
      </Card>
    </div>
  );
};

export default OutstandingInvoices;
