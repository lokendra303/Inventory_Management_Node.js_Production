import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Select, DatePicker,
  InputNumber, Input, message, Tooltip, Statistic, Row, Col, Card, Tabs
} from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, CloseCircleOutlined,
  EditOutlined, EyeOutlined, BarChartOutlined
} from '@ant-design/icons';
import apiService from '../../services/apiService';
import dayjs from 'dayjs';
import { useCurrency } from '../../contexts/CurrencyContext';

const { Option } = Select;
const { TabPane } = Tabs;

const STATUS_COLORS = {
  draft: 'default', in_progress: 'processing',
  pending_approval: 'warning', approved: 'success', cancelled: 'error'
};

export default function StockCount() {
  const { formatCurrency } = useCurrency();
  const [counts, setCounts] = useState([]);
  const [aging, setAging] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selectedCount, setSelectedCount] = useState(null);
  const [countLines, setCountLines] = useState([]);
  const [form] = Form.useForm();
  const [countForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('counts');

  const loadCounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.get('/stock-counts');
      setCounts(res.data || []);
    } catch { message.error('Failed to load stock counts'); }
    finally { setLoading(false); }
  }, []);

  const loadAging = useCallback(async () => {
    try {
      const res = await apiService.get('/stock-counts/aging');
      setAging(res.data || []);
    } catch { message.error('Failed to load aging report'); }
  }, []);

  const loadWarehouses = useCallback(async () => {
    try {
      const res = await apiService.get('/warehouses', { params: { status: 'active' } });
      setWarehouses(res.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadCounts();
    loadWarehouses();
  }, [loadCounts, loadWarehouses]);

  useEffect(() => {
    if (activeTab === 'aging') loadAging();
  }, [activeTab, loadAging]);

  const handleCreate = async (values) => {
    try {
      await apiService.post('/stock-counts', {
        warehouseId: values.warehouseId,
        countType: values.countType,
        scheduledDate: values.scheduledDate?.format('YYYY-MM-DD'),
        notes: values.notes
      });
      message.success('Stock count created');
      setCreateModal(false);
      form.resetFields();
      loadCounts();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to create stock count');
    }
  };

  const openDetail = async (record) => {
    try {
      const res = await apiService.get(`/stock-counts/${record.id}`);
      setSelectedCount(res.data);
      const lines = (res.data.lines || []).map(l => ({ ...l, inputQty: l.counted_qty ?? '' }));
      setCountLines(lines);
      setDetailModal(true);
    } catch { message.error('Failed to load count details'); }
  };

  const handleSubmitCount = async () => {
    const lines = countLines
      .filter(l => l.inputQty !== '' && l.inputQty !== null)
      .map(l => ({ lineId: l.id, countedQty: parseFloat(l.inputQty), notes: l.notes }));

    if (!lines.length) { message.warning('Enter at least one counted quantity'); return; }

    try {
      await apiService.post(`/stock-counts/${selectedCount.id}/submit`, { lines });
      message.success('Count submitted');
      setDetailModal(false);
      loadCounts();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to submit count');
    }
  };

  const handleApprove = async (countId) => {
    Modal.confirm({
      title: 'Approve & Post Stock Count?',
      content: 'This will update inventory quantities based on counted values. This cannot be undone.',
      okText: 'Approve & Post',
      okType: 'primary',
      onOk: async () => {
        try {
          await apiService.post(`/stock-counts/${countId}/approve`);
          message.success('Stock count approved and inventory updated');
          loadCounts();
        } catch (e) {
          message.error(e.response?.data?.error || 'Failed to approve');
        }
      }
    });
  };

  const handleCancel = async (countId) => {
    try {
      await apiService.post(`/stock-counts/${countId}/cancel`);
      message.success('Stock count cancelled');
      loadCounts();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to cancel');
    }
  };

  const countColumns = [
    { title: 'Count #', dataIndex: 'count_number', key: 'count_number', width: 140, ellipsis: true },
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name', width: 130, ellipsis: true },
    { title: 'Type', dataIndex: 'count_type', key: 'count_type', width: 90,
      render: v => <Tag>{v?.toUpperCase()}</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 130,
      render: v => <Tag color={STATUS_COLORS[v]}>{v?.replace('_', ' ').toUpperCase()}</Tag> },
    { title: 'Lines', dataIndex: 'total_lines', key: 'total_lines', width: 70 },
    { title: 'Counted', key: 'progress', width: 90,
      render: (_, r) => `${r.counted_lines || 0} / ${r.total_lines || 0}` },
    { title: 'Scheduled', dataIndex: 'scheduled_date', key: 'scheduled_date', width: 120,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '-' },
    {
      title: 'Actions', key: 'actions', width: 120, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Tooltip title="View / Count"><Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)} /></Tooltip>
          {r.status === 'pending_approval' && (
            <Tooltip title="Approve & Post">
              <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleApprove(r.id)} />
            </Tooltip>
          )}
          {['draft', 'in_progress'].includes(r.status) && (
            <Tooltip title="Cancel">
              <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleCancel(r.id)} />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  const BUCKET_ORDER = { '0-30': 0, '31-60': 1, '61-90': 2, '91-120': 3, '120+': 4 };

  const agingColumns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 110, ellipsis: true,
      sorter: (a, b) => (a.sku || '').localeCompare(b.sku || '') },
    { title: 'Item', dataIndex: 'item_name', key: 'item_name', width: 150, ellipsis: true,
      sorter: (a, b) => (a.item_name || '').localeCompare(b.item_name || '') },
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name', width: 120, ellipsis: true,
      sorter: (a, b) => (a.warehouse_name || '').localeCompare(b.warehouse_name || '') },
    { title: 'On Hand', dataIndex: 'quantity_on_hand', key: 'quantity_on_hand', width: 90,
      sorter: (a, b) => parseFloat(a.quantity_on_hand || 0) - parseFloat(b.quantity_on_hand || 0),
      render: v => parseFloat(v || 0).toFixed(2) },
    { title: 'Last Movement', dataIndex: 'last_movement_date', key: 'last_movement_date', width: 130,
      sorter: (a, b) => dayjs(a.last_movement_date || 0).unix() - dayjs(b.last_movement_date || 0).unix(),
      render: v => v ? dayjs(v).format('DD MMM YYYY') : 'Never' },
    { title: 'Days Idle', dataIndex: 'days_since_movement', key: 'days_since_movement', width: 90,
      sorter: (a, b) => (a.days_since_movement || 0) - (b.days_since_movement || 0),
      defaultSortOrder: 'descend',
      render: v => {
        const days = parseInt(v || 0);
        if (days >= 9999) return <Tag color="red">Never moved</Tag>;
        const color = days > 120 ? 'red' : days > 90 ? 'orange' : days > 60 ? 'gold' : 'green';
        return <Tag color={color}>{days}d</Tag>;
      }
    },
    { title: 'Aging Bucket', dataIndex: 'aging_bucket', key: 'aging_bucket', width: 110,
      sorter: (a, b) => (BUCKET_ORDER[a.aging_bucket] ?? 0) - (BUCKET_ORDER[b.aging_bucket] ?? 0),
      render: v => {
        const color = v === '120+' ? 'red' : v === '91-120' ? 'orange' : v === '61-90' ? 'gold' : 'green';
        return <Tag color={color}>{v} days</Tag>;
      }
    },
    { title: 'Value', dataIndex: 'total_value', key: 'total_value', width: 110,
      sorter: (a, b) => parseFloat(a.total_value || 0) - parseFloat(b.total_value || 0),
      render: v => formatCurrency(v) }
  ];

  const lineColumns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120 },
    { title: 'Item', dataIndex: 'item_name', key: 'item_name' },
    { title: 'System Qty', dataIndex: 'system_qty', key: 'system_qty', width: 110,
      render: v => parseFloat(v || 0).toFixed(2) },
    { title: 'Counted Qty', key: 'counted_qty', width: 130,
      render: (_, r, idx) => (
        selectedCount?.status === 'pending_approval' || selectedCount?.status === 'approved'
          ? parseFloat(r.counted_qty || 0).toFixed(2)
          : <InputNumber
              size="small" min={0} step={0.01}
              value={countLines[idx]?.inputQty}
              onChange={val => {
                const updated = [...countLines];
                updated[idx] = { ...updated[idx], inputQty: val };
                setCountLines(updated);
              }}
            />
      )
    },
    { title: 'Variance', key: 'variance', width: 100,
      render: (_, r, idx) => {
        const counted = parseFloat(countLines[idx]?.inputQty ?? r.counted_qty ?? 0);
        const system = parseFloat(r.system_qty || 0);
        const variance = counted - system;
        if (isNaN(variance)) return '-';
        const color = variance > 0 ? 'green' : variance < 0 ? 'red' : 'default';
        return <Tag color={color}>{variance >= 0 ? '+' : ''}{variance.toFixed(2)}</Tag>;
      }
    }
  ];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>Stock Count & Inventory Aging</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
          New Stock Count
        </Button>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Stock Counts" key="counts">
          <Table
            columns={countColumns} dataSource={counts} rowKey="id"
            loading={loading} size="small"
            pagination={{ pageSize: 20, showSizeChanger: true, size: 'small' }}
            scroll={{ x: 'max-content' }}
          />
        </TabPane>
        <TabPane tab={<span><BarChartOutlined /> Inventory Aging</span>} key="aging">
          <Table
            columns={agingColumns} dataSource={aging} rowKey={r => `${r.item_id}-${r.warehouse_name}`}
            size="small"
            pagination={{ pageSize: 50, showSizeChanger: true, size: 'small' }}
            scroll={{ x: 'max-content' }}
          />
        </TabPane>
      </Tabs>

      {/* Create Modal */}
      <Modal
        title="New Stock Count" open={createModal}
        onCancel={() => { setCreateModal(false); form.resetFields(); }}
        onOk={() => form.submit()} okText="Create"
        width="min(480px, 96vw)"
        style={{ top: 16 }}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}>
            <Select placeholder="Select warehouse">
              {warehouses.map(w => <Option key={w.id} value={w.id}>{w.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="countType" label="Count Type" initialValue="full">
            <Select>
              <Option value="full">Full Count</Option>
              <Option value="cycle">Cycle Count</Option>
              <Option value="spot">Spot Check</Option>
            </Select>
          </Form.Item>
          <Form.Item name="scheduledDate" label="Scheduled Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail / Count Entry Modal */}
      <Modal
        title={`Stock Count: ${selectedCount?.count_number}`}
        open={detailModal}
        width="min(900px, 96vw)"
        style={{ top: 16 }}
        onCancel={() => setDetailModal(false)}
        footer={
          selectedCount?.status === 'in_progress' || selectedCount?.status === 'draft'
            ? [
                <Button key="cancel" onClick={() => setDetailModal(false)}>Close</Button>,
                <Button key="submit" type="primary" onClick={handleSubmitCount}>Submit Count</Button>
              ]
            : [<Button key="close" onClick={() => setDetailModal(false)}>Close</Button>]
        }
      >
        {selectedCount && (
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}><Statistic title="Warehouse" value={selectedCount.warehouse_name} /></Col>
            <Col xs={12} sm={6}><Statistic title="Type" value={selectedCount.count_type?.toUpperCase()} /></Col>
            <Col xs={12} sm={6}><Statistic title="Status" value={selectedCount.status?.replace('_', ' ').toUpperCase()} /></Col>
            <Col xs={12} sm={6}><Statistic title="Total Lines" value={countLines.length} /></Col>
          </Row>
        )}
        <Table
          columns={lineColumns} dataSource={countLines} rowKey="id"
          size="small" pagination={{ pageSize: 20, size: 'small' }}
          scroll={{ x: 'max-content' }}
        />
      </Modal>
    </div>
  );
}
