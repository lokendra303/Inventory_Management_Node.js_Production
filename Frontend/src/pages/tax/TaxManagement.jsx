import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, InputNumber,
  Select, Switch, Tag, Space, Tabs, Popconfirm, message, Row, Col
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  PercentageOutlined, AppstoreOutlined
} from '@ant-design/icons';
import apiService from '../../services/apiService';

const TAX_TYPES = ['GST', 'VAT', 'TDS', 'TCS', 'IGST', 'CGST', 'SGST', 'custom'];

export default function TaxManagement() {
  const [groups, setGroups] = useState([]);
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [groupModal, setGroupModal] = useState(false);
  const [rateModal, setRateModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [groupForm] = Form.useForm();
  const [rateForm] = Form.useForm();

  const loadGroups = useCallback(async () => {
    try {
      const res = await apiService.get('/tax/groups');
      if (res.success) setGroups(res.data);
    } catch { message.error('Failed to load tax groups'); }
  }, []);

  const loadRates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.get('/tax/rates');
      if (res.success) setRates(res.data);
    } catch { message.error('Failed to load tax rates'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadGroups(); loadRates(); }, [loadGroups, loadRates]);

  // ── Tax Groups ──────────────────────────────────────────────
  const openGroupModal = (record = null) => {
    setEditing(record);
    groupForm.setFieldsValue(record || { name: '', description: '' });
    setGroupModal(true);
  };

  const saveGroup = async (values) => {
    try {
      if (editing) {
        await apiService.put(`/tax/groups/${editing.id}`, values);
        message.success('Tax group updated');
      } else {
        await apiService.post('/tax/groups', values);
        message.success('Tax group created');
      }
      setGroupModal(false);
      groupForm.resetFields();
      setEditing(null);
      loadGroups();
    } catch { message.error('Failed to save tax group'); }
  };

  const deleteGroup = async (id) => {
    try {
      await apiService.delete(`/tax/groups/${id}`);
      message.success('Tax group deleted');
      loadGroups();
    } catch { message.error('Failed to delete tax group'); }
  };

  // ── Tax Rates ────────────────────────────────────────────────
  const openRateModal = (record = null) => {
    setEditing(record);
    rateForm.setFieldsValue(record
      ? { ...record, isCompound: !!record.is_compound, isInclusive: !!record.is_inclusive }
      : { name: '', rate: 0, taxType: 'custom', isCompound: false, isInclusive: false }
    );
    setRateModal(true);
  };

  const saveRate = async (values) => {
    try {
      const payload = { ...values, isCompound: values.isCompound ? 1 : 0, isInclusive: values.isInclusive ? 1 : 0 };
      if (editing) {
        await apiService.put(`/tax/rates/${editing.id}`, payload);
        message.success('Tax rate updated');
      } else {
        await apiService.post('/tax/rates', payload);
        message.success('Tax rate created');
      }
      setRateModal(false);
      rateForm.resetFields();
      setEditing(null);
      loadRates();
    } catch { message.error('Failed to save tax rate'); }
  };

  const deleteRate = async (id) => {
    try {
      await apiService.delete(`/tax/rates/${id}`);
      message.success('Tax rate deleted');
      loadRates();
    } catch { message.error('Failed to delete tax rate'); }
  };

  const groupColumns = [
    { title: 'Group Name', dataIndex: 'name', key: 'name', render: v => <strong>{v}</strong> },
    { title: 'Description', dataIndex: 'description', key: 'description', render: v => v || '—' },
    { title: 'Rates', dataIndex: 'rate_count', key: 'rate_count',
      render: v => <Tag color="blue">{v || 0} rates</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status',
      render: v => <Tag color={v === 'active' ? 'green' : 'default'}>{v}</Tag> },
    {
      title: 'Actions', key: 'actions', width: 100,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openGroupModal(r)} />
          <Popconfirm title="Delete this group?" onConfirm={() => deleteGroup(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const rateColumns = [
    { title: 'Tax Name', dataIndex: 'name', key: 'name', render: v => <strong>{v}</strong> },
    { title: 'Rate', dataIndex: 'rate', key: 'rate',
      render: v => <Tag color="purple">{parseFloat(v).toFixed(2)}%</Tag> },
    { title: 'Type', dataIndex: 'tax_type', key: 'tax_type',
      render: v => <Tag color="blue">{v?.toUpperCase()}</Tag> },
    { title: 'Group', dataIndex: 'group_name', key: 'group_name', render: v => v || '—' },
    { title: 'Compound', dataIndex: 'is_compound', key: 'is_compound',
      render: v => v ? <Tag color="orange">Yes</Tag> : '—' },
    { title: 'Inclusive', dataIndex: 'is_inclusive', key: 'is_inclusive',
      render: v => v ? <Tag color="cyan">Yes</Tag> : '—' },
    {
      title: 'Actions', key: 'actions', width: 100,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openRateModal(r)} />
          <Popconfirm title="Delete this rate?" onConfirm={() => deleteRate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24, background: '#f5f6fa', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        borderRadius: 16, padding: '24px 28px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '10px 14px' }}>
            <PercentageOutlined style={{ fontSize: 28, color: '#fff' }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>Tax Management</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
              Configure GST, VAT, TDS and custom tax rates
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {[
          { label: 'Tax Groups', value: groups.length, color: '#667eea', bg: '#f0f0ff' },
          { label: 'Tax Rates', value: rates.length, color: '#52c41a', bg: '#f6ffed' },
          { label: 'GST Rates', value: rates.filter(r => r.tax_type === 'GST').length, color: '#fa8c16', bg: '#fff7e6' },
          { label: 'Custom Rates', value: rates.filter(r => r.tax_type === 'custom').length, color: '#722ed1', bg: '#f9f0ff' },
        ].map(s => (
          <Col xs={12} sm={6} key={s.label}>
            <Card bordered={false} style={{ borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
              bodyStyle={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: s.bg, borderRadius: 10, padding: 10, fontSize: 22, color: s.color }}>
                  <PercentageOutlined />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>{s.label}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Tabs
        defaultActiveKey="rates"
        items={[
          {
            key: 'rates',
            label: <span><PercentageOutlined /> Tax Rates</span>,
            children: (
              <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}
                extra={
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openRateModal()}
                    style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 8 }}>
                    Add Tax Rate
                  </Button>
                }
                title={<strong>All Tax Rates</strong>}
              >
                <Table dataSource={rates} columns={rateColumns} rowKey="id"
                  loading={loading} pagination={{ pageSize: 15 }} size="small" />
              </Card>
            )
          },
          {
            key: 'groups',
            label: <span><AppstoreOutlined /> Tax Groups</span>,
            children: (
              <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}
                extra={
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openGroupModal()}
                    style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 8 }}>
                    Add Tax Group
                  </Button>
                }
                title={<strong>Tax Groups</strong>}
              >
                <Table dataSource={groups} columns={groupColumns} rowKey="id"
                  pagination={{ pageSize: 15 }} size="small" />
              </Card>
            )
          }
        ]}
      />

      {/* Tax Group Modal */}
      <Modal title={editing ? 'Edit Tax Group' : 'Add Tax Group'}
        open={groupModal} onCancel={() => { setGroupModal(false); setEditing(null); groupForm.resetFields(); }}
        footer={null} width={480}>
        <Form form={groupForm} layout="vertical" onFinish={saveGroup} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Group Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. GST Group, VAT Group" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit"
                style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none' }}>
                {editing ? 'Update' : 'Create'}
              </Button>
              <Button onClick={() => { setGroupModal(false); setEditing(null); groupForm.resetFields(); }}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Tax Rate Modal */}
      <Modal title={editing ? 'Edit Tax Rate' : 'Add Tax Rate'}
        open={rateModal} onCancel={() => { setRateModal(false); setEditing(null); rateForm.resetFields(); }}
        footer={null} width={520}>
        <Form form={rateForm} layout="vertical" onFinish={saveRate} style={{ marginTop: 16 }}>
          <Row gutter={14}>
            <Col span={14}>
              <Form.Item name="name" label="Tax Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. GST 18%, VAT 5%" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="rate" label="Rate (%)" rules={[{ required: true }]}>
                <InputNumber min={0} max={100} step={0.01} precision={2} style={{ width: '100%' }}
                  addonAfter="%" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={14}>
            <Col span={12}>
              <Form.Item name="taxType" label="Tax Type" rules={[{ required: true }]}>
                <Select>
                  {TAX_TYPES.map(t => <Select.Option key={t} value={t}>{t.toUpperCase()}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="taxGroupId" label="Tax Group">
                <Select allowClear placeholder="Select group">
                  {groups.map(g => <Select.Option key={g.id} value={g.id}>{g.name}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={14}>
            <Col span={12}>
              <Form.Item name="isCompound" label="Compound Tax" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="isInclusive" label="Tax Inclusive" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit"
                style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none' }}>
                {editing ? 'Update' : 'Create'}
              </Button>
              <Button onClick={() => { setRateModal(false); setEditing(null); rateForm.resetFields(); }}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
