import React, { useState, useEffect } from 'react';
import { Button, Table, Space, Input, Row, Col, Card, Popconfirm, message, Spin } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/apiService';

const Vendors = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch vendors on component mount
  useEffect(() => {
    const token = sessionStorage.getItem('token');
    console.log('Vendors component mounted, token exists:', !!token);
    if (token) {
      fetchVendors();
    } else {
      setLoading(false);
      message.error('Please login first to view vendors');
    }
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      console.log('Fetching vendors from API...');
      const response = await apiService.get('/vendors');
      
      console.log('Vendors API response:', response);
      
      // Handle different response formats
      let vendorsData = [];
      if (Array.isArray(response)) {
        vendorsData = response;
      } else if (response && response.data && Array.isArray(response.data)) {
        vendorsData = response.data;
      } else if (response && response.success && Array.isArray(response.data)) {
        vendorsData = response.data;
      }
      
      if (vendorsData.length > 0) {
        // Map all database fields to display format
        const mappedVendors = vendorsData.map(vendor => ({
          id: vendor.id,
          vendorName: vendor.display_name || '',
          displayName: vendor.display_name || '',
          vendorCode: vendor.vendor_code || '',
          companyName: vendor.company_name || '',
          salutation: vendor.salutation || '',
          firstName: vendor.first_name || '',
          lastName: vendor.last_name || '',
          email: vendor.email || '',
          workPhone: vendor.work_phone || '',
          mobilePhone: vendor.mobile_phone || '',
          pan: vendor.pan || '',
          gstin: vendor.gstin || '',
          msmeRegistered: vendor.msme_registered || false,
          currency: vendor.currency || 'INR',
          paymentTerms: vendor.payment_terms || '',
          tds: vendor.tds || '',
          website: vendor.website_url || '',
          department: vendor.department || '',
          designation: vendor.designation || '',
          billingAttention: vendor.billing_attention || '',
          billingCountry: vendor.billing_country || '',
          billingAddress1: vendor.billing_address1 || '',
          billingAddress2: vendor.billing_address2 || '',
          billingCity: vendor.billing_city || '',
          billingState: vendor.billing_state || '',
          billingPinCode: vendor.billing_pin_code || '',
          shippingAttention: vendor.shipping_attention || '',
          shippingCountry: vendor.shipping_country || '',
          shippingAddress1: vendor.shipping_address1 || '',
          shippingAddress2: vendor.shipping_address2 || '',
          shippingCity: vendor.shipping_city || '',
          shippingState: vendor.shipping_state || '',
          shippingPinCode: vendor.shipping_pin_code || '',
          remarks: vendor.remarks || '',
          status: vendor.status === 'active' ? 'Active' : 'Inactive',
          createdAt: vendor.created_at,
          updatedAt: vendor.updated_at
        }));
        
        setVendors(mappedVendors);
        console.log(`Successfully loaded ${mappedVendors.length} vendors`);
      } else {
        setVendors([]);
        console.log('No vendors found in database');
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
      if (error.response?.status === 400) {
        const errorMsg = error.response?.data?.error || 'Bad request';
        console.error('400 Error details:', error.response?.data);
        message.error(`Bad request: ${errorMsg}`);
      } else if (error.response?.status === 403) {
        message.error('You do not have permission to view vendors');
      } else if (error.response?.status === 401) {
        message.error('Session expired - please login again');
      } else if (error.response?.status === 404) {
        message.error('Vendors endpoint not found');
      } else {
        message.error('Failed to load vendors: ' + (error.message || 'Unknown error'));
      }
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (vendorId, newStatus) => {
    try {
      setActionLoading(true);
      const response = await apiService.put(`/vendors/${vendorId}`, {
        status: newStatus
      });

      console.log('Status change response:', response);
      
      // Update local state
      setVendors(vendors.map(v => 
        v.id === vendorId 
          ? { ...v, status: newStatus === 'active' ? 'Active' : 'Inactive' }
          : v
      ));
      message.success(`Vendor ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      console.error('Error updating vendor status:', error);
      message.error(error.response?.data?.error || 'Failed to update vendor status');
    } finally {
      setActionLoading(false);
    }
  };

  const columns = [
    {
      title: 'Vendor Name',
      dataIndex: 'vendorName',
      key: 'vendorName',
      render: (text, record) => (
        <Button 
          type="link"
          onClick={() => navigate(`/purchases/vendors/${record.id}`)}
          style={{ padding: 0, height: 'auto' }}
        >
          {text}
        </Button>
      )
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email'
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone'
    },
    {
      title: 'City',
      dataIndex: 'city',
      key: 'city'
    },
    {
      title: 'State',
      dataIndex: 'state',
      key: 'state'
    },
    {
      title: 'GSTIN',
      dataIndex: 'gstin',
      key: 'gstin'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <span style={{ color: status === 'Active' ? '#52c41a' : '#ff4d4f', fontWeight: '500' }}>
          {status}
        </span>
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="primary" 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => navigate(`/purchases/vendors/${record.id}`)}
          >
            View
          </Button>
          {record.status === 'Active' ? (
            <Popconfirm
              title="Deactivate Vendor"
              description="Are you sure you want to deactivate this vendor?"
              onConfirm={() => handleStatusChange(record.id, 'inactive')}
              okText="Yes"
              cancelText="No"
            >
              <Button 
                danger 
                size="small"
                loading={actionLoading}
              >
                Deactivate
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title="Activate Vendor"
              description="Are you sure you want to activate this vendor?"
              onConfirm={() => handleStatusChange(record.id, 'active')}
              okText="Yes"
              cancelText="No"
            >
              <Button 
                type="default" 
                size="small"
                loading={actionLoading}
              >
                Activate
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        {/* Header */}
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12}>
            <h2 style={{ margin: 0 }}>Vendors</h2>
          </Col>
          <Col xs={24} sm={12} style={{ textAlign: 'right' }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/purchases/vendors/new')}
            >
              New Vendor
            </Button>
          </Col>
        </Row>

        {/* Search Bar */}
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12}>
            <Input
              placeholder="Search vendors..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </Col>
        </Row>

        {/* Vendors Table */}
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={vendors.filter(v => 
              v.vendorName.toLowerCase().includes(searchText.toLowerCase()) ||
              v.email.toLowerCase().includes(searchText.toLowerCase())
            )}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 800 }}
          />
        </Spin>
      </Card>
    </div>
  );
};

export default Vendors;
