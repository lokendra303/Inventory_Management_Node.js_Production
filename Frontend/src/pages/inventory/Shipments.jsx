import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, Space, Modal, Form, Select, InputNumber, Input, message, Card, Row, Col, Statistic } from 'antd';
import { PlusOutlined, SendOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import dayjs from 'dayjs';

const { Option } = Select;

export default function Shipments() {
  const [shipments, setShipments] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, iRes, wRes, soRes] = await Promise.all([
        apiService.get('/inventory/transfers'),
        apiService.get('/items', { params: { status: 'active' } }),
        apiService.get('/warehouses', { params: { status: 'active' } }),
        apiService.get('/sales-orders', { params: { status: 'confirmed' } })
      ]);
      // Show ship operations from transfer history
      setShipments((invRes.data || []).filter(t => t.event_type === 'STOCK_SHIPPED' || t.operation_type === 'ship'));
      setItems(iRes.data || []);
      setWarehouses(wRes.data || []);
      setSalesOrders(soRes.data || []);
    } catch { message.error('Failed to load shipments'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleShip = async (values) => {
    try {
      await apiService.post('/inventory/ship', {
        itemId: values.itemId,
        warehouseId: values.warehouseId,
        quantity: values.quantity,
        soId: values.soId,
        reference: values.reference,
        notes: values.notes
      });
      message.success('Stock shipped successfully');
      setCreateModal(false);
      form.resetFields();
      load();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to ship stock');
    }
  };

  const totalShipped = shipments.reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);

  const columns = [
    { title: 'Item', dataIndex: 'item_name', key: 'item_name',
      render: (v, r) => v || r.item_id },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 110 },
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name',
      render: (v, r) => v || r.warehouse_id },
    { title: 'Qty Shipped', dataIndex: 'quantity', key: 'quantity', width: 110,
      render: v => <Tag color="blue">{parseFloat(v || 0).toFixed(2)}</Tag> },
    { title: 'Reference', dataIndex: 'reference', key: 'reference',
      render: v => v || '-' },
    { title: 'Date', dataIndex: 'created_at', key: 'created_at', width: 130,
      render: v => v ? dayjs(v).format('DD MMM YYYY HH:mm') : '-' }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Shipments</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
          Ship Stock
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title="Total Shipments" value={shipments.length} prefix={<SendOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="Total Units Shipped" value={totalShipped.toFixed(2)} />
          </Card>
        </Col>
      </Row>

      <Table columns={columns} dataSource={shipments} rowKey={(r, i) => r.id || i}
        loading={loading} size="small" pagination={{ pageSize: 20 }}
        locale={{ emptyText: 'No shipments recorded yet' }} />

      <Modal title="Ship Stock" open={createModal}
        onCancel={() => { setCreateModal(false); form.resetFields(); }}
        onOk={() => form.submit()} okText="Ship">
        <Form form={form} layout="vertical" onFinish={handleShip}>
          <Form.Item name="itemId" label="Item" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children" placeholder="Select item">
              {items.map(i => <Option key={i.id} value={i.id}>{i.name} ({i.sku})</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="warehouseId" label="From Warehouse" rules={[{ required: true }]}>
            <Select placeholder="Select warehouse">
              {warehouses.map(w => <Option key={w.id} value={w.id}>{w.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]}>
            <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="soId" label="Sales Order (optional)">
            <Select showSearch optionFilterProp="children" placeholder="Link to sales order" allowClear>
              {salesOrders.map(so => <Option key={so.id} value={so.id}>{so.so_number} — {so.customer_name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="reference" label="Reference">
            <Input placeholder="Shipment reference" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
