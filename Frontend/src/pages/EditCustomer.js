import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  Tabs,
  Card,
  Row,
  Col,
  Space,
  Checkbox,
  Upload,
  Tooltip,
  message,
  Divider,
  InputNumber,
  Spin
} from 'antd';
import { UploadOutlined, InfoCircleOutlined, LinkOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import apiService from '../services/apiService';

const EditCustomer = () => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('otherDetails');
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    fetchCustomer();
  }, [id]);

  const fetchCustomer = async () => {
    try {
      setFetchLoading(true);
      const response = await apiService.get(`/customers/${id}`);
      
      if (response.success) {
        const customer = response.data;
        form.setFieldsValue({
          displayName: customer.display_name,
          companyName: customer.company_name,
          salutation: customer.salutation,
          firstName: customer.first_name,
          lastName: customer.last_name,
          email: customer.email,
          workPhone: customer.work_phone,
          mobilePhone: customer.mobile_phone,
          pan: customer.pan,
          gstin: customer.gstin,
          msmeRegistered: customer.msme_registered,
          currency: customer.currency,
          paymentTerms: customer.payment_terms,
          tds: customer.tds,
          websiteUrl: customer.website_url,
          department: customer.department,
          designation: customer.designation,
          billingAttention: customer.billing_attention,
          billingCountry: customer.billing_country,
          billingAddress1: customer.billing_address1,
          billingAddress2: customer.billing_address2,
          billingCity: customer.billing_city,
          billingState: customer.billing_state,
          billingPinCode: customer.billing_pin_code,
          shippingAttention: customer.shipping_attention,
          shippingCountry: customer.shipping_country,
          shippingAddress1: customer.shipping_address1,
          shippingAddress2: customer.shipping_address2,
          shippingCity: customer.shipping_city,
          shippingState: customer.shipping_state,
          shippingPinCode: customer.shipping_pin_code,
          remarks: customer.remarks,
          creditLimit: customer.credit_limit,
          bankName: customer.bank_name,
          accountHolderName: customer.account_holder_name,
          accountNumber: customer.account_number,
          ifscCode: customer.ifsc_code,
          branchName: customer.branch_name,
          accountType: customer.account_type,
          swiftCode: customer.swift_code,
          iban: customer.iban
        });
      } else {
        message.error('Failed to load customer details');
        navigate('/sales/customers');
      }
    } catch (error) {
      console.error('Error fetching customer:', error);
      message.error('Failed to load customer details');
      navigate('/sales/customers');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      const apiData = {
        displayName: values.displayName,
        companyName: values.companyName || '',
        salutation: values.salutation || '',
        firstName: values.firstName || '',
        lastName: values.lastName || '',
        email: values.email || '',
        workPhone: values.workPhone || '',
        mobilePhone: values.mobilePhone || '',
        pan: values.pan || '',
        gstin: values.gstin || '',
        msmeRegistered: values.msmeRegistered || false,
        currency: values.currency || 'INR',
        paymentTerms: values.paymentTerms || '',
        tds: values.tds || '',
        websiteUrl: values.websiteUrl || '',
        department: values.department || '',
        designation: values.designation || '',
        billingAttention: values.billingAttention || '',
        billingCountry: values.billingCountry || '',
        billingAddress1: values.billingAddress1 || '',
        billingAddress2: values.billingAddress2 || '',
        billingCity: values.billingCity || '',
        billingState: values.billingState || '',
        billingPinCode: values.billingPinCode || '',
        shippingAttention: values.shippingAttention || '',
        shippingCountry: values.shippingCountry || '',
        shippingAddress1: values.shippingAddress1 || '',
        shippingAddress2: values.shippingAddress2 || '',
        shippingCity: values.shippingCity || '',
        shippingState: values.shippingState || '',
        shippingPinCode: values.shippingPinCode || '',
        remarks: values.remarks || '',
        creditLimit: values.creditLimit || 0,
        bankName: values.bankName || '',
        accountHolderName: values.accountHolderName || '',
        accountNumber: values.accountNumber || '',
        ifscCode: values.ifscCode || '',
        branchName: values.branchName || '',
        accountType: values.accountType || '',
        swiftCode: values.swiftCode || '',
        iban: values.iban || ''
      };
      
      const response = await apiService.put(`/customers/${id}`, apiData);
      
      if (response.success) {
        message.success('Customer updated successfully');
        setTimeout(() => {
          navigate(`/sales/customers/${id}`);
        }, 1500);
      } else {
        message.error(response.error || 'Failed to update customer');
      }
    } catch (error) {
      console.error('Error updating customer:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to update customer';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const salutationOptions = [
    { label: 'Mr.', value: 'mr' },
    { label: 'Ms.', value: 'ms' },
    { label: 'Mrs.', value: 'mrs' },
    { label: 'Dr.', value: 'dr' }
  ];

  const currencyOptions = [
    { label: 'INR- Indian Rupee', value: 'INR' },
    { label: 'USD- US Dollar', value: 'USD' },
    { label: 'EUR- Euro', value: 'EUR' }
  ];

  const paymentTermsOptions = [
    { label: 'Due on Receipt', value: 'due_on_receipt' },
    { label: 'Net 15', value: 'net_15' },
    { label: 'Net 30', value: 'net_30' },
    { label: 'Net 60', value: 'net_60' }
  ];

  const taxOptions = [
    { label: 'SGST', value: 'sgst' },
    { label: 'CGST', value: 'cgst' },
    { label: 'IGST', value: 'igst' }
  ];

  const countryOptions = [
    { label: 'India', value: 'india' },
    { label: 'USA', value: 'usa' },
    { label: 'UK', value: 'uk' }
  ];

  const stateOptions = [
    { label: 'Andhra Pradesh', value: 'ap' },
    { label: 'Assam', value: 'assam' },
    { label: 'Delhi', value: 'delhi' }
  ];

  const accountTypeOptions = [
    { label: 'Savings', value: 'savings' },
    { label: 'Current', value: 'current' },
    { label: 'Cash Credit (CC)', value: 'cc' },
    { label: 'Overdraft (OD)', value: 'od' }
  ];

  if (fetchLoading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <Space>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate(`/sales/customers/${id}`)}
          >
            Back to Customer
          </Button>
        </Space>
      </div>

      <h1 style={{ marginBottom: '8px', fontSize: '28px', fontWeight: '600' }}>Edit Customer</h1>

      <Form form={form} layout="vertical" autoComplete="off">
        <Card style={{ marginBottom: '24px', borderRadius: '4px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
              Primary Contact
              <Tooltip title="Main contact person for this customer">
                <InfoCircleOutlined style={{ marginLeft: '8px', color: '#999' }} />
              </Tooltip>
            </h3>
          </div>

          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8} md={6}>
              <Form.Item name="salutation" label="Salutation">
                <Select placeholder="Select" options={salutationOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8} md={9}>
              <Form.Item name="firstName" label="First Name">
                <Input placeholder="First Name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8} md={9}>
              <Form.Item name="lastName" label="Last Name">
                <Input placeholder="Last Name" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item label="Company Name" name="companyName">
                <Input placeholder="Enter company name" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item
                label={
                  <span>
                    Display Name
                    <span style={{ color: '#ff4d4f' }}> *</span>
                    <Tooltip title="How customer will be displayed in the system">
                      <InfoCircleOutlined style={{ marginLeft: '8px', color: '#999' }} />
                    </Tooltip>
                  </span>
                }
                name="displayName"
                rules={[{ required: true, message: 'Display Name is required' }]}
              >
                <Input placeholder="Enter display name" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item 
                label={
                  <span>
                    Email Address
                    <Tooltip title="Primary email for customer communication">
                      <InfoCircleOutlined style={{ marginLeft: '8px', color: '#999' }} />
                    </Tooltip>
                  </span>
                } 
                name="email"
              >
                <Input type="email" placeholder="customer@example.com" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={9}>
              <Form.Item name="workPhone" label="Work Phone">
                <Input placeholder="Work Phone Number" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="mobilePhone" label="Mobile">
                <Input placeholder="Mobile Number" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ background: '#fff' }}
          items={[
            {
              key: 'otherDetails',
              label: 'Other Details',
              children: (
                <Card style={{ marginTop: '0px', borderTop: 'none' }}>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Form.Item 
                        label={
                          <span>
                            PAN
                            <Tooltip title="Permanent Account Number">
                              <InfoCircleOutlined style={{ marginLeft: '8px', color: '#999' }} />
                            </Tooltip>
                          </span>
                        } 
                        name="pan"
                      >
                        <Input placeholder="Enter PAN" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item 
                        label={
                          <span>
                            Credit Limit
                            <Tooltip title="Maximum credit limit for this customer">
                              <InfoCircleOutlined style={{ marginLeft: '8px', color: '#999' }} />
                            </Tooltip>
                          </span>
                        } 
                        name="creditLimit"
                      >
                        <InputNumber 
                          placeholder="Enter credit limit" 
                          style={{ width: '100%' }}
                          min={0}
                          formatter={value => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={value => value.replace(/₹\s?|(,*)/g, '')}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col xs={24}>
                      <Form.Item name="msmeRegistered" valuePropName="checked">
                        <Checkbox style={{ fontSize: '14px' }}>
                          This customer is MSME registered
                        </Checkbox>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider style={{ margin: '24px 0' }} />

                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Form.Item label="Currency" name="currency">
                        <Select placeholder="Select Currency" options={currencyOptions} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label="Payment Terms" name="paymentTerms">
                        <Select placeholder="Select Payment Terms" options={paymentTermsOptions} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Form.Item label="TDS" name="tds">
                        <Select placeholder="Select a Tax" options={taxOptions} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Form.Item label="Website URL" name="websiteUrl">
                        <Input 
                          prefix={<LinkOutlined style={{ color: '#bfbfbf' }} />} 
                          placeholder="ex: www.customer.com" 
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Form.Item label="Department" name="department">
                        <Input placeholder="Enter department" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label="Designation" name="designation">
                        <Input placeholder="Enter designation" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              )
            },
            {
              key: 'address',
              label: 'Address',
              children: (
                <Card style={{ marginTop: '0px', borderTop: 'none' }}>
                  <Row gutter={32}>
                    <Col xs={24} md={12}>
                      <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '600' }}>
                          Billing Address
                        </h4>
                      </div>

                      <Row gutter={[16, 16]}>
                        <Col xs={24}>
                          <Form.Item label="Attention" name="billingAttention">
                            <Input placeholder="Enter name" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={[16, 16]}>
                        <Col xs={24}>
                          <Form.Item label="Country/Region" name="billingCountry">
                            <Select placeholder="Select" options={countryOptions} />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={[16, 16]}>
                        <Col xs={24}>
                          <Form.Item label="Address" name="billingAddress1">
                            <Input.TextArea placeholder="Street 1" rows={2} />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={[16, 16]}>
                        <Col xs={24}>
                          <Form.Item name="billingAddress2">
                            <Input.TextArea placeholder="Street 2" rows={2} />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12}>
                          <Form.Item label="City" name="billingCity">
                            <Input placeholder="Enter city" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item label="State" name="billingState">
                            <Select placeholder="Select or type to add" options={stateOptions} />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={[16, 16]}>
                        <Col xs={24}>
                          <Form.Item label="Pin Code" name="billingPinCode">
                            <Input placeholder="Enter pin code" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Col>

                    <Col xs={24} md={12}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>
                          Shipping Address
                        </h4>
                        <Button type="link" size="small" style={{ padding: 0 }}>
                          📋 Copy billing address
                        </Button>
                      </div>

                      <Row gutter={[16, 16]}>
                        <Col xs={24}>
                          <Form.Item label="Attention" name="shippingAttention">
                            <Input placeholder="Enter name" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={[16, 16]}>
                        <Col xs={24}>
                          <Form.Item label="Country/Region" name="shippingCountry">
                            <Select placeholder="Select" options={countryOptions} />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={[16, 16]}>
                        <Col xs={24}>
                          <Form.Item label="Address" name="shippingAddress1">
                            <Input.TextArea placeholder="Street 1" rows={2} />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={[16, 16]}>
                        <Col xs={24}>
                          <Form.Item name="shippingAddress2">
                            <Input.TextArea placeholder="Street 2" rows={2} />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12}>
                          <Form.Item label="City" name="shippingCity">
                            <Input placeholder="Enter city" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item label="State" name="shippingState">
                            <Select placeholder="Select or type to add" options={stateOptions} />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={[16, 16]}>
                        <Col xs={24}>
                          <Form.Item label="Pin Code" name="shippingPinCode">
                            <Input placeholder="Enter pin code" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Col>
                  </Row>
                </Card>
              )
            },
            {
              key: 'bankDetails',
              label: 'Bank Details',
              children: (
                <Card style={{ marginTop: '0px', borderTop: 'none' }}>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Form.Item label="Bank Name" name="bankName">
                        <Input placeholder="Enter bank name" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label="Account Holder Name" name="accountHolderName">
                        <Input placeholder="Enter account holder name" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Form.Item label="Account Number" name="accountNumber">
                        <Input placeholder="Enter account number" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label="Account Type" name="accountType">
                        <Select placeholder="Select account type" options={accountTypeOptions} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Form.Item label="IFSC Code" name="ifscCode">
                        <Input placeholder="Enter IFSC code" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label="Branch Name" name="branchName">
                        <Input placeholder="Enter branch name" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Form.Item label="SWIFT Code" name="swiftCode">
                        <Input placeholder="Enter SWIFT code (for international)" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label="IBAN" name="iban">
                        <Input placeholder="Enter IBAN (for international)" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              )
            },
            {
              key: 'remarks',
              label: 'Remarks',
              children: (
                <Card style={{ marginTop: '0px', borderTop: 'none' }}>
                  <Form.Item name="remarks">
                    <Input.TextArea placeholder="Add remarks here" rows={4} />
                  </Form.Item>
                </Card>
              )
            }
          ]}
        />

        <Row gutter={16} style={{ marginTop: '24px', marginBottom: '24px' }}>
          <Col>
            <Button 
              type="primary" 
              onClick={handleSave}
              loading={loading}
              disabled={loading}
              style={{ minWidth: '100px', height: '40px', fontSize: '14px', fontWeight: '500' }}
            >
              Update
            </Button>
          </Col>
          <Col>
            <Button 
              style={{ minWidth: '100px', height: '40px', fontSize: '14px' }}
              disabled={loading}
              onClick={() => navigate(`/sales/customers/${id}`)}
            >
              Cancel
            </Button>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

export default EditCustomer;