import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Space, message, Card, Row, Col, Statistic, DatePicker } from 'antd';
import { DollarOutlined, BankOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatAmount } from '../../utils/numberFormat';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

export default function PurchasesPaymentMade() {
  const { currency } = useCurrency();
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { paymentType: 'purchase', limit: 100 }; // Only purchase payments
      if (dateRange) {
        params.dateFrom = dateRange[0].format('YYYY-MM-DD');
        params.dateTo = dateRange[1].format('YYYY-MM-DD');
      }
      
      const response = await apiService.get('/accounting/payments', { params });
      if (response.success) {
        setPayments(response.data.payments || []);
        setSummary(response.data.summary || {});
      } else {
        message.error('Failed to load payments');
      }
    } catch (error) {
      console.error('Error loading payments:', error);
      message.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    load();
  }, [load]);

  const METHOD_COLORS = { bank_transfer: 'blue', cash: 'green', cheque: 'orange', online: 'purple' };

  const columns = [
    { title: 'Bill #', dataIndex: 'invoice_number', key: 'invoice_number', width: 150 },
    { title: 'Vendor', dataIndex: 'party_name', key: 'party_name' },
    { title: 'Payment Date', dataIndex: 'payment_date', key: 'payment_date', width: 130,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '-' },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 130, align: 'right',
      render: v => (
        <span style={{ fontWeight: 'bold', color: '#52c41a' }}>
          {currency} {formatAmount(v)}
        </span>
      ) },
    { title: 'Method', dataIndex: 'payment_method', key: 'payment_method', width: 130,
      render: v => <Tag color={METHOD_COLORS[v] || 'default'}>{v?.replace('_', ' ').toUpperCase()}</Tag> },
    { 
      title: 'Made By', 
      key: 'made_by', 
      width: 150,
      render: (_, record) => {
        if (record.first_name || record.last_name) {
          return (
            <div>
              <div style={{ fontWeight: 500 }}>
                {record.first_name} {record.last_name}
              </div>
              {record.user_email && (
                <div style={{ fontSize: 11, color: '#666' }}>
                  {record.user_email}
                </div>
              )}
            </div>
          );
        }
        return <span style={{ color: '#999' }}>Unknown User</span>;
      }
    },
    { title: 'Reference', dataIndex: 'reference', key: 'reference',
      render: v => v || '-' },
    { title: 'Notes', dataIndex: 'notes', key: 'notes',
      render: v => v || '-' }
  ];

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 24, fontSize: '20px', fontWeight: 600 }}>Payments Made to Vendors</h2>
      
      <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#f0f2ff', borderRadius: '6px', border: '1px solid #d6e4ff' }}>
        <span style={{ color: '#1890ff', fontWeight: 500 }}>📋 Purchase Payments Only</span>
        <span style={{ color: '#666', marginLeft: 8 }}>This page shows only payments made to vendors for purchase bills.</span>
      </div>
      
      {/* Summary Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Payments Made"
              value={summary.totalPurchasePayments || 0}
              prefix={<DollarOutlined />}
              formatter={value => `${currency} ${formatAmount(value)}`}
              valueStyle={{ color: '#ff4d4f' }}
            />
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Money paid to vendors
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Number of Payments"
              value={summary.purchasePaymentCount || 0}
              prefix={<BankOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Total payment transactions
            </div>
          </Card>
        </Col>
      </Row>

      {/* Date Filter */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <RangePicker 
            value={dateRange} 
            onChange={setDateRange}
            placeholder={['From Date', 'To Date']}
            allowClear
          />
          <span style={{ color: '#666' }}>Filter payments by date range</span>
        </Space>
      </Card>

      {/* Payments Table */}
      <Card>
        <Table 
          columns={columns} 
          dataSource={payments} 
          rowKey="id"
          loading={loading} 
          size="small" 
          pagination={{ 
            pageSize: 20, 
            size: 'small',
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} payments`
          }}
          scroll={{ x: 'max-content' }} 
        />
      </Card>
    </div>
  );
}
