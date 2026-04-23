import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Select, DatePicker,
  InputNumber, Input, message, Tooltip, Row, Col, Empty, Tabs
} from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, CloseCircleOutlined,
  EyeOutlined, BarChartOutlined, ReloadOutlined, UnorderedListOutlined
} from '@ant-design/icons';
import apiService from '../../services/apiService';
import dayjs from 'dayjs';
import { useCurrency } from '../../contexts/CurrencyContext';

const { Option } = Select;

const STATUS_META = {
  draft:            { color: '#8c8c8c', bg: '#fafafa',   border: '#d9d9d9',   label: 'Draft' },
  in_progress:      { color: '#1890ff', bg: '#e6f7ff',   border: '#91d5ff',   label: 'In Progress' },
  pending_approval: { color: '#fa8c16', bg: '#fff7e6',   border: '#ffd591',   label: 'Pending Approval' },
  approved:         { color: '#52c41a', bg: '#f6ffed',   border: '#b7eb8f',   label: 'Approved' },
  cancelled:        { color: '#ff4d4f', bg: '#fff1f0',   border: '#ffa39e',   label: 'Cancelled' }
};

const BUCKET_ORDER = { '0-30': 0, '31-60': 1, '61-90': 2, '91-120': 3, '120+': 4 };

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

  useEffect(() => { loadCounts(); loadWarehouses(); }, [loadCounts, loadWarehouses]);
  useEffect(() => { if (activeTab === 'aging') loadAging(); }, [activeTab, loadAging]);

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
      setCountLines((res.data.lines || []).map(l => ({ ...l, inputQty: l.counted_qty ?? '' })));
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

  const handleApprove = (countId) => {
    Modal.confirm({
      title: 'Approve & Post Stock Count?',
      content: 'This will update inventory quantities. This cannot be undone.',
      okText: 'Approve & Post',
      okType: 'primary',
      onOk: async () => {
        try {
          await apiService.post(`/stock-counts/${countId}/approve`);
          message.success('Stock count approved and inventory updated');
          loadCounts();
        } catch (e) { message.error(e.response?.data?.error || 'Failed to approve'); }
      }
    });
  };

  const handleCancel = async (countId) => {
    try {
      await apiService.post(`/stock-counts/${countId}/cancel`);
      message.success('Stock count cancelled');
      loadCounts();
    } catch (e) { message.error(e.response?.data?.error || 'Failed to cancel'); }
  };

  const countColumns = [
    {
      title: 'Count #', dataIndex: 'count_number', key: 'count_number',
      render: (v) => <span style={{ fontWeight: 600, color: '#1a1a2e', fontSize: 13 }}>{v}</span>
    },
    {
      title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name',
      render: (v) => (
        <Tag style={{ borderRadius: 12, fontSize: 11, padding: '1px 8px', background: '#f0f5ff', border: '1px solid #adc6ff', color: '#2f54eb' }}>
          {v}
        </Tag>
      )
    },
    {
      title: 'Type', dataIndex: 'count_type', key: 'count_type', width: 100,
      render: (v) => (
        <Tag style={{ borderRadius: 10, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
          {v}
        </Tag>
      )
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 150,
      render: (v) => {
        const m = STATUS_META[v] || STATUS_META.draft;
        return (
          <span style={{ background: m.bg, border: `1px solid ${m.border}`, color: m.color, borderRadius: 12, fontSize: 11, fontWeight: 600, padding: '2px 10px' }}>
            {m.label}
          </span>
        );
      }
    },
    {
      title: 'Progress', key: 'progress', width: 110, align: 'center',
      render: (_, r) => {
        const total = r.total_lines || 0;
        const counted = r.counted_lines || 0;
        const pct = total > 0 ? Math.round((counted / total) * 100) : 0;
        return (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: pct === 100 ? '#52c41a' : '#1890ff' }}>{counted}/{total}</div>
            <div style={{ height: 4, background: '#f0f0f0', borderRadius: 4, marginTop: 3 }}>
              <div style={{ height: 4, width: `${pct}%`, background: pct === 100 ? '#52c41a' : '#1890ff', borderRadius: 4, transition: 'width 0.3s' }} />
            </div>
          </div>
        );
      }
    },
    {
      title: 'Scheduled', dataIndex: 'scheduled_date', key: 'scheduled_date', width: 120,
      render: (v) => v ? <span style={{ fontSize: 12, color: '#595959' }}>{dayjs(v).format('DD MMM YYYY')}</span> : <span style={{ color: '#bfbfbf' }}>—</span>
    },
    {
      title: '', key: 'actions', width: 110, fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="View / Count">
            <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)}
              style={{ background: '#1890ff', color: '#fff', border: 'none', borderRadius: 6, boxShadow: '0 2px 6px rgba(24,144,255,0.4)' }} />
          </Tooltip>
          {r.status === 'pending_approval' && (
            <Tooltip title="Approve & Post">
              <Button size="small" icon={<CheckCircleOutlined />} onClick={() => handleApprove(r.id)}
                style={{ background: '#52c41a', color: '#fff', border: 'none', borderRadius: 6 }} />
            </Tooltip>
          )}
          {['draft', 'in_progress'].includes(r.status) && (
            <Tooltip title="Cancel">
              <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleCancel(r.id)}
                style={{ borderRadius: 6 }} />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  const agingColumns = [
    {
      title: 'Item', dataIndex: 'item_name', key: 'item_name',
      sorter: (a, b) => (a.item_name || '').localeCompare(b.item_name || ''),
      render: (name, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1a1a2e', fontSize: 13 }}>{name}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.sku}</div>
        </div>
      )
    },
    {
      title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name',
      sorter: (a, b) => (a.warehouse_name || '').localeCompare(b.warehouse_name || ''),
      render: (v) => (
        <Tag style={{ borderRadius: 12, fontSize: 11, padding: '1px 8px', background: '#f0f5ff', border: '1px solid #adc6ff', color: '#2f54eb' }}>{v}</Tag>
      )
    },
    {
      title: 'On Hand', dataIndex: 'quantity_on_hand', key: 'quantity_on_hand', align: 'right', width: 90,
      sorter: (a, b) => parseFloat(a.quantity_on_hand || 0) - parseFloat(b.quantity_on_hand || 0),
      render: (v) => <span style={{ fontWeight: 600, color: '#1890ff' }}>{parseFloat(v || 0).toFixed(2)}</span>
    },
    {
      title: 'Last Movement', dataIndex: 'last_movement_date', key: 'last_movement_date', width: 130,
      sorter: (a, b) => dayjs(a.last_movement_date || 0).unix() - dayjs(b.last_movement_date || 0).unix(),
      render: (v) => <span style={{ fontSize: 12, color: '#595959' }}>{v ? dayjs(v).format('DD MMM YYYY') : 'Never'}</span>
    },
    {
      title: 'Days Idle', dataIndex: 'days_since_movement', key: 'days_since_movement', width: 100, align: 'center',
      sorter: (a, b) => (a.days_since_movement || 0) - (b.days_since_movement || 0),
      defaultSortOrder: 'descend',
      render: (v) => {
        const days = parseInt(v || 0);
        if (days >= 9999) return <span style={{ background: '#fff1f0', color: '#ff4d4f', border: '1px solid #ffa39e', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '2px 8px' }}>Never moved</span>;
        const { color, bg, border } = days > 120 ? { color: '#ff4d4f', bg: '#fff1f0', border: '#ffa39e' }
          : days > 90 ? { color: '#fa8c16', bg: '#fff7e6', border: '#ffd591' }
          : days > 60 ? { color: '#d4b106', bg: '#feffe6', border: '#fffb8f' }
          : { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f' };
        return <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '2px 8px' }}>{days}d</span>;
      }
    },
    {
      title: 'Aging Bucket', dataIndex: 'aging_bucket', key: 'aging_bucket', width: 120, align: 'center',
      sorter: (a, b) => (BUCKET_ORDER[a.aging_bucket] ?? 0) - (BUCKET_ORDER[b.aging_bucket] ?? 0),
      render: (v) => {
        const { color, bg, border } = v === '120+' ? { color: '#ff4d4f', bg: '#fff1f0', border: '#ffa39e' }
          : v === '91-120' ? { color: '#fa8c16', bg: '#fff7e6', border: '#ffd591' }
          : v === '61-90' ? { color: '#d4b106', bg: '#feffe6', border: '#fffb8f' }
          : { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f' };
        return <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '2px 8px' }}>{v} days</span>;
      }
    },
    {
      title: 'Value', dataIndex: 'total_value', key: 'total_value', width: 120, align: 'right',
      sorter: (a, b) => parseFloat(a.total_value || 0) - parseFloat(b.total_value || 0),
      render: (v) => <span style={{ fontWeight: 700, color: '#1890ff' }}>{formatCurrency(v)}</span>
    }
  ];

  const lineColumns = [
    {
      title: 'Item', dataIndex: 'item_name', key: 'item_name',
      render: (name, r) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.sku}</div>
        </div>
      )
    },
    {
      title: 'System Qty', dataIndex: 'system_qty', key: 'system_qty', width: 110, align: 'right',
      render: (v) => <span style={{ fontWeight: 600, color: '#1890ff' }}>{parseFloat(v || 0).toFixed(2)}</span>
    },
    {
      title: 'Counted Qty', key: 'counted_qty', width: 140, align: 'right',
      render: (_, r, idx) => (
        selectedCount?.status === 'pending_approval' || selectedCount?.status === 'approved'
          ? <span style={{ fontWeight: 600 }}>{parseFloat(r.counted_qty || 0).toFixed(2)}</span>
          : <InputNumber
              size="small" min={0} step={0.01}
              value={countLines[idx]?.inputQty}
              style={{ width: 100, borderRadius: 6 }}
              onChange={val => {
                const updated = [...countLines];
                updated[idx] = { ...updated[idx], inputQty: val };
                setCountLines(updated);
              }}
            />
      )
    },
    {
      title: 'Variance', key: 'variance', width: 100, align: 'center',
      render: (_, r, idx) => {
        const counted = parseFloat(countLines[idx]?.inputQty ?? r.counted_qty ?? 0);
        const system = parseFloat(r.system_qty || 0);
        const variance = counted - system;
        if (isNaN(variance) || (countLines[idx]?.inputQty === '' && !r.counted_qty)) return <span style={{ color: '#bfbfbf' }}>—</span>;
        const positive = variance > 0;
        const zero = variance === 0;
        return (
          <span style={{
            fontWeight: 700, fontSize: 12, padding: '2px 8px', borderRadius: 10,
            background: zero ? '#fafafa' : positive ? '#f6ffed' : '#fff1f0',
            color: zero ? '#8c8c8c' : positive ? '#52c41a' : '#ff4d4f',
            border: `1px solid ${zero ? '#d9d9d9' : positive ? '#b7eb8f' : '#ffa39e'}`
          }}>
            {variance >= 0 ? '+' : ''}{variance.toFixed(2)}
          </span>
        );
      }
    }
  ];

  const summaryStats = [
    { label: 'Total Counts', value: counts.length, icon: '📋', bg: 'linear-gradient(135deg, #1890ff, #096dd9)' },
    { label: 'In Progress', value: counts.filter(c => c.status === 'in_progress').length, icon: '⏳', bg: 'linear-gradient(135deg, #fa8c16, #d46b08)' },
    { label: 'Pending Approval', value: counts.filter(c => c.status === 'pending_approval').length, icon: '🔔', bg: 'linear-gradient(135deg, #722ed1, #531dab)' },
    { label: 'Approved', value: counts.filter(c => c.status === 'approved').length, icon: '✅', bg: 'linear-gradient(135deg, #52c41a, #389e0d)' },
  ];

  return (
    <div style={{ padding: '20px 24px', background: 'linear-gradient(180deg,#f8f9ff 0%,#eef3ff 100%)', minHeight: '100vh' }}>

      {/* Page Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12,
        background: 'linear-gradient(135deg,#1890ff 0%,#667eea 100%)', borderRadius: 16, padding: '16px 18px',
        boxShadow: '0 10px 24px rgba(24,144,255,0.25)'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>Stock Count</h1>
          <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.88)', fontSize: 13 }}>Physical counts, variance tracking and inventory aging</p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadCounts} loading={loading} style={{ borderRadius: 8 }}>Refresh</Button>
          <Button
            type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}
            style={{ borderRadius: 8, background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none', fontWeight: 600 }}
          >
            New Stock Count
          </Button>
        </Space>
      </div>

      {/* Summary Tiles */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {summaryStats.map(({ label, value, icon, bg }) => (
          <Col xs={12} sm={6} key={label}>
            <div
              style={{ background: bg, borderRadius: 14, padding: '16px 20px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 8px 18px rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.16)', transition: 'all 0.22s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div>
                <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{value}</div>
              </div>
              <div style={{ fontSize: 26, opacity: 0.75 }}>{icon}</div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Tabs */}
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 6px 18px rgba(0,0,0,0.08)', border: '1px solid #edf0f7', overflow: 'hidden' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ padding: '0 20px' }}
          tabBarStyle={{ marginBottom: 12, paddingTop: 6 }}
          items={[
            {
              key: 'counts',
              label: <span style={{ fontWeight: 600 }}><UnorderedListOutlined style={{ marginRight: 6 }} />Stock Counts</span>,
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  <Table
                    columns={countColumns} dataSource={counts} rowKey="id"
                    loading={loading} size="small"
                    className="stockcount-premium-table"
                    pagination={{ pageSize: 20, showSizeChanger: true, size: 'small', showTotal: (t) => `${t} records`, style: { padding: '12px 0' } }}
                    scroll={{ x: 'max-content' }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No stock counts yet" style={{ padding: '40px 0' }} /> }}
                    style={{ fontSize: 13 }}
                  />
                </div>
              )
            },
            {
              key: 'aging',
              label: <span style={{ fontWeight: 600 }}><BarChartOutlined style={{ marginRight: 6 }} />Inventory Aging</span>,
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  <Table
                    columns={agingColumns} dataSource={aging} rowKey={r => `${r.item_id}-${r.warehouse_name}`}
                    size="small"
                    className="stockcount-premium-table"
                    pagination={{ pageSize: 50, showSizeChanger: true, size: 'small', showTotal: (t) => `${t} items`, style: { padding: '12px 0' } }}
                    scroll={{ x: 'max-content' }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No aging data" style={{ padding: '40px 0' }} /> }}
                    style={{ fontSize: 13 }}
                  />
                </div>
              )
            }
          ]}
        />
      </div>

      {/* Create Modal */}
      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 16 }}>📋 New Stock Count</span>}
        open={createModal}
        onCancel={() => { setCreateModal(false); form.resetFields(); }}
        onOk={() => form.submit()}
        okText="Create"
        okButtonProps={{ style: { borderRadius: 8, background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none', fontWeight: 600 } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        width="min(480px, 96vw)"
        style={{ top: 20 }}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item name="warehouseId" label={<span style={{ fontWeight: 600 }}>Warehouse</span>} rules={[{ required: true }]}>
            <Select placeholder="Select warehouse" style={{ borderRadius: 8 }}>
              {warehouses.map(w => <Option key={w.id} value={w.id}>{w.name}</Option>)}
            </Select>
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="countType" label={<span style={{ fontWeight: 600 }}>Count Type</span>} initialValue="full">
                <Select>
                  <Option value="full">Full Count</Option>
                  <Option value="cycle">Cycle Count</Option>
                  <Option value="spot">Spot Check</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="scheduledDate" label={<span style={{ fontWeight: 600 }}>Scheduled Date</span>}>
                <DatePicker style={{ width: '100%', borderRadius: 8 }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label={<span style={{ fontWeight: 600 }}>Notes</span>}>
            <Input.TextArea rows={2} style={{ borderRadius: 8 }} placeholder="Optional notes…" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail / Count Entry Modal */}
      <Modal
        title={
          selectedCount && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{selectedCount.count_number}</span>
              {(() => {
                const m = STATUS_META[selectedCount.status] || STATUS_META.draft;
                return <span style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}`, borderRadius: 10, fontSize: 11, fontWeight: 600, padding: '2px 10px' }}>{m.label}</span>;
              })()}
            </div>
          )
        }
        open={detailModal}
        width="min(900px, 96vw)"
        style={{ top: 16 }}
        onCancel={() => setDetailModal(false)}
        footer={
          ['in_progress', 'draft'].includes(selectedCount?.status)
            ? [
                <Button key="close" onClick={() => setDetailModal(false)} style={{ borderRadius: 8 }}>Close</Button>,
                <Button key="submit" type="primary" onClick={handleSubmitCount}
                  style={{ borderRadius: 8, background: 'linear-gradient(135deg, #52c41a, #389e0d)', border: 'none', fontWeight: 600 }}>
                  Submit Count
                </Button>
              ]
            : [<Button key="close" onClick={() => setDetailModal(false)} style={{ borderRadius: 8 }}>Close</Button>]
        }
      >
        {selectedCount && (
          <>
            <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
              {[
                { label: 'Warehouse', value: selectedCount.warehouse_name, bg: 'linear-gradient(135deg, #1890ff, #096dd9)' },
                { label: 'Type', value: selectedCount.count_type?.toUpperCase(), bg: 'linear-gradient(135deg, #722ed1, #531dab)' },
                { label: 'Total Lines', value: countLines.length, bg: 'linear-gradient(135deg, #fa8c16, #d46b08)' },
                { label: 'Counted', value: `${countLines.filter(l => l.inputQty !== '' && l.inputQty !== null && l.counted_qty !== null).length} / ${countLines.length}`, bg: 'linear-gradient(135deg, #52c41a, #389e0d)' },
              ].map(({ label, value, bg }) => (
                <Col xs={12} sm={6} key={label}>
                  <div style={{ background: bg, borderRadius: 12, padding: '12px 14px', color: '#fff', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{value}</div>
                  </div>
                </Col>
              ))}
            </Row>
            <Table
              columns={lineColumns} dataSource={countLines} rowKey="id"
              size="small"
              className="stockcount-premium-table"
              pagination={{ pageSize: 20, size: 'small' }}
              scroll={{ x: 'max-content' }}
              style={{ fontSize: 13 }}
            />
          </>
        )}
      </Modal>
      <style>{`
        .stockcount-premium-table .ant-table-thead > tr > th {
          background: linear-gradient(180deg,#fafbff,#f3f6ff) !important;
          font-weight: 700;
          color: #334155;
          border-bottom: 1px solid #e9edf7;
        }
        .stockcount-premium-table .ant-table-tbody > tr:nth-child(even) > td {
          background: #fcfdff;
        }
        .stockcount-premium-table .ant-table-tbody > tr:hover > td {
          background: #f0f5ff !important;
        }
      `}</style>
    </div>
  );
}
