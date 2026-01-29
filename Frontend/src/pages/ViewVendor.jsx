import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tabs,
  Button,
  Row,
  Col,
  Descriptions,
  Divider,
  Spin,
  message,
  Space
} from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import apiService from '../services/apiService';

const ViewVendor = () => {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');

  const fetchVendor = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching vendor:', vendorId);
      const response = await apiService.get(`/vendors/${vendorId}`);
      
      console.log('Vendor fetch response:', response);
      
      let vendorData = null;
      if (response && response.data && typeof response.data === 'object') {
        vendorData = response.data;
      } else if (response && typeof response === 'object') {
        vendorData = response;
      }
      
      if (vendorData) {
        setVendor(vendorData);
        console.log('Vendor loaded:', vendorData);
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <p>Vendor not found</p>
          <Button onClick={() => navigate('/purchases/vendors')}>Back to Vendors</Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <Space style={{ marginBottom: '16px' }}>
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/purchases/vendors')}
          >
            Back
          </Button>
        </Space>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '600' }}>
            {vendor.displayName || vendor.companyName}
          </h1>
          <Button 
            type="primary" 
            icon={<EditOutlined />}
            onClick={() => navigate(`/purchases/vendors/${vendorId}/edit`)}
          >
            Edit
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'details',
            label: 'Vendor Details',
            children: (
              <Card>
                <Descriptions bordered column={2}>
                  <Descriptions.Item label="Display Name" span={2}>
                    {vendor.displayName}
                  </Descriptions.Item>
                  <Descriptions.Item label="Company Name" span={2}>
                    {vendor.companyName}
                  </Descriptions.Item>
                  <Descriptions.Item label="Status">
                    <span style={{ color: vendor.status === 'active' ? '#52c41a' : '#ff4d4f', fontWeight: '500' }}>
                      {vendor.status?.toUpperCase() || 'N/A'}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="Email">
                    {vendor.email || 'N/A'}
                  </Descriptions.Item>
                </Descriptions>

                <Divider />
                <h3 style={{ marginBottom: '16px' }}>Contact Information</h3>
                <Descriptions bordered column={2}>
                  <Descriptions.Item label="First Name">
                    {vendor.firstName || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Last Name">
                    {vendor.lastName || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Work Phone">
                    {vendor.workPhone || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Mobile Phone">
                    {vendor.mobilePhone || 'N/A'}
                  </Descriptions.Item>
                </Descriptions>

                <Divider />
                <h3 style={{ marginBottom: '16px' }}>Tax & Compliance</h3>
                <Descriptions bordered column={2}>
                  <Descriptions.Item label="PAN">
                    {vendor.pan || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="GSTIN">
                    {vendor.gstin || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="MSME Registered">
                    {vendor.msmeRegistered ? 'Yes' : 'No'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Currency">
                    {vendor.currency || 'N/A'}
                  </Descriptions.Item>
                </Descriptions>

                <Divider />
                <h3 style={{ marginBottom: '16px' }}>Financial Terms</h3>
                <Descriptions bordered column={2}>
                  <Descriptions.Item label="Payment Terms">
                    {vendor.paymentTerms || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="TDS">
                    {vendor.tds || 'N/A'}
                  </Descriptions.Item>
                </Descriptions>

                <Divider />
                <h3 style={{ marginBottom: '16px' }}>Additional Information</h3>
                <Descriptions bordered column={2}>
                  <Descriptions.Item label="Website URL">
                    {vendor.websiteUrl ? (
                      <a href={vendor.websiteUrl} target="_blank" rel="noopener noreferrer">
                        {vendor.websiteUrl}
                      </a>
                    ) : 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Department">
                    {vendor.department || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Designation">
                    {vendor.designation || 'N/A'}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )
          },
          {
            key: 'addresses',
            label: 'Addresses',
            children: (
              <Card>
                <Row gutter={32}>
                  <Col xs={24} md={12}>
                    <h4 style={{ marginBottom: '16px', fontWeight: '600' }}>Billing Address</h4>
                    <Descriptions bordered column={1}>
                      <Descriptions.Item label="Attention">
                        {vendor.billingAttention || 'N/A'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Country/Region">
                        {vendor.billingCountry || 'N/A'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Address">
                        {vendor.billingAddress1 || 'N/A'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Address 2">
                        {vendor.billingAddress2 || 'N/A'}
                      </Descriptions.Item>
                      <Descriptions.Item label="City">
                        {vendor.billingCity || 'N/A'}
                      </Descriptions.Item>
                      <Descriptions.Item label="State">
                        {vendor.billingState || 'N/A'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Pin Code">
                        {vendor.billingPinCode || 'N/A'}
                      </Descriptions.Item>
                    </Descriptions>
                  </Col>
                  <Col xs={24} md={12}>
                    <h4 style={{ marginBottom: '16px', fontWeight: '600' }}>Shipping Address</h4>
                    <Descriptions bordered column={1}>
                      <Descriptions.Item label="Attention">
                        {vendor.shippingAttention || 'N/A'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Country/Region">
                        {vendor.shippingCountry || 'N/A'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Address">
                        {vendor.shippingAddress1 || 'N/A'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Address 2">
                        {vendor.shippingAddress2 || 'N/A'}
                      </Descriptions.Item>
                      <Descriptions.Item label="City">
                        {vendor.shippingCity || 'N/A'}
                      </Descriptions.Item>
                      <Descriptions.Item label="State">
                        {vendor.shippingState || 'N/A'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Pin Code">
                        {vendor.shippingPinCode || 'N/A'}
                      </Descriptions.Item>
                    </Descriptions>
                  </Col>
                </Row>
              </Card>
            )
          },
          {
            key: 'remarks',
            label: 'Remarks',
            children: (
              <Card>
                <div style={{ padding: '16px', background: '#fafafa', borderRadius: '4px', minHeight: '200px' }}>
                  {vendor.remarks || <span style={{ color: '#999' }}>No remarks added</span>}
                </div>
              </Card>
            )
          }
        ]}
      />
    </div>
  );
};

export default ViewVendor;
