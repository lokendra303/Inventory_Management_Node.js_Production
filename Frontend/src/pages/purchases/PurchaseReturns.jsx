import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Select, DatePicker,
  InputNumber, Input, message, Tooltip, Divider
} from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import dayjs from 'dayjs';
import { useCurrency } from '../../contexts/CurrencyContext';

const { Option } = Select;

const STATUS_COLORS = { draft: 'default', confirmed: 'success', cancelled: 'error' };

export default function PurchaseReturns() {
  const { formatCurrency } = useCurrency();
  const [returns, setReturns] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [lines, setLines] = useState([{ itemId: '', warehouseId: '', quantity: 1, unitCost: 0, returnReason: '' }]);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, vRes, iRes, wRes] = await Promise.all([
        apiService.get('/purchase-returns'),
        apiService.get('/vendors'),
        apiService.get('/items'),
        apiService.get('/warehouses')
      ]);
      setReturns(rRes.data || []);
      setVendors(vRes.data || []);
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
      await apiService.post('/purchase-returns', {
        vendorId: values.vendorId,
        vendorName: vendors.find(v => v.id === values.vendorId)?.display_name || values.vendorName,
        returnDate: values.returnDate?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
        reason: values.reason,
        lines: validLines
      });
      message.success('Purchase return created');
      setCreateModal(false);
      form.resetFields();
      setLines([{ itemId: '', warehouseId: '', quantity: 1, unitCost: 0, returnReason: '' }]);
      load();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to create return');
    }
  };

  const handleConfirm = (returnId) => {
    Modal.confirm({
      title: 'Confirm Purchase Return?',
      content: 'This will deduct the returned quantities from inventory and generate a Debit Note.',
      okText: 'Confirm Return',
      okType: 'primary',
      onOk: async () => {
        try {
          const res = await apiService.post(`/purchase-returns/${returnId}/confirm`);
          message.success(`Return confirmed. Debit Note: ${res.data?.debitNoteNumber}`);
          load();
        } catch (e) {
          message.error(e.response?.data?.error || 'Failed to confirm return');
        }
      }
    });
  };

  const handleCancel = async (returnId) => {
    try {
      await apiService.post(`/purchase-returns/${returnId}/cancel`);
      message.success('Return cancelled');
      load();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to cancel');
    }
  };

  const openDetail = async (record) => {
    try {
      const res = await apiService.get(`/purchase-returns/${record.id}`);
      setSelectedReturn(res.data);
      setDetailModal(true);
    } catch { message.error('Failed to load return details'); }
  };

  const addLine = () => setLines([...lines, { itemId: '', warehouseId: '', quantity: 1, unitCost: 0, returnReason: '' }]);
  const removeLine = (idx) => setLines(lines.filter((_, i) => i !== idx));
  const updateLine = (idx, field, value) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    setLines(updated);
  };

  const columns = [
    { title: 'Return #', dataIndex: 'return_number', key: 'return_number', width: 140 },
    { title: 'Vendor', key: 'vendor', render: (_, r) => r.vendor_display_name || r.vendor_name },
    { title: 'Return Date', dataIndex: 'return_date', key: 'return_date', width: 120,
      render: v => dayjs(v).format('DD MMM YYYY') },
    { title: 'Lines', dataIndex: 'line_count', key: 'line_count', width: 70 },
    { title: 'Total', dataIndex: 'total_amount', key: 'total_amount', width: 110,
      render: v => formatCurrency(v) },
    { title: 'Debit Note', dataIndex: 'debit_note_number', key: 'debit_note_number', width: 130,
      render: v => v ? <Tag color="blue">{v}</Tag> : '-' },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: v => <Tag color={STATUS_COLORS[v]}>{v?.toUpperCase()}</Tag> },
    {
      title: 'Actions', key: 'actions', width: 140,
      render: (_, r) => (
        <Space>
          <Tooltip title="View"><Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)} /></Tooltip>
          {r.status === 'draft' && (
            <>
              <Tooltip title="Confirm">
                <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleConfirm(r.id)} />
              </Tooltip>
              <Tooltip title="Cancel">
                <Button size="small" danger icon={<CloseOutlined />} onClick={() => handleCancel(r.id)} />
              </Tooltip>
            </>
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
    { title: 'Unit Cost', dataIndex: 'unit_cost', key: 'unit_cost', width: 100,
      render: v => formatCurrency(v) },
    { title: 'Total', dataIndex: 'line_total', key: 'line_total', width: 100,
      render: v => formatCurrency(v) },
    { title: 'Reason', dataIndex: 'return_reason', key: 'return_reason' }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Purchase Returns</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
          New Return
        </Button>
      </div>

      <Table columns={columns} dataSource={returns} rowKey="id"
        loading={loading} size="small" pagination={{ pageSize: 20 }} />

      {/* Create Modal */}
      <Modal title="New Purchase Return" open={createModal} width={900}
        onCancel={() => { setCreateModal(false); form.resetFields(); setLines([{ itemId: '', warehouseId: '', quantity: 1, unitCost: 0, returnReason: '' }]); }}
        onOk={() => form.submit()} okText="Create Return">
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="vendorId" label="Vendor" style={{ flex: 1 }} rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="children" placeholder="Select vendor">
                {vendors.map(v => <Option key={v.id} value={v.id}>{v.display_name}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="returnDate" label="Return Date" style={{ flex: 1 }} initialValue={dayjs()}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="reason" label="Return Reason">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>

        <Divider>Return Lines</Divider>
        {lines.map((line, idx) => (
          <Space key={idx} style={{ display: 'flex', marginBottom: 8 }} align="start">
            <Select showSearch optionFilterProp="children" placeholder="Item" style={{ width: 200 }}
              value={line.itemId || undefined}
              onChange={v => updateLine(idx, 'itemId', v)}>
              {items.map(i => <Option key={i.id} value={i.id}>{i.name}</Option>)}
            </Select>
            <Select placeholder="Warehouse" style={{ width: 150 }}
              value={line.warehouseId || undefined}
              onChange={v => updateLine(idx, 'warehouseId', v)}>
              {warehouses.map(w => <Option key={w.id} value={w.id}>{w.name}</Option>)}
            </Select>
            <InputNumber placeholder="Qty" min={0.01} step={0.01} style={{ width: 80 }}
              value={line.quantity} onChange={v => updateLine(idx, 'quantity', v)} />
            <InputNumber placeholder="Unit Cost" min={0} step={0.01} style={{ width: 100 }}
              value={line.unitCost} onChange={v => updateLine(idx, 'unitCost', v)} />
            <Input placeholder="Reason" style={{ width: 150 }}
              value={line.returnReason} onChange={e => updateLine(idx, 'returnReason', e.target.value)} />
            <Button danger icon={<DeleteOutlined />} onClick={() => removeLine(idx)} disabled={lines.length === 1} />
          </Space>
        ))}
        <Button type="dashed" icon={<PlusOutlined />} onClick={addLine} style={{ marginTop: 8 }}>
          Add Line
        </Button>
      </Modal>

      {/* Detail Modal */}
      <Modal title={`Return: ${selectedReturn?.return_number}`} open={detailModal} width={800}
        onCancel={() => setDetailModal(false)} footer={null}>
        {selectedReturn && (
          <>
            <Space style={{ marginBottom: 16 }}>
              <Tag>Vendor: {selectedReturn.vendor_display_name || selectedReturn.vendor_name}</Tag>
              <Tag>Date: {dayjs(selectedReturn.return_date).format('DD MMM YYYY')}</Tag>
              <Tag color={STATUS_COLORS[selectedReturn.status]}>{selectedReturn.status?.toUpperCase()}</Tag>
              {selectedReturn.debit_note_number && <Tag color="blue">DN: {selectedReturn.debit_note_number}</Tag>}
            </Space>
            <Table columns={detailLineColumns} dataSource={selectedReturn.lines || []}
              rowKey="id" size="small" pagination={false} />
            <div style={{ textAlign: 'right', marginTop: 8, fontWeight: 'bold' }}>
              Total: {formatCurrency(selectedReturn.total_amount || 0)}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
