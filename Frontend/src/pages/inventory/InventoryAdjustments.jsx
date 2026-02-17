import React, { useEffect, useState } from 'react';
import { Card, Form, Select, InputNumber, Input, Button, Table, message, Space } from 'antd';
import apiService from '../../services/apiService';
import { useAuth } from '../../hooks/useAuth.jsx';

const InventoryAdjustments = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchLookups();
  }, []);

  const fetchLookups = async () => {
    try {
      setLoading(true);
      const [itemsRes, whRes] = await Promise.all([
        apiService.get('/items'),
        apiService.get('/warehouses')
      ]);
      setItems(itemsRes.success ? itemsRes.data : []);
      setWarehouses(whRes.success ? whRes.data : []);
    } catch (err) {
      message.error('Failed to load lookups');
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values) => {
    try {
      setLoading(true);
      const payload = {
        itemId: values.itemId,
        warehouseId: values.warehouseId,
        adjustmentType: values.adjustmentType,
        quantityChange: values.quantityChange,
        reason: values.reason
      };

      const res = await apiService.post('/inventory/adjust', payload);
      if (res.success) {
        message.success('Inventory adjusted');
        setList(prev => [{ ...payload, id: Date.now(), created_at: new Date().toISOString(), user: user?.email || user?.id }, ...prev]);
        form.resetFields();
      } else {
        message.error(res.message || 'Adjustment failed');
      }
    } catch (err) {
      message.error('Adjustment failed');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: 'Item', dataIndex: 'itemId', key: 'itemId', render: (id) => items.find(i => i.id === id)?.name || id },
    { title: 'Warehouse', dataIndex: 'warehouseId', key: 'warehouseId', render: (id) => warehouses.find(w => w.id === id)?.name || id },
    { title: 'Type', dataIndex: 'adjustmentType', key: 'adjustmentType' },
    { title: 'Qty', dataIndex: 'quantityChange', key: 'quantityChange' },
    { title: 'Reason', dataIndex: 'reason', key: 'reason' },
    { title: 'By', dataIndex: 'user', key: 'user' },
    { title: 'Date', dataIndex: 'created_at', key: 'created_at' }
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1>Inventory Adjustments</h1>
      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="itemId" label="Item" rules={[{ required: true }]}>
            <Select placeholder="Select item" loading={loading}>
              {items.filter(i => i.status === 'active').map(i => <Select.Option key={i.id} value={i.id}>{i.name} ({i.sku})</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}>
            <Select placeholder="Select warehouse" loading={loading}>
              {warehouses.filter(w => w.status === 'active').map(w => <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="adjustmentType" label="Type" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="increase">Increase</Select.Option>
              <Select.Option value="decrease">Decrease</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="quantityChange" label="Quantity" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>Submit Adjustment</Button>
              <Button onClick={() => form.resetFields()}>Reset</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card title="Recent Adjustments">
        <Table dataSource={list} columns={columns} rowKey={(r) => r.id} />
      </Card>
    </div>
  );
};

export default InventoryAdjustments;
