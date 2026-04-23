import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select,
  Switch, Tag, Space, Tabs, Popconfirm, message, Row, Col, Badge, Alert
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  ThunderboltOutlined, PlayCircleOutlined, PauseCircleOutlined,
  HistoryOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ShoppingCartOutlined, ShopOutlined
} from '@ant-design/icons';
import apiService from '../../services/apiService';
import { SalesOrderFlow, PurchaseOrderFlow } from './ProcessGuides.jsx';

const MODULES = ['inventory', 'sales_order', 'purchase_order', 'invoice', 'item'];
const TRIGGER_EVENTS = {
  inventory: ['stock_low', 'stock_received', 'stock_adjusted', 'stock_transferred'],
  sales_order: ['so_created', 'so_confirmed', 'so_shipped', 'so_cancelled'],
  purchase_order: ['po_created', 'po_confirmed', 'po_received', 'po_cancelled'],
  invoice: ['invoice_created', 'invoice_sent', 'invoice_paid', 'invoice_overdue'],
  item: ['item_created', 'item_updated', 'item_deactivated'],
};
const OPERATORS = ['equals', 'not_equals', 'greater_than', 'less_than', 'contains'];
const ACTION_TYPES = ['send_notification', 'update_status'];

export default function WorkflowAutomation() {
  const [rules, setRules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ruleModal, setRuleModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [conditions, setConditions] = useState([]);
  const [actions, setActions] = useState([]);
  const [selectedModule, setSelectedModule] = useState('inventory');

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.get('/workflows');
      if (res.success) setRules(res.data);
    } catch { message.error('Failed to load workflow rules'); }
    finally { setLoading(false); }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const res = await apiService.get('/workflows/logs');
      if (res.success) setLogs(res.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadRules(); loadLogs(); }, [loadRules, loadLogs]);

  const openModal = (record = null) => {
    setEditing(record);
    if (record) {
      setSelectedModule(record.module);
      setConditions(record.conditions || []);
      setActions(record.actions || []);
      form.setFieldsValue({ name: record.name, description: record.description,
        module: record.module, triggerEvent: record.trigger_event });
    } else {
      setSelectedModule('inventory');
      setConditions([]);
      setActions([{ type: 'send_notification', title: '', message: '' }]);
      form.resetFields();
    }
    setRuleModal(true);
  };

  const saveRule = async () => {
    try {
      const values = await form.validateFields();
      const payload = { ...values, conditions, actions };
      if (editing) {
        await apiService.put(`/workflows/${editing.id}`, payload);
        message.success('Workflow rule updated');
      } else {
        await apiService.post('/workflows', payload);
        message.success('Workflow rule created');
      }
      setRuleModal(false);
      form.resetFields();
      setEditing(null);
      loadRules();
    } catch (e) {
      if (e?.errorFields) message.error('Please fill all required fields');
      else message.error('Failed to save workflow rule');
    }
  };

  const deleteRule = async (id) => {
    try {
      await apiService.delete(`/workflows/${id}`);
      message.success('Rule deleted');
      loadRules();
    } catch { message.error('Failed to delete rule'); }
  };

  const toggleRule = async (id) => {
    try {
      await apiService.post(`/workflows/${id}/toggle`);
      loadRules();
    } catch { message.error('Failed to toggle rule'); }
  };

  // Condition helpers
  const addCondition = () => setConditions(c => [...c, { field: '', operator: 'equals', value: '' }]);
  const updateCondition = (i, key, val) => setConditions(c => c.map((x, idx) => idx === i ? { ...x, [key]: val } : x));
  const removeCondition = (i) => setConditions(c => c.filter((_, idx) => idx !== i));

  // Action helpers
  const addAction = () => setActions(a => [...a, { type: 'send_notification', title: '', message: '' }]);
  const updateAction = (i, key, val) => setActions(a => a.map((x, idx) => idx === i ? { ...x, [key]: val } : x));
  const removeAction = (i) => setActions(a => a.filter((_, idx) => idx !== i));

  const ruleColumns = [
    {
      title: 'Rule', key: 'rule',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 700 }}>{r.name}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{r.description}</div>
        </div>
      )
    },
    { title: 'Module', dataIndex: 'module', key: 'module',
      render: v => <Tag color="blue">{v?.replace('_', ' ').toUpperCase()}</Tag> },
    { title: 'Trigger', dataIndex: 'trigger_event', key: 'trigger_event',
      render: v => <Tag color="purple">{v?.replace(/_/g, ' ')}</Tag> },
    { title: 'Runs', dataIndex: 'execution_count', key: 'execution_count',
      render: v => <Badge count={v || 0} showZero style={{ backgroundColor: '#667eea' }} /> },
    {
      title: 'Active', key: 'active',
      render: (_, r) => (
        <Switch checked={r.is_active === 1} size="small"
          onChange={() => toggleRule(r.id)}
          checkedChildren={<PlayCircleOutlined />}
          unCheckedChildren={<PauseCircleOutlined />}
        />
      )
    },
    {
      title: 'Actions', key: 'actions', width: 100,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Popconfirm title="Delete this rule?" onConfirm={() => deleteRule(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const logColumns = [
    { title: 'Rule', dataIndex: 'rule_name', key: 'rule_name', render: v => <strong>{v}</strong> },
    { title: 'Status', dataIndex: 'status', key: 'status',
      render: v => (
        <Tag color={v === 'success' ? 'green' : v === 'failed' ? 'red' : 'orange'}
          icon={v === 'success' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
          {v}
        </Tag>
      )
    },
    { title: 'Error', dataIndex: 'error_message', key: 'error_message', render: v => v || '—' },
    { title: 'Executed At', dataIndex: 'executed_at', key: 'executed_at',
      render: v => new Date(v).toLocaleString() },
  ];

  return (
    <div style={{ padding: 24, background: '#f5f6fa', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#f093fb,#f5576c)',
        borderRadius: 16, padding: '24px 28px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '10px 14px' }}>
            <ThunderboltOutlined style={{ fontSize: 28, color: '#fff' }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>Workflow Automation</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
              Automate actions based on business events
            </div>
          </div>
        </div>
        <Button icon={<PlusOutlined />} size="large" onClick={() => openModal()}
          style={{ background: '#fff', color: '#f5576c', border: 'none', fontWeight: 700, borderRadius: 10 }}>
          New Rule
        </Button>
      </div>

      {/* Under Development Alert */}
      <Alert
        message="Feature Under Development"
        description="Workflow Automation is currently under development. Rules and triggers may not function as expected. Full automation features will be available soon."
        type="warning"
        showIcon
        banner
        style={{ marginBottom: 24 }}
      />

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Rules', value: rules.length, color: '#667eea' },
          { label: 'Active Rules', value: rules.filter(r => r.is_active).length, color: '#52c41a' },
          { label: 'Total Executions', value: rules.reduce((s, r) => s + (r.execution_count || 0), 0), color: '#f7971e' },
          { label: 'Log Entries', value: logs.length, color: '#f5576c' },
        ].map(s => (
          <Col xs={12} sm={6} key={s.label}>
            <Card bordered={false} style={{ borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
              bodyStyle={{ padding: '18px 20px' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>{s.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Tabs defaultActiveKey="rules" items={[
        {
          key: 'rules',
          label: <span><ThunderboltOutlined /> Rules</span>,
          children: (
            <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
              <Table dataSource={rules} columns={ruleColumns} rowKey="id"
                loading={loading} pagination={{ pageSize: 10 }} size="small"
                locale={{ emptyText: 'No workflow rules yet. Create your first rule to automate tasks.' }} />
            </Card>
          )
        },
        {
          key: 'logs',
          label: <span><HistoryOutlined /> Execution Logs</span>,
          children: (
            <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
              <Table dataSource={logs} columns={logColumns} rowKey="id"
                pagination={{ pageSize: 20 }} size="small"
                locale={{ emptyText: 'No execution logs yet.' }} />
            </Card>
          )
        },
        {
          key: 'so-flow',
          label: <span><ShoppingCartOutlined /> Sales Order Flow</span>,
          children: <SalesOrderFlow />,
        },
        {
          key: 'po-flow',
          label: <span><ShopOutlined /> Purchase Order Flow</span>,
          children: <PurchaseOrderFlow />,
        },
      ]} />

      {/* Rule Builder Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThunderboltOutlined style={{ color: '#f5576c' }} />
            {editing ? 'Edit Workflow Rule' : 'Create Workflow Rule'}
          </div>
        }
        open={ruleModal}
        onCancel={() => { setRuleModal(false); setEditing(null); form.resetFields(); }}
        onOk={saveRule}
        okText={editing ? 'Update Rule' : 'Create Rule'}
        okButtonProps={{ style: { background: 'linear-gradient(135deg,#f093fb,#f5576c)', border: 'none' } }}
        width={680}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={14}>
            <Col span={14}>
              <Form.Item name="name" label="Rule Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Low Stock Alert" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="module" label="Module" rules={[{ required: true }]}>
                <Select onChange={v => { setSelectedModule(v); form.setFieldValue('triggerEvent', undefined); }}>
                  {MODULES.map(m => (
                    <Select.Option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={14}>
            <Col span={14}>
              <Form.Item name="triggerEvent" label="Trigger Event" rules={[{ required: true }]}>
                <Select placeholder="Select trigger">
                  {(TRIGGER_EVENTS[selectedModule] || []).map(e => (
                    <Select.Option key={e} value={e}>{e.replace(/_/g, ' ')}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="description" label="Description">
                <Input placeholder="Optional" />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        {/* Conditions */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>Conditions (all must match)</span>
            <Button size="small" icon={<PlusOutlined />} onClick={addCondition}>Add</Button>
          </div>
          {conditions.length === 0 && (
            <div style={{ color: '#9ca3af', fontSize: 13, padding: '8px 0' }}>
              No conditions — rule will trigger on every event
            </div>
          )}
          {conditions.map((cond, i) => (
            <Row gutter={8} key={i} style={{ marginBottom: 8 }}>
              <Col span={7}>
                <Input placeholder="Field (e.g. quantity)" value={cond.field}
                  onChange={e => updateCondition(i, 'field', e.target.value)} />
              </Col>
              <Col span={6}>
                <Select value={cond.operator} onChange={v => updateCondition(i, 'operator', v)} style={{ width: '100%' }}>
                  {OPERATORS.map(o => <Select.Option key={o} value={o}>{o.replace('_', ' ')}</Select.Option>)}
                </Select>
              </Col>
              <Col span={8}>
                <Input placeholder="Value" value={cond.value}
                  onChange={e => updateCondition(i, 'value', e.target.value)} />
              </Col>
              <Col span={3}>
                <Button danger size="small" onClick={() => removeCondition(i)}>✕</Button>
              </Col>
            </Row>
          ))}
        </div>

        {/* Actions */}
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>Actions</span>
            <Button size="small" icon={<PlusOutlined />} onClick={addAction}>Add</Button>
          </div>
          {actions.map((action, i) => (
            <Card key={i} size="small" style={{ marginBottom: 8, borderRadius: 8, background: '#fafbff' }}
              extra={<Button danger size="small" onClick={() => removeAction(i)}>✕</Button>}>
              <Row gutter={8}>
                <Col span={8}>
                  <Select value={action.type} onChange={v => updateAction(i, 'type', v)} style={{ width: '100%' }}>
                    {ACTION_TYPES.map(t => <Select.Option key={t} value={t}>{t.replace('_', ' ')}</Select.Option>)}
                  </Select>
                </Col>
                <Col span={8}>
                  <Input placeholder="Title / Field" value={action.title || action.field || ''}
                    onChange={e => updateAction(i, action.type === 'update_status' ? 'field' : 'title', e.target.value)} />
                </Col>
                <Col span={8}>
                  <Input placeholder="Message / Value" value={action.message || action.value || ''}
                    onChange={e => updateAction(i, action.type === 'update_status' ? 'value' : 'message', e.target.value)} />
                </Col>
              </Row>
            </Card>
          ))}
        </div>
      </Modal>
    </div>
  );
}
