import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Descriptions, Table, Button, Space, Tag, Spin, message, Modal, Form, Input, Row, Col,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import platformApi from '../services/platformApi';
import { institutionStatusLabel } from '../config/institutionDisplay';

const { Title } = Typography;

export default function PlatformTenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await platformApi.get(`/platform/institutions/${id}`);
        if (!cancelled && res.success) setPayload(res.data);
        else if (!cancelled) message.error(res.error || 'Not found');
      } catch (e) {
        if (!cancelled) message.error(e.response?.data?.error || e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const openEdit = () => {
    const inst = payload?.institution;
    if (!inst) return;
    form.setFieldsValue({
      name: inst.name,
      email: inst.email,
      mobile: inst.mobile || '',
      address: inst.address || '',
      city: inst.city || '',
      state: inst.state || '',
      country: inst.country || '',
      postal_code: inst.postal_code || '',
      website: inst.website || '',
      contact_person: inst.contact_person || '',
      plan: inst.plan || '',
      institution_type: inst.institution_type || '',
      registration_number: inst.registration_number || '',
      tax_id: inst.tax_id || '',
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await platformApi.patch(`/platform/institutions/${id}`, values);
      if (res.success && res.data) {
        message.success('Tenant updated');
        setPayload(res.data);
        setEditOpen(false);
      } else message.error(res.error || 'Update failed');
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status) => {
    try {
      const res = await platformApi.patch(`/platform/institutions/${id}/status`, { status });
      if (res.success) {
        message.success(`Tenant ${status === 'suspended' ? 'suspended' : 'activated'}`);
        const refreshed = await platformApi.get(`/platform/institutions/${id}`);
        if (refreshed.success) setPayload(refreshed.data);
      } else message.error(res.error);
    } catch (e) {
      message.error(e.response?.data?.error || e.message);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!payload?.institution) {
    return <Card>Tenant not found.</Card>;
  }

  const { institution, stats, subscription, users } = payload;
  const sub = subscription || {};

  return (
    <div>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/platform/tenants')} style={{ marginBottom: 8, paddingLeft: 0 }}>
        Back to tenants
      </Button>
      <Title level={3} style={{ marginTop: 0 }}>{institution.name}</Title>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="ID">{institution.id}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={institution.status === 'active' ? 'green' : 'red'}>{institutionStatusLabel(institution.status)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Email">{institution.email}</Descriptions.Item>
          <Descriptions.Item label="Plan">{sub.plan_name || institution.plan || '—'}</Descriptions.Item>
          <Descriptions.Item label="Subscription">{sub.status || '—'}</Descriptions.Item>
          <Descriptions.Item label="City / Country">{institution.city || '—'} / {institution.country || '—'}</Descriptions.Item>
        </Descriptions>
        <Space style={{ marginTop: 16 }} wrap>
          <Button icon={<EditOutlined />} onClick={openEdit}>Edit tenant</Button>
          {institution.status === 'active' ? (
            <Button danger onClick={() => setStatus('suspended')}>Suspend tenant</Button>
          ) : (
            <Button type="primary" onClick={() => setStatus('active')}>Activate tenant</Button>
          )}
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          Suspending blocks tenant login. Data is not deleted.
        </Typography.Paragraph>
      </Card>

      <RowCards stats={stats} />

      <Modal
        title="Edit tenant"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={saveEdit}
        confirmLoading={saving}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Required' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Required' }, { type: 'email' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="mobile" label="Mobile">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="contact_person" label="Contact person">
                <Input />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="address" label="Address">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="city" label="City">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="state" label="State">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="postal_code" label="Postal code">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="country" label="Country">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="website" label="Website">
                <Input placeholder="https://…" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="plan" label="Plan label (institution)">
                <Input placeholder="e.g. starter, standard" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="institution_type" label="Institution type">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="registration_number" label="Registration #">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="tax_id" label="Tax ID">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Card title={`Users (${users?.length || 0})`}>
        <Table
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
          dataSource={users || []}
          columns={[
            { title: 'Email', dataIndex: 'email', key: 'email' },
            { title: 'Name', key: 'name', render: (_, r) => `${r.first_name || ''} ${r.last_name || ''}`.trim() || '—' },
            { title: 'Role', dataIndex: 'role', key: 'role' },
            {
              title: 'Status',
              dataIndex: 'status',
              key: 'status',
              render: (v) => <Tag color={v === 'active' ? 'green' : 'default'}>{v}</Tag>,
            },
          ]}
        />
      </Card>
    </div>
  );
}

function RowCards({ stats }) {
  if (!stats) return null;
  return (
    <Card style={{ marginBottom: 16 }} size="small">
      <Space size="large" wrap>
        <span><strong>Active users:</strong> {stats.activeUsers}</span>
        <span><strong>Active items:</strong> {stats.activeItems}</span>
        <span><strong>Warehouses:</strong> {stats.activeWarehouses}</span>
      </Space>
    </Card>
  );
}
