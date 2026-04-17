import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, InputNumber,
  Select, Switch, Tag, Space, Tabs, Popconfirm, message,
  Row, Col, Divider
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  PercentageOutlined, AppstoreOutlined, SyncOutlined
} from '@ant-design/icons';
import apiService from '../../services/apiService';

export default function TaxManagement() {
  const [groups, setGroups]       = useState([]);
  const [rates, setRates]         = useState([]);
  const [taxTypes, setTaxTypes]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [groupModal, setGroupModal] = useState(false);
  const [rateModal, setRateModal]   = useState(false);
  const [editing, setEditing]       = useState(null);
  const [groupForm] = Form.useForm();
  const [rateForm]  = Form.useForm();

  const [syncing, setSyncing] = useState(false);

  // Inline add state for type and group dropdowns
  const [newTypeName,  setNewTypeName]  = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const newTypeInputRef  = useRef(null);
  const newGroupInputRef = useRef(null);

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

  const loadTaxTypes = useCallback(async () => {
    try {
      const res = await apiService.get('/tax/types');
      if (res.success) setTaxTypes(res.data);
    } catch { message.error('Failed to load tax types'); }
  }, []);

  useEffect(() => {
    loadGroups();
    loadRates();
    loadTaxTypes();
  }, [loadGroups, loadRates, loadTaxTypes]);

  // ── Inline: Add Tax Type ─────────────────────────────────────
  const handleAddType = async (e) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;
    try {
      const res = await apiService.post('/tax/types', { name: newTypeName.trim() });
      if (res.success) {
        setTaxTypes(res.data);
        setNewTypeName('');
        message.success(`Tax type "${newTypeName.trim()}" added`);
        setTimeout(() => newTypeInputRef.current?.focus(), 0);
      }
    } catch { message.error('Failed to add tax type'); }
  };

  const handleDeleteType = async (e, id, name) => {
    e.stopPropagation();
    try {
      await apiService.delete(`/tax/types/${id}`);
      setTaxTypes(prev => prev.filter(t => t.id !== id));
      message.success(`Tax type "${name}" deleted`);
    } catch { message.error('Failed to delete tax type'); }
  };

  // ── Inline: Add Tax Group ────────────────────────────────────
  const handleAddGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      await apiService.post('/tax/groups', { name: newGroupName.trim() });
      setNewGroupName('');
      message.success(`Tax group "${newGroupName.trim()}" added`);
      await loadGroups();
      setTimeout(() => newGroupInputRef.current?.focus(), 0);
    } catch { message.error('Failed to add tax group'); }
  };

  const handleDeleteGroupInline = async (e, id, name) => {
    e.stopPropagation();
    try {
      await apiService.delete(`/tax/groups/${id}`);
      setGroups(prev => prev.filter(g => g.id !== id));
      message.success(`Tax group "${name}" deleted`);
    } catch { message.error('Failed to delete tax group'); }
  };

  const syncLiveRates = async () => {
    setSyncing(true);
    try {
      const res = await apiService.post('/tax/sync-live-rates');
      if (res.success) {
        const { inserted, skipped, source } = res.data;
        message.success(`Synced from ${source}: ${inserted} added, ${skipped} already existed`);
        loadRates();
      }
    } catch { message.error('Failed to sync live rates'); }
    finally { setSyncing(false); }
  };

  // ── Tax Groups CRUD ──────────────────────────────────────────
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

  // ── Tax Rates CRUD ───────────────────────────────────────────
  const openRateModal = (record = null) => {
    setEditing(record);
    rateForm.setFieldsValue(record
      ? { ...record,
          taxType: record.tax_type,
          taxGroupId: record.tax_group_id,
          isCompound: !!record.is_compound,
          isInclusive: !!record.is_inclusive }
      : { name: '', rate: 0, taxType: taxTypes[0]?.name || 'GST',
          isCompound: false, isInclusive: false }
    );
    setRateModal(true);
  };

  const saveRate = async (values) => {
    try {
      const payload = {
        ...values,
        isCompound:  values.isCompound  ? 1 : 0,
        isInclusive: values.isInclusive ? 1 : 0,
      };
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

  // ── Columns ──────────────────────────────────────────────────
  const groupColumns = [
    { title: 'Group Name', dataIndex: 'name', key: 'name',
      render: v => <strong>{v}</strong> },
    { title: 'Description', dataIndex: 'description', key: 'description',
      render: v => v || '—' },
    { title: 'Rates', dataIndex: 'rate_count', key: 'rate_count',
      render: v => <Tag color="blue">{v || 0} rates</Tag> },
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
    { title: 'Tax Name', dataIndex: 'name', key: 'name',
      render: v => <strong>{v}</strong> },
    { title: 'Rate', dataIndex: 'rate', key: 'rate',
      render: v => <Tag color="purple">{parseFloat(v).toFixed(2)}%</Tag> },
    { title: 'Type', dataIndex: 'tax_type', key: 'tax_type',
      render: v => <Tag color="blue">{v?.toUpperCase()}</Tag> },
    { title: 'Group', dataIndex: 'group_name', key: 'group_name',
      render: v => v || '—' },
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

  const btnStyle = {
    background: 'linear-gradient(135deg,#667eea,#764ba2)',
    border: 'none', borderRadius: 8
  };

  return (
    <div style={{ padding: 24, background: '#f5f6fa', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        borderRadius: 16, padding: '24px 28px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 14
      }}>
        <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '10px 14px' }}>
          <PercentageOutlined style={{ fontSize: 28, color: '#fff' }} />
        </div>
        <div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>Tax Management</div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
            Configure tax types, groups and rates
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {[
          { label: 'Tax Types',   value: taxTypes.length,                                    color: '#1677ff', bg: '#e6f4ff' },
          { label: 'Tax Groups',  value: groups.length,                                      color: '#667eea', bg: '#f0f0ff' },
          { label: 'Tax Rates',   value: rates.length,                                       color: '#52c41a', bg: '#f6ffed' },
          { label: 'Gov. Rates',  value: rates.filter(r => r.tax_type !== 'custom').length,  color: '#722ed1', bg: '#f9f0ff' },
        ].map(s => (
          <Col xs={12} sm={6} key={s.label}>
            <Card bordered={false}
              style={{ borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
              bodyStyle={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: s.bg, borderRadius: 10, padding: 10,
                  fontSize: 22, color: s.color }}>
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

      <Tabs defaultActiveKey="rates" items={[
        {
          key: 'rates',
          label: <span><PercentageOutlined /> Tax Rates</span>,
          children: (
            <Card bordered={false}
              style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}
              title={<strong>All Tax Rates</strong>}
              extra={
                <Space>
                  <Button icon={<SyncOutlined spin={syncing} />}
                    onClick={syncLiveRates} loading={syncing}
                    style={{ borderRadius: 8 }}>
                    Sync Gov. Rates
                  </Button>
                  <Button type="primary" icon={<PlusOutlined />}
                    onClick={() => openRateModal()} style={btnStyle}>
                    Add Tax Rate
                  </Button>
                </Space>
              }
            >
              <Table dataSource={rates} columns={rateColumns} rowKey="id"
                loading={loading} pagination={{ pageSize: 15 }} size="small"
                locale={{ emptyText: 'No tax rates yet. Click "Add Tax Rate" to create one.' }}
              />
            </Card>
          )
        },
        {
          key: 'groups',
          label: <span><AppstoreOutlined /> Tax Groups</span>,
          children: (
            <Card bordered={false}
              style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}
              title={<strong>Tax Groups</strong>}
              extra={
                <Button type="primary" icon={<PlusOutlined />}
                  onClick={() => openGroupModal()} style={btnStyle}>
                  Add Tax Group
                </Button>
              }
            >
              <Table dataSource={groups} columns={groupColumns} rowKey="id"
                pagination={{ pageSize: 15 }} size="small"
                locale={{ emptyText: 'No tax groups yet. Click "Add Tax Group" to create one.' }}
              />
            </Card>
          )
        },
        {
          key: 'types',
          label: <span><AppstoreOutlined /> Tax Types</span>,
          children: (
            <Card bordered={false}
              style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}
              title={<strong>Tax Types</strong>}
              extra={
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input
                    ref={newTypeInputRef}
                    placeholder="New type name e.g. CESS"
                    value={newTypeName}
                    onChange={e => setNewTypeName(e.target.value)}
                    onPressEnter={handleAddType}
                    style={{ width: 200, borderRadius: 8 }}
                  />
                  <Button type="primary" icon={<PlusOutlined />}
                    onClick={handleAddType} style={btnStyle}>
                    Add
                  </Button>
                </div>
              }
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '8px 0' }}>
                {taxTypes.map(t => (
                  <Tag
                    key={t.id}
                    color="blue"
                    closable
                    onClose={e => handleDeleteType(e, t.id, t.name)}
                    style={{ fontSize: 13, padding: '4px 10px', borderRadius: 20 }}
                  >
                    {t.name.toUpperCase()}
                  </Tag>
                ))}
                {taxTypes.length === 0 && (
                  <span style={{ color: '#8c8c8c', fontSize: 13 }}>
                    No tax types yet. Add one above.
                  </span>
                )}
              </div>
            </Card>
          )
        }
      ]} />

      {/* Tax Group Modal */}
      <Modal
        title={editing ? 'Edit Tax Group' : 'Add Tax Group'}
        open={groupModal}
        onCancel={() => { setGroupModal(false); setEditing(null); groupForm.resetFields(); }}
        footer={null} width={480}
      >
        <Form form={groupForm} layout="vertical" onFinish={saveGroup} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Group Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. GST Group, VAT Group" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" style={btnStyle}>
                {editing ? 'Update' : 'Create'}
              </Button>
              <Button onClick={() => { setGroupModal(false); setEditing(null); groupForm.resetFields(); }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Tax Rate Modal */}
      <Modal
        title={editing ? 'Edit Tax Rate' : 'Add Tax Rate'}
        open={rateModal}
        onCancel={() => { setRateModal(false); setEditing(null); rateForm.resetFields(); }}
        footer={null} width={540}
      >
        <Form form={rateForm} layout="vertical" onFinish={saveRate} style={{ marginTop: 16 }}>
          <Row gutter={14}>
            <Col span={14}>
              <Form.Item name="name" label="Tax Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. GST 18%, VAT 5%" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="rate" label="Rate (%) — Gov. Fixed" rules={[{ required: true }]}>
                <InputNumber min={0} max={100} step={0.01} precision={2}
                  style={{ width: '100%' }} addonAfter="%"
                  disabled={!!editing} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={14}>
            {/* Tax Type — dynamic from API with inline add */}
            <Col span={12}>
              <Form.Item name="taxType" label="Tax Type" rules={[{ required: true }]}>
                <Select
                  placeholder="Select or add type"
                  dropdownRender={menu => (
                    <>
                      {menu}
                      <Divider style={{ margin: '6px 0' }} />
                      <div style={{ display: 'flex', gap: 6, padding: '4px 8px' }}>
                        <Input
                          ref={newTypeInputRef}
                          size="small"
                          placeholder="New type name"
                          value={newTypeName}
                          onChange={e => setNewTypeName(e.target.value)}
                          onKeyDown={e => e.stopPropagation()}
                          style={{ flex: 1 }}
                        />
                        <Button size="small" type="text" icon={<PlusOutlined />}
                          onClick={handleAddType}>
                          Add
                        </Button>
                      </div>
                    </>
                  )}
                >
                  {taxTypes.map(t => (
                    <Select.Option key={t.id} value={t.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{t.name.toUpperCase()}</span>
                        <span
                          onClick={e => handleDeleteType(e, t.id, t.name)}
                          style={{
                            marginLeft: 8, width: 18, height: 18, borderRadius: '50%',
                            background: '#ff4d4f', color: '#fff', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', fontSize: 11, fontWeight: 700,
                            flexShrink: 0
                          }}
                        >×</span>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            {/* Tax Group — dynamic from API with inline add */}
            <Col span={12}>
              <Form.Item name="taxGroupId" label="Tax Group">
                <Select
                  allowClear
                  placeholder="Select or add group"
                  dropdownRender={menu => (
                    <>
                      {menu}
                      <Divider style={{ margin: '6px 0' }} />
                      <div style={{ display: 'flex', gap: 6, padding: '4px 8px' }}>
                        <Input
                          ref={newGroupInputRef}
                          size="small"
                          placeholder="New group name"
                          value={newGroupName}
                          onChange={e => setNewGroupName(e.target.value)}
                          onKeyDown={e => e.stopPropagation()}
                          style={{ flex: 1 }}
                        />
                        <Button size="small" type="text" icon={<PlusOutlined />}
                          onClick={handleAddGroup}>
                          Add
                        </Button>
                      </div>
                    </>
                  )}
                >
                  {groups.map(g => (
                    <Select.Option key={g.id} value={g.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{g.name}</span>
                        <span
                          onClick={e => handleDeleteGroupInline(e, g.id, g.name)}
                          style={{
                            marginLeft: 8, width: 18, height: 18, borderRadius: '50%',
                            background: '#ff4d4f', color: '#fff', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', fontSize: 11, fontWeight: 700,
                            flexShrink: 0
                          }}
                        >×</span>
                      </div>
                    </Select.Option>
                  ))}
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
              <Button type="primary" htmlType="submit" style={btnStyle}>
                {editing ? 'Update' : 'Create'}
              </Button>
              <Button onClick={() => { setRateModal(false); setEditing(null); rateForm.resetFields(); }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
