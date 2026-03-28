import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Select, DatePicker,
  InputNumber, Input, message, Tooltip, Divider, Row, Col
} from 'antd';
import { PlusOutlined, EyeOutlined, CheckOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import dayjs from 'dayjs';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';

const { Option } = Select;

const STATUS_COLORS = {
  draft: 'default', dispatched: 'processing', delivered: 'success', cancelled: 'error'
};

export default function DeliveryChallans() {
  const { formatCurrency } = useCurrency();
  const [challans, setChallans] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [lines, setLines] = useState([{ itemId: '', warehouseId: '', quantity: 1, unitPrice: 0 }]);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, custRes, iRes, wRes] = await Promise.all([
        apiService.get('/delivery-challans'),
        apiService.get('/customers'),
        apiService.get('/items'),
        apiService.get('/warehouses')
      ]);
      setChallans(cRes.data || []);
      setCustomers(custRes.data || []);
      setItems(iRes.data || []);
      setWarehouses(wRes.data || []);
    } catch { message.error('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (values) => {
    const validLines = lines.filter(l => l.itemId && l.warehouseId && l.quantity > 0);
    if (!validLines.length) { message.warning('Add at least one line'); return; }
    try {
      await apiService.post('/delivery-challans', {
        customerId: values.customerId,
        customerName: customers.find(c => c.id === values.customerId)?.display_name,
        challanDate: values.challanDate?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
        deliveryAddress: values.deliveryAddress,
        notes: values.notes,
        lines: validLines
      });
      message.success('Delivery challan created');
      setCreateModal(false);
      form.resetFields();
      setLines([{ itemId: '', warehouseId: '', quantity: 1, unitPrice: 0 }]);
      load();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to create challan');
    }
  };

  const handleStatusUpdate = async (challanId, status) => {
    try {
      await apiService.put(`/delivery-challans/${challanId}/status`, { status });
      message.success(`Status updated to ${status}`);
      load();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to update status');
    }
  };

  const handleConvertToInvoice = (challanId) => {
    Modal.confirm({
      title: 'Convert to Sales Invoice?',
      content: 'This will create a sales invoice from this delivery challan.',
      okText: 'Convert',
      okType: 'primary',
      onOk: async () => {
        try {
          const res = await apiService.post(`/delivery-challans/${challanId}/convert-to-invoice`);
          message.success(`Invoice created: ${res.data?.invoiceId}`);
          load();
        } catch (e) {
          message.error(e.response?.data?.error || 'Failed to convert');
        }
      }
    });
  };

  const openDetail = async (record) => {
    try {
      const res = await apiService.get(`/delivery-challans/${record.id}`);
      setSelected(res.data);
      setDetailModal(true);
    } catch { message.error('Failed to load details'); }
  };

  const addLine = () => setLines([...lines, { itemId: '', warehouseId: '', quantity: 1, unitPrice: 0 }]);
  const removeLine = (idx) => setLines(lines.filter((_, i) => i !== idx));
  const updateLine = (idx, field, value) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    setLines(updated);
  };

  const columns = [
    { title: 'Challan #', dataIndex: 'challan_number', key: 'challan_number', width: 140 },
    { title: 'Customer', dataIndex: 'customer_name', key: 'customer_name' },
    { title: 'Date', dataIndex: 'challan_date', key: 'challan_date', width: 120,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '-' },
    { title: 'Lines', dataIndex: 'line_count', key: 'line_count', width: 70 },
    { title: 'Invoice', dataIndex: 'invoice_id', key: 'invoice_id', width: 100,
      render: v => v ? <Tag color="blue">Invoiced</Tag> : <Tag>Pending</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: v => <Tag color={STATUS_COLORS[v]}>{v?.toUpperCase()}</Tag> },
    {
      title: 'Actions', key: 'actions', width: 200,
      render: (_, r) => (
        <Space>
          <Tooltip title="View"><Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)} /></Tooltip>
          {r.status === 'draft' && (
            <Tooltip title="Mark Dispatched">
              <Button size="small" type="primary" icon={<CheckOutlined />}
                onClick={() => handleStatusUpdate(r.id, 'dispatched')} />
            </Tooltip>
          )}
          {r.status === 'dispatched' && (
            <Tooltip title="Mark Delivered">
              <Button size="small" type="primary" icon={<CheckOutlined />}
                onClick={() => handleStatusUpdate(r.id, 'delivered')} />
            </Tooltip>
          )}
          {r.status === 'delivered' && !r.invoice_id && (
            <Tooltip title="Convert to Invoice">
              <Button size="small" icon={<FileTextOutlined />}
                onClick={() => handleConvertToInvoice(r.id)} />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  const detailLineColumns = [
    { title: 'Item', dataIndex: 'item_name', key: 'item_name' },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 110 },
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name' },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity', width: 80,
      render: v => parseFloat(v || 0).toFixed(2) },
    { title: 'Unit Price', dataIndex: 'unit_price', key: 'unit_price', width: 100,
      render: v => formatCurrency(v) },
    { title: 'Total', key: 'total', width: 100,
      render: (_, r) => formatCurrency(parseFloat(r.quantity || 0) * parseFloat(r.unit_price || 0)) }
  ];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>Delivery Challans</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>New Challan</Button>
      </div>
      <Table columns={columns} dataSource={challans} rowKey="id" loading={loading} size="small"
        pagination={{ pageSize: 20, size: 'small' }} scroll={{ x: 'max-content' }} />
      <Modal title="New Delivery Challan" open={createModal} width="min(900px, 96vw)" style={{ top: 16 }}
        onCancel={() => { setCreateModal(false); form.resetFields(); setLines([{ itemId: '', warehouseId: '', quantity: 1, unitPrice: 0 }]); }}
        onOk={() => form.submit()} okText="Create Challan">
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
              <Form.Item name="challanDate" label="Challan Date" initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="deliveryAddress" label="Delivery Address"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
        </Form>
        <Divider>Challan Lines</Divider>
        {lines.map((line, idx) => (
          <div key={idx} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8, padding: 8, border: '1px solid #f0f0f0', borderRadius: 4 }}>
            <Select showSearch optionFilterProp="children" placeholder="Item" style={{ flex: 1, minWidth: 140 }}
              value={line.itemId || undefined} onChange={v => updateLine(idx, 'itemId', v)}>
              {items.map(i => <Option key={i.id} value={i.id}>{i.name}</Option>)}
            </Select>
            <Select placeholder="Warehouse" style={{ flex: 1, minWidth: 120 }}
              value={line.warehouseId || undefined} onChange={v => updateLine(idx, 'warehouseId', v)}>
              {warehouses.map(w => <Option key={w.id} value={w.id}>{w.name}</Option>)}
            </Select>
            <InputNumber placeholder="Qty" min={0.01} step={0.01} style={{ width: 80 }}
              value={line.quantity} onChange={v => updateLine(idx, 'quantity', v)} />
            <InputNumber placeholder="Unit Price" min={0} step={0.01} style={{ width: 100 }}
              value={line.unitPrice} onChange={v => updateLine(idx, 'unitPrice', v)} />
            <Button danger icon={<DeleteOutlined />} onClick={() => removeLine(idx)} disabled={lines.length === 1} />
          </div>
        ))}
        <Button type="dashed" icon={<PlusOutlined />} onClick={addLine} style={{ marginTop: 8 }}>Add Line</Button>
      </Modal>
      <Modal title={`Challan: ${selected?.challan_number}`} open={detailModal} width="min(800px, 96vw)" style={{ top: 16 }}
        onCancel={() => setDetailModal(false)} footer={null}>
        {selected && (
          <>
            <Space wrap style={{ marginBottom: 16 }}>
              <Tag>Customer: {selected.customer_name}</Tag>
              <Tag>Date: {selected.challan_date ? dayjs(selected.challan_date).format('DD MMM YYYY') : '-'}</Tag>
              <Tag color={STATUS_COLORS[selected.status]}>{selected.status?.toUpperCase()}</Tag>
            </Space>
            {selected.delivery_address && <p style={{ marginBottom: 12 }}><strong>Delivery Address:</strong> {selected.delivery_address}</p>}
            <Table columns={detailLineColumns} dataSource={selected.lines || []} rowKey="id" size="small" pagination={false} scroll={{ x: 'max-content' }} />
          </>
        )}
      </Modal>
    </div>
  );
}
