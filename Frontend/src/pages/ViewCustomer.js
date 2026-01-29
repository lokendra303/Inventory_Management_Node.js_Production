import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Descriptions,
  Tag,
  Button,
  Space,
  Divider,
  Spin,
  message
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  GlobalOutlined,
  BankOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import apiService from '../services/apiService';

const ViewCustomer = () => {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
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

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <Space>
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
        </Space>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card title="Customer Information" style={{ marginBottom: '24px' }}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Display Name" span={2}>
                <strong>{customer.display_name}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Customer Code">
                {customer.customer_code || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={customer.status === 'active' ? 'green' : 'red'}>
                  {customer.status?.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Company Name" span={2}>
                {customer.company_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Contact Person">
                {[customer.salutation, customer.first_name, customer.last_name]
                  .filter(Boolean).join(' ') || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Credit Limit">
                {customer.credit_limit ? `₹${parseFloat(customer.credit_limit).toLocaleString()}` : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="Contact Information" style={{ marginBottom: '24px' }}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label={<><MailOutlined /> Email</>}>
                {customer.email || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={<><PhoneOutlined /> Work Phone</>}>
                {customer.work_phone || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={<><PhoneOutlined /> Mobile</>}>
                {customer.mobile_phone || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={<><GlobalOutlined /> Website</>}>
                {customer.website_url ? (
                  <a href={customer.website_url} target="_blank" rel="noopener noreferrer">
                    {customer.website_url}
                  </a>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Department">
                {customer.department || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Designation">
                {customer.designation || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="Business Information" style={{ marginBottom: '24px' }}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="PAN">
                {customer.pan || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="GSTIN">
                {customer.gstin || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="MSME Registered">
                <Tag color={customer.msme_registered ? 'green' : 'default'}>
                  {customer.msme_registered ? 'Yes' : 'No'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Currency">
                {customer.currency || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Payment Terms">
                {customer.payment_terms || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="TDS">
                {customer.tds || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Row gutter={[24, 24]}>
            <Col xs={24} md={12}>
              <Card title="Billing Address" size="small">
                <div>
                  {customer.billing_attention && <div><strong>{customer.billing_attention}</strong></div>}
                  {customer.billing_address1 && <div>{customer.billing_address1}</div>}
                  {customer.billing_address2 && <div>{customer.billing_address2}</div>}
                  {customer.billing_city && customer.billing_state && (
                    <div>{customer.billing_city}, {customer.billing_state}</div>
                  )}
                  {customer.billing_pin_code && <div>{customer.billing_pin_code}</div>}
                  {customer.billing_country && <div>{customer.billing_country}</div>}
                  {!customer.billing_address1 && <div style={{ color: '#999' }}>No billing address</div>}
                </div>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title="Shipping Address" size="small">
                <div>
                  {customer.shipping_attention && <div><strong>{customer.shipping_attention}</strong></div>}
                  {customer.shipping_address1 && <div>{customer.shipping_address1}</div>}
                  {customer.shipping_address2 && <div>{customer.shipping_address2}</div>}
                  {customer.shipping_city && customer.shipping_state && (
                    <div>{customer.shipping_city}, {customer.shipping_state}</div>
                  )}
                  {customer.shipping_pin_code && <div>{customer.shipping_pin_code}</div>}
                  {customer.shipping_country && <div>{customer.shipping_country}</div>}
                  {!customer.shipping_address1 && <div style={{ color: '#999' }}>No shipping address</div>}
                </div>
              </Card>
            </Col>
          </Row>

          {customer.remarks && (
            <Card title="Remarks" style={{ marginTop: '24px' }}>
              <p>{customer.remarks}</p>
            </Card>
          )}
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Quick Stats" style={{ marginBottom: '24px' }}>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <UserOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
              <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
                {customer.display_name}
              </div>
              <Tag color={customer.status === 'active' ? 'green' : 'red'} style={{ fontSize: '12px' }}>
                {customer.status?.toUpperCase()}
              </Tag>
            </div>
            <Divider />
            <div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: '#666' }}>Customer since:</span>
                <div>{new Date(customer.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: '#666' }}>Last updated:</span>
                <div>{new Date(customer.updated_at).toLocaleDateString()}</div>
              </div>
            </div>
          </Card>

          <Card title="Actions" size="small">
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
                onClick={() => message.info('Performance metrics coming soon')}
              >
                View Performance
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ViewCustomer;