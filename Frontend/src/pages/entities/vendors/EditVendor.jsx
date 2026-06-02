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
import { InfoCircleOutlined, LinkOutlined, ArrowLeftOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import apiService from '../../../services/apiService';
import { copyBillingToShipping } from '../../../utils/addressFormUtils';
import { GstinFormField } from '../../../components/entities/GstinFormField';
import { PanFormField } from '../../../components/entities/PanFormField';

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

  const normalizeAddress = (addr = {}) => ({
    attention: addr.attention || '',
    country: addr.country || '',
    address1: addr.address1 || '',
    address2: addr.address2 || '',
    city: addr.city || '',
    state: addr.state || '',
    pin_code: addr.pin_code || '',
  });
  const hasAddressData = (addr = {}) =>
    ['attention', 'country', 'address1', 'address2', 'city', 'state', 'pin_code']
      .some((k) => addr[k] != null && String(addr[k]).trim() !== '');
  const buildOrderedAddresses = (primary, extras, selectedKey) => {
    const all = [
      { ...primary, _key: 'primary' },
      ...(extras || []).map((addr, idx) => ({ ...addr, _key: `extra_${idx}` })),
    ].filter(hasAddressData);
    if (!all.length) return [];
    const preferred = selectedKey || all[0]._key;
    return [
      ...all.filter((addr) => addr._key === preferred),
      ...all.filter((addr) => addr._key !== preferred),
    ].map(({ _key, ...rest }) => rest);
  };
  const normalizeBank = (bank = {}) => ({
    bank_name: bank.bank_name || bank.bankName || '',
    account_holder_name: bank.account_holder_name || bank.accountHolderName || '',
    account_number: bank.account_number || bank.accountNumber || '',
    ifsc_code: bank.ifsc_code || bank.ifscCode || '',
    branch_name: bank.branch_name || bank.branchName || '',
    account_type: bank.account_type || bank.accountType || '',
    swift_code: bank.swift_code || bank.swiftCode || '',
    iban: bank.iban || '',
  });
  const hasBankData = (bank = {}) =>
    ['bank_name', 'account_holder_name', 'account_number', 'ifsc_code', 'branch_name', 'account_type', 'swift_code', 'iban']
      .some((k) => bank[k] != null && String(bank[k]).trim() !== '');
  const buildOrderedBanks = (primary, extras, selectedKey) => {
    const all = [
      { ...primary, _key: 'primary' },
      ...(extras || []).map((bank, idx) => ({ ...bank, _key: `extra_${idx}` })),
    ].filter(hasBankData);
    if (!all.length) return [];
    const preferred = selectedKey || all[0]._key;
    return [
      ...all.filter((b) => b._key === preferred),
      ...all.filter((b) => b._key !== preferred),
    ].map(({ _key, ...rest }) => rest);
  };

  const fetchVendor = async () => {
    try {
      setFetchLoading(true);
      const response = await apiService.get(`/vendors/${vendorId}`);
      const vendorData = response.data || response;
      const billingAddresses = Array.isArray(vendorData.billing_addresses) ? vendorData.billing_addresses : [];
      const shippingAddresses = Array.isArray(vendorData.shipping_addresses) ? vendorData.shipping_addresses : [];
      const bankDetails = Array.isArray(vendorData.bank_details) ? vendorData.bank_details : [];
      
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
      if (billingAddresses.length > 0) {
        form.setFieldsValue({ billingAddressesExtra: billingAddresses.slice(1).map(normalizeAddress), defaultBillingAddressKey: 'primary' });
      }
      if (shippingAddresses.length > 0) {
        form.setFieldsValue({ shippingAddressesExtra: shippingAddresses.slice(1).map(normalizeAddress), defaultShippingAddressKey: 'primary' });
      }
      if (bankDetails.length > 0) {
        form.setFieldsValue({ bankDetailsExtra: bankDetails.slice(1).map(normalizeBank), defaultBankDetailKey: 'primary' });
      }
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
      const primaryBilling = normalizeAddress({
        attention: values.billingAttention,
        country: values.billingCountry,
        address1: values.billingAddress1,
        address2: values.billingAddress2,
        city: values.billingCity,
        state: values.billingState,
        pin_code: values.billingPinCode,
      });
      const primaryShipping = normalizeAddress({
        attention: values.shippingAttention,
        country: values.shippingCountry,
        address1: values.shippingAddress1,
        address2: values.shippingAddress2,
        city: values.shippingCity,
        state: values.shippingState,
        pin_code: values.shippingPinCode,
      });
      apiData.billingAddresses = buildOrderedAddresses(
        primaryBilling,
        (values.billingAddressesExtra || []).map(normalizeAddress),
        values.defaultBillingAddressKey || 'primary'
      );
      apiData.shippingAddresses = buildOrderedAddresses(
        primaryShipping,
        (values.shippingAddressesExtra || []).map(normalizeAddress),
        values.defaultShippingAddressKey || 'primary'
      );
      apiData.bankDetails = buildOrderedBanks(
        normalizeBank({
          bank_name: values.bankName,
          account_holder_name: values.accountHolderName,
          account_number: values.accountNumber,
          ifsc_code: values.ifscCode,
          branch_name: values.branchName,
          account_type: values.accountType,
          swift_code: values.swiftCode,
          iban: values.iban,
        }),
        (values.bankDetailsExtra || []).map(normalizeBank),
        values.defaultBankDetailKey || 'primary'
      );
      apiData.defaultBankDetailKey = 'primary';
      
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
                      <PanFormField name="pan" />
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
                      <Form.Item noStyle shouldUpdate>
                        {() => (
                          <Checkbox
                            checked={form.getFieldValue('defaultBillingAddressKey') === 'primary'}
                            onChange={() => form.setFieldsValue({ defaultBillingAddressKey: 'primary' })}
                          >
                            Use this billing address on invoice
                          </Checkbox>
                        )}
                      </Form.Item>
                      <Divider style={{ margin: '12px 0' }} />
                      <Form.List name="billingAddressesExtra">
                        {(fields, { add, remove }) => (
                          <>
                            {fields.map((field, idx) => (
                              <Card key={field.key} size="small" style={{ marginBottom: 12 }}>
                                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                                  <b>Additional Billing Address {idx + 1}</b>
                                  <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                                </Space>
                                <Form.Item name={[field.name, 'attention']} label="Attention"><Input /></Form.Item>
                                <Form.Item name={[field.name, 'country']} label="Country/Region"><Select options={countryOptions} /></Form.Item>
                                <Form.Item name={[field.name, 'address1']} label="Address"><Input.TextArea rows={2} /></Form.Item>
                                <Form.Item name={[field.name, 'address2']}><Input.TextArea rows={2} placeholder="Street 2" /></Form.Item>
                                <Row gutter={12}>
                                  <Col span={12}><Form.Item name={[field.name, 'city']} label="City"><Input /></Form.Item></Col>
                                  <Col span={12}><Form.Item name={[field.name, 'state']} label="State"><Select options={stateOptions} /></Form.Item></Col>
                                </Row>
                                <Form.Item name={[field.name, 'pin_code']} label="Pin Code"><Input /></Form.Item>
                                <Form.Item noStyle shouldUpdate>
                                  {() => (
                                    <Checkbox
                                      checked={form.getFieldValue('defaultBillingAddressKey') === `extra_${idx}`}
                                      onChange={() => form.setFieldsValue({ defaultBillingAddressKey: `extra_${idx}` })}
                                    >
                                      Use this billing address on invoice
                                    </Checkbox>
                                  )}
                                </Form.Item>
                              </Card>
                            ))}
                            <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()} block>
                              Add another billing address
                            </Button>
                          </>
                        )}
                      </Form.List>
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
                      <Form.Item noStyle shouldUpdate>
                        {() => (
                          <Checkbox
                            checked={form.getFieldValue('defaultShippingAddressKey') === 'primary'}
                            onChange={() => form.setFieldsValue({ defaultShippingAddressKey: 'primary' })}
                          >
                            Use this shipping address on invoice
                          </Checkbox>
                        )}
                      </Form.Item>
                      <Divider style={{ margin: '12px 0' }} />
                      <Form.List name="shippingAddressesExtra">
                        {(fields, { add, remove }) => (
                          <>
                            {fields.map((field, idx) => (
                              <Card key={field.key} size="small" style={{ marginBottom: 12 }}>
                                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                                  <b>Additional Shipping Address {idx + 1}</b>
                                  <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                                </Space>
                                <Form.Item name={[field.name, 'attention']} label="Attention"><Input /></Form.Item>
                                <Form.Item name={[field.name, 'country']} label="Country/Region"><Select options={countryOptions} /></Form.Item>
                                <Form.Item name={[field.name, 'address1']} label="Address"><Input.TextArea rows={2} /></Form.Item>
                                <Form.Item name={[field.name, 'address2']}><Input.TextArea rows={2} placeholder="Street 2" /></Form.Item>
                                <Row gutter={12}>
                                  <Col span={12}><Form.Item name={[field.name, 'city']} label="City"><Input /></Form.Item></Col>
                                  <Col span={12}><Form.Item name={[field.name, 'state']} label="State"><Select options={stateOptions} /></Form.Item></Col>
                                </Row>
                                <Form.Item name={[field.name, 'pin_code']} label="Pin Code"><Input /></Form.Item>
                                <Form.Item noStyle shouldUpdate>
                                  {() => (
                                    <Checkbox
                                      checked={form.getFieldValue('defaultShippingAddressKey') === `extra_${idx}`}
                                      onChange={() => form.setFieldsValue({ defaultShippingAddressKey: `extra_${idx}` })}
                                    >
                                      Use this shipping address on invoice
                                    </Checkbox>
                                  )}
                                </Form.Item>
                              </Card>
                            ))}
                            <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()} block>
                              Add another shipping address
                            </Button>
                          </>
                        )}
                      </Form.List>
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
                  <Form.Item noStyle shouldUpdate>
                    {() => (
                      <Checkbox
                        checked={form.getFieldValue('defaultBankDetailKey') === 'primary'}
                        onChange={() => form.setFieldsValue({ defaultBankDetailKey: 'primary' })}
                      >
                        Use this bank account as primary
                      </Checkbox>
                    )}
                  </Form.Item>
                  <Divider style={{ margin: '12px 0' }} />
                  <Form.List name="bankDetailsExtra">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map((field, idx) => (
                          <Card key={field.key} size="small" style={{ marginBottom: 12 }}>
                            <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                              <b>Additional Bank Account {idx + 1}</b>
                              <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                            </Space>
                            <Row gutter={[16, 16]}>
                              <Col xs={24} md={12}><Form.Item name={[field.name, 'bank_name']} label="Bank Name"><Input /></Form.Item></Col>
                              <Col xs={24} md={12}><Form.Item name={[field.name, 'account_holder_name']} label="Account Holder Name"><Input /></Form.Item></Col>
                              <Col xs={24} md={12}><Form.Item name={[field.name, 'account_number']} label="Account Number"><Input /></Form.Item></Col>
                              <Col xs={24} md={12}><Form.Item name={[field.name, 'account_type']} label="Account Type"><Select options={accountTypeOptions} /></Form.Item></Col>
                              <Col xs={24} md={12}><Form.Item name={[field.name, 'ifsc_code']} label="IFSC Code"><Input /></Form.Item></Col>
                              <Col xs={24} md={12}><Form.Item name={[field.name, 'branch_name']} label="Branch Name"><Input /></Form.Item></Col>
                              <Col xs={24} md={12}><Form.Item name={[field.name, 'swift_code']} label="SWIFT Code"><Input /></Form.Item></Col>
                              <Col xs={24} md={12}><Form.Item name={[field.name, 'iban']} label="IBAN"><Input /></Form.Item></Col>
                            </Row>
                            <Form.Item noStyle shouldUpdate>
                              {() => (
                                <Checkbox
                                  checked={form.getFieldValue('defaultBankDetailKey') === `extra_${idx}`}
                                  onChange={() => form.setFieldsValue({ defaultBankDetailKey: `extra_${idx}` })}
                                >
                                  Use this bank account as primary
                                </Checkbox>
                              )}
                            </Form.Item>
                          </Card>
                        ))}
                        <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()} block>
                          Add another bank account
                        </Button>
                      </>
                    )}
                  </Form.List>
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
