import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Button,
  Input,
  Tag,
  Dropdown,
  message,
  Row,
  Col,
  Tooltip,
  Avatar,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  MoreOutlined,
  EditOutlined,
  UserOutlined,
  CheckCircleOutlined,
  StopOutlined,
  TeamOutlined,
  MailOutlined,
  PhoneOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiService from '../../../services/apiService';
import InvoiceListStatCards from '../../../components/business/InvoiceListStatCards';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/customers', { params: { status: 'all' } });

      if (response.success) {
        setCustomers(response.data || []);
      } else {
        message.error('Failed to load customers');
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      message.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = useMemo(
    () =>
      customers.filter(
        (customer) =>
          !searchText ||
          customer.display_name?.toLowerCase().includes(searchText.toLowerCase()) ||
          customer.company_name?.toLowerCase().includes(searchText.toLowerCase()) ||
          customer.email?.toLowerCase().includes(searchText.toLowerCase()) ||
          customer.customer_code?.toLowerCase().includes(searchText.toLowerCase())
      ),
    [customers, searchText]
  );

  const stats = useMemo(
    () => ({
      total: customers.length,
      active: customers.filter((c) => c.status === 'active').length,
      inactive: customers.filter((c) => c.status === 'inactive').length,
    }),
    [customers]
  );

  const handleStatusToggle = async (customerId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const response = await apiService.put(`/customers/${customerId}`, { status: newStatus });

      if (response.success) {
        message.success(`Customer ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
        fetchCustomers();
      } else {
        message.error('Failed to update customer status');
      }
    } catch (error) {
      console.error('Error updating customer status:', error);
      message.error('Failed to update customer status');
    }
  };

  const getActionItems = (record) => [
    {
      key: 'edit',
      label: 'Edit Customer',
      icon: <EditOutlined />,
      onClick: () => navigate(`/sales/customers/${record.id}/edit`),
    },
    {
      key: 'status',
      label: record.status === 'active' ? 'Deactivate' : 'Activate',
      icon: record.status === 'active' ? <StopOutlined /> : <CheckCircleOutlined />,
      onClick: () => handleStatusToggle(record.id, record.status),
    },
  ];

  const statCards = useMemo(() => {
    const cards = [
      {
        label: 'Total Customers',
        value: stats.total,
        sub: 'In directory',
        subValue: `${stats.active} active`,
        gradient: 'linear-gradient(135deg,#667eea,#764ba2)',
        shadow: 'rgba(102,126,234,0.35)',
        icon: <TeamOutlined style={{ fontSize: 22, color: '#fff' }} />,
      },
      {
        label: 'Active',
        value: stats.active,
        sub: 'Ready to trade',
        subValue: stats.total ? `${Math.round((stats.active / stats.total) * 100)}%` : '0%',
        gradient: 'linear-gradient(135deg,#11998e,#38ef7d)',
        shadow: 'rgba(17,153,142,0.35)',
        icon: <CheckCircleOutlined style={{ fontSize: 22, color: '#fff' }} />,
      },
      {
        label: 'Inactive',
        value: stats.inactive,
        sub: 'Deactivated',
        subValue: stats.inactive ? 'Review needed' : 'None',
        gradient: 'linear-gradient(135deg,#f093fb,#f5576c)',
        shadow: 'rgba(245,87,108,0.35)',
        icon: <StopOutlined style={{ fontSize: 22, color: '#fff' }} />,
      },
    ];
    if (searchText) {
      cards.push({
        label: 'Matching search',
        value: filteredCustomers.length,
        sub: 'Shown below',
        subValue: `"${searchText.length > 18 ? `${searchText.slice(0, 18)}…` : searchText}"`,
        gradient: 'linear-gradient(135deg,#4facfe,#00f2fe)',
        shadow: 'rgba(79,172,254,0.35)',
        icon: <SearchOutlined style={{ fontSize: 22, color: '#fff' }} />,
      });
    }
    return cards;
  }, [stats, searchText, filteredCustomers.length]);

  const columns = [
    {
      title: 'Customer',
      dataIndex: 'display_name',
      key: 'display_name',
      render: (text, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar
            size={40}
            style={{
              background: 'linear-gradient(135deg,#667eea,#764ba2)',
              flexShrink: 0,
              fontWeight: 700,
            }}
          >
            {(text || '?').charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: '#1a1a2e', lineHeight: 1.3 }}>{text}</div>
            {record.company_name && (
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{record.company_name}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (_, record) => (
        <div style={{ fontSize: 13 }}>
          {record.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#444' }}>
              <MailOutlined style={{ color: '#667eea', fontSize: 12 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.email}</span>
            </div>
          )}
          {(record.work_phone || record.mobile_phone) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: '#888',
                marginTop: 4,
                fontSize: 12,
              }}
            >
              <PhoneOutlined style={{ color: '#11998e', fontSize: 12 }} />
              {record.mobile_phone || record.work_phone}
            </div>
          )}
          {!record.email && !record.work_phone && !record.mobile_phone && (
            <span style={{ color: '#bbb' }}>—</span>
          )}
        </div>
      ),
    },
    {
      title: 'Code',
      dataIndex: 'customer_code',
      key: 'customer_code',
      width: 150,
      render: (code) =>
        code ? (
          <Tag style={{ borderRadius: 6, fontFamily: 'monospace', margin: 0 }}>{code}</Tag>
        ) : (
          '—'
        ),
    },
    {
      title: 'Credit limit',
      dataIndex: 'credit_limit',
      key: 'credit_limit',
      width: 120,
      align: 'right',
      render: (value) => (
        <span style={{ fontWeight: 600, color: Number(value) > 0 ? '#1a1a2e' : '#aaa' }}>
          {value ? `₹${parseFloat(value).toLocaleString('en-IN')}` : '₹0'}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag
          color={status === 'active' ? 'success' : 'error'}
          style={{ borderRadius: 20, fontWeight: 600, margin: 0 }}
        >
          {status === 'active' ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 52,
      render: (_, record) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Dropdown
            menu={{
              items: getActionItems(record),
              onClick: ({ key }) => {
                const item = getActionItems(record).find((i) => i.key === key);
                if (item?.onClick) item.onClick();
              },
            }}
            trigger={['click']}
          >
            <Tooltip title="Actions">
              <Button
                type="text"
                icon={<MoreOutlined />}
                onClick={(e) => e.stopPropagation()}
                style={{ color: '#667eea' }}
              />
            </Tooltip>
          </Dropdown>
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px 16px 32px', background: '#f5f6fa', minHeight: '100vh' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 'clamp(18px,4vw,26px)',
              fontWeight: 700,
              margin: 0,
              color: '#1a1a2e',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <UserOutlined style={{ fontSize: 22, color: '#667eea' }} />
            Customers
          </h1>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>
            Manage buyers — click a row to open profile and transaction history
          </p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          onClick={() => navigate('/sales/customers/new')}
          style={{ borderRadius: 10, height: 42, fontWeight: 600 }}
        >
          New Customer
        </Button>
      </div>

      <InvoiceListStatCards cards={statCards} />

      <div
        style={{
          borderRadius: 16,
          background: '#fff',
          boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <Input
            placeholder="Search name, company, email, or code..."
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 280, borderRadius: 8 }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchCustomers}
            loading={loading}
            style={{ borderRadius: 8 }}
          >
            Refresh
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={filteredCustomers}
          rowKey="id"
          loading={loading}
          size="middle"
          onRow={(record) => ({
            onClick: () => navigate(`/sales/customers/${record.id}`),
            style: { cursor: 'pointer' },
          })}
          rowClassName={(_, index) => (index % 2 === 0 ? 'table-row-light' : '')}
          pagination={{
            total: filteredCustomers.length,
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} customers`,
            size: 'small',
          }}
          scroll={{ x: 'max-content' }}
        />
      </div>
    </div>
  );
};

export default Customers;
