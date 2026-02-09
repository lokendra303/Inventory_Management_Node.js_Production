import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Upload,
  message,
  Space,
  Image,
  Typography,
  Row,
  Col,
  Divider,
  Tabs
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  SaveOutlined,
  EyeOutlined
} from '@ant-design/icons';
import apiService from '../services/apiService';
import InvoicePreview from '../components/InvoicePreview';

const { Title, Text } = Typography;

const CompanySettings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({});
  const [logoFile, setLogoFile] = useState(null);
  const [stampFile, setStampFile] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await apiService.get('/company-settings');
      if (response.success && response.data) {
        console.log('Loaded settings:', response.data);
        setSettings(response.data);
        form.setFieldsValue({
          companyName: response.data.company_name,
          address: response.data.address,
          phone: response.data.phone,
          email: response.data.email,
          authorizedSignatoryName: response.data.authorized_signatory_name,
          authorizedSignatoryDesignation: response.data.authorized_signatory_designation
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
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
        loadSettings();
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      message.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (fileType, file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const response = await apiService.post(
        `/company-settings/upload/${fileType}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.success) {
        message.success(`${fileType} uploaded successfully`);
        await loadSettings();
      }
    } catch (error) {
      console.error(`Error uploading ${fileType}:`, error);
      message.error(`Failed to upload ${fileType}`);
    } finally {
      setLoading(false);
    }

    return false; // Prevent default upload behavior
  };

  const handleFileDelete = async (fileType) => {
    try {
      setLoading(true);
      const response = await apiService.delete(`/company-settings/upload/${fileType}`);
      
      if (response.success) {
        message.success(`${fileType} deleted successfully`);
        await loadSettings();
      }
    } catch (error) {
      console.error(`Error deleting ${fileType}:`, error);
      message.error(`Failed to delete ${fileType}`);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (path) => {
    if (!path) return null;
    return `http://localhost:5000${path}?t=${Date.now()}`;
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Title level={3}>Company Settings</Title>
        <Text type="secondary">
          Configure your company information, logo, stamp, and signature for invoices
        </Text>

        <Divider />

        <Tabs
          defaultActiveKey="1"
          items={[
            {
              key: '1',
              label: (
                <span>
                  <SaveOutlined /> Settings
                </span>
              ),
              children: (
                <>
                  <Form form={form} layout="vertical">
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name="companyName"
                          label="Company Name"
                          rules={[{ required: true, message: 'Please enter company name' }]}
                        >
                          <Input placeholder="Enter company name" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="email"
                          label="Email"
                          rules={[{ type: 'email', message: 'Please enter valid email' }]}
                        >
                          <Input placeholder="info@company.com" />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name="phone"
                          label="Phone"
                        >
                          <Input placeholder="+1-000-000-0000" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="address"
                          label="Address"
                        >
                          <Input placeholder="Company Address, City, State" />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name="authorizedSignatoryName"
                          label="Authorized Signatory Name"
                        >
                          <Input placeholder="Enter signatory name" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="authorizedSignatoryDesignation"
                          label="Authorized Signatory Designation"
                        >
                          <Input placeholder="Enter designation (e.g., CEO, Director)" />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={handleSaveSettings}
                      loading={loading}
                    >
                      Save Settings
                    </Button>
                  </Form>

                  <Divider />

                  <Title level={4}>Invoice Documents</Title>
                  <Text type="secondary">
                    Upload logo, stamp, and signature for professional invoices (Max 5MB, PNG/JPG/SVG)
                  </Text>

                  <Row gutter={24} style={{ marginTop: 24 }}>
                    {/* Logo Upload */}
                    <Col span={8}>
                      <Card size="small" title="Company Logo">
                        {settings.logo_path ? (
                          <div style={{ textAlign: 'center' }}>
                            <Image
                              key={settings.logo_path}
                              src={getImageUrl(settings.logo_path)}
                              alt="Company Logo"
                              style={{ maxWidth: '100%', maxHeight: 150 }}
                              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                            />
                            <div style={{ marginTop: 16 }}>
                              <Button
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => handleFileDelete('logo')}
                                loading={loading}
                              >
                                Remove Logo
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Upload
                            beforeUpload={(file) => handleFileUpload('logo', file)}
                            showUploadList={false}
                            accept="image/*"
                          >
                            <Button icon={<UploadOutlined />} loading={loading}>
                              Upload Logo
                            </Button>
                          </Upload>
                        )}
                        <div style={{ marginTop: 8 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Appears at top of invoice
                          </Text>
                        </div>
                      </Card>
                    </Col>

                    {/* Stamp Upload */}
                    <Col span={8}>
                      <Card size="small" title="Company Stamp">
                        {settings.stamp_path ? (
                          <div style={{ textAlign: 'center' }}>
                            <Image
                              key={settings.stamp_path}
                              src={getImageUrl(settings.stamp_path)}
                              alt="Company Stamp"
                              style={{ maxWidth: '100%', maxHeight: 150 }}
                              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                            />
                            <div style={{ marginTop: 16 }}>
                              <Button
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => handleFileDelete('stamp')}
                                loading={loading}
                              >
                                Remove Stamp
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Upload
                            beforeUpload={(file) => handleFileUpload('stamp', file)}
                            showUploadList={false}
                            accept="image/*"
                          >
                            <Button icon={<UploadOutlined />} loading={loading}>
                              Upload Stamp
                            </Button>
                          </Upload>
                        )}
                        <div style={{ marginTop: 8 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Official company seal
                          </Text>
                        </div>
                      </Card>
                    </Col>

                    {/* Signature Upload */}
                    <Col span={8}>
                      <Card size="small" title="Authorized Signature">
                        {settings.signature_path ? (
                          <div style={{ textAlign: 'center' }}>
                            <Image
                              key={settings.signature_path}
                              src={getImageUrl(settings.signature_path)}
                              alt="Signature"
                              style={{ maxWidth: '100%', maxHeight: 150 }}
                              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                            />
                            <div style={{ marginTop: 16 }}>
                              <Button
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => handleFileDelete('signature')}
                                loading={loading}
                              >
                                Remove Signature
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Upload
                            beforeUpload={(file) => handleFileUpload('signature', file)}
                            showUploadList={false}
                            accept="image/*"
                          >
                            <Button icon={<UploadOutlined />} loading={loading}>
                              Upload Signature
                            </Button>
                          </Upload>
                        )}
                        <div style={{ marginTop: 8 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Signatory's signature
                          </Text>
                        </div>
                      </Card>
                    </Col>
                  </Row>

                  <Divider />

                  <div style={{ backgroundColor: '#f0f2f5', padding: 16, borderRadius: 4 }}>
                    <Title level={5}>Tips for Best Results:</Title>
                    <ul>
                      <li>Logo: Use transparent PNG (recommended size: 200x80 pixels)</li>
                      <li>Stamp: Use transparent PNG with circular design (recommended size: 150x150 pixels)</li>
                      <li>Signature: Use transparent PNG or white background (recommended size: 200x80 pixels)</li>
                      <li>All images will be automatically resized to fit the invoice layout</li>
                      <li>For print quality, use high-resolution images (300 DPI)</li>
                    </ul>
                  </div>
                </>
              )
            },
            {
              key: '2',
              label: (
                <span>
                  <EyeOutlined /> Preview
                </span>
              ),
              children: <InvoicePreview />
            }
          ]}
        />
      </Card>
    </div>
  );
};

export default CompanySettings;
