import React, { useState, useEffect } from 'react';
import { Card, Typography, Table, Tag, Progress, Spin, message, Row, Col } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth.jsx';

const { Title } = Typography;

const OutstandingInvoices = () => {
  const [outstandingData, setOutstandingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchOutstandingData();
  }, []);

  const fetchOutstandingData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/invoices/dashboard/outstanding', {
        headers: {
          'Authorization': `Bearer ${user.token}`,
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
      render: (type) => (
        <Tag color={type === 'sales' ? 'green' : 'blue'}>
          {type?.toUpperCase() || 'UNKNOWN'}
        </Tag>
      ),
    },
    {
      title: 'Invoice Number',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
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
      render: (amount) => `$${parseFloat(amount || 0).toFixed(2)}`,
    },
    {
      title: 'Balance Amount',
      dataIndex: 'balance_amount',
      key: 'balance_amount',
      render: (amount) => `$${parseFloat(amount || 0).toFixed(2)}`,
    },
    {
      title: 'Due Date',
      dataIndex: 'due_date',
      key: 'due_date',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: 'Days Overdue',
      dataIndex: 'days_overdue',
      key: 'days_overdue',
      render: (days) => {
        const daysNum = parseInt(days || 0);
        return (
          <Tag color={daysNum > 0 ? 'red' : 'green'}>
            {daysNum > 0 ? `${daysNum} days overdue` : `${Math.abs(daysNum)} days remaining`}
          </Tag>
        );
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
  const allInvoices = outstandingData ? [
    ...(outstandingData.aging_detail?.current || []),
    ...(outstandingData.aging_detail?.overdue_1_30 || []),
    ...(outstandingData.aging_detail?.overdue_31_60 || []),
    ...(outstandingData.aging_detail?.overdue_61_90 || []),
    ...(outstandingData.aging_detail?.overdue_90_plus || [])
  ] : [];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <ClockCircleOutlined /> Outstanding Invoices
      </Title>

      <Row gutter={16} style={{ marginBottom: '24px' }}>
        {agingSummary.map((bucket, index) => {
          const percentage = outstandingData.total_outstanding > 0 
            ? (bucket.total_amount / outstandingData.total_outstanding) * 100 
            : 0;
          
          return (
            <Col span={6} key={bucket.bucket}>
              <Card>
                <Title level={4}>
                  {bucket.bucket.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Title>
                <Progress 
                  percent={Math.round(percentage)} 
                  status={bucket.bucket.includes('overdue') ? 'exception' : 'active'} 
                />
                <p>${parseFloat(bucket.total_amount || 0).toFixed(2)}</p>
                <p>{bucket.count} invoices</p>
              </Card>
            </Col>
          );
        })}
      </Row>

      <Card>
        <Table 
          columns={columns} 
          dataSource={allInvoices}
          pagination={{ pageSize: 10 }}
          rowKey={(record, index) => `${record.invoice_number}-${index}`}
        />
      </Card>
    </div>
  );
};

export default OutstandingInvoices;