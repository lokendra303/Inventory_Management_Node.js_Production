import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Upload,
  message,
  Typography,
  Row,
  Col,
  Divider,
  Tabs,
  Space,
  Alert,
  Table,
  Modal,
  Switch,
  Image,
  Popconfirm,
  Spin,
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  SaveOutlined,
  EyeOutlined,
  ShopOutlined,
  FileImageOutlined,
  PlusOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import apiService from '../../services/apiService';
import { mediaUrl } from '../../config/appConfig';
import InvoicePreview from '../../components/business/InvoicePreview';
import InvoicePdfTemplateTiles from '../../components/business/InvoicePdfTemplateTiles';
import { PanFormField } from '../../components/entities/PanFormField';
import { useAuth } from '../../hooks/useAuth.jsx';
import { INVOICE_PDF_TEMPLATES } from '../../constants/invoicePdfTemplates';
import './CompanySettings.css';

const { Title, Text, Paragraph } = Typography;

const DEFAULT_PDF_FOOTER_OPTIONS = {
  si: { stamp: true, signature: true },
  pi: { stamp: true, signature: true },
  so: { stamp: true, signature: true },
  po: { stamp: true, signature: true },
};

const PDF_FOOTER_DOC_ROWS = [
  { key: 'si', label: 'Sales Invoice (SI)' },
  { key: 'pi', label: 'Purchase Invoice (PI)' },
  { key: 'so', label: 'Sales Order (SO)' },
  { key: 'po', label: 'Purchase Order (PO)' },
];

