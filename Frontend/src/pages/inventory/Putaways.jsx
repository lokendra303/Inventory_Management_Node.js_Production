import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, Space, Modal, Form, Select, Input, message, Tooltip, Card, Statistic, Row, Col } from 'antd';
import { CheckOutlined, InboxOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import dayjs from 'dayjs';

const { Option } = Select;

export default function Putaways() {
  const [pendingReceipts, setPendingReceipts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [putawayModal, setPutawayModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prRes, wRes] = await Promise.all([
        apiService.get('/grn/pending-receipts'),
        apiService.get('/warehouses')
      ]);
      setPendingReceipts(prRes.data || []);
      setWarehouses(wRes.data || []);
    } catch { message.error('Failed to load putaway data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openPutaway = (record) => {
    setSelected(record);
    form.resetFields();
    setPutawayModal(true);
  };

  const handlePutaway = async (values) => {
    try {
      // Mark the GRN as put away by receiving stock into the specified location
      await apiService.post('/inventory/receive', {
        itemId: selected.item_id,
        warehouseId: values.warehouseId,
        quantity: selected.pending_quantity || selected.quantity_ordered,
        unitCost: selected.unit_cost || 0,
        reference: `PUTAWAY-${selected.grn_number || selected.po_number}`,
        notes: values.notes
      });
      message.success('Putaway completed — stock added to warehouse');
      setPutawayModal(false);
      form.resetFields();
      load();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to complete putaway');
    }
  };

  const totalPending = pendingReceipts.reduce((s, r) => s + (parseFloat(r.pending_quantity || r.quantity_ordered) || 0), 0);

  const columns = [
    { title: 'PO #', dataIndex: 'po_number', key: 'po_number', width: 120, ellipsis: true },
    { title: 'GRN #', dataIndex: 'grn_number', key: 'grn_number', width: 120, ellipsis: true },
    { title: 'Item', dataIndex: 'item_name', key: 'item_name', width: 140, ellipsis: true },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 100, ellipsis: true },
    { title: 'Vendor', dataIndex: 'vendor_name', key: 'vendor_name', width: 120, ellipsis: true },
    { title: 'Qty Pending', key: 'qty', width: 100,
      render: (_, r) => <Tag color="orange">{parseFloat(r.pending_quantity || r.quantity_ordered || 0).toFixed(2)}</Tag> },
    { title: 'Receipt Date', dataIndex: 'receipt_date', key: 'receipt_date', width: 120,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '-' },
    {
      title: 'Actions', key: 'actions', width: 110, fixed: 'right',
      render: (_, r) => (
        <Tooltip title="Put Away">
          <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => openPutaway(r)}>
            Put Away
          </Button>
        </Tooltip>
      )
    }
  ];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>Putaways</h2>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic title="Pending Putaways" value={pendingReceipts.length}
              prefix={<InboxOutlined />} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic title="Units Pending" value={totalPending.toFixed(2)} />
          </Card>
        </Col>
      </Row>

      <Table columns={columns} dataSource={pendingReceipts} rowKey={(r) => `${r.po_number}-${r.item_id}`}
        loading={loading} size="small" pagination={{ pageSize: 20, size: 'small' }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'No pending putaways — all received goods have been put away' }} />

      <Modal title={`Put Away — ${selected?.item_name}`} open={putawayModal}
        onCancel={() => { setPutawayModal(false); form.resetFields(); }}
        onOk={() => form.submit()} okText="Complete Putaway"
        width="min(480px, 96vw)" style={{ top: 16 }}>
        {selected && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f6f8fa', borderRadius: 6 }}>
            <strong>Item:</strong> {selected.item_name} ({selected.sku})<br />
            <strong>Quantity:</strong> {parseFloat(selected.pending_quantity || selected.quantity_ordered || 0).toFixed(2)}<br />
            <strong>From PO:</strong> {selected.po_number}
          </div>
        )}
        <Form form={form} layout="vertical" onFinish={handlePutaway}>
          <Form.Item name="warehouseId" label="Destination Warehouse" rules={[{ required: true }]}>
            <Select placeholder="Select warehouse">
              {warehouses.filter(w => w.status === 'active').map(w => (
                <Option key={w.id} value={w.id}>{w.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Putaway notes (optional)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
