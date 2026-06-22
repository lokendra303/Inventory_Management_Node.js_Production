import React, { useEffect, useState } from 'react';
import {
  Modal, Form, Input, Select, Switch, InputNumber, Button, Table, Space, message, Tag,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import batchGeneratorService from '../../services/batchGeneratorService';

const CONTEXT = 'kit_assembly';

const CONTEXT_OPTIONS = [
  { value: 'kit_assembly', label: 'Kit assembly (ASM-…)' },
  { value: 'opening_stock', label: 'Opening stock (OPEN-…)' },
  { value: 'kit_disassembly', label: 'Kit disassembly (DSM-…)' },
];

const TEMPLATE_HINT = 'Tokens: {SKU}, {ITEM}, {CATEGORY}, {WAREHOUSE}, {DATE}, {SEQ} — e.g. ASM-{SKU}-{DATE}-{SEQ}';

export default function BatchRulesModal({ open, onClose }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterContext, setFilterContext] = useState(CONTEXT);
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
    if (open) load();
  }, [open, filterContext]);

  const startCreate = () => {
    setEditing({ isNew: true });
    form.resetFields();
    const defaultTemplate = filterContext === 'opening_stock'
      ? 'OPEN-{SKU}-{DATE}-{SEQ}'
      : filterContext === 'kit_disassembly'
        ? 'DSM-{SKU}-{DATE}-{SEQ}'
        : 'ASM-{SKU}-{DATE}-{SEQ}';
    form.setFieldsValue({
      context: filterContext,
      scope: 'default',
      prefixMode: 'static',
      prefixStatic: defaultTemplate,
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
    form.setFieldsValue({
      name: rule.name,
      context: rule.context,
      scope: rule.scope,
      scopeValue: rule.scope_value,
      prefixMode: rule.prefix_mode,
      prefixStatic: rule.prefix_static,
      prefixSource: rule.prefix_source,
      prefixLength: rule.prefix_length,
      separator: rule.separator,
      useDate: !!rule.use_date,
      dateFormat: rule.date_format,
      useCounter: !!rule.use_counter,
      counterStart: rule.counter_start,
      counterPadding: rule.counter_padding,
      isDefault: !!rule.is_default,
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        name: values.name,
        context: values.context || filterContext,
        scope: values.scope,
        scopeValue: values.scope === 'category' ? values.scopeValue : null,
        prefixMode: values.prefixMode,
        prefixStatic: values.prefixStatic,
        prefixSource: values.prefixSource,
        prefixLength: values.prefixLength,
        separator: values.separator || '-',
        useDate: values.useDate,
        dateFormat: values.dateFormat,
        useCounter: values.useCounter,
        counterStart: values.counterStart,
        counterPadding: values.counterPadding,
        isDefault: values.isDefault,
      };
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
      await load();
    } catch (e) {
      message.error(e?.response?.data?.error || 'Delete failed');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
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
      render: (_, r) => (
        <Space size={4}>
          {r.is_default ? <Tag color="blue">Default</Tag> : null}
          {r.scope === 'category' ? <Tag>{r.scope_value}</Tag> : <Tag>Institution</Tag>}
        </Space>
      ),
    },
    {
      title: 'Counter',
      key: 'counter',
      render: (_, r) => `${r.counter_current || 0} / pad ${r.counter_padding}`,
    },
    {
      title: '',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => startEdit(r)}>Edit</Button>
          <Button size="small" danger onClick={() => handleDelete(r.id)}>Delete</Button>
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title="Batch coding rules"
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      destroyOnClose
    >
      <Space style={{ marginBottom: 12 }}>
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
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="Rule name" rules={[{ required: true }]}>
            <Input placeholder="Kit assembly — main warehouse" />
          </Form.Item>
          <Form.Item name="context" label="Rule type" rules={[{ required: true }]}>
            <Select options={CONTEXT_OPTIONS} />
          </Form.Item>
          <Form.Item name="scope" label="Scope" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'default', label: 'Institution-wide' },
                { value: 'category', label: 'Category override' },
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.scope !== c.scope}>
            {({ getFieldValue }) => getFieldValue('scope') === 'category' && (
              <Form.Item name="scopeValue" label="Category" rules={[{ required: true }]}>
                <Input placeholder="e.g. Gift Sets" />
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item name="prefixStatic" label="Batch template" rules={[{ required: true }]} extra={TEMPLATE_HINT}>
            <Input placeholder="ASM-{SKU}-{DATE}-{SEQ}" />
          </Form.Item>
          <Space wrap>
            <Form.Item name="useDate" label="Use date" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="dateFormat" label="Date format">
              <Select
                style={{ width: 140 }}
                options={[
                  { value: 'YYYYMMDD', label: 'YYYYMMDD' },
                  { value: 'YYYYMM', label: 'YYYYMM' },
                  { value: 'YYMM', label: 'YYMM' },
                ]}
              />
            </Form.Item>
            <Form.Item name="useCounter" label="Use counter" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="counterPadding" label="Counter digits">
              <InputNumber min={1} max={12} />
            </Form.Item>
            <Form.Item name="counterStart" label="Counter start">
              <InputNumber min={1} />
            </Form.Item>
            <Form.Item name="isDefault" label="Default rule" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
          <Form.Item name="prefixMode" hidden><Input /></Form.Item>
          <Space>
            <Button onClick={() => { setEditing(null); form.resetFields(); }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Save rule</Button>
          </Space>
        </Form>
      )}
    </Modal>
  );
}