const CompanySettings = () => {
  const { fetchProfile } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({});
  const [activeTab, setActiveTab] = useState('settings');
  const [addrModal, setAddrModal] = useState({ open: false, record: null });
  const [addrForm] = Form.useForm();
  const [stampLabel, setStampLabel] = useState('');
  const [sigLabel, setSigLabel] = useState('');
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState('');
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const watchedInvoiceTemplate = Form.useWatch('invoicePdfTemplate', form);

  const loadSettings = useCallback(async () => {
    try {
      const response = await apiService.get('/company-settings');
      if (response.success && response.data) {
        setSettings(response.data);
        form.setFieldsValue({
          companyName: response.data.company_name,
          address: response.data.address || '',
          phone: response.data.phone,
          email: response.data.email,
          taxId: (response.data.tax_id || '').toUpperCase(),
          pan: (response.data.pan || '').toUpperCase(),
          cin: (response.data.cin || '').toUpperCase(),
          tan: (response.data.tan || '').toUpperCase(),
          website: response.data.website || '',
          bankName: response.data.bank_name,
          accountHolderName: response.data.account_holder_name || '',
          accountNumber: response.data.account_number,
          ifscCode: response.data.ifsc_code,
          branchName: response.data.branch_name || '',
          swiftCode: response.data.swift_code,
          authorizedSignatoryName: response.data.authorized_signatory_name,
          authorizedSignatoryDesignation: response.data.authorized_signatory_designation,
          invoicePdfTemplate: response.data.invoice_pdf_template || 'branded',
          pdfFooterOptions: {
            ...DEFAULT_PDF_FOOTER_OPTIONS,
            ...(response.data.pdf_footer_options || {}),
          },
        });
      }
    } catch {
      message.error('Failed to load company settings');
    }
  }, [form]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const closeInvoicePdfPreview = useCallback(() => {
    setPdfPreviewOpen(false);
    setPdfPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPdfPreviewLoading(false);
  }, []);

  const openInvoicePdfPreview = useCallback(
    async (template) => {
      const meta = INVOICE_PDF_TEMPLATES.find((x) => x.id === template);
      setPdfPreviewTitle(meta ? `Sample PDF — ${meta.name}` : 'Sample PDF');
      setPdfPreviewOpen(true);
      setPdfPreviewLoading(true);
      setPdfPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      try {
        const res = await apiService.get(`/company-settings/invoice-pdf-preview/${template}`, { responseType: 'blob' });
        const blob = res.data;
        if (!blob || blob.size < 64 || (blob.type && blob.type.includes('json'))) {
          message.error('Preview failed');
          closeInvoicePdfPreview();
          return;
        }
        setPdfPreviewUrl(URL.createObjectURL(blob));
      } catch (e) {
        message.error(e.response?.data?.error || e.userMessage || 'Could not load PDF preview');
        closeInvoicePdfPreview();
      } finally {
        setPdfPreviewLoading(false);
      }
    },
    [closeInvoicePdfPreview]
  );

  const handleSaveSettings = async () => {
    try {
      const values = await form.validateFields();
      if (values.taxId) {
        values.taxId = String(values.taxId).trim().toUpperCase();
      }
      if (values.pan) {
        values.pan = String(values.pan).trim().toUpperCase();
      }
      if (values.cin) {
        values.cin = String(values.cin).trim().toUpperCase();
      }
      if (values.tan) {
        values.tan = String(values.tan).trim().toUpperCase();
      }
      setLoading(true);
      const response = await apiService.put('/company-settings', values);
      if (response.success) {
        message.success('Company settings saved');
        await loadSettings();
        setPreviewRefreshKey((k) => k + 1);
        await fetchProfile();
        if (values.companyName && values.address && values.phone) {
          apiService.post('/onboarding/complete', { stepId: 'company_profile' }).catch(() => {});
        }
      }
    } catch (e) {
      if (e?.errorFields) return;
      message.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const openAddrModal = (record = null) => {
    setAddrModal({ open: true, record });
    if (record) {
      addrForm.setFieldsValue({
        label: record.label,
        address: record.address,
        is_default: !!record.is_default,
      });
    } else {
      addrForm.resetFields();
      addrForm.setFieldsValue({ is_default: false });
    }
  };

  const saveAddrModal = async () => {
    try {
      const v = await addrForm.validateFields();
      setLoading(true);
      if (addrModal.record) {
        const res = await apiService.put(`/company-settings/addresses/${addrModal.record.id}`, v);
        if (!res.success) throw new Error(res.error);
        message.success('Address updated');
      } else {
        const res = await apiService.post('/company-settings/addresses', v);
        if (!res.success) throw new Error(res.error);
        message.success('Address added');
      }
      setAddrModal({ open: false, record: null });
      await loadSettings();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.message || e.response?.data?.error || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const deleteAddress = async (id) => {
    try {
      setLoading(true);
      const res = await apiService.delete(`/company-settings/addresses/${id}`);
      if (!res.success) throw new Error(res.error);
      message.success('Removed');
      await loadSettings();
    } catch (e) {
      message.error(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const setStampDefault = async (id) => {
    try {
      setLoading(true);
      const res = await apiService.patch(`/company-settings/stamps/${id}`, { is_default: true });
      if (!res.success) throw new Error(res.error);
      await loadSettings();
    } catch (e) {
      message.error(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStampLabel = async (id, label) => {
    try {
      const res = await apiService.patch(`/company-settings/stamps/${id}`, { label });
      if (!res.success) throw new Error(res.error);
      await loadSettings();
    } catch (e) {
      message.error(e.response?.data?.error || e.message);
    }
  };

  const deleteStamp = async (id) => {
    try {
      setLoading(true);
      const res = await apiService.delete(`/company-settings/stamps/${id}`);
      if (!res.success) throw new Error(res.error);
      message.success('Stamp removed');
      await loadSettings();
    } catch (e) {
      message.error(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const setSigDefault = async (id) => {
    try {
      setLoading(true);
      const res = await apiService.patch(`/company-settings/signatures/${id}`, { is_default: true });
      if (!res.success) throw new Error(res.error);
      await loadSettings();
    } catch (e) {
      message.error(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const updateSigLabel = async (id, label) => {
    try {
      const res = await apiService.patch(`/company-settings/signatures/${id}`, { label });
      if (!res.success) throw new Error(res.error);
      await loadSettings();
    } catch (e) {
      message.error(e.response?.data?.error || e.message);
    }
  };

  const deleteSig = async (id) => {
    try {
      setLoading(true);
      const res = await apiService.delete(`/company-settings/signatures/${id}`);
      if (!res.success) throw new Error(res.error);
      message.success('Signature removed');
      await loadSettings();
    } catch (e) {
      message.error(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadStamp = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    if (stampLabel.trim()) fd.append('label', stampLabel.trim());
    try {
      setLoading(true);
      const res = await apiService.post('/company-settings/upload/stamp', fd);
      if (res.success) {
        message.success('Stamp added');
        setStampLabel('');
        await loadSettings();
      } else message.error(res.error || 'Upload failed');
    } catch {
      message.error('Upload failed');
    } finally {
      setLoading(false);
    }
    return false;
  };

  const uploadSignature = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    if (sigLabel.trim()) fd.append('label', sigLabel.trim());
    try {
      setLoading(true);
      const res = await apiService.post('/company-settings/upload/signature', fd);
      if (res.success) {
        message.success('Signature added');
        setSigLabel('');
        await loadSettings();
      } else message.error(res.error || 'Upload failed');
    } catch {
      message.error('Upload failed');
    } finally {
      setLoading(false);
    }
    return false;
  };

  const uploadLogo = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      setLoading(true);
      const res = await apiService.post('/company-settings/upload/logo', fd);
      if (res.success) {
        message.success('Logo updated');
        await loadSettings();
      } else message.error(res.error || 'Upload failed');
    } catch {
      message.error('Upload failed');
    } finally {
      setLoading(false);
    }
    return false;
  };

  const deleteLogo = async () => {
    try {
      setLoading(true);
      const res = await apiService.delete('/company-settings/upload/logo');
      if (res.success) {
        message.success('Logo removed');
        await loadSettings();
      }
    } catch {
      message.error('Failed');
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (p) => mediaUrl(p, { cacheBust: true });

  const addresses = settings.addresses || [];
  const stamps = settings.stamps || [];
  const signatures = settings.signatures || [];

  const addrColumns = [
    { title: 'Label', dataIndex: 'label', key: 'l', width: 160 },
    {
      title: 'Address',
      dataIndex: 'address',
      key: 'a',
      ellipsis: true,
      render: (t) => <span style={{ whiteSpace: 'pre-wrap' }}>{t}</span>,
    },
    {
      title: 'Default for invoices',
      dataIndex: 'is_default',
      key: 'd',
      width: 160,
      render: (v) => (v ? <Text type="success">Yes</Text> : <Text type="secondary">No</Text>),
    },
    {
      title: '',
      key: 'x',
      width: 140,
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" onClick={() => openAddrModal(r)}>Edit</Button>
          <Popconfirm title="Remove this address?" onConfirm={() => deleteAddress(r.id)}>
            <Button type="link" size="small" danger>Remove</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const settingsPanel = (
    <Form form={form} layout="vertical" requiredMark="optional" initialValues={{ invoicePdfTemplate: 'branded' }}>
      <Card size="small" title="Company" styles={{ header: { fontWeight: 600 } }}>
        <Paragraph type="secondary" style={{ marginTop: 0, marginBottom: 16 }}>
          Legal name and contact details used on invoices and PDFs.
        </Paragraph>
        <Row gutter={[20, 0]}>
          <Col xs={24} md={12}>
            <Form.Item name="companyName" label="Registered company name" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="As on tax registration" allowClear />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="email"
              label="Company email"
              rules={[{ required: true, message: 'Required' }, { type: 'email', message: 'Invalid email' }]}
            >
              <Input allowClear />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="phone" label="Phone" rules={[{ required: true, message: 'Required' }]}>
              <Input allowClear />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="taxId"
              label="GSTIN / Tax ID"
              extra="Shown on invoice PDF header and seller block (GSTIN/UIN)."
              normalize={(value) => (value ? String(value).trim().toUpperCase() : value)}
            >
              <Input
                placeholder="e.g. 27AAAAA0000A1Z5"
                allowClear
                maxLength={15}
                style={{ textTransform: 'uppercase' }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <PanFormField name="pan" extra="Shown on invoices and purchase order PDF footers." />
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="cin"
              label="CIN"
              extra="Corporate Identification Number (company registration)."
              normalize={(value) => (value ? String(value).trim().toUpperCase() : value)}
            >
              <Input placeholder="e.g. U12345MH2020PTC123456" allowClear maxLength={21} style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="tan"
              label="TAN"
              extra="Tax Deduction Account Number (optional)."
              normalize={(value) => (value ? String(value).trim().toUpperCase() : value)}
            >
              <Input placeholder="e.g. MUMB12345A" allowClear maxLength={10} style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="website" label="Website" rules={[{ type: 'url', message: 'Enter a valid URL (https://…)' }]}>
              <Input placeholder="https://www.example.com" allowClear />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              name="address"
              label="Default invoice address"
              rules={[{ required: true, message: 'Enter at least one address (or add rows below and sync here)' }]}
              extra="This line is kept in sync with the address marked default in the table below."
            >
              <Input.TextArea rows={3} placeholder="Shown on invoice header when you use the default location" showCount maxLength={500} />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Card
        size="small"
        title={(
          <Space>
            <EnvironmentOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />
            <span>All locations & addresses</span>
          </Space>
        )}
        style={{ marginTop: 16 }}
        styles={{ header: { fontWeight: 600 } }}
        extra={(
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openAddrModal(null)}>
            Add address
          </Button>
        )}
      >
        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          Register branches, warehouses, or billing offices. Mark one as default for invoices (also updates the field above on save).
        </Paragraph>
        <Table rowKey="id" size="small" pagination={false} dataSource={addresses} columns={addrColumns} locale={{ emptyText: 'No saved addresses yet' }} />
      </Card>

      <Card size="small" title="Authorized signatory" style={{ marginTop: 16 }} styles={{ header: { fontWeight: 600 } }}>
        <Row gutter={[20, 0]}>
          <Col xs={24} md={12}>
            <Form.Item name="authorizedSignatoryName" label="Name">
              <Input allowClear />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="authorizedSignatoryDesignation" label="Title">
              <Input placeholder="Director, Partner, …" allowClear />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Card size="small" title="Bank details" style={{ marginTop: 16 }} styles={{ header: { fontWeight: 600 } }}>
        <Paragraph type="secondary" style={{ marginTop: 0, marginBottom: 16 }}>
          Optional. Used on invoice PDF footers. Account holder is separate from registered company name.
        </Paragraph>
        <Row gutter={[20, 0]}>
          <Col xs={24} md={12}>
            <Form.Item
              name="accountHolderName"
              label="Account holder name"
              extra="Legal name on the bank account (may differ from company name)."
            >
              <Input placeholder="As per bank records" allowClear />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="bankName" label="Bank name"><Input allowClear /></Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="accountNumber" label="Account number"><Input allowClear /></Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="branchName" label="Branch"><Input allowClear /></Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="ifscCode" label="IFSC"><Input allowClear /></Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="swiftCode" label="SWIFT / BIC"><Input allowClear /></Form.Item>
          </Col>
        </Row>
      </Card>

      <Card
        size="small"
        title={(
          <Space>
            <FileTextOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />
            <span>Invoice PDF layout</span>
          </Space>
        )}
        style={{ marginTop: 16 }}
        styles={{ header: { fontWeight: 600 } }}
      >
        <Paragraph type="secondary" style={{ marginTop: 0, marginBottom: 12 }}>
          Applies to sales and purchase invoice PDF downloads. Pick a style, preview a sample with your logo and company details, then save.
        </Paragraph>
        <Form.Item
          name="invoicePdfTemplate"
          label="Template"
          rules={[{ required: true, message: 'Select a template' }]}
        >
          <InvoicePdfTemplateTiles onPreviewPdf={openInvoicePdfPreview} />
        </Form.Item>
      </Card>

      <Card
        size="small"
        title="Stamp & signature on PDFs"
        style={{ marginTop: 16 }}
        styles={{ header: { fontWeight: 600 } }}
      >
        <Paragraph type="secondary" style={{ marginTop: 0, marginBottom: 12 }}>
          Choose which documents include your default stamp and signature. Upload files below; turn off per document type as needed.
        </Paragraph>
        <Table
          size="small"
          pagination={false}
          rowKey="key"
          dataSource={PDF_FOOTER_DOC_ROWS}
          columns={[
            { title: 'Document', dataIndex: 'label', key: 'label' },
            {
              title: 'Stamp',
              key: 'stamp',
              width: 100,
              align: 'center',
              render: (_, row) => (
                <Form.Item
                  name={['pdfFooterOptions', row.key, 'stamp']}
                  valuePropName="checked"
                  style={{ margin: 0 }}
                >
                  <Switch size="small" />
                </Form.Item>
              ),
            },
            {
              title: 'Signature',
              key: 'signature',
              width: 100,
              align: 'center',
              render: (_, row) => (
                <Form.Item
                  name={['pdfFooterOptions', row.key, 'signature']}
                  valuePropName="checked"
                  style={{ margin: 0 }}
                >
                  <Switch size="small" />
                </Form.Item>
              ),
            },
          ]}
        />
      </Card>

      <Divider style={{ margin: '24px 0 16px' }} />

      <div style={{ fontWeight: 600, marginBottom: 8 }}>
        <FileImageOutlined style={{ marginRight: 8, color: 'rgba(0,0,0,0.45)' }} />
        Logo
      </div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space align="start" wrap size="large">
          {settings.logo_path ? (
            <Image src={getImageUrl(settings.logo_path)} alt="Logo" height={72} style={{ objectFit: 'contain' }} />
          ) : (
            <Text type="secondary">No logo</Text>
          )}
          <Space direction="vertical">
            <Upload beforeUpload={uploadLogo} showUploadList={false} accept="image/png,image/jpeg,image/jpg,image/svg+xml">
              <Button icon={<UploadOutlined />} loading={loading}>Upload / replace</Button>
            </Upload>
            {settings.logo_path && (
              <Popconfirm title="Remove logo?" onConfirm={deleteLogo}>
                <Button danger type="text" size="small" icon={<DeleteOutlined />}>Remove</Button>
              </Popconfirm>
            )}
          </Space>
        </Space>
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Stamps</div>
          <Paragraph type="secondary" style={{ fontSize: 12 }}>Multiple seals; choose which one is used on new PDFs.</Paragraph>
          <Space wrap style={{ marginBottom: 12 }}>
            <Input style={{ width: 160 }} placeholder="Label (optional)" value={stampLabel} onChange={(e) => setStampLabel(e.target.value)} />
            <Upload beforeUpload={uploadStamp} showUploadList={false} accept="image/*">
              <Button icon={<UploadOutlined />} loading={loading}>Add stamp</Button>
            </Upload>
          </Space>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {stamps.map((s) => (
              <Card key={s.id} size="small" type={s.is_default ? 'inner' : undefined}>
                <Space wrap align="start">
                  <Image src={getImageUrl(s.file_path)} alt={s.label} width={72} height={72} style={{ objectFit: 'contain' }} />
                  <Space direction="vertical" size={4}>
                    <Input
                      defaultValue={s.label}
                      size="small"
                      style={{ width: 200 }}
                      onBlur={(e) => {
                        if (e.target.value !== s.label) updateStampLabel(s.id, e.target.value);
                      }}
                    />
                    <Space>
                      {!s.is_default && (
                        <Button size="small" onClick={() => setStampDefault(s.id)}>Set default</Button>
                      )}
                      {s.is_default && <Text type="success">Default for invoices</Text>}
                      <Popconfirm title="Delete this stamp file?" onConfirm={() => deleteStamp(s.id)}>
                        <Button size="small" danger type="text">Delete</Button>
                      </Popconfirm>
                    </Space>
                  </Space>
                </Space>
              </Card>
            ))}
            {stamps.length === 0 && <Text type="secondary">No stamps yet.</Text>}
          </Space>
        </Col>
        <Col xs={24} lg={12}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Signatures</div>
          <Paragraph type="secondary" style={{ fontSize: 12 }}>Multiple signatories or styles.</Paragraph>
          <Space wrap style={{ marginBottom: 12 }}>
            <Input style={{ width: 160 }} placeholder="Label (optional)" value={sigLabel} onChange={(e) => setSigLabel(e.target.value)} />
            <Upload beforeUpload={uploadSignature} showUploadList={false} accept="image/*">
              <Button icon={<UploadOutlined />} loading={loading}>Add signature</Button>
            </Upload>
          </Space>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {signatures.map((s) => (
              <Card key={s.id} size="small" type={s.is_default ? 'inner' : undefined}>
                <Space wrap align="start">
                  <Image src={getImageUrl(s.file_path)} alt={s.label} width={120} height={48} style={{ objectFit: 'contain' }} />
                  <Space direction="vertical" size={4}>
                    <Input
                      defaultValue={s.label}
                      size="small"
                      style={{ width: 200 }}
                      onBlur={(e) => {
                        if (e.target.value !== s.label) updateSigLabel(s.id, e.target.value);
                      }}
                    />
                    <Space>
                      {!s.is_default && (
                        <Button size="small" onClick={() => setSigDefault(s.id)}>Set default</Button>
                      )}
                      {s.is_default && <Text type="success">Default for invoices</Text>}
                      <Popconfirm title="Delete this signature?" onConfirm={() => deleteSig(s.id)}>
                        <Button size="small" danger type="text">Delete</Button>
                      </Popconfirm>
                    </Space>
                  </Space>
                </Space>
              </Card>
            ))}
            {signatures.length === 0 && <Text type="secondary">No signatures yet.</Text>}
          </Space>
        </Col>
      </Row>

      <Alert
        type="info"
        showIcon
        style={{ marginTop: 20 }}
        message="Default stamp and signature files are used when enabled above for each document type. Save changes after updating switches."
      />

      <Modal
        title={pdfPreviewTitle}
        open={pdfPreviewOpen}
        onCancel={closeInvoicePdfPreview}
        footer={null}
        width={960}
        destroyOnClose
        styles={{ body: { paddingTop: 8 } }}
      >
        {pdfPreviewLoading ? (
          <div style={{ height: 520, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spin size="large" tip="Generating sample PDF…" />
          </div>
        ) : pdfPreviewUrl ? (
          <iframe
            title="Invoice PDF preview"
            src={pdfPreviewUrl}
            style={{ width: '100%', height: '72vh', border: 'none', borderRadius: 4 }}
          />
        ) : null}
      </Modal>

      <Modal
        title={addrModal.record ? 'Edit address' : 'Add address'}
        open={addrModal.open}
        onCancel={() => setAddrModal({ open: false, record: null })}
        onOk={saveAddrModal}
        confirmLoading={loading}
        destroyOnClose
        width={520}
      >
        <Form form={addrForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="label" label="Label" rules={[{ required: true, message: 'e.g. Head office' }]}>
            <Input placeholder="Head office, Factory, …" />
          </Form.Item>
          <Form.Item name="address" label="Full address" rules={[{ required: true, message: 'Required' }]}>
            <Input.TextArea rows={4} placeholder="Street, city, state, postal code, country" />
          </Form.Item>
          <Form.Item name="is_default" label="Default for invoices" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Form>
  );

  return (
    <div className="company-settings" style={{ padding: '8px 0 32px' }}>
      <div className="company-settings__intro">
        <Title level={4} style={{ marginBottom: 4 }}>Company settings</Title>
        <Text type="secondary">
          Company profile, locations, banking, and invoice assets. Under <Text strong>Invoice PDF layout</Text>, click a
          template card (radio + &quot;Selected&quot;) — then click Save changes.
        </Text>
      </div>

      <Card bordered styles={{ body: { paddingTop: 8 } }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          tabBarExtraContent={
            activeTab === 'settings' ? (
              <Button type="primary" icon={<SaveOutlined />} loading={loading} onClick={handleSaveSettings}>
                Save changes
              </Button>
            ) : null
          }
          items={[
            {
              key: 'settings',
              label: (
                <span>
                  <ShopOutlined style={{ marginRight: 6 }} />
                  Details & branding
                </span>
              ),
              children: settingsPanel,
            },
            {
              key: 'preview',
              label: (
                <span>
                  <EyeOutlined style={{ marginRight: 6 }} />
                  Invoice preview
                </span>
              ),
              children: (
                <div style={{ paddingTop: 8 }}>
                  <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                    Two previews for the selected template — sales (SI) with Bill to and Ship to, and
                    purchase (PI) with vendor Bill to. Logo, company banner, and signature come from
                    Details &amp; branding. Save there, then refresh each preview.
                  </Paragraph>
                  <InvoicePreview
                    documentType="sales"
                    templateId={watchedInvoiceTemplate || settings.invoice_pdf_template || 'branded'}
                    refreshKey={`${previewRefreshKey}-si-${activeTab}`}
                  />
                  <InvoicePreview
                    documentType="purchase"
                    templateId={watchedInvoiceTemplate || settings.invoice_pdf_template || 'branded'}
                    refreshKey={`${previewRefreshKey}-pi-${activeTab}`}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default CompanySettings;
