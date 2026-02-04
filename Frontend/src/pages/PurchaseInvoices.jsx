import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Table, Space, Tag, Spin, message } from 'antd';
import { ShoppingCartOutlined, PlusOutlined } from '@ant-design/icons';
import apiService from '../services/apiService';

const { Title } = Typography;

const PurchaseInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  useEffect(() => {
    fetchInvoices();
  }, [pagination.current, pagination.pageSize]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/purchase-invoices', {
        params: {
          page: pagination.current,
          limit: pagination.pageSize
        }
      });
      
      if (response.success) {
        setInvoices(response.data?.invoices || []);
        setPagination(prev => ({
          ...prev,
          total: response.data?.pagination?.total || 0
        }));
      } else {
        message.error(response.error || 'Failed to fetch purchase invoices');
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      message.error('Error loading invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (paginationInfo) => {
    setPagination({
      current: paginationInfo.current,
      pageSize: paginationInfo.pageSize,
      total: paginationInfo.total
    });
  };

  const columns = [
    {
      title: 'Invoice Number',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
    },
    {
      title: 'Vendor',
      dataIndex: 'vendor_name',
      key: 'vendor_name',
    },
    {
      title: 'Invoice Date',
      dataIndex: 'invoice_date',
      key: 'invoice_date',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Due Date',
      dataIndex: 'due_date',
      key: 'due_date',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: 'Amount',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (amount) => `$${parseFloat(amount || 0).toFixed(2)}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          draft: 'orange',
          posted: 'blue',
          partially_paid: 'purple',
          paid: 'green',
          cancelled: 'red'
        };
        return (
          <Tag color={colors[status] || 'default'}>
            {status?.toUpperCase() || 'UNKNOWN'}
          </Tag>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2}>
          <ShoppingCartOutlined /> Purchase Invoices
        </Title>
        <Button type="primary" icon={<PlusOutlined />}>
          Create Invoice
        </Button>
      </div>

      <Card>
        <Table 
          columns={columns} 
          dataSource={invoices}
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
          }}
          onChange={handleTableChange}
          rowKey="id"
        />
      </Card>
    </div>
  );
};

export default PurchaseInvoices;