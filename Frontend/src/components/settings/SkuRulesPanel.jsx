import React, { useEffect, useState } from 'react';
import {
  Form, Input, Button, Table, Space, message, Tag, Alert, Card,
} from 'antd';
import { PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import skuGeneratorService from '../../services/skuGeneratorService';
import apiService from '../../services/apiService';
import { useAuth } from '../../hooks/useAuth.jsx';
import CodeRuleEditor from '../settings/CodeRuleEditor';
import {
  buildDefaultDerivedConfig,
  buildPayloadFromFormValues,
  mapRuleToFormValues,
  SAMPLE_SKU_PREVIEW_CONTEXT,
} from '../../utils/codeGeneratorConfig';

export function SkuRulesPanel({ active = true }) {
  const { user } = useAuth();
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [rulesRes, catRes] = await Promise.allSettled([
        skuGeneratorService.listRules(),
        apiService.get('/categories'),
      ]);
      if (rulesRes.status === 'fulfilled') {
        setRules(Array.isArray(rulesRes.value) ? rulesRes.value : []);
      }
      if (catRes.status === 'fulfilled' && catRes.value?.success) {
        setCategories((catRes.value.data || []).map((c) => c.name).filter(Boolean));
      }
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to load SKU rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (active) load();
  }, [active]);

  const orgLabel = user?.institutionName || 'your organization';

  const startCreate = () => {
    setEditing({ isNew: true });
    form.resetFields();
    form.setFieldsValue({
      name: 'Default SKU rule',
      scope: 'default',
      prefixMode: 'static',
      prefixStatic: '{BRAND|3|abbr}-{ITEM|4|slice}-{VARIANT|4|slice}-{SEQ}',
      prefixSources: [],
      prefixSourceConfig: buildDefaultDerivedConfig(),
      useDate: false,
      dateFormat: 'YYMM',
      useCounter: true,
      counterStart: 1,
      counterPadding: 4,
      separator: '-',
      isDefault: true,
    });
  };

  const startEdit = (rule) => {
    setEditing(rule);
    form.setFieldsValue(mapRuleToFormValues(rule));
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = buildPayloadFromFormValues(values);
      if (editing?.isNew) {
        await skuGeneratorService.createRule(payload);
        message.success('SKU rule created');
      } else if (editing?.id) {
        await skuGeneratorService.updateRule(editing.id, payload);
        message.success('SKU rule updated');
      }
      setEditing(null);
      form.resetFields();
      await load();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e?.response?.data?.error || e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await skuGeneratorService.deleteRule(id);
      message.success('Rule archived');
      if (editing?.id === id) {
        setEditing(null);
        form.resetFields();
      }
      await load();
    } catch (e) {
      message.error(e?.response?.data?.error || 'Delete failed');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', width: 180 },
    {
      title: 'Template',
      dataIndex: 'prefix_static',
      key: 'template',
      ellipsis: true,
      render: (v, r) => v || `${r.prefix_mode}/${r.prefix_source}`,
    },
    {
      title: 'Scope',
      key: 'scope',
      width: 140,
      render: (_, r) => (
        <Space size={4} wrap>
          {r.is_default ? <Tag color="purple">Default</Tag> : null}
          {r.scope === 'category' ? <Tag>{r.scope_value}</Tag> : <Tag>Institution</Tag>}
        </Space>
      ),
    },
    {
      title: 'Counter',
      key: 'counter',
      width: 100,
      render: (_, r) => `${r.counter_current || 0} / pad ${r.counter_padding}`,
    },
    {
      title: '',
      key: 'actions',
      width: 140,
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => startEdit(r)}>Edit</Button>
          <Button size="small" danger onClick={() => handleDelete(r.id)}>Delete</Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Alert
        type="info"
        showIcon
        icon={<ThunderboltOutlined />}
        style={{ marginBottom: 16, borderRadius: 10 }}
        message={`SKU coding rules for ${orgLabel}`}
        description={
          'Fully customize how new item SKUs are generated. Use token templates ({BRAND}, {ITEM}, {VARIANT}, {COLOR}, {SIZE}, {TYPE}, {DATE}, {SEQ}) '
          + 'or guided field mode. Category overrides take priority over the institution default.'
        }
      />

      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={startCreate}>
          New SKU rule
        </Button>
      </Space>

      <Table
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={rules}
        columns={columns}
        pagination={false}
        style={{ marginBottom: editing ? 16 : 0 }}
      />

      {editing && (
        <Card size="small" title={editing.isNew ? 'New SKU rule' : `Edit: ${editing.name}`}>
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Form.Item name="name" label="Rule name" rules={[{ required: true }]}>
              <Input placeholder="Cosmetics — brand + variant + counter" />
            </Form.Item>
            <CodeRuleEditor
              form={form}
              ruleKind="sku"
              categoryOptions={categories}
              samplePreviewContext={SAMPLE_SKU_PREVIEW_CONTEXT}
            />
            <Space>
              <Button onClick={() => { setEditing(null); form.resetFields(); }}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={saving} style={{ background: '#764ba2', border: 'none' }}>
                Save rule
              </Button>
            </Space>
          </Form>
        </Card>
      )}
    </>
  );
}

export default SkuRulesPanel;
