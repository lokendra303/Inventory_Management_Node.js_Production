import React, { useEffect, useState } from 'react';
import {
  Modal, Form, Input, Select, Button, Table, Space, message, Tag, Alert, Card,
} from 'antd';
import { PlusOutlined, InfoCircleOutlined } from '@ant-design/icons';
import batchGeneratorService from '../../services/batchGeneratorService';
import { useAuth } from '../../hooks/useAuth.jsx';
import CodeRuleEditor from '../settings/CodeRuleEditor';
import {
  buildDefaultDerivedConfig,
  buildPayloadFromFormValues,
  mapRuleToFormValues,
  SAMPLE_BATCH_PREVIEW_CONTEXT,
} from '../../utils/codeGeneratorConfig';

const CONTEXT_OPTIONS = [
  { value: 'kit_assembly', label: 'Manufacturing assembly (ASM-…)' },
  { value: 'opening_stock', label: 'Opening stock (OPEN-…)' },
  { value: 'kit_disassembly', label: 'Manufacturing disassembly (DSM-…)' },
  { value: 'general', label: 'General receive (GRN / stock in)' },
];

const defaultTemplateForContext = (ctx) => {
  if (ctx === 'opening_stock') return 'OPEN-{BRAND|3|abbr}-{SKU}-{DATE}-{SEQ}';
  if (ctx === 'kit_disassembly') return 'DSM-{SKU}-{VARIANT}-{DATE}-{SEQ}';
  if (ctx === 'general') return 'LOT-{CATEGORY|3|abbr}-{SKU}-{DATE}-{SEQ}';
  return 'ASM-{BRAND|3|abbr}-{SKU}-{VARIANT}-{DATE}-{SEQ}';
};

export function BatchRulesPanel({ active = true }) {
  const { user } = useAuth();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterContext, setFilterContext] = useState('kit_assembly');
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const list = await batchGeneratorService.listRules(filterContext);
      setRules(Array.isArray(list) ? list : []);
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to load batch rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (active) load();
  }, [active, filterContext]);

  const orgLabel = user?.institutionName || 'your organization';

  const startCreate = () => {
    setEditing({ isNew: true });
    form.resetFields();
    form.setFieldsValue({
      name: '',
      context: filterContext,
      scope: 'default',
      prefixMode: 'static',
      prefixStatic: defaultTemplateForContext(filterContext),
      prefixSources: [],
      prefixSourceConfig: buildDefaultDerivedConfig(),
      useDate: true,
      dateFormat: 'YYYYMMDD',
      useCounter: true,
      counterStart: 1,
      counterPadding: 3,
      separator: '-',
      isDefault: false,
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
        await batchGeneratorService.createRule(payload);
        message.success('Batch rule created');
      } else if (editing?.id) {
        await batchGeneratorService.updateRule(editing.id, payload);
        message.success('Batch rule updated');
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
      await batchGeneratorService.deleteRule(id);
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
          {r.is_default ? <Tag color="blue">Default</Tag> : null}
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

  const previewCtx = {
    ...SAMPLE_BATCH_PREVIEW_CONTEXT,
    context: form.getFieldValue('context') || filterContext,
  };

  return (
    <>
      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 16, borderRadius: 10 }}
        message={`Batch coding rules for ${orgLabel}`}
        description={
          'Each organization has its own batch/lot templates and counters. '
          + 'Use tokens like {SKU}, {BRAND}, {VARIANT}, {COLOR}, {SIZE}, {DATE}, {SEQ} — same power as SKU rules. '
          + 'Set a default per operation type, or add category overrides for different product lines.'
        }
      />

      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          value={filterContext}
          onChange={setFilterContext}
          style={{ width: 280 }}
          options={CONTEXT_OPTIONS}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={startCreate}>
          New rule
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
        <Card size="small" title={editing.isNew ? 'New batch rule' : `Edit: ${editing.name}`}>
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Form.Item name="name" label="Rule name" rules={[{ required: true }]}>
              <Input placeholder="Manufacturing assembly — cosmetics line" />
            </Form.Item>
            <CodeRuleEditor
              form={form}
              ruleKind="batch"
              showContextField
              contextOptions={CONTEXT_OPTIONS}
              samplePreviewContext={previewCtx}
            />
            <Space>
              <Button onClick={() => { setEditing(null); form.resetFields(); }}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={saving}>Save rule</Button>
            </Space>
          </Form>
        </Card>
      )}
    </>
  );
}

export default function BatchRulesModal({ open, onClose }) {
  return (
    <Modal
      title="Batch coding rules"
      open={open}
      onCancel={onClose}
      footer={null}
      width={960}
      destroyOnClose
    >
      {open ? <BatchRulesPanel active={open} /> : null}
    </Modal>
  );
}
