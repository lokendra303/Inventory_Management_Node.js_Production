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
  Tooltip,
  message,
  Divider,
  Spin
} from 'antd';
import { InfoCircleOutlined, LinkOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import apiService from '../../../services/apiService';
import { copyBillingToShipping } from '../../../utils/addressFormUtils';
import { GstinFormField } from '../../../components/entities/GstinFormField';

const EditVendor = () => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('otherDetails');
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const navigate = useNavigate();
  const { vendorId } = useParams();

  useEffect(() => {
    fetchVendor();
  }, [vendorId]);

  const fetchVendor = async () => {
    try {
      setFetchLoading(true);
      const response = await apiService.get(`/vendors/${vendorId}`);
      const vendorData = response.data || response;
      
      form.setFieldsValue({
        displayName: vendorData.display_name || vendorData.displayName,
        companyName: vendorData.company_name || vendorData.companyName,
        salutation: vendorData.salutation,
        firstName: vendorData.first_name || vendorData.firstName,
        lastName: vendorData.last_name || vendorData.lastName,
        email: vendorData.email,
        workPhone: vendorData.work_phone || vendorData.workPhone,
        mobilePhone: vendorData.mobile_phone || vendorData.mobilePhone,
        pan: vendorData.pan,
        gstin: vendorData.gstin,
        msmeRegistered: vendorData.msme_registered || vendorData.msmeRegistered,
        currency: vendorData.currency,
        paymentTerms: vendorData.payment_terms || vendorData.paymentTerms,
        tds: vendorData.tds,
        websiteUrl: vendorData.website_url || vendorData.websiteUrl,
        department: vendorData.department,
        designation: vendorData.designation,
        billingAttention: vendorData.billing_attention || vendorData.billingAttention,
        billingCountry: vendorData.billing_country || vendorData.billingCountry,
        billingAddress1: vendorData.billing_address1 || vendorData.billingAddress1,
        billingAddress2: vendorData.billing_address2 || vendorData.billingAddress2,
        billingCity: vendorData.billing_city || vendorData.billingCity,
        billingState: vendorData.billing_state || vendorData.billingState,
        billingPinCode: vendorData.billing_pin_code || vendorData.billingPinCode,
        shippingAttention: vendorData.shipping_attention || vendorData.shippingAttention,
        shippingCountry: vendorData.shipping_country || vendorData.shippingCountry,
        shippingAddress1: vendorData.shipping_address1 || vendorData.shippingAddress1,
        shippingAddress2: vendorData.shipping_address2 || vendorData.shippingAddress2,
        shippingCity: vendorData.shipping_city || vendorData.shippingCity,
        shippingState: vendorData.shipping_state || vendorData.shippingState,
        shippingPinCode: vendorData.shipping_pin_code || vendorData.shippingPinCode,
        remarks: vendorData.remarks,
        bankName: vendorData.bank_name || vendorData.bankName,
        accountHolderName: vendorData.account_holder_name || vendorData.accountHolderName,
        accountNumber: vendorData.account_number || vendorData.accountNumber,
        ifscCode: vendorData.ifsc_code || vendorData.ifscCode,
        branchName: vendorData.branch_name || vendorData.branchName,
        accountType: vendorData.account_type || vendorData.accountType,
        swiftCode: vendorData.swift_code || vendorData.swiftCode,
        iban: vendorData.iban
      });
    } catch (error) {
      message.error('Failed to load vendor details');
      navigate('/purchases/vendors');
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
        bankName: values.bankName || '',
        accountHolderName: values.accountHolderName || '',
        accountNumber: values.accountNumber || '',
        ifscCode: values.ifscCode || '',
        branchName: values.branchName || '',
        accountType: values.accountType || '',
        swiftCode: values.swiftCode || '',
        iban: values.iban || ''
      };
      
      const response = await apiService.put(`/vendors/${vendorId}`, apiData);
      
      if (response.success || response.data?.success) {
        message.success('Vendor updated successfully');
        navigate(`/purchases/vendors/${vendorId}`);
      } else {
        message.error(response.error || 'Failed to update vendor');
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to update vendor');
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

  const accountTypeOptions = [
    { label: 'Savings', value: 'savings' },
    { label: 'Current', value: 'current' },
    { label: 'Cash Credit (CC)', value: 'cc' },
    { label: 'Overdraft (OD)', value: 'od' }
  ];

  const stateOptions = [
    { label: 'Andhra Pradesh', value: 'andhra_pradesh' },
    { label: 'Karnataka', value: 'karnataka' },
    { label: 'Tamil Nadu', value: 'tamil_nadu' },
    { label: 'Maharashtra', value: 'maharashtra' },
    { label: 'Gujarat', value: 'gujarat' },
    { label: 'Rajasthan', value: 'rajasthan' },
    { label: 'West Bengal', value: 'west_bengal' },
    { label: 'Uttar Pradesh', value: 'uttar_pradesh' },
    { label: 'Delhi', value: 'delhi' }
  ];

  if (fetchLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
      <Space style={{ marginBottom: '12px' }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(`/purchases/vendors/${vendorId}`)}>Back</Button>
      </Space>
      <h1 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: '600' }}>Edit Vendor</h1>

      <Form form={form} layout="vertical" autoComplete="off">
        <Card style={{ marginBottom: '24px', borderRadius: '4px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
              Primary Contact
              <Tooltip title="Main contact person for this vendor">
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
              <Form.Item label="Email Address" name="email">
                <Input type="email" placeholder="vendor@example.com" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Form.Item name="workPhone" label="Work Phone">
                <Input placeholder="Work Phone Number" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
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
                      <Form.Item label="PAN" name="pan">
                        <Input 
                          placeholder="Enter PAN" 
                          style={{ textTransform: 'uppercase' }}
                          onChange={(e) => {
                            const value = e.target.value.toUpperCase();
                            form.setFieldsValue({ pan: value });
                          }}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <GstinFormField partyType="vendor" />
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col xs={24}>
                      <Form.Item name="msmeRegistered" valuePropName="checked">
                        <Checkbox>This vendor is MSME registered</Checkbox>
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

                  <Divider style={{ margin: '24px 0' }} />

                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Form.Item label="Website URL" name="websiteUrl">
                        <Input prefix={<LinkOutlined />} placeholder="ex: www.zyiker.com" />
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
                      <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '600' }}>Billing Address</h4>
                      <Row gutter={[16, 16]}>
                        <Col xs={24}>
                          <Form.Item label="Attention" name="billingAttention">
                            <Input placeholder="Enter name" />
                          </Form.Item>
                        </Col>
                        <Col xs={24}>
                          <Form.Item label="Country/Region" name="billingCountry">
                            <Select placeholder="Select" options={countryOptions} />
                          </Form.Item>
                        </Col>
                        <Col xs={24}>
                          <Form.Item label="Address" name="billingAddress1">
                            <Input.TextArea placeholder="Street 1" rows={2} />
                          </Form.Item>
                        </Col>
                        <Col xs={24}>
                          <Form.Item name="billingAddress2">
                            <Input.TextArea placeholder="Street 2" rows={2} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item label="City" name="billingCity">
                            <Input placeholder="Enter city" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item label="State" name="billingState">
                            <Select placeholder="Select" options={stateOptions} />
                          </Form.Item>
                        </Col>
                        <Col xs={24}>
                          <Form.Item label="Pin Code" name="billingPinCode">
                            <Input placeholder="Enter pin code" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Col>

                    <Col xs={24} md={12}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>Shipping Address</h4>
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0 }}
                          onClick={() => copyBillingToShipping(form)}
                        >
                          📋 Copy billing address
                        </Button>
                      </div>
                      <Row gutter={[16, 16]}>
                        <Col xs={24}>
                          <Form.Item label="Attention" name="shippingAttention">
                            <Input placeholder="Enter name" />
                          </Form.Item>
                        </Col>
                        <Col xs={24}>
                          <Form.Item label="Country/Region" name="shippingCountry">
                            <Select placeholder="Select" options={countryOptions} />
                          </Form.Item>
                        </Col>
                        <Col xs={24}>
                          <Form.Item label="Address" name="shippingAddress1">
                            <Input.TextArea placeholder="Street 1" rows={2} />
                          </Form.Item>
                        </Col>
                        <Col xs={24}>
                          <Form.Item name="shippingAddress2">
                            <Input.TextArea placeholder="Street 2" rows={2} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item label="City" name="shippingCity">
                            <Input placeholder="Enter city" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item label="State" name="shippingState">
                            <Select placeholder="Select" options={stateOptions} />
                          </Form.Item>
                        </Col>
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
                    <Col xs={24} md={12}>
                      <Form.Item label="SWIFT Code" name="swiftCode">
                        <Input placeholder="Enter SWIFT code" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label="IBAN" name="iban">
                        <Input placeholder="Enter IBAN" />
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
            <Button type="primary" onClick={handleSave} loading={loading}>
              Update
            </Button>
          </Col>
          <Col>
            <Button onClick={() => navigate(`/purchases/vendors/${vendorId}`)}>
              Cancel
            </Button>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

export default EditVendor;
