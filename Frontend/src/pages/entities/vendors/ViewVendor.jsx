import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tabs,
  Button,
  Row,
  Col,
  Tag,
  Divider,
  Spin,
  message,
  Space,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  ShopOutlined,
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

const mapVendor = (vendorData) => ({
  id: vendorData.id,
  displayName: vendorData.display_name || vendorData.displayName,
  companyName: vendorData.company_name || vendorData.companyName,
  vendorCode: vendorData.vendor_code || vendorData.vendorCode,
  status: vendorData.status,
  email: vendorData.email,
  salutation: vendorData.salutation,
  firstName: vendorData.first_name || vendorData.firstName,
  lastName: vendorData.last_name || vendorData.lastName,
  workPhone: vendorData.work_phone || vendorData.workPhone,
  mobilePhone: vendorData.mobile_phone || vendorData.mobilePhone,
  pan: vendorData.pan,
  gstin: vendorData.gstin,
  msmeRegistered: vendorData.msme_registered ?? vendorData.msmeRegistered,
  currency: vendorData.currency,
  paymentTerms: vendorData.payment_terms || vendorData.paymentTerms,
  tds: vendorData.tds,
  websiteUrl: vendorData.website_url || vendorData.websiteUrl,
  department: vendorData.department,
  designation: vendorData.designation,
  billing_attention: vendorData.billing_attention || vendorData.billingAttention,
  billing_country: vendorData.billing_country || vendorData.billingCountry,
  billing_address1: vendorData.billing_address1 || vendorData.billingAddress1,
  billing_address2: vendorData.billing_address2 || vendorData.billingAddress2,
  billing_city: vendorData.billing_city || vendorData.billingCity,
  billing_state: vendorData.billing_state || vendorData.billingState,
  billing_pin_code: vendorData.billing_pin_code || vendorData.billingPinCode,
  shipping_attention: vendorData.shipping_attention || vendorData.shippingAttention,
  shipping_country: vendorData.shipping_country || vendorData.shippingCountry,
  shipping_address1: vendorData.shipping_address1 || vendorData.shippingAddress1,
  shipping_address2: vendorData.shipping_address2 || vendorData.shippingAddress2,
  shipping_city: vendorData.shipping_city || vendorData.shippingCity,
  shipping_state: vendorData.shipping_state || vendorData.shippingState,
  shipping_pin_code: vendorData.shipping_pin_code || vendorData.shippingPinCode,
  bankName: vendorData.bank_name || vendorData.bankName,
  accountHolderName: vendorData.account_holder_name || vendorData.accountHolderName,
  accountNumber: vendorData.account_number || vendorData.accountNumber,
  accountType: vendorData.account_type || vendorData.accountType,
  ifscCode: vendorData.ifsc_code || vendorData.ifscCode,
  branchName: vendorData.branch_name || vendorData.branchName,
  swiftCode: vendorData.swift_code || vendorData.swiftCode,
  iban: vendorData.iban,
  remarks: vendorData.remarks,
  createdAt: vendorData.created_at || vendorData.createdAt,
  updatedAt: vendorData.updated_at || vendorData.updatedAt,
});

