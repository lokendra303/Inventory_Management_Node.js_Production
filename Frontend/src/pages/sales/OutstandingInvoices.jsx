import React, { useState, useEffect } from 'react';
import { Card, Typography, Table, Tag, Progress, Spin, message, Row, Col, Statistic } from 'antd';
import { ClockCircleOutlined, ExclamationCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';

const { Title, Text } = Typography;

const BUCKET_CONFIG = {
  current:        { label: 'Current',        color: '#52c41a', tagColor: 'green',  progressStatus: 'active'    },
  overdue_1_30:   { label: 'Overdue 1–30',   color: '#faad14', tagColor: 'orange', progressStatus: 'normal'    },
  overdue_31_60:  { label: 'Overdue 31–60',  color: '#fa8c16', tagColor: 'warning',progressStatus: 'exception' },
  overdue_61_90:  { label: 'Overdue 61–90',  color: '#f5222d', tagColor: 'red',    progressStatus: 'exception' },
  overdue_90_plus:{ label: 'Overdue 90+',    color: '#820014', tagColor: 'error',  progressStatus: 'exception' },
};

const OutstandingInvoices = () => {
  const [outstandingData, setOutstandingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    fetchOutstandingData();
  }, []);

  const fetchOutstandingData = async () => {
    try {
      setLoading(true);
      const token = user?.token || sessionStorage.getItem('token');
      const response = await fetch('/api/invoices/dashboard/outstanding', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOutstandingData(data.data);
      } else {
        message.error('Failed to fetch outstanding invoices');
      }
    } catch (error) {
      console.error('Error fetching outstanding data:', error);
      message.error('Error loading outstanding invoices');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (type) => (
        <Tag color={type === 'sales' ? 'green' : 'blue'}>
          {type?.toUpperCase() || 'UNKNOWN'}
        </Tag>
      ),
    },
    {
      title: 'Invoice #',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      width: 140,
    },
    {
      title: 'Party Name',
      dataIndex: 'party_name',
      key: 'party_name',
    },
    {
      title: 'Total Amount',
      dataIndex: 'total_amount',
      key: 'total_amount',
      align: 'right',
      width: 130,
      render: (amount) => formatCurrency(amount || 0),
    },
    {
      title: 'Balance Due',
      dataIndex: 'balance_amount',
      key: 'balance_amount',
      align: 'right',
      width: 130,
      render: (amount) => (
        <Text strong style={{ color: '#f5222d' }}>
          {formatCurrency(amount || 0)}
        </Text>
      ),
    },
    {
      title: 'Due Date',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 110,
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: 'Aging',
      dataIndex: 'aging_bucket',
      key: 'aging_bucket',
      width: 140,
      render: (bucket) => {
        const config = BUCKET_CONFIG[bucket];
        if (!config) return '-';
        return <Tag color={config.tagColor}>{config.label}</Tag>;
      },
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  const agingSummary = outstandingData?.aging_summary || [];
  const totalOutstanding = outstandingData?.total_outstanding || 0;
  const totalCount = outstandingData?.total_count || 0;

  const allInvoices = outstandingData ? [
    ...(outstandingData.aging_detail?.current || []),
    ...(outstandingData.aging_detail?.overdue_1_30 || []),
    ...(outstandingData.aging_detail?.overdue_31_60 || []),
    ...(outstandingData.aging_detail?.overdue_61_90 || []),
    ...(outstandingData.aging_detail?.overdue_90_plus || []),
  ] : [];

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}><ClockCircleOutlined style={{ marginRight: 8 }} />Outstanding Invoices</Title>
        <div style={{ textAlign: 'right' }}>
          <Text type="secondary">{totalCount} invoice{totalCount !== 1 ? 's' : ''} outstanding</Text><br />
          <Text strong style={{ fontSize: 16, color: '#f5222d' }}>{formatCurrency(totalOutstanding)}</Text>
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        {agingSummary.map((bucket) => {
          const config = BUCKET_CONFIG[bucket.bucket] || {};
          const percentage = totalOutstanding > 0
            ? Math.round((bucket.total_amount / totalOutstanding) * 100)
            : 0;

          return (
            <Col xs={24} sm={12} lg={8} xl={4} key={bucket.bucket}>
              <Card
                size="small"
                style={{ borderTop: `3px solid ${config.color}`, height: '100%' }}
              >
                <div style={{ marginBottom: 8 }}>
                  <Text strong style={{ fontSize: 13, color: config.color }}>
                    {config.label || bucket.bucket}
                  </Text>
                </div>
                <Statistic
                  value={formatCurrency(bucket.total_amount || 0)}
                  valueStyle={{ fontSize: 16, fontWeight: 600, color: bucket.bucket === 'current' ? '#52c41a' : '#f5222d' }}
                  formatter={(val) => val}
                />
                <Progress
                  percent={percentage}
                  size="small"
                  status={config.progressStatus}
                  style={{ margin: '8px 0 4px' }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {bucket.count} invoice{bucket.count !== 1 ? 's' : ''} · {percentage}%
                </Text>
              </Card>
            </Col>
          );
        })}
      </Row>

      <Card
        title={
          <span>
            <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
            Invoice Details
          </span>
        }
      >
        <Table columns={columns} dataSource={allInvoices}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${total} invoices`, size: 'small' }}
          rowKey={(record, index) => `${record.invoice_number}-${index}`}
          size="small" scroll={{ x: 'max-content' }}
          locale={{ emptyText: (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <CheckCircleOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 8 }} />
              <br />
              <Text type="secondary">No outstanding invoices</Text>
            </div>
          )}}
        />
      </Card>
    </div>
  );
};

export default OutstandingInvoices;
