import React, { useEffect, useState } from 'react';
import { Card, Form, Select, InputNumber, Button, Table, message, Space } from 'antd';
import apiService from '../services/apiService';
import { useAuth } from '../hooks/useAuth.jsx';

const MoveOrders = () => {
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
        fromWarehouseId: values.fromWarehouseId,
        toWarehouseId: values.toWarehouseId,
        quantity: values.quantity
      };

      const res = await apiService.post('/inventory/transfer', payload);
      if (res.success) {
        message.success('Transfer created');
        setList(prev => [{ ...payload, id: Date.now(), created_at: new Date().toISOString(), user: user?.email || user?.id }, ...prev]);
        form.resetFields();
      } else {
        message.error(res.message || 'Transfer failed');
      }
    } catch (err) {
      message.error('Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: 'Item', dataIndex: 'itemId', key: 'itemId', render: (id) => items.find(i => i.id === id)?.name || id },
    { title: 'From', dataIndex: 'fromWarehouseId', key: 'fromWarehouseId', render: (id) => warehouses.find(w => w.id === id)?.name || id },
    { title: 'To', dataIndex: 'toWarehouseId', key: 'toWarehouseId', render: (id) => warehouses.find(w => w.id === id)?.name || id },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity' },
    { title: 'By', dataIndex: 'user', key: 'user' },
    { title: 'Date', dataIndex: 'created_at', key: 'created_at' }
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1>Move Orders</h1>
      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="itemId" label="Item" rules={[{ required: true }]}>
            <Select placeholder="Select item" loading={loading}>
              {items.map(i => <Select.Option key={i.id} value={i.id}>{i.name} ({i.sku})</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="fromWarehouseId" label="From Warehouse" rules={[{ required: true }]}>
            <Select placeholder="Select source" loading={loading}>
              {warehouses.map(w => <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="toWarehouseId" label="To Warehouse" rules={[{ required: true }]}>
            <Select placeholder="Select destination" loading={loading}>
              {warehouses.map(w => <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>Create Move</Button>
              <Button onClick={() => form.resetFields()}>Reset</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card title="Recent Moves">
        <Table dataSource={list} columns={columns} rowKey={(r) => r.id} />
      </Card>
    </div>
  );
};

export default MoveOrders;
