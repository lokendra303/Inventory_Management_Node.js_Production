import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, Button, Upload, message,
  Image, Typography, Row, Col, Divider, Tabs, Tag, Badge
} from 'antd';
import {
  UploadOutlined, DeleteOutlined, SaveOutlined, EyeOutlined,
  BankOutlined, ShopOutlined, UserOutlined, MailOutlined,
  PhoneOutlined, EnvironmentOutlined, FileImageOutlined,
  CheckCircleFilled, BulbOutlined, CameraOutlined
} from '@ant-design/icons';
import apiService from '../../services/apiService';
import InvoicePreview from '../../components/business/InvoicePreview';
import { useAuth } from '../../hooks/useAuth.jsx';

const { Title, Text } = Typography;

const sectionCard = {
  borderRadius: 12,
  boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
  border: '1px solid #f0f0f0',
  marginBottom: 20
};

const labelIcon = (icon, color) => (
  <span style={{ color, marginRight: 6 }}>{icon}</span>
);

const CompanySettings = () => {
  const { fetchProfile } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({});

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const response = await apiService.get('/company-settings');
      if (response.success && response.data) {
        setSettings(response.data);
        form.setFieldsValue({
          companyName: response.data.company_name,
          address: response.data.address,
          phone: response.data.phone,
          email: response.data.email,
          bankName: response.data.bank_name,
          accountNumber: response.data.account_number,
          ifscCode: response.data.ifsc_code,
          swiftCode: response.data.swift_code,
          authorizedSignatoryName: response.data.authorized_signatory_name,
          authorizedSignatoryDesignation: response.data.authorized_signatory_designation
        });
      }
    } catch {
      message.error('Failed to load company settings');
    }
  };

  const handleSaveSettings = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const response = await apiService.put('/company-settings', values);
      if (response.success) {
        message.success('Settings saved successfully');
        await loadSettings();
        await fetchProfile();
        // Mark onboarding step complete if all 3 required fields are filled
        if (values.companyName && values.address && values.phone) {
          apiService.post('/onboarding/complete', { stepId: 'company_profile' }).catch(() => {});
        }
      }
    } catch {
      message.error('Failed to save settings');
    } finally { setLoading(false); }
  };

  const handleFileUpload = async (fileType, file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      setLoading(true);
      const response = await apiService.post(`/company-settings/upload/${fileType}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (response.success) { message.success(`${fileType} uploaded successfully`); await loadSettings(); }
    } catch {
      message.error(`Failed to upload ${fileType}`);
    } finally { setLoading(false); }
    return false;
  };

  const handleFileDelete = async (fileType) => {
    try {
      setLoading(true);
      const response = await apiService.delete(`/company-settings/upload/${fileType}`);
      if (response.success) { message.success(`${fileType} deleted successfully`); await loadSettings(); }
    } catch {
      message.error(`Failed to delete ${fileType}`);
    } finally { setLoading(false); }
  };

  const getImageUrl = (path) => path ? `http://localhost:5000${path}?t=${Date.now()}` : null;

  const UploadCard = ({ type, path, title, description, icon }) => (
    <Card
      style={{
        ...sectionCard,
        textAlign: 'center',
        background: path ? '#f6ffed' : '#fafafa',
        border: path ? '1.5px solid #b7eb8f' : '1.5px dashed #d9d9d9',
        transition: 'all 0.3s'
      }}
      bodyStyle={{ padding: '20px 16px' }}
    >
      <div style={{ marginBottom: 10 }}>
        {path ? (
          <Badge count={<CheckCircleFilled style={{ color: '#52c41a', fontSize: 16 }} />} offset={[-4, 4]}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'linear-gradient(135deg, #52c41a22, #52c41a44)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto', fontSize: 22, color: '#52c41a'
            }}>
              {icon}
            </div>
          </Badge>
        ) : (
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1677ff15, #1677ff30)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto', fontSize: 22, color: '#1677ff'
          }}>
            {icon}
          </div>
        )}
      </div>

      <Text strong style={{ display: 'block', marginBottom: 4 }}>{title}</Text>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>{description}</Text>

      {path ? (
        <>
          <Image
            key={path}
            src={getImageUrl(path)}
            alt={title}
            style={{ maxWidth: '100%', maxHeight: 100, borderRadius: 6, marginBottom: 12 }}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          />
          <br />
          <Button danger size="small" icon={<DeleteOutlined />} onClick={() => handleFileDelete(type)} loading={loading}>
            Remove
          </Button>
        </>
      ) : (
        <Upload beforeUpload={(file) => handleFileUpload(type, file)} showUploadList={false} accept="image/*">
          <Button type="dashed" icon={<UploadOutlined />} loading={loading} style={{ borderRadius: 8 }}>
            Upload {title}
          </Button>
        </Upload>
      )}
    </Card>
  );

  const settingsTab = (
    <>
      {/* Company Info Section */}
      <Card
        style={sectionCard}
        title={
          <span style={{ color: '#1677ff' }}>
            <ShopOutlined style={{ marginRight: 8 }} />Company Information
          </span>
        }
        extra={<Tag color="blue">General</Tag>}
      >
        <Form form={form} layout="vertical">
          <Row gutter={20}>
            <Col xs={24} sm={12}>
              <Form.Item name="companyName" label={<>{labelIcon(<ShopOutlined />, '#1677ff')}Company Name</>}
                rules={[{ required: true, message: 'Company name is required' }]}>
                <Input placeholder="Enter company name" size="large" style={{ borderRadius: 8 }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="email" label={<>{labelIcon(<MailOutlined />, '#722ed1')}Email</>}
                rules={[{ required: true, message: 'Email is required' }, { type: 'email', message: 'Please enter valid email' }]}>
                <Input placeholder="info@company.com" size="large" style={{ borderRadius: 8 }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="phone" label={<>{labelIcon(<PhoneOutlined />, '#13c2c2')}Phone</>}
                rules={[{ required: true, message: 'Phone number is required' }]}>
                <Input placeholder="+1-000-000-0000" size="large" style={{ borderRadius: 8 }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="address" label={<>{labelIcon(<EnvironmentOutlined />, '#fa8c16')}Address</>}
                rules={[{ required: true, message: 'Address is required' }]}>
                <Input placeholder="Company Address, City, State" size="large" style={{ borderRadius: 8 }} />
              </Form.Item>
            </Col>
          </Row>

          {/* Signatory Section */}
          <Divider orientation="left" style={{ color: '#595959', fontSize: 13 }}>
            <UserOutlined style={{ marginRight: 6, color: '#52c41a' }} />Authorized Signatory
          </Divider>
          <Row gutter={20}>
            <Col xs={24} sm={12}>
              <Form.Item name="authorizedSignatoryName" label={<>{labelIcon(<UserOutlined />, '#52c41a')}Signatory Name</>}>
                <Input placeholder="Enter signatory name" size="large" style={{ borderRadius: 8 }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="authorizedSignatoryDesignation" label={<>{labelIcon(<UserOutlined />, '#52c41a')}Designation</>}>
                <Input placeholder="e.g., CEO, Director" size="large" style={{ borderRadius: 8 }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* Bank Details Section */}
      <Card
        style={sectionCard}
        title={
          <span style={{ color: '#fa8c16' }}>
            <BankOutlined style={{ marginRight: 8 }} />Bank Details
          </span>
        }
        extra={<Tag color="orange">Financial</Tag>}
      >
        <Form form={form} layout="vertical">
          <Row gutter={20}>
            <Col xs={24} sm={12}>
              <Form.Item name="bankName" label={<>{labelIcon(<BankOutlined />, '#fa8c16')}Bank Name</>}>
                <Input placeholder="Enter bank name" size="large" style={{ borderRadius: 8 }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="accountNumber" label="Account Number">
                <Input placeholder="Enter account number" size="large" style={{ borderRadius: 8 }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="ifscCode" label="IFSC Code">
                <Input placeholder="Enter IFSC code" size="large" style={{ borderRadius: 8 }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="swiftCode" label="SWIFT Code">
                <Input placeholder="Enter SWIFT code (international)" size="large" style={{ borderRadius: 8 }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Button
        type="primary"
        icon={<SaveOutlined />}
        onClick={handleSaveSettings}
        loading={loading}
        size="large"
        style={{
          borderRadius: 10, height: 44, paddingInline: 32,
          background: 'linear-gradient(90deg, #1677ff, #4096ff)',
          boxShadow: '0 4px 12px rgba(22,119,255,0.35)',
          marginBottom: 24
        }}
      >
        Save Settings
      </Button>

      {/* Documents Section */}
      <Card
        style={sectionCard}
        title={
          <span style={{ color: '#722ed1' }}>
            <FileImageOutlined style={{ marginRight: 8 }} />Invoice Documents
          </span>
        }
        extra={<Tag color="purple">Branding</Tag>}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
          Upload logo, stamp, and signature for professional invoices (Max 5MB · PNG / JPG / SVG)
        </Text>
        <Row gutter={[20, 20]}>
          <Col xs={24} sm={8}>
            <UploadCard type="logo" path={settings.logo_path} title="Company Logo"
              description="Appears at top of invoice" icon={<ShopOutlined />} />
          </Col>
          <Col xs={24} sm={8}>
            <UploadCard type="stamp" path={settings.stamp_path} title="Company Stamp"
              description="Official company seal" icon={<CameraOutlined />} />
          </Col>
          <Col xs={24} sm={8}>
            <UploadCard type="signature" path={settings.signature_path} title="Authorized Signature"
              description="Signatory's signature" icon={<UserOutlined />} />
          </Col>
        </Row>
      </Card>

      {/* Tips */}
      <div style={{
        background: 'linear-gradient(135deg, #fffbe6, #fff7e6)',
        border: '1px solid #ffe58f', borderRadius: 12, padding: '16px 20px'
      }}>
        <Text strong style={{ color: '#d48806', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <BulbOutlined /> Tips for Best Results
        </Text>
        <Row gutter={[12, 6]}>
          {[
            ['Logo', 'Transparent PNG · 200×80 px'],
            ['Stamp', 'Transparent PNG · circular · 150×150 px'],
            ['Signature', 'Transparent PNG · 200×80 px'],
            ['Quality', 'Use 300 DPI for crisp print output']
          ].map(([label, tip]) => (
            <Col xs={24} sm={12} key={label}>
              <Text style={{ fontSize: 13 }}>
                <Tag color="gold" style={{ marginRight: 6 }}>{label}</Tag>{tip}
              </Text>
            </Col>
          ))}
        </Row>
      </div>
    </>
  );

  return (
    <div style={{ padding: '16px 20px', background: '#f5f7fa', minHeight: '100vh' }}>
      {/* Hero Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1677ff 0%, #4096ff 50%, #69b1ff 100%)',
        borderRadius: 16, padding: '28px 32px', marginBottom: 24,
        boxShadow: '0 8px 24px rgba(22,119,255,0.25)', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: -30, right: -30, width: 160, height: 160,
          borderRadius: '50%', background: 'rgba(255,255,255,0.08)'
        }} />
        <div style={{
          position: 'absolute', bottom: -20, right: 80, width: 100, height: 100,
          borderRadius: '50%', background: 'rgba(255,255,255,0.06)'
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, color: '#fff', flexShrink: 0
          }}>
            <ShopOutlined />
          </div>
          <div>
            <Title level={3} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>
              Company Settings
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 14 }}>
              Manage your company profile, bank details, and invoice branding
            </Text>
          </div>
        </div>
      </div>

      <Card style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: 'none' }}>
        <Tabs
          defaultActiveKey="1"
          size="large"
          items={[
            {
              key: '1',
              label: <span><SaveOutlined style={{ marginRight: 6 }} />Settings</span>,
              children: settingsTab
            },
            {
              key: '2',
              label: <span><EyeOutlined style={{ marginRight: 6 }} />Preview</span>,
              children: <InvoicePreview />
            }
          ]}
        />
      </Card>
    </div>
  );
};

export default CompanySettings;
