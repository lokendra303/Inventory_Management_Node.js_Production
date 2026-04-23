import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Select,
  InputNumber, message, Tooltip, Row, Col, Empty, Tabs
} from 'antd';
import {
  PlusOutlined, EditOutlined, WarningOutlined, BulbOutlined,
  ReloadOutlined, CheckCircleOutlined, ShoppingCartOutlined
} from '@ant-design/icons';
import apiService from '../../services/apiService';

const { Option } = Select;

export default function ReorderLevels() {
  const [rules, setRules]           = useState([]);
  const [alerts, setAlerts]         = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [items, setItems]           = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [alertLoading, setAlertLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [ruleModal, setRuleModal]   = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [activeTab, setActiveTab]   = useState('rules');
  const [form] = Form.useForm();

  // ── Loaders ──────────────────────────────────────────────────────────────
  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.get('/reorder-levels');
      setRules(res.data || []);
    } catch { message.error('Failed to load reorder levels'); }
    finally { setLoading(false); }
  }, []);

  const loadAlerts = useCallback(async () => {
    setAlertLoading(true);
    try {
      const res = await apiService.get('/reorder-levels/low-stock-alerts');
      setAlerts(res.data || []);
    } catch { message.error('Failed to load alerts'); }
    finally { setAlertLoading(false); }
  }, []);

  const loadSuggestions = useCallback(async () => {
    setSuggestLoading(true);
    try {
      const res = await apiService.get('/reorder-levels/suggestions');
      setSuggestions(res.data || []);
    } catch { message.error('Failed to load suggestions'); }
    finally { setSuggestLoading(false); }
  }, []);

  const loadMeta = useCallback(async () => {
    try {
      const [iRes, wRes] = await Promise.all([
        apiService.get('/items'),
        apiService.get('/warehouses'),
      ]);
      setItems(iRes.data || []);
      setWarehouses(wRes.data || []);
    } catch {}
  }, []);

  useEffect(() => { loadRules(); loadMeta(); }, [loadRules, loadMeta]);
  useEffect(() => { if (activeTab === 'alerts') loadAlerts(); }, [activeTab, loadAlerts]);
  useEffect(() => { if (activeTab === 'suggestions') loadSuggestions(); }, [activeTab, loadSuggestions]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditRecord(null);
    form.resetFields();
    setRuleModal(true);
  };

  const openEdit = (record) => {
    setEditRecord(record);
    form.setFieldsValue({
      itemId:        record.item_id,
      warehouseId:   record.warehouse_id,
      reorderLevel:  parseFloat(record.reorder_level),
      reorderQuantity: parseFloat(record.reorder_quantity),
      maxStockLevel: parseFloat(record.max_stock_level),
    });
    setRuleModal(true);
  };

  const handleSave = async (values) => {
    try {
      await apiService.post('/reorder-levels', values);
      message.success(editRecord ? 'Reorder rule updated' : 'Reorder rule created');
      setRuleModal(false);
      form.resetFields();
      loadRules();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to save reorder rule');
    }
  };

  const handleAcknowledge = async (alertId) => {
    try {
      await apiService.put(`/reorder-levels/alerts/${alertId}/acknowledge`);
      message.success('Alert acknowledged');
      loadAlerts();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to acknowledge');
    }
  };

  // ── Summary counts ────────────────────────────────────────────────────────
  const lowCount    = rules.filter(r => r.stock_status === 'low').length;
  const okCount     = rules.filter(r => r.stock_status === 'ok').length;
  const activeAlerts = alerts.filter(a => a.status === 'active').length;

  const summaryTiles = [
    { label: 'Total Rules',    value: rules.length,  icon: '📋', bg: 'linear-gradient(135deg,#667eea,#764ba2)' },
    { label: 'Low Stock',      value: lowCount,       icon: '⚠️',  bg: 'linear-gradient(135deg,#ff4d4f,#cf1322)' },
    { label: 'Stock OK',       value: okCount,        icon: '✅',  bg: 'linear-gradient(135deg,#52c41a,#389e0d)' },
    { label: 'Active Alerts',  value: activeAlerts,   icon: '🔔',  bg: 'linear-gradient(135deg,#fa8c16,#d46b08)' },
  ];

  // ── Columns ───────────────────────────────────────────────────────────────
  const ruleColumns = [
    {
      title: 'Item', key: 'item',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1a1a2e', fontSize: 13 }}>{r.item_name}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.sku}</div>
        </div>
      )
    },
    {
      title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name',
      render: v => (
        <Tag style={{ borderRadius: 12, fontSize: 11, padding: '1px 8px', background: '#f0f5ff', border: '1px solid #adc6ff', color: '#2f54eb' }}>
          {v}
        </Tag>
      )
    },
    {
      title: 'Current Stock', dataIndex: 'current_stock', key: 'current_stock', align: 'right', width: 120,
      render: (v, r) => {
        const val = parseFloat(v || 0);
        const low = parseFloat(r.reorder_level || 0);
        const isLow = val <= low;
        return (
          <span style={{ fontWeight: 700, color: isLow ? '#ff4d4f' : '#52c41a', fontSize: 13 }}>
            {val.toFixed(2)}
          </span>
        );
      }
    },
    {
      title: 'Reorder Level', dataIndex: 'reorder_level', key: 'reorder_level', align: 'right', width: 120,
      render: v => <span style={{ fontWeight: 600, color: '#fa8c16' }}>{parseFloat(v || 0).toFixed(2)}</span>
    },
    {
      title: 'Reorder Qty', dataIndex: 'reorder_quantity', key: 'reorder_quantity', align: 'right', width: 110,
      render: v => <span style={{ fontWeight: 600, color: '#1890ff' }}>{parseFloat(v || 0).toFixed(2)}</span>
    },
    {
      title: 'Max Stock', dataIndex: 'max_stock_level', key: 'max_stock_level', align: 'right', width: 100,
      render: v => <span style={{ color: '#595959' }}>{parseFloat(v || 0).toFixed(2)}</span>
    },
    {
      title: 'Status', dataIndex: 'stock_status', key: 'stock_status', width: 90, align: 'center',
      render: v => v === 'low'
        ? <span style={{ background: '#fff1f0', color: '#ff4d4f', border: '1px solid #ffa39e', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '2px 10px' }}>LOW</span>
        : <span style={{ background: '#f6ffed', color: '#52c41a', border: '1px solid #b7eb8f', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '2px 10px' }}>OK</span>
    },
    {
      title: '', key: 'actions', width: 60, align: 'center',
      render: (_, r) => (
        <Tooltip title="Edit Rule">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}
            style={{ borderRadius: 6, background: '#667eea', color: '#fff', border: 'none' }} />
        </Tooltip>
      )
    }
  ];

  const alertColumns = [
    {
      title: 'Item', key: 'item',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1a1a2e', fontSize: 13 }}>{r.item_name}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.sku}</div>
        </div>
      )
    },
    {
      title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name',
      render: v => (
        <Tag style={{ borderRadius: 12, fontSize: 11, padding: '1px 8px', background: '#f0f5ff', border: '1px solid #adc6ff', color: '#2f54eb' }}>
          {v}
        </Tag>
      )
    },
    {
      title: 'Current Stock', dataIndex: 'current_stock', key: 'current_stock', align: 'right', width: 120,
      render: v => <span style={{ fontWeight: 700, color: '#ff4d4f', fontSize: 13 }}>{parseFloat(v || 0).toFixed(2)}</span>
    },
    {
      title: 'Reorder Level', dataIndex: 'reorder_level', key: 'reorder_level', align: 'right', width: 120,
      render: v => <span style={{ fontWeight: 600, color: '#fa8c16' }}>{parseFloat(v || 0).toFixed(2)}</span>
    },
    {
      title: 'Reorder Qty', dataIndex: 'reorder_quantity', key: 'reorder_quantity', align: 'right', width: 110,
      render: v => <span style={{ fontWeight: 600, color: '#1890ff' }}>{parseFloat(v || 0).toFixed(2)}</span>
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110, align: 'center',
      render: v => {
        const map = {
          active:       { bg: '#fff1f0', color: '#ff4d4f', border: '#ffa39e', label: 'ACTIVE' },
          acknowledged: { bg: '#fff7e6', color: '#fa8c16', border: '#ffd591', label: 'ACKNOWLEDGED' },
          resolved:     { bg: '#f6ffed', color: '#52c41a', border: '#b7eb8f', label: 'RESOLVED' },
        };
        const m = map[v] || map.active;
        return <span style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}`, borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '2px 8px' }}>{m.label}</span>;
      }
    },
    {
      title: '', key: 'actions', width: 80, align: 'center',
      render: (_, r) => r.status === 'active' && (
        <Tooltip title="Acknowledge Alert">
          <Button size="small" icon={<CheckCircleOutlined />} onClick={() => handleAcknowledge(r.id)}
            style={{ borderRadius: 6, background: '#52c41a', color: '#fff', border: 'none' }} />
        </Tooltip>
      )
    }
  ];

  const suggestionColumns = [
    {
      title: 'Item', key: 'item',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1a1a2e', fontSize: 13 }}>{r.item_name}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.sku}</div>
        </div>
      )
    },
    {
      title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name',
      render: v => (
        <Tag style={{ borderRadius: 12, fontSize: 11, padding: '1px 8px', background: '#f0f5ff', border: '1px solid #adc6ff', color: '#2f54eb' }}>
          {v}
        </Tag>
      )
    },
    {
      title: 'Current Stock', dataIndex: 'current_stock', key: 'current_stock', align: 'right', width: 120,
      render: v => <span style={{ fontWeight: 700, color: '#ff4d4f', fontSize: 13 }}>{parseFloat(v || 0).toFixed(2)}</span>
    },
    {
      title: 'Reorder Level', dataIndex: 'reorder_level', key: 'reorder_level', align: 'right', width: 120,
      render: v => <span style={{ fontWeight: 600, color: '#fa8c16' }}>{parseFloat(v || 0).toFixed(2)}</span>
    },
    {
      title: 'Shortage', dataIndex: 'shortage', key: 'shortage', align: 'right', width: 100,
      render: v => <span style={{ fontWeight: 700, color: '#ff4d4f' }}>{parseFloat(v || 0).toFixed(2)}</span>
    },
    {
      title: 'Suggested Order Qty', dataIndex: 'suggested_quantity', key: 'suggested_quantity', align: 'right', width: 150,
      render: v => (
        <span style={{ fontWeight: 700, color: '#1890ff', background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 8, padding: '2px 10px', fontSize: 13 }}>
          {parseFloat(v || 0).toFixed(2)}
        </span>
      )
    },
    {
      title: 'Preferred Vendor', dataIndex: 'preferred_vendor', key: 'preferred_vendor', width: 150,
      render: (v, r) => v
        ? <div>
            <div style={{ fontWeight: 600, fontSize: 12 }}>{v}</div>
            {r.lead_time_days && <div style={{ fontSize: 11, color: '#8c8c8c' }}>Lead: {r.lead_time_days}d</div>}
          </div>
        : <span style={{ color: '#bfbfbf', fontSize: 12 }}>No vendor history</span>
    }
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '20px 24px', background: 'linear-gradient(180deg,#f8f9ff 0%,#eef3ff 100%)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12,
        background: 'linear-gradient(135deg,#fa8c16 0%,#ff4d4f 100%)', borderRadius: 16, padding: '16px 18px',
        boxShadow: '0 10px 24px rgba(250,140,22,0.24)'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>Reorder Levels</h1>
          <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.88)', fontSize: 13 }}>Set stock thresholds, monitor low stock alerts and get reorder suggestions</p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadRules} loading={loading} style={{ borderRadius: 8 }}>Refresh</Button>
          <Button
            type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ borderRadius: 8, background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', fontWeight: 600 }}
          >
            Set Reorder Rule
          </Button>
        </Space>
      </div>

      {/* Summary Tiles */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {summaryTiles.map(({ label, value, icon, bg }) => (
          <Col xs={12} sm={6} key={label}>
            <div
              style={{ background: bg, borderRadius: 14, padding: '16px 20px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 8px 18px rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.16)', transition: 'all 0.22s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div>
                <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{value}</div>
              </div>
              <div style={{ fontSize: 26, opacity: 0.75 }}>{icon}</div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Tabs */}
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 6px 18px rgba(0,0,0,0.08)', border: '1px solid #edf0f7', overflow: 'hidden' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ padding: '0 20px' }}
          tabBarStyle={{ marginBottom: 12, paddingTop: 6 }}
          items={[
            {
              key: 'rules',
              label: <span style={{ fontWeight: 600 }}><EditOutlined style={{ marginRight: 6 }} />Reorder Rules</span>,
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  <Table
                    columns={ruleColumns} dataSource={rules} rowKey="id"
                    loading={loading} size="small"
                    className="reorder-premium-table"
                    pagination={{ pageSize: 20, showSizeChanger: true, size: 'small', showTotal: t => `${t} rules`, style: { padding: '12px 0' } }}
                    scroll={{ x: 'max-content' }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No reorder rules set yet" style={{ padding: '40px 0' }} /> }}
                    style={{ fontSize: 13 }}
                    rowClassName={r => r.stock_status === 'low' ? 'reorder-row-low' : ''}
                  />
                </div>
              )
            },
            {
              key: 'alerts',
              label: (
                <span style={{ fontWeight: 600 }}>
                  <WarningOutlined style={{ marginRight: 6, color: activeAlerts > 0 ? '#ff4d4f' : undefined }} />
                  Low Stock Alerts
                  {activeAlerts > 0 && (
                    <span style={{ marginLeft: 6, background: '#ff4d4f', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>
                      {activeAlerts}
                    </span>
                  )}
                </span>
              ),
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  <Table
                    columns={alertColumns} dataSource={alerts} rowKey="id"
                    loading={alertLoading} size="small"
                    className="reorder-premium-table"
                    pagination={{ pageSize: 20, showSizeChanger: true, size: 'small', showTotal: t => `${t} alerts`, style: { padding: '12px 0' } }}
                    scroll={{ x: 'max-content' }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No low stock alerts" style={{ padding: '40px 0' }} /> }}
                    style={{ fontSize: 13 }}
                  />
                </div>
              )
            },
            {
              key: 'suggestions',
              label: <span style={{ fontWeight: 600 }}><BulbOutlined style={{ marginRight: 6, color: '#fa8c16' }} />Reorder Suggestions</span>,
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  {suggestions.length > 0 && (
                    <div style={{ margin: '0 0 12px', padding: '10px 16px', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShoppingCartOutlined style={{ color: '#fa8c16', fontSize: 16 }} />
                      <span style={{ fontSize: 13, color: '#874d00', fontWeight: 500 }}>
                        {suggestions.length} item{suggestions.length > 1 ? 's' : ''} need restocking now. Review and raise purchase orders.
                      </span>
                    </div>
                  )}
                  <Table
                    columns={suggestionColumns} dataSource={suggestions} rowKey={r => `${r.item_id}-${r.warehouse_id}`}
                    loading={suggestLoading} size="small"
                    className="reorder-premium-table"
                    pagination={{ pageSize: 20, showSizeChanger: true, size: 'small', showTotal: t => `${t} items`, style: { padding: '12px 0' } }}
                    scroll={{ x: 'max-content' }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="All stock levels are healthy" style={{ padding: '40px 0' }} /> }}
                    style={{ fontSize: 13 }}
                  />
                </div>
              )
            }
          ]}
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        title={
          <span style={{ fontWeight: 700, fontSize: 16 }}>
            {editRecord ? '✏️ Edit Reorder Rule' : '➕ Set Reorder Rule'}
          </span>
        }
        open={ruleModal}
        onCancel={() => { setRuleModal(false); form.resetFields(); setEditRecord(null); }}
        onOk={() => form.submit()}
        okText={editRecord ? 'Update Rule' : 'Save Rule'}
        okButtonProps={{ style: { borderRadius: 8, background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', fontWeight: 600 } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        width="min(520px, 96vw)"
        style={{ top: 20 }}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="itemId" label={<span style={{ fontWeight: 600 }}>Item</span>} rules={[{ required: true, message: 'Select an item' }]}>
                <Select showSearch optionFilterProp="children" placeholder="Select item" disabled={!!editRecord} style={{ borderRadius: 8 }}>
                  {items.map(i => <Option key={i.id} value={i.id}>{i.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="warehouseId" label={<span style={{ fontWeight: 600 }}>Warehouse</span>} rules={[{ required: true, message: 'Select a warehouse' }]}>
                <Select placeholder="Select warehouse" disabled={!!editRecord} style={{ borderRadius: 8 }}>
                  {warehouses.map(w => <Option key={w.id} value={w.id}>{w.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <div style={{ background: '#f8f9ff', border: '1px solid #e8eaff', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#667eea', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Stock Thresholds
            </div>
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="reorderLevel" label={<span style={{ fontWeight: 600, fontSize: 12 }}>Reorder Level</span>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0 }}>
                  <InputNumber min={0} step={1} style={{ width: '100%', borderRadius: 8 }} placeholder="e.g. 10" />
                </Form.Item>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>Alert trigger point</div>
              </Col>
              <Col span={8}>
                <Form.Item name="reorderQuantity" label={<span style={{ fontWeight: 600, fontSize: 12 }}>Reorder Qty</span>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0 }}>
                  <InputNumber min={1} step={1} style={{ width: '100%', borderRadius: 8 }} placeholder="e.g. 50" />
                </Form.Item>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>How much to order</div>
              </Col>
              <Col span={8}>
                <Form.Item name="maxStockLevel" label={<span style={{ fontWeight: 600, fontSize: 12 }}>Max Stock</span>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0 }}>
                  <InputNumber min={1} step={1} style={{ width: '100%', borderRadius: 8 }} placeholder="e.g. 200" />
                </Form.Item>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>Upper stock limit</div>
              </Col>
            </Row>
          </div>
        </Form>
      </Modal>

      <style>{`
        .reorder-row-low td { background: #fff9f9 !important; }
        .reorder-row-low:hover td { background: #fff1f0 !important; }
        .reorder-premium-table .ant-table-thead > tr > th {
          background: linear-gradient(180deg,#fafbff,#f3f6ff) !important;
          font-weight: 700;
          color: #334155;
          border-bottom: 1px solid #e9edf7;
        }
        .reorder-premium-table .ant-table-tbody > tr:nth-child(even) > td {
          background: #fcfdff;
        }
        .reorder-premium-table .ant-table-tbody > tr:hover > td {
          background: #f0f5ff !important;
        }
      `}</style>
    </div>
  );
}