const ViewVendor = () => {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');

  const fetchVendor = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.get(`/vendors/${vendorId}`);

      let vendorData = null;
      if (response?.data && typeof response.data === 'object') {
        vendorData = response.data;
      } else if (response && typeof response === 'object') {
        vendorData = response;
      }

      if (vendorData) {
        setVendor(mapVendor(vendorData));
      } else {
        message.error('Invalid vendor data received');
      }
    } catch (error) {
      console.error('Error fetching vendor:', error);
      if (error.response?.status === 404) {
        message.error('Vendor not found');
        setTimeout(() => navigate('/purchases/vendors'), 2000);
      } else {
        message.error('Failed to load vendor details');
      }
    } finally {
      setLoading(false);
    }
  }, [vendorId, navigate]);

  useEffect(() => {
    if (vendorId) {
      fetchVendor();
    }
  }, [vendorId, fetchVendor]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="entity-profile-page">
        <Card>
          <p>Vendor not found</p>
          <Button onClick={() => navigate('/purchases/vendors')}>Back to Vendors</Button>
        </Card>
      </div>
    );
  }

  const isMobile = window.innerWidth <= 768;
  const contactPerson = [vendor.salutation, vendor.firstName, vendor.lastName]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`entity-profile-page${isMobile ? ' entity-profile-page--mobile' : ''}`}>
      <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/purchases/vendors')}
        >
          Back to Vendors
        </Button>
        <Button
          type="primary"
          icon={<EditOutlined />}
          onClick={() => navigate(`/purchases/vendors/${vendorId}/edit`)}
        >
          Edit Vendor
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
          <EntityTransactionHistory entityType="vendor" entityId={vendorId} />
        </Card>
      ) : (
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Card title="Vendor Information" className="entity-profile-card" style={{ marginBottom: 24 }}>
              <EntityInfoGrid
                items={[
                  {
                    key: 'display_name',
                    label: 'Display Name',
                    span: 2,
                    render: () => <strong>{vendor.displayName}</strong>,
                  },
                  { key: 'vendor_code', label: 'Vendor Code', value: vendor.vendorCode },
                  {
                    key: 'status',
                    label: 'Status',
                    render: () => (
                      <Tag color={vendor.status === 'active' ? 'green' : 'red'}>
                        {vendor.status?.toUpperCase()}
                      </Tag>
                    ),
                  },
                  { key: 'company_name', label: 'Company Name', span: 2, value: vendor.companyName },
                  { key: 'contact_person', label: 'Contact Person', value: contactPerson },
                  { key: 'email', label: 'Email', icon: <MailOutlined />, value: vendor.email },
                ]}
              />
            </Card>

            <Card title="Contact Information" className="entity-profile-card" style={{ marginBottom: 24 }}>
              <EntityInfoGrid
                items={[
                  {
                    key: 'work_phone',
                    label: 'Work Phone',
                    icon: <PhoneOutlined />,
                    value: vendor.workPhone,
                  },
                  {
                    key: 'mobile_phone',
                    label: 'Mobile',
                    icon: <PhoneOutlined />,
                    value: vendor.mobilePhone,
                  },
                  {
                    key: 'website',
                    label: 'Website',
                    icon: <GlobalOutlined />,
                    render: () => (
                      vendor.websiteUrl ? (
                        <a href={vendor.websiteUrl} target="_blank" rel="noopener noreferrer">
                          {vendor.websiteUrl}
                        </a>
                      ) : formatEntityValue(null)
                    ),
                  },
                  { key: 'department', label: 'Department', value: vendor.department },
                  { key: 'designation', label: 'Designation', value: vendor.designation },
                ]}
              />
            </Card>

            <Card title="Business Information" className="entity-profile-card" style={{ marginBottom: 24 }}>
              <EntityInfoGrid
                items={[
                  { key: 'pan', label: 'PAN', value: vendor.pan },
                  { key: 'gstin', label: 'GSTIN', value: vendor.gstin },
                  {
                    key: 'msme',
                    label: 'MSME Registered',
                    render: () => (
                      <span style={{ color: vendor.msmeRegistered ? '#16a34a' : '#64748b' }}>
                        {vendor.msmeRegistered ? 'Yes' : 'No'}
                      </span>
                    ),
                  },
                  { key: 'currency', label: 'Currency', value: vendor.currency },
                  { key: 'payment_terms', label: 'Payment Terms', value: vendor.paymentTerms },
                  { key: 'tds', label: 'TDS', value: vendor.tds },
                ]}
              />
            </Card>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} md={12}>
                <EntityAddressCard title="Billing Address" prefix="billing_" data={vendor} />
              </Col>
              <Col xs={24} md={12}>
                <EntityAddressCard title="Shipping Address" prefix="shipping_" data={vendor} />
              </Col>
            </Row>

            <Card title="Bank Details" className="entity-profile-card" style={{ marginBottom: 24 }}>
              <EntityInfoGrid
                items={[
                  { key: 'bank_name', label: 'Bank Name', value: vendor.bankName },
                  { key: 'account_holder', label: 'Account Holder', value: vendor.accountHolderName },
                  { key: 'account_number', label: 'Account Number', value: vendor.accountNumber },
                  { key: 'account_type', label: 'Account Type', value: vendor.accountType },
                  { key: 'ifsc', label: 'IFSC Code', value: vendor.ifscCode },
                  { key: 'branch', label: 'Branch Name', value: vendor.branchName },
                  { key: 'swift', label: 'SWIFT Code', value: vendor.swiftCode },
                  { key: 'iban', label: 'IBAN', value: vendor.iban },
                ]}
              />
            </Card>

            {vendor.remarks && (
              <Card title="Remarks" className="entity-profile-card">
                <p style={{ margin: 0, color: '#334155', lineHeight: 1.6 }}>{vendor.remarks}</p>
              </Card>
            )}
          </Col>

          <Col xs={24} lg={8}>
            <Card title="Quick Stats" className="entity-profile-card" style={{ marginBottom: 24 }}>
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <ShopOutlined className="entity-profile-sidebar-icon" />
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
                  {vendor.displayName || vendor.companyName}
                </div>
                <Tag color={vendor.status === 'active' ? 'green' : 'red'}>
                  {vendor.status?.toUpperCase()}
                </Tag>
              </div>
              <Divider style={{ margin: '16px 0' }} />
              <div>
                {vendor.createdAt && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="entity-profile-meta-label">Vendor since</div>
                    <div>{new Date(vendor.createdAt).toLocaleDateString()}</div>
                  </div>
                )}
                {vendor.updatedAt && (
                  <div>
                    <div className="entity-profile-meta-label">Last updated</div>
                    <div>{new Date(vendor.updatedAt).toLocaleDateString()}</div>
                  </div>
                )}
              </div>
            </Card>

            <Card title="Actions" size="small" className="entity-profile-card">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button
                  block
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/purchases/vendors/${vendorId}/edit`)}
                >
                  Edit Vendor
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

export default ViewVendor;
