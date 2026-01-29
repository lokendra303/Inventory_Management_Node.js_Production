import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Dropdown,
  message,
  Card,
  Row,
  Col,
  Statistic
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  MoreOutlined,
  EyeOutlined,
  EditOutlined,
  UserOutlined,
  CheckCircleOutlined,
  StopOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/apiService';
import { useAuth } from '../hooks/useAuth';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const navigate = useNavigate();
  const { token } = useAuth();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/customers');
      
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

  const handleSearch = (value) => {
    setSearchText(value);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.display_name?.toLowerCase().includes(searchText.toLowerCase()) ||
    customer.company_name?.toLowerCase().includes(searchText.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleStatusToggle = async (customerId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const response = await apiService.put(`/customers/${customerId}`, { status: newStatus });
      
      if (response.success) {
        message.success(`Customer ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
        fetchCustomers(); // Refresh the list
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
      key: 'view',
      label: 'View Details',
      icon: <EyeOutlined />,
      onClick: () => navigate(`/sales/customers/${record.id}`)
    },
    {
      key: 'edit',
      label: 'Edit Customer',
      icon: <EditOutlined />,
      onClick: () => navigate(`/sales/customers/${record.id}/edit`)
    },
    {
      key: 'status',
      label: record.status === 'active' ? 'Deactivate' : 'Activate',
      icon: record.status === 'active' ? <StopOutlined /> : <CheckCircleOutlined />,
      onClick: () => handleStatusToggle(record.id, record.status)
    }
  ];

  const columns = [
    {
      title: 'Customer Name',
      dataIndex: 'display_name',
      key: 'display_name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          {record.company_name && (
            <div style={{ fontSize: '12px', color: '#666' }}>{record.company_name}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (_, record) => (
        <div>
          {record.email && <div>{record.email}</div>}
          {record.work_phone && (
            <div style={{ fontSize: '12px', color: '#666' }}>{record.work_phone}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Customer Code',
      dataIndex: 'customer_code',
      key: 'customer_code',
    },
    {
      title: 'Credit Limit',
      dataIndex: 'credit_limit',
      key: 'credit_limit',
      render: (value) => value ? `₹${parseFloat(value).toLocaleString()}` : '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status?.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Dropdown
          menu={{
            items: getActionItems(record),
            onClick: ({ key }) => {
              const item = getActionItems(record).find(item => item.key === key);
              if (item?.onClick) item.onClick();
            }
          }}
          trigger={['click']}
        >
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  const stats = {
    total: customers.length,
    active: customers.filter(c => c.status === 'active').length,
    inactive: customers.filter(c => c.status === 'inactive').length
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>Customers</h1>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => navigate('/sales/customers/new')}
          >
            New Customer
          </Button>
        </div>

        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={8} md={6}>
            <Card>
              <Statistic
                title="Total Customers"
                value={stats.total}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Card>
              <Statistic
                title="Active"
                value={stats.active}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Card>
              <Statistic
                title="Inactive"
                value={stats.inactive}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
        </Row>

        <Space style={{ marginBottom: '16px' }}>
          <Input.Search
            placeholder="Search customers..."
            allowClear
            enterButton={<SearchOutlined />}
            size="middle"
            onSearch={handleSearch}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ width: 300 }}
          />
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredCustomers}
          rowKey="id"
          loading={loading}
          pagination={{
            total: filteredCustomers.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} customers`,
          }}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
};

export default Customers;