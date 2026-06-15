import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Tag,
  Button,
  Space,
  Divider,
  Spin,
  message,
  Tabs,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  GlobalOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import apiService from '../../../services/apiService';
import EntityTransactionHistory from '../../../components/entities/EntityTransactionHistory';
import EntityInfoGrid, { formatEntityValue } from '../../../components/entities/EntityInfoGrid';
import EntityAddressCard from '../../../components/entities/EntityAddressCard';
import '../../../components/entities/EntityInfoGrid.css';

const ViewCustomer = () => {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCustomer();
  }, [id]);

  const fetchCustomer = async () => {
    try {
      setLoading(true);
      const response = await apiService.get(`/customers/${id}`);

      if (response.success) {
        setCustomer(response.data);
      } else {
        message.error('Failed to load customer details');
        navigate('/sales/customers');
      }
    } catch (error) {
      console.error('Error fetching customer:', error);
      message.error('Failed to load customer details');
      navigate('/sales/customers');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!customer) {
    return null;
  }

  const isMobile = window.innerWidth <= 768;
  const contactPerson = [customer.salutation, customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`entity-profile-page${isMobile ? ' entity-profile-page--mobile' : ''}`}>
      <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/sales/customers')}
        >
          Back to Customers
        </Button>
        <Button
          type="primary"
          icon={<EditOutlined />}
          onClick={() => navigate(`/sales/customers/${id}/edit`)}
        >
          Edit Customer
        </Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginBottom: 16 }}
        items={[
          { key: 'profile', label: 'Profile' },
          { key: 'transactions', label: 'Transaction History' },
        ]}
      />

      {activeTab === 'transactions' ? (
        <Card style={{ marginBottom: 24 }}>
          <EntityTransactionHistory entityType="customer" entityId={id} />
        </Card>
      ) : (
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Card title="Customer Information" className="entity-profile-card" style={{ marginBottom: 24 }}>
              <EntityInfoGrid
                items={[
                  {
                    key: 'display_name',
                    label: 'Display Name',
                    span: 2,
                    render: () => <strong>{customer.display_name}</strong>,
                  },
                  { key: 'customer_code', label: 'Customer Code', value: customer.customer_code },
                  {
                    key: 'status',
                    label: 'Status',
                    render: () => (
                      <Tag color={customer.status === 'active' ? 'green' : 'red'}>
                        {customer.status?.toUpperCase()}
                      </Tag>
                    ),
                  },
                  { key: 'company_name', label: 'Company Name', span: 2, value: customer.company_name },
                  { key: 'contact_person', label: 'Contact Person', value: contactPerson },
                  {
                    key: 'credit_limit',
                    label: 'Credit Limit',
                    render: () => formatEntityValue(
                      customer.credit_limit
                        ? `₹${parseFloat(customer.credit_limit).toLocaleString()}`
                        : null
                    ),
                  },
                ]}
              />
            </Card>

            <Card title="Contact Information" className="entity-profile-card" style={{ marginBottom: 24 }}>
              <EntityInfoGrid
                items={[
                  {
                    key: 'email',
                    label: 'Email',
                    icon: <MailOutlined />,
                    value: customer.email,
                  },
                  {
                    key: 'work_phone',
                    label: 'Work Phone',
                    icon: <PhoneOutlined />,
                    value: customer.work_phone,
                  },
                  {
                    key: 'mobile_phone',
                    label: 'Mobile',
                    icon: <PhoneOutlined />,
                    value: customer.mobile_phone,
                  },
                  {
                    key: 'website',
                    label: 'Website',
                    icon: <GlobalOutlined />,
                    render: () => (
                      customer.website_url ? (
                        <a href={customer.website_url} target="_blank" rel="noopener noreferrer">
                          {customer.website_url}
                        </a>
                      ) : formatEntityValue(null)
                    ),
                  },
                  { key: 'department', label: 'Department', value: customer.department },
                  { key: 'designation', label: 'Designation', value: customer.designation },
                ]}
              />
            </Card>

            <Card title="Business Information" className="entity-profile-card" style={{ marginBottom: 24 }}>
              <EntityInfoGrid
                items={[
                  { key: 'pan', label: 'PAN', value: customer.pan },
                  { key: 'gstin', label: 'GSTIN', value: customer.gstin },
                  {
                    key: 'msme',
                    label: 'MSME Registered',
                    render: () => (
                      <span style={{ color: customer.msme_registered ? '#16a34a' : '#64748b' }}>
                        {customer.msme_registered ? 'Yes' : 'No'}
                      </span>
                    ),
                  },
                  { key: 'currency', label: 'Currency', value: customer.currency },
                  { key: 'payment_terms', label: 'Payment Terms', value: customer.payment_terms },
                  { key: 'tds', label: 'TDS', value: customer.tds },
                ]}
              />
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <EntityAddressCard title="Billing Address" prefix="billing_" data={customer} />
              </Col>
              <Col xs={24} md={12}>
                <EntityAddressCard title="Shipping Address" prefix="shipping_" data={customer} />
              </Col>
            </Row>

            {customer.remarks && (
              <Card title="Remarks" className="entity-profile-card" style={{ marginTop: 24 }}>
                <p style={{ margin: 0, color: '#334155', lineHeight: 1.6 }}>{customer.remarks}</p>
              </Card>
            )}
          </Col>

          <Col xs={24} lg={8}>
            <Card title="Quick Stats" className="entity-profile-card" style={{ marginBottom: 24 }}>
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <UserOutlined className="entity-profile-sidebar-icon" />
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
                  {customer.display_name}
                </div>
                <Tag color={customer.status === 'active' ? 'green' : 'red'}>
                  {customer.status?.toUpperCase()}
                </Tag>
              </div>
              <Divider style={{ margin: '16px 0' }} />
              <div>
                <div style={{ marginBottom: 12 }}>
                  <div className="entity-profile-meta-label">Customer since</div>
                  <div>{new Date(customer.created_at).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="entity-profile-meta-label">Last updated</div>
                  <div>{new Date(customer.updated_at).toLocaleDateString()}</div>
                </div>
              </div>
            </Card>

            <Card title="Actions" size="small" className="entity-profile-card">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button
                  block
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/sales/customers/${id}/edit`)}
                >
                  Edit Customer
                </Button>
                <Button
                  block
                  icon={<BankOutlined />}
                  onClick={() => setActiveTab('transactions')}
                >
                  Transaction History
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default ViewCustomer;
