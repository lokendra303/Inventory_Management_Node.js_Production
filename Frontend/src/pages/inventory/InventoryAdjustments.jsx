import React, { useEffect, useState } from 'react';
import { Card, Form, Select, InputNumber, Input, Button, Table, message, Space, Tag, Row, Col, Statistic } from 'antd';
import { PlusOutlined, MinusOutlined } from '@ant-design/icons';
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
      // silently fail — table will just be empty
    } finally {
      setLoading(false);
    }
  };

  const onItemOrWarehouseChange = async () => {
    const itemId = form.getFieldValue('itemId');
    const warehouseId = form.getFieldValue('warehouseId');
    if (!itemId || !warehouseId) { setCurrentStock(null); return; }
    try {
      const res = await apiService.get(`/inventory/${itemId}/${warehouseId}`);
      // res.data may be null if item has no projection yet — show zeros
      setCurrentStock(res.success ? (res.data || { quantity_on_hand: 0, quantity_available: 0, quantity_reserved: 0, average_cost: 0, total_value: 0 }) : null);
    } catch {
      setCurrentStock({ quantity_on_hand: 0, quantity_available: 0, quantity_reserved: 0, average_cost: 0, total_value: 0 });
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
      render: (name, r) => `${name} (${r.sku})`
    },
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name', render: v => v || '-' },
    {
      title: 'Type',
      dataIndex: 'adjustment_type',
      key: 'adjustment_type',
      render: (v) => (
        <Tag color={v === 'increase' ? 'green' : 'red'} icon={v === 'increase' ? <PlusOutlined /> : <MinusOutlined />}>
          {v === 'increase' ? 'Increase' : 'Decrease'}
        </Tag>
      )
    },
    { title: 'Qty', dataIndex: 'quantity_change', key: 'quantity_change' },
    { title: 'Reason Type', dataIndex: 'loss_type', key: 'loss_type', render: v => v || '-' },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', render: v => v || '-' },
    { title: 'Adjusted By', dataIndex: 'adjusted_by_name', key: 'adjusted_by_name', render: v => v?.trim() || '-' },
    { title: 'Ref', dataIndex: 'reference_number', key: 'reference_number' },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: v => new Date(v).toLocaleString()
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1>Inventory Adjustments</h1>

      {canAdjust && (
        <Card title="New Adjustment" style={{ marginBottom: 16 }}>
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="itemId" label="Item" rules={[{ required: true }]}>
                  <Select
                    placeholder="Select item"
                    showSearch
                    filterOption={(input, option) => option.children.toLowerCase().includes(input.toLowerCase())}
                    onChange={onItemOrWarehouseChange}
                  >
                    {items.filter(i => i.status === 'active').map(i => (
                      <Select.Option key={i.id} value={i.id}>{i.name} ({i.sku})</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}>
                  <Select placeholder="Select warehouse" onChange={onItemOrWarehouseChange}>
                    {warehouses.map(w => (
                      <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="adjustmentType" label="Adjustment Type" rules={[{ required: true }]}>
                  <Select onChange={() => form.setFieldsValue({ adjustmentReason: undefined })}>
                    <Select.Option value="increase">Increase</Select.Option>
                    <Select.Option value="decrease">Decrease</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {currentStock && (
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <Statistic title="On Hand" value={currentStock.quantity_on_hand ?? 0} />
                </Col>
                <Col span={6}>
                  <Statistic title="Available" value={currentStock.quantity_available ?? 0} />
                </Col>
                <Col span={6}>
                  <Statistic title="Reserved" value={currentStock.quantity_reserved ?? 0} />
                </Col>
                <Col span={6}>
                  <Statistic title="Avg Cost" value={formatPrice(currentStock.average_cost ?? 0, currency, 'USD')} />
                </Col>
              </Row>
            )}

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="quantityChange" label="Quantity" rules={[{ required: true }]}>
                  <InputNumber min={0.01} step={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, curr) => prev.adjustmentType !== curr.adjustmentType}
                >
                  {({ getFieldValue }) => {
                    const type = getFieldValue('adjustmentType');
                    return (
                      <Form.Item name="adjustmentReason" label="Reason Type" rules={[{ required: true }]}>
                        <Select placeholder={type ? 'Select reason' : 'Select adjustment type first'}>
                          {(ADJUSTMENT_REASONS[type] || []).map(r => (
                            <Select.Option key={r.value} value={r.value}>{r.label}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    );
                  }}
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'Please provide a reason' }]}>
                  <Input placeholder="e.g. Physical count correction" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={submitting}>Submit Adjustment</Button>
                <Button onClick={() => { form.resetFields(); setCurrentStock(null); }}>Reset</Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      )}

      <Card title="Adjustment History">
        <Table
          dataSource={adjustments}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      </Card>
    </div>
  );
};

export default InventoryAdjustments;
