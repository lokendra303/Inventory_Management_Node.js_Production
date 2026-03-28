import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Select, DatePicker,
  InputNumber, Input, message, Tooltip, Divider, Row, Col
} from 'antd';
import { PlusOutlined, EyeOutlined, CheckOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import dayjs from 'dayjs';

const { Option } = Select;
const STATUS_COLORS = { draft: 'default', confirmed: 'success', cancelled: 'error' };

export default function SalesReturns() {
  const [returns, setReturns] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [lines, setLines] = useState([{ itemId: '', warehouseId: '', quantity: 1, unitPrice: 0, returnReason: '' }]);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, cRes, iRes, wRes] = await Promise.all([
        apiService.get('/sales-orders', { params: { status: 'returned' } }),
        apiService.get('/customers'),
        apiService.get('/items'),
        apiService.get('/warehouses')
      ]);
      setReturns(rRes.data || []);
      setCustomers(cRes.data || []);
      setItems(iRes.data || []);
      setWarehouses(wRes.data || []);
    } catch { message.error('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (values) => {
    const validLines = lines.filter(l => l.itemId && l.warehouseId && l.quantity > 0);
    if (!validLines.length) { message.warning('Add at least one return line'); return; }
    try {
      // Post as a sales order with status 'returned' or use a dedicated endpoint if available
      await apiService.post('/sales-orders', {
        customerId: values.customerId,
        customerName: customers.find(c => c.id === values.customerId)?.display_name,
        orderDate: values.returnDate?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
        notes: `SALES RETURN - ${values.reason || ''}`,
        status: 'returned',
        lines: validLines.map(l => ({
          itemId: l.itemId,
          warehouseId: l.warehouseId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          notes: l.returnReason
        }))
      });
      message.success('Sales return created');
      setCreateModal(false);
      form.resetFields();
      setLines([{ itemId: '', warehouseId: '', quantity: 1, unitPrice: 0, returnReason: '' }]);
      load();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to create sales return');
    }
  };

  const addLine = () => setLines([...lines, { itemId: '', warehouseId: '', quantity: 1, unitPrice: 0, returnReason: '' }]);
  const removeLine = (idx) => setLines(lines.filter((_, i) => i !== idx));
  const updateLine = (idx, field, value) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    setLines(updated);
  };

  const columns = [
    { title: 'Order #', dataIndex: 'so_number', key: 'so_number', width: 140 },
    { title: 'Customer', dataIndex: 'customer_name', key: 'customer_name' },
    { title: 'Date', dataIndex: 'order_date', key: 'order_date', width: 120,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '-' },
    { title: 'Total', dataIndex: 'total_amount', key: 'total_amount', width: 110,
      render: v => `$${parseFloat(v || 0).toFixed(2)}` },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: v => <Tag color={STATUS_COLORS[v] || 'default'}>{v?.toUpperCase()}</Tag> },
    {
      title: 'Actions', key: 'actions', width: 100,
      render: (_, r) => (
        <Tooltip title="View">
          <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelected(r); setDetailModal(true); }} />
        </Tooltip>
      )
    }
  ];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>Sales Returns</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>New Return</Button>
      </div>
      <Table columns={columns} dataSource={returns} rowKey="id"
        loading={loading} size="small" pagination={{ pageSize: 20, size: 'small' }} scroll={{ x: 'max-content' }} />
      <Modal title="New Sales Return" open={createModal} width="min(900px, 96vw)" style={{ top: 16 }}
        onCancel={() => { setCreateModal(false); form.resetFields(); setLines([{ itemId: '', warehouseId: '', quantity: 1, unitPrice: 0, returnReason: '' }]); }}
        onOk={() => form.submit()} okText="Create Return">
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="customerId" label="Customer" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="children" placeholder="Select customer">
                  {customers.map(c => <Option key={c.id} value={c.id}>{c.display_name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="returnDate" label="Return Date" initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reason" label="Return Reason"><Input.TextArea rows={2} /></Form.Item>
        </Form>
        <Divider>Return Lines</Divider>
        {lines.map((line, idx) => (
          <div key={idx} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8, padding: 8, border: '1px solid #f0f0f0', borderRadius: 4 }}>
            <Select showSearch optionFilterProp="children" placeholder="Item" style={{ flex: 1, minWidth: 130 }}
              value={line.itemId || undefined} onChange={v => updateLine(idx, 'itemId', v)}>
              {items.map(i => <Option key={i.id} value={i.id}>{i.name}</Option>)}
            </Select>
            <Select placeholder="Warehouse" style={{ flex: 1, minWidth: 110 }}
              value={line.warehouseId || undefined} onChange={v => updateLine(idx, 'warehouseId', v)}>
              {warehouses.map(w => <Option key={w.id} value={w.id}>{w.name}</Option>)}
            </Select>
            <InputNumber placeholder="Qty" min={0.01} step={0.01} style={{ width: 75 }}
              value={line.quantity} onChange={v => updateLine(idx, 'quantity', v)} />
            <InputNumber placeholder="Price" min={0} step={0.01} style={{ width: 90 }}
              value={line.unitPrice} onChange={v => updateLine(idx, 'unitPrice', v)} />
            <Input placeholder="Reason" style={{ flex: 1, minWidth: 110 }}
              value={line.returnReason} onChange={e => updateLine(idx, 'returnReason', e.target.value)} />
            <Button danger icon={<DeleteOutlined />} onClick={() => removeLine(idx)} disabled={lines.length === 1} />
          </div>
        ))}
        <Button type="dashed" icon={<PlusOutlined />} onClick={addLine} style={{ marginTop: 8 }}>Add Line</Button>
      </Modal>
      <Modal title={`Return: ${selected?.so_number}`} open={detailModal} width="min(700px, 96vw)" style={{ top: 16 }}
        onCancel={() => setDetailModal(false)} footer={null}>
        {selected && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space wrap>
              <Tag>Customer: {selected.customer_name}</Tag>
              <Tag>Date: {selected.order_date ? dayjs(selected.order_date).format('DD MMM YYYY') : '-'}</Tag>
              <Tag color={STATUS_COLORS[selected.status] || 'default'}>{selected.status?.toUpperCase()}</Tag>
            </Space>
            {selected.notes && <p><strong>Notes:</strong> {selected.notes}</p>}
            <p><strong>Total:</strong> ${parseFloat(selected.total_amount || 0).toFixed(2)}</p>
          </Space>
        )}
      </Modal>
    </div>
  );
}
