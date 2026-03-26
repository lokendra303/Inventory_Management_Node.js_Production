import React, { useEffect, useState } from 'react';
import { Form, Select, InputNumber, Input, Button, Table, message, Space, Tag, Row, Col, Empty, Spin } from 'antd';
import { PlusOutlined, MinusOutlined, CheckCircleOutlined, ReloadOutlined, EditOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatPrice } from '../../utils/currency';

const ADJUSTMENT_REASONS = {
  increase: [
    { value: 'COUNT_CORRECTION', label: 'Count Correction' },
    { value: 'STOCK_FOUND',      label: 'Stock Found' },
    { value: 'RETURN',           label: 'Return to Stock' },
    { value: 'OTHER',            label: 'Other' }
  ],
  decrease: [
    { value: 'COUNT_CORRECTION', label: 'Count Correction' },
    { value: 'DAMAGED',          label: 'Damaged' },
    { value: 'EXPIRED',          label: 'Expired' },
    { value: 'MISSING',          label: 'Missing / Lost' },
    { value: 'THEFT',            label: 'Theft' },
    { value: 'OTHER',            label: 'Other' }
  ]
};

const InventoryAdjustments = () => {
  const { user } = useAuth();
  const { currency } = useCurrency();
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [currentStock, setCurrentStock] = useState(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const canAdjust = user?.permissions?.inventory_adjust || user?.permissions?.all;

  useEffect(() => {
    fetchLookups();
    fetchAdjustments();
  }, []);

  const fetchLookups = async () => {
    try {
      const [itemsRes, whRes] = await Promise.all([
        apiService.get('/items'),
        apiService.get('/warehouses')
      ]);
      setItems(itemsRes.success ? itemsRes.data : []);
      setWarehouses(whRes.success ? whRes.data.filter(w => w.status === 'active') : []);
    } catch {
      message.error('Failed to load items/warehouses');
    }
  };

  const fetchAdjustments = async () => {
    try {
      setLoading(true);
      const res = await apiService.get('/inventory/adjustments?limit=100');
      if (res.success) setAdjustments(res.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const onItemOrWarehouseChange = async () => {
    const itemId = form.getFieldValue('itemId');
    const warehouseId = form.getFieldValue('warehouseId');
    if (!itemId || !warehouseId) { setCurrentStock(null); return; }
    try {
      setStockLoading(true);
      const res = await apiService.get(`/inventory/${itemId}/${warehouseId}`);
      setCurrentStock(res.success
        ? (res.data || { quantity_on_hand: 0, quantity_available: 0, quantity_reserved: 0, average_cost: 0 })
        : null);
    } catch {
      setCurrentStock({ quantity_on_hand: 0, quantity_available: 0, quantity_reserved: 0, average_cost: 0 });
    } finally {
      setStockLoading(false);
    }
  };

  const onFinish = async (values) => {
    try {
      setSubmitting(true);
      const res = await apiService.post('/inventory/adjust', {
        itemId: values.itemId,
        warehouseId: values.warehouseId,
        adjustmentType: values.adjustmentType,
        quantityChange: values.quantityChange,
        reason: values.reason,
        lossType: values.adjustmentReason || 'OTHER'
      });
      if (res.success) {
        message.success('Inventory adjusted successfully');
        form.resetFields();
        setCurrentStock(null);
        fetchAdjustments();
      } else {
        message.error(res.error || 'Adjustment failed');
      }
    } catch (err) {
      message.error(err?.message || 'Adjustment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'Item',
      dataIndex: 'item_name',
      key: 'item_name',
      ellipsis: true,
      render: (name, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1a1a2e', fontSize: 13 }}>{name}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.sku}</div>
        </div>
      )
    },
    {
      title: 'Warehouse',
      dataIndex: 'warehouse_name',
      key: 'warehouse_name',
      render: (v) => v ? (
        <Tag style={{ borderRadius: 12, fontSize: 11, padding: '1px 8px', background: '#f0f5ff', border: '1px solid #adc6ff', color: '#2f54eb' }}>
          {v}
        </Tag>
      ) : '—'
    },
    {
      title: 'Type',
      dataIndex: 'adjustment_type',
      key: 'adjustment_type',
      width: 110,
      render: (v) => (
        <Tag
          icon={v === 'increase' ? <PlusOutlined /> : <MinusOutlined />}
          style={{
            borderRadius: 12, fontWeight: 600, fontSize: 11, padding: '2px 10px',
            background: v === 'increase' ? '#f6ffed' : '#fff1f0',
            border: `1px solid ${v === 'increase' ? '#b7eb8f' : '#ffa39e'}`,
            color: v === 'increase' ? '#389e0d' : '#cf1322'
          }}
        >
          {v === 'increase' ? 'Increase' : 'Decrease'}
        </Tag>
      )
    },
    {
      title: 'Qty',
      dataIndex: 'quantity_change',
      key: 'quantity_change',
      width: 80,
      align: 'right',
      render: (v, r) => (
        <span style={{ fontWeight: 700, color: r.adjustment_type === 'increase' ? '#52c41a' : '#ff4d4f', fontSize: 13 }}>
          {r.adjustment_type === 'increase' ? '+' : '-'}{v}
        </span>
      )
    },
    {
      title: 'Reason Type',
      dataIndex: 'loss_type',
      key: 'loss_type',
      render: (v) => v ? <Tag style={{ borderRadius: 10, fontSize: 11 }}>{v}</Tag> : '—'
    },
    { title: 'Notes', dataIndex: 'reason', key: 'reason', ellipsis: true, render: v => v || '—' },
    {
      title: 'Adjusted By',
      dataIndex: 'adjusted_by_name',
      key: 'adjusted_by_name',
      render: (v) => v?.trim() ? (
        <span style={{ fontSize: 12, color: '#595959' }}>{v.trim()}</span>
      ) : '—'
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v) => (
        <span style={{ fontSize: 12, color: '#8c8c8c' }}>{new Date(v).toLocaleString()}</span>
      )
    }
  ];

  const stockTiles = currentStock ? [
    { label: 'On Hand',   value: currentStock.quantity_on_hand ?? 0,   bg: 'linear-gradient(135deg, #1890ff, #096dd9)', icon: '📦' },
    { label: 'Available', value: currentStock.quantity_available ?? 0, bg: 'linear-gradient(135deg, #52c41a, #389e0d)', icon: '✅' },
    { label: 'Reserved',  value: currentStock.quantity_reserved ?? 0,  bg: 'linear-gradient(135deg, #fa8c16, #d46b08)', icon: '🔒' },
    { label: 'Avg Cost',  value: formatPrice(currentStock.average_cost ?? 0, currency, 'USD'), bg: 'linear-gradient(135deg, #722ed1, #531dab)', icon: '💰', isText: true }
  ] : [];

  return (
    <div style={{ padding: '20px 24px', background: '#f4f6fb', minHeight: '100vh' }}>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.3px' }}>Inventory Adjustments</h1>
          <p style={{ margin: '2px 0 0', color: '#8c8c8c', fontSize: 13 }}>Manually increase or decrease stock levels with a tracked reason</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchAdjustments} loading={loading} style={{ borderRadius: 8 }}>
          Refresh
        </Button>
      </div>

      {/* Adjustment Form */}
      {canAdjust && (
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 24, overflow: 'hidden' }}>
          {/* Form Header */}
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '16px 24px',
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            <EditOutlined style={{ color: '#fff', fontSize: 18 }} />
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>New Adjustment</span>
          </div>

          <div style={{ padding: '20px 24px' }}>
            <Form form={form} layout="vertical" onFinish={onFinish}>
              <Row gutter={[16, 0]}>
                <Col xs={24} sm={8}>
                  <Form.Item name="itemId" label={<span style={{ fontWeight: 600, fontSize: 13 }}>Item</span>} rules={[{ required: true }]}>
                    <Select
                      placeholder="Select item"
                      showSearch
                      filterOption={(input, option) => option.children.toLowerCase().includes(input.toLowerCase())}
                      onChange={onItemOrWarehouseChange}
                      style={{ borderRadius: 8 }}
                    >
                      {items.filter(i => i.status === 'active').map(i => (
                        <Select.Option key={i.id} value={i.id}>{i.name} ({i.sku})</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="warehouseId" label={<span style={{ fontWeight: 600, fontSize: 13 }}>Warehouse</span>} rules={[{ required: true }]}>
                    <Select placeholder="Select warehouse" onChange={onItemOrWarehouseChange}>
                      {warehouses.map(w => (
                        <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="adjustmentType" label={<span style={{ fontWeight: 600, fontSize: 13 }}>Adjustment Type</span>} rules={[{ required: true }]}>
                    <Select
                      placeholder="Select type"
                      onChange={() => form.setFieldsValue({ adjustmentReason: undefined })}
                    >
                      <Select.Option value="increase">
                        <span style={{ color: '#52c41a', fontWeight: 600 }}>▲ Increase</span>
                      </Select.Option>
                      <Select.Option value="decrease">
                        <span style={{ color: '#ff4d4f', fontWeight: 600 }}>▼ Decrease</span>
                      </Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              {/* Current Stock Preview */}
              {stockLoading && (
                <div style={{ textAlign: 'center', padding: '16px 0' }}><Spin size="small" /> <span style={{ color: '#8c8c8c', fontSize: 13, marginLeft: 8 }}>Loading stock levels…</span></div>
              )}
              {!stockLoading && currentStock && (
                <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
                  {stockTiles.map(({ label, value, bg, icon, isText }) => (
                    <Col xs={12} sm={6} key={label}>
                      <div style={{ background: bg, borderRadius: 12, padding: '12px 14px', color: '#fff', textAlign: 'center' }}>
                        <div style={{ fontSize: 18, marginBottom: 2 }}>{icon}</div>
                        <div style={{ fontSize: isText ? 14 : 20, fontWeight: 800, lineHeight: 1.2 }}>{value}</div>
                        <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>{label}</div>
                      </div>
                    </Col>
                  ))}
                </Row>
              )}

              <Row gutter={[16, 0]}>
                <Col xs={24} sm={8}>
                  <Form.Item name="quantityChange" label={<span style={{ fontWeight: 600, fontSize: 13 }}>Quantity</span>} rules={[{ required: true }]}>
                    <InputNumber min={0.01} step={1} style={{ width: '100%', borderRadius: 8 }} placeholder="Enter quantity" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item
                    noStyle
                    shouldUpdate={(prev, curr) => prev.adjustmentType !== curr.adjustmentType}
                  >
                    {({ getFieldValue }) => {
                      const type = getFieldValue('adjustmentType');
                      return (
                        <Form.Item name="adjustmentReason" label={<span style={{ fontWeight: 600, fontSize: 13 }}>Reason Type</span>} rules={[{ required: true }]}>
                          <Select placeholder={type ? 'Select reason' : 'Select type first'} disabled={!type}>
                            {(ADJUSTMENT_REASONS[type] || []).map(r => (
                              <Select.Option key={r.value} value={r.value}>{r.label}</Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                      );
                    }}
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="reason" label={<span style={{ fontWeight: 600, fontSize: 13 }}>Notes</span>} rules={[{ required: true, message: 'Please provide a reason' }]}>
                    <Input placeholder="e.g. Physical count correction" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item style={{ marginBottom: 0 }}>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={submitting}
                    icon={<CheckCircleOutlined />}
                    style={{ borderRadius: 8, fontWeight: 600, background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none', paddingInline: 24 }}
                  >
                    Submit Adjustment
                  </Button>
                  <Button
                    onClick={() => { form.resetFields(); setCurrentStock(null); }}
                    style={{ borderRadius: 8 }}
                  >
                    Reset
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        </div>
      )}

      {/* History Table */}
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>Adjustment History</span>
          {adjustments.length > 0 && (
            <span style={{ background: '#f0f5ff', color: '#2f54eb', borderRadius: 10, fontSize: 11, fontWeight: 600, padding: '1px 8px', border: '1px solid #adc6ff' }}>
              {adjustments.length}
            </span>
          )}
        </div>
        <Table
          dataSource={adjustments}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, size: 'small', showTotal: (t) => `${t} records`, style: { padding: '12px 20px' } }}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No adjustments yet" style={{ padding: '40px 0' }} /> }}
          style={{ fontSize: 13 }}
          rowClassName={(r) => r.adjustment_type === 'decrease' ? 'adj-decrease-row' : 'adj-increase-row'}
        />
      </div>

      <style>{`
        .adj-decrease-row { background: #fffafa !important; }
        .adj-decrease-row:hover > td { background: #fff1f0 !important; }
        .adj-increase-row:hover > td { background: #f6ffed !important; }
      `}</style>
    </div>
  );
};

export default InventoryAdjustments;
