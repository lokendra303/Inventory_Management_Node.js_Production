import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Select, Input, InputNumber,
  message, Tooltip, Card, Statistic, Row, Col, Tabs, Alert
} from 'antd';
import { CheckOutlined, InboxOutlined, HistoryOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import dayjs from 'dayjs';

const { Option } = Select;

export default function Putaways() {
  const [pendingPutaways, setPendingPutaways] = useState([]);
  const [history, setHistory] = useState([]);
  const [bins, setBins] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [putawayModal, setPutawayModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [warehouseFilter, setWarehouseFilter] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const params = warehouseFilter ? { warehouseId: warehouseFilter } : {};
      const res = await apiService.get('/putaways/pending', { params });
      setPendingPutaways(res.data || []);
    } catch {
      message.error('Failed to load pending putaways');
    } finally {
      setLoading(false);
    }
  }, [warehouseFilter]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = warehouseFilter ? { warehouseId: warehouseFilter } : {};
      const res = await apiService.get('/putaways/history', { params });
      setHistory(res.data || []);
    } catch {
      message.error('Failed to load putaway history');
    } finally {
      setHistoryLoading(false);
    }
  }, [warehouseFilter]);

  const loadWarehouses = useCallback(async () => {
    try {
      const res = await apiService.get('/warehouses');
      setWarehouses(res.data || []);
    } catch {
      message.error('Failed to load warehouses');
    }
  }, []);

  useEffect(() => { loadWarehouses(); }, [loadWarehouses]);
  useEffect(() => { loadPending(); }, [loadPending]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const loadBinsForWarehouse = async (warehouseId) => {
    if (!warehouseId) {
      setBins([]);
      return;
    }
    try {
      const res = await apiService.get('/warehouse-locations/bins', {
        params: { warehouseId, status: 'active', limit: 2000 },
      });
      setBins(res.data || []);
    } catch {
      message.error('Failed to load bins');
      setBins([]);
    }
  };

  const openPutaway = async (record) => {
    setSelected(record);
    form.resetFields();
    await loadBinsForWarehouse(record.warehouseId);
    setPutawayModal(true);
    form.setFieldsValue({
      quantity: record.pendingQuantity,
      binId: record.defaultBinId || undefined,
    });
  };

  const handlePutaway = async (values) => {
    setSubmitting(true);
    try {
      await apiService.post('/putaways', {
        grnLineId: selected.grnLineId,
        binId: values.binId,
        quantity: values.quantity,
        notes: values.notes,
      });
      message.success('Putaway completed — stock assigned to bin');
      setPutawayModal(false);
      form.resetFields();
      setSelected(null);
      loadPending();
      loadHistory();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to complete putaway');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPending = pendingPutaways.reduce(
    (s, r) => s + (parseFloat(r.pendingQuantity) || 0),
    0
  );

  const pendingColumns = [
    { title: 'PO #', dataIndex: 'poNumber', key: 'poNumber', width: 110, ellipsis: true },
    { title: 'GRN #', dataIndex: 'grnNumber', key: 'grnNumber', width: 120, ellipsis: true },
    { title: 'Item', dataIndex: 'itemName', key: 'itemName', width: 150, ellipsis: true },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 100, ellipsis: true },
    { title: 'Vendor', dataIndex: 'vendorName', key: 'vendorName', width: 120, ellipsis: true },
    { title: 'Warehouse', dataIndex: 'warehouseName', key: 'warehouseName', width: 120, ellipsis: true },
    {
      title: 'Qty Pending', key: 'qty', width: 100,
      render: (_, r) => <Tag color="orange">{parseFloat(r.pendingQuantity || 0).toFixed(2)}</Tag>,
    },
    {
      title: 'Received', key: 'received', width: 90,
      render: (_, r) => parseFloat(r.quantityReceived || 0).toFixed(2),
    },
    {
      title: 'Receipt Date', dataIndex: 'receiptDate', key: 'receiptDate', width: 120,
      render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '-'),
    },
    {
      title: 'Actions', key: 'actions', width: 110, fixed: 'right',
      render: (_, r) => (
        <Tooltip title="Put Away">
          <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => openPutaway(r)}>
            Put Away
          </Button>
        </Tooltip>
      ),
    },
  ];

  const historyColumns = [
    { title: 'GRN #', dataIndex: 'grn_number', key: 'grn_number', width: 120, ellipsis: true },
    { title: 'PO #', dataIndex: 'po_number', key: 'po_number', width: 110, ellipsis: true },
    { title: 'Item', dataIndex: 'item_name', key: 'item_name', width: 140, ellipsis: true },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 90, ellipsis: true },
    {
      title: 'Bin', key: 'bin', width: 140, ellipsis: true,
      render: (_, r) => `${r.zone_name} / ${r.rack_name} / ${r.bin_code}`,
    },
    {
      title: 'Qty', dataIndex: 'quantity', key: 'quantity', width: 80,
      render: (v) => <Tag color="green">{parseFloat(v || 0).toFixed(2)}</Tag>,
    },
    {
      title: 'Date', dataIndex: 'putaway_date', key: 'putaway_date', width: 120,
      render: (v) => (v ? dayjs(v).format('DD MMM YYYY HH:mm') : '-'),
    },
  ];

  const formatBinLabel = (bin) => {
    const parts = [bin.zone_name, bin.rack_name, bin.code].filter(Boolean);
    return parts.join(' / ');
  };

  return (
    <div style={{ padding: 20, background: 'linear-gradient(180deg,#f8f9ff 0%,#eef3ff 100%)', minHeight: '100vh' }}>
      <div style={{
        marginBottom: 16, background: 'linear-gradient(135deg,#f7971e 0%,#ffd200 100%)',
        borderRadius: 16, padding: '16px 18px', boxShadow: '0 10px 24px rgba(247,151,30,0.24)',
      }}>
        <h2 style={{ margin: 0, fontSize: '22px', color: '#1a1a2e', fontWeight: 800 }}>Putaways</h2>
        <div style={{ color: 'rgba(26,26,46,0.72)', fontSize: 12 }}>
          Assign received goods (GRN) to warehouse bins. Stock is received at GRN; putaway records the storage location.
        </div>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16, borderRadius: 10 }}
        message="Receive goods first via Purchases → Purchase Receives (GRN). Putaway lines appear here after GRN is posted."
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }} align="middle">
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 14, boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
            <Statistic
              title="Pending Putaways"
              value={pendingPutaways.length}
              prefix={<InboxOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 14, boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
            <Statistic title="Units Pending" value={totalPending.toFixed(2)} />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Space wrap>
            <span style={{ fontWeight: 600, color: '#334155' }}>Warehouse:</span>
            <Select
              allowClear
              placeholder="All warehouses"
              style={{ minWidth: 200 }}
              value={warehouseFilter}
              onChange={setWarehouseFilter}
            >
              {warehouses.filter((w) => w.status === 'active').map((w) => (
                <Option key={w.id} value={w.id}>{w.name}</Option>
              ))}
            </Select>
          </Space>
        </Col>
      </Row>

      <div style={{
        background: '#fff', borderRadius: 16, padding: 12,
        boxShadow: '0 6px 18px rgba(0,0,0,0.08)', border: '1px solid #edf0f7',
      }}>
        <Tabs
          items={[
            {
              key: 'pending',
              label: 'Pending',
              children: (
                <Table
                  columns={pendingColumns}
                  dataSource={pendingPutaways}
                  rowKey="grnLineId"
                  loading={loading}
                  size="small"
                  pagination={{ pageSize: 20, size: 'small' }}
                  className="putaways-premium-table"
                  scroll={{ x: 'max-content' }}
                  locale={{ emptyText: 'No pending putaways — receive goods via GRN first, or all received stock has been put away' }}
                />
              ),
            },
            {
              key: 'history',
              label: (
                <span><HistoryOutlined /> History</span>
              ),
              children: (
                <Table
                  columns={historyColumns}
                  dataSource={history}
                  rowKey="id"
                  loading={historyLoading}
                  size="small"
                  pagination={{ pageSize: 20, size: 'small' }}
                  className="putaways-premium-table"
                  scroll={{ x: 'max-content' }}
                  locale={{ emptyText: 'No putaway history yet' }}
                />
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={`Put Away — ${selected?.itemName || ''}`}
        open={putawayModal}
        onCancel={() => { setPutawayModal(false); form.resetFields(); setSelected(null); }}
        onOk={() => form.submit()}
        okText="Complete Putaway"
        confirmLoading={submitting}
        width="min(520px, 96vw)"
        style={{ top: 16 }}
      >
        {selected && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f6f8fa', borderRadius: 6 }}>
            <strong>Item:</strong> {selected.itemName} ({selected.sku})<br />
            <strong>GRN:</strong> {selected.grnNumber}<br />
            <strong>PO:</strong> {selected.poNumber}<br />
            <strong>Warehouse:</strong> {selected.warehouseName}<br />
            <strong>Pending:</strong> {parseFloat(selected.pendingQuantity || 0).toFixed(2)}
          </div>
        )}
        <Form form={form} layout="vertical" onFinish={handlePutaway}>
          <Form.Item
            name="binId"
            label="Destination Bin"
            rules={[{ required: true, message: 'Select a bin' }]}
            extra={bins.length === 0 ? 'No active bins in this warehouse — create bins under Warehouses → Zones / Racks / Bins' : undefined}
          >
            <Select
              showSearch
              placeholder="Select bin (zone / rack / bin)"
              optionFilterProp="label"
              options={bins.map((b) => ({
                value: b.id,
                label: formatBinLabel(b),
              }))}
            />
          </Form.Item>
          <Form.Item
            name="quantity"
            label="Quantity to Put Away"
            rules={[
              { required: true, message: 'Enter quantity' },
              {
                validator: (_, value) => {
                  if (value == null || value === '') return Promise.reject(new Error('Enter quantity'));
                  if (Number(value) <= 0) return Promise.reject(new Error('Quantity must be greater than zero'));
                  if (selected && Number(value) > Number(selected.pendingQuantity)) {
                    return Promise.reject(new Error(`Cannot exceed pending ${selected.pendingQuantity}`));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber min={0.0001} step={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Putaway notes (optional)" />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .putaways-premium-table .ant-table-thead > tr > th {
          background: linear-gradient(180deg,#fafbff,#f3f6ff) !important;
          font-weight: 700;
          color: #334155;
        }
        .putaways-premium-table .ant-table-tbody > tr:nth-child(even) > td {
          background: #fcfdff;
        }
        .putaways-premium-table .ant-table-tbody > tr:hover > td {
          background: #f0f5ff !important;
        }
      `}</style>
    </div>
  );
}
