import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Typography, Spin, Tag, Button, Space, Modal, Form, Input, InputNumber, Switch, Checkbox, message, Tooltip,
} from 'antd';
import { PlusOutlined, EditOutlined, InfoCircleOutlined } from '@ant-design/icons';
import platformApi from '../services/platformApi';

const { Title, Paragraph, Text } = Typography;

const fmtMoney = (n) => (n === 0 ? 'Free' : `₹${Number(n).toLocaleString('en-IN')}`);
const fmtLimit = (n) => (n === -1 ? '∞' : n);

export default function PlatformPlans() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [featureOptions, setFeatureOptions] = useState([]);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [plansRes, optRes] = await Promise.all([
        platformApi.get('/platform/plans'),
        platformApi.get('/platform/plans/feature-options'),
      ]);
      if (plansRes.success) setPlans(plansRes.data || []);
      else setError(plansRes.error || 'Failed to load plans');
      if (optRes.success) setFeatureOptions(optRes.data || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setModalMode('create');
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      is_active: true,
      sort_order: 99,
      price_monthly: 0,
      price_yearly: 0,
      max_users: 5,
      max_warehouses: 2,
      max_items: 500,
      features_all: false,
      feature_keys: ['inventory', 'sales', 'purchases'],
    });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setModalMode('edit');
    setEditingId(row.id);
    const feats = Array.isArray(row.features) ? row.features : [];
    const all = feats.includes('all');
    const keys = all ? [] : feats.filter((k) => k !== 'all');
    form.setFieldsValue({
      name: row.name,
      description: row.description || '',
      price_monthly: Number(row.price_monthly),
      price_yearly: Number(row.price_yearly),
      max_users: row.max_users,
      max_warehouses: row.max_warehouses,
      max_items: row.max_items,
      is_active: !!row.is_active,
      sort_order: row.sort_order ?? 0,
      features_all: all,
      feature_keys: keys,
    });
    setModalOpen(true);
  };

  const submit = async () => {
    try {
      const v = await form.validateFields();
      const features = v.features_all ? ['all'] : (v.feature_keys || []);
      if (!v.features_all && (!features || features.length === 0)) {
        message.warning('Select at least one module, or enable “All features”.');
        return;
      }
      setSaving(true);
      const payload = {
        name: v.name,
        description: v.description || '',
        price_monthly: v.price_monthly,
        price_yearly: v.price_yearly,
        max_users: v.max_users,
        max_warehouses: v.max_warehouses,
        max_items: v.max_items,
        features,
        is_active: v.is_active,
        sort_order: v.sort_order,
      };
      if (modalMode === 'create') {
        payload.id = (v.plan_id || '').trim().toLowerCase();
        const res = await platformApi.post('/platform/plans', payload);
        if (res.success) {
          message.success('Plan created');
          setModalOpen(false);
          load();
        } else message.error(res.error || 'Failed');
      } else {
        const res = await platformApi.patch(`/platform/plans/${editingId}`, payload);
        if (res.success) {
          message.success('Plan updated');
          setModalOpen(false);
          load();
        } else message.error(res.error || 'Failed');
      }
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const moduleChoices = featureOptions.filter((f) => f.key !== 'all');

  if (loading && plans.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Space align="start" style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
        <div>
          <Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>Subscription plans</Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Define prices, usage caps (use <Text code>-1</Text> for unlimited), and which modules each plan may access.
            Changes apply to new checkouts and to feature checks for existing institutions on that plan.
          </Paragraph>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New plan</Button>
      </Space>

      {error && <Card style={{ marginBottom: 16 }}><Paragraph type="danger">{error}</Paragraph></Card>}

      <Card>
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          pagination={false}
          dataSource={plans}
          columns={[
            { title: 'Order', dataIndex: 'sort_order', key: 'so', width: 70 },
            {
              title: 'Plan',
              dataIndex: 'name',
              key: 'name',
              render: (t, r) => (
                <span>
                  <Text strong>{t}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>{r.id}</Text>
                  {!r.is_active && <Tag style={{ marginLeft: 8 }}>hidden</Tag>}
                </span>
              ),
            },
            { title: 'Monthly', dataIndex: 'price_monthly', key: 'pm', width: 100, render: fmtMoney },
            { title: 'Yearly', dataIndex: 'price_yearly', key: 'py', width: 100, render: fmtMoney },
            { title: 'Users', dataIndex: 'max_users', key: 'mu', width: 72, render: fmtLimit },
            { title: 'WH', dataIndex: 'max_warehouses', key: 'mw', width: 72, render: fmtLimit },
            { title: 'Items', dataIndex: 'max_items', key: 'mi', width: 72, render: fmtLimit },
            {
              title: 'Modules',
              dataIndex: 'features',
              key: 'feat',
              render: (feats) => {
                const list = Array.isArray(feats) ? feats : [];
                if (list.includes('all')) return <Tag color="purple">all modules</Tag>;
                return (
                  <Space size={[4, 4]} wrap>
                    {list.map((k) => (
                      <Tag key={k}>{k}</Tag>
                    ))}
                  </Space>
                );
              },
            },
            {
              title: '',
              key: 'act',
              width: 90,
              render: (_, row) => (
                <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={modalMode === 'create' ? 'New subscription plan' : `Edit plan: ${editingId}`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        confirmLoading={saving}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          {modalMode === 'create' && (
            <Form.Item
              name="plan_id"
              label="Plan id (slug)"
              rules={[
                { required: true, message: 'Required' },
                { pattern: /^[a-z0-9][a-z0-9-]{0,62}$/i, message: 'Use letters, numbers, hyphens only' },
              ]}
              extra="Stable id referenced in billing (e.g. plan-standard). Cannot be changed later."
            >
              <Input placeholder="plan-my-tier" />
            </Form.Item>
          )}
          <Form.Item name="name" label="Display name" rules={[{ required: true, message: 'Required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space size="large" wrap style={{ width: '100%' }}>
            <Form.Item name="price_monthly" label="Price / month (INR)" rules={[{ required: true }]}>
              <InputNumber min={0} step={1} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="price_yearly" label="Price / year (INR)" rules={[{ required: true }]}>
              <InputNumber min={0} step={1} style={{ width: 160 }} />
            </Form.Item>
          </Space>
          <Space size="large" wrap style={{ width: '100%' }}>
            <Form.Item
              name="max_users"
              label={(
                <span>
                  Max users{' '}
                  <Tooltip title="-1 = unlimited">
                    <InfoCircleOutlined />
                  </Tooltip>
                </span>
              )}
              rules={[{ required: true }]}
            >
              <InputNumber min={-1} step={1} style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="max_warehouses" label="Max warehouses" rules={[{ required: true }]}>
              <InputNumber min={-1} step={1} style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="max_items" label="Max items" rules={[{ required: true }]}>
              <InputNumber min={-1} step={1} style={{ width: 140 }} />
            </Form.Item>
          </Space>
          <Space size="large" wrap>
            <Form.Item name="sort_order" label="Sort order" rules={[{ required: true }]}>
              <InputNumber min={0} max={999} step={1} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="is_active" label="Visible to institutions" valuePropName="checked">
              <Switch checkedChildren="on" unCheckedChildren="off" />
            </Form.Item>
          </Space>

          <Form.Item
            name="features_all"
            label="Module access"
            valuePropName="checked"
            extra="When off, pick modules below. When on, institutions get every gated module."
          >
            <Checkbox>All features (same as including the “all” flag)</Checkbox>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.features_all !== c.features_all}>
            {({ getFieldValue }) => (
              !getFieldValue('features_all') ? (
                <Form.Item name="feature_keys" label="Allowed modules">
                  <Checkbox.Group options={moduleChoices.map((o) => ({ label: o.label, value: o.key }))} />
                </Form.Item>
              ) : null
            )}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
