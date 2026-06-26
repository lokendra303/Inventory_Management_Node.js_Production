import React, { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react';
import {
  Button,
  Card,
  Col,
  Dropdown,
  Input,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Popconfirm,
  Tooltip,
  Empty,
  Modal,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  BuildOutlined,
  SearchOutlined,
  FileTextOutlined,
  ReloadOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  InboxOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  BlockOutlined,
  CheckCircleOutlined,
  StopOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import apiService from '../../services/apiService';
import { useAuth } from '../../hooks/useAuth.jsx';

const BomItemForm = lazy(() => import('./BomItemForm'));
const ItemDetailsModal = lazy(() => import('../../components/inventory/ItemDetailsModal.jsx'));

const { Text } = Typography;

const PAGE_BG = '#f0f2f5';
const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const GRADIENT_SOFT = 'linear-gradient(135deg, #667eea22, #764ba222)';

const pillFilter = (active, color, bg, border) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 14px',
  borderRadius: 20,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  border: `1.5px solid ${active ? border : '#e8e8ef'}`,
  background: active ? bg : '#fff',
  color: active ? color : '#8c8c8c',
  transition: 'all 0.15s ease',
  userSelect: 'none',
});

const fulfillmentBadge = (mode) => {
  const isExplode = mode === 'explode_on_ship';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        background: isExplode ? 'linear-gradient(135deg, #f3e8ff, #ede9fe)' : 'linear-gradient(135deg, #eff6ff, #dbeafe)',
        color: isExplode ? '#7c3aed' : '#2563eb',
        border: `1px solid ${isExplode ? '#ddd6fe' : '#bfdbfe'}`,
      }}
    >
      {isExplode ? <ThunderboltOutlined /> : <InboxOutlined />}
      {isExplode ? 'Explode on ship' : 'Pre-built'}
    </span>
  );
};

const stockDisplay = (qty) => {
  const n = Number(qty) || 0;
  const low = n <= 0;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 44,
        padding: '2px 10px',
        borderRadius: 8,
        fontWeight: 700,
        fontSize: 13,
        background: low ? '#fff1f0' : '#f6ffed',
        color: low ? '#cf1322' : '#389e0d',
        border: `1px solid ${low ? '#ffccc7' : '#b7eb8f'}`,
      }}
    >
      {n}
    </span>
  );
};

export default function BomItemsPage() {
  const { user } = useAuth();
  const canManage = user?.permissions?.production_management || user?.permissions?.all;
  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [resumeDraftId, setResumeDraftId] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);

  const fetchDrafts = useCallback(async () => {
    if (!canManage) {
      setDrafts([]);
      return;
    }
    try {
      setDraftsLoading(true);
      const res = await apiService.get('/production/bom-drafts');
      setDrafts(res.success && Array.isArray(res.data) ? res.data : []);
    } catch {
      setDrafts([]);
    } finally {
      setDraftsLoading(false);
    }
  }, [canManage]);

  const fetchAllForCounts = useCallback(async () => {
    try {
      const res = await apiService.get('/production/bom-items?status=all');
      setAllItems(res.success ? res.data : []);
    } catch {
      setAllItems([]);
    }
  }, []);

  const fetchItems = useCallback(async () => {
    if (statusFilter === 'drafts') return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'drafts') {
        params.set('status', statusFilter);
      }
      if (searchText.trim()) params.set('search', searchText.trim());
      const qs = params.toString();
      const res = await apiService.get(`/production/bom-items${qs ? `?${qs}` : ''}`);
      setItems(res.success ? res.data : []);
    } catch (err) {
      message.error(err?.response?.data?.error || 'Failed to load BOM items');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchAllForCounts(), fetchDrafts()]);
    if (statusFilter !== 'drafts') {
      await fetchItems();
    }
  }, [fetchAllForCounts, fetchDrafts, fetchItems, statusFilter]);

  useEffect(() => {
    fetchAllForCounts();
    fetchDrafts();
  }, [fetchAllForCounts, fetchDrafts]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const isDraftView = statusFilter === 'drafts';

  const stats = useMemo(() => {
    const active = allItems.filter((i) => i.status === 'active').length;
    const prebuilt = allItems.filter((i) => (i.kit_fulfillment_mode || 'prebuilt') !== 'explode_on_ship').length;
    const totalStock = allItems.reduce((sum, i) => sum + (Number(i.current_stock) || 0), 0);
    return { total: allItems.length, active, prebuilt, totalStock, drafts: drafts.length };
  }, [allItems, drafts.length]);

  const filteredItems = useMemo(() => {
    if (!searchText.trim()) return items;
    const q = searchText.toLowerCase();
    return items.filter(
      (row) =>
        String(row.name || '').toLowerCase().includes(q)
        || String(row.sku || '').toLowerCase().includes(q)
    );
  }, [items, searchText]);

  const openCreate = (draftId = null) => {
    setEditingId(null);
    setResumeDraftId(draftId);
    setFormOpen(true);
  };

  const resumeDraft = (draft) => {
    openCreate(draft?.id || null);
  };

  const deleteDraft = async (draftId) => {
    try {
      await apiService.delete(`/production/bom-draft/${draftId}`);
      message.success('Draft deleted');
      fetchDrafts();
    } catch {
      message.error('Failed to delete draft');
    }
  };

  const openEdit = (record) => {
    setEditingId(record.id);
    setResumeDraftId(null);
    setFormOpen(true);
  };

  const openItemDetails = (record) => {
    setViewingItem(record);
  };

  const deactivateBomItem = (item) => {
    if (item.status !== 'active') return;

    Modal.confirm({
      title: 'Deactivate BOM item?',
      icon: <StopOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <p style={{ marginBottom: 8 }}>
            <strong>{item.name}</strong>
            {item.sku ? ` (${item.sku})` : ''} will be marked inactive and hidden from active lists.
          </p>
          <p style={{ margin: 0, color: '#8c8c8c', fontSize: 13 }}>
            You can reactivate it from the Inactive tab or while editing the item.
          </p>
        </div>
      ),
      okText: 'Deactivate',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const response = await apiService.put(`/production/bom-items/${item.id}`, { status: 'inactive' });
          if (response.success) {
            message.success('BOM item deactivated');
            refreshAll();
          } else {
            message.error(response.error || 'Failed to deactivate BOM item');
          }
        } catch (error) {
          message.error(
            error?.response?.data?.error
            || error?.message
            || 'Failed to deactivate BOM item',
            8
          );
        }
      },
    });
  };

  const activateBomItem = async (item) => {
    if (item.status !== 'inactive') return;

    try {
      const response = await apiService.put(`/production/bom-items/${item.id}`, { status: 'active' });
      if (response.success) {
        message.success('BOM item activated');
        refreshAll();
      } else {
        message.error(response.error || 'Failed to activate BOM item');
      }
    } catch (error) {
      message.error(
        error?.response?.data?.error
        || error?.message
        || 'Failed to activate BOM item',
        8
      );
    }
  };

  const filteredDrafts = useMemo(() => {
    if (!searchText.trim()) return drafts;
    const q = searchText.toLowerCase();
    return drafts.filter((row) => {
      const name = String(row.data?.name || row.label || '').toLowerCase();
      const sku = String(row.data?.sku || row.sku || '').toLowerCase();
      return name.includes(q) || sku.includes(q);
    });
  }, [drafts, searchText]);

  const statusFilters = [
    { key: 'all', label: 'All', count: allItems.length, color: '#667eea', bg: '#f0f0ff', border: '#667eea' },
    { key: 'active', label: 'Active', count: allItems.filter((i) => i.status === 'active').length, color: '#52c41a', bg: '#f6ffed', border: '#52c41a' },
    { key: 'inactive', label: 'Inactive', count: allItems.filter((i) => i.status === 'inactive').length, color: '#8c8c8c', bg: '#fafafa', border: '#bfbfbf' },
    ...(canManage ? [{
      key: 'drafts',
      label: 'Drafts',
      count: drafts.length,
      color: '#fa8c16',
      bg: '#fff7e6',
      border: '#fa8c16',
    }] : []),
  ];

  const draftColumns = [
    {
      title: 'DRAFT / SKU',
      key: 'name',
      render: (_, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: '#fff7e6',
              border: '1px solid #ffd591',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fa8c16',
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            <FileTextOutlined />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#1a1a2e', fontSize: 14 }}>
              {row.data?.name || row.label || 'Untitled draft'}
            </div>
            <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>
              {row.data?.sku || row.sku || '—'}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'COMPONENTS',
      key: 'components',
      width: 130,
      render: (_, row) => {
        const count = Array.isArray(row.data?.components)
          ? row.data.components.filter((c) => c?.itemId).length
          : 0;
        return count > 0 ? `${count} item(s)` : '—';
      },
    },
    {
      title: 'LAST SAVED',
      key: 'savedAt',
      width: 180,
      render: (_, row) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          <ClockCircleOutlined style={{ marginRight: 6 }} />
          {row.savedAt ? dayjs(row.savedAt).format('DD MMM YYYY, HH:mm') : '—'}
        </Text>
      ),
    },
    {
      title: 'STATUS',
      key: 'status',
      width: 110,
      render: () => (
        <Tag
          style={{
            borderRadius: 20,
            fontWeight: 600,
            border: 'none',
            padding: '2px 12px',
            background: '#fff7e6',
            color: '#d48806',
          }}
        >
          ● Draft
        </Tag>
      ),
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      width: 200,
      align: 'center',
      render: (_, row) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => resumeDraft(row)}
            style={{
              borderRadius: 8,
              fontWeight: 600,
              background: GRADIENT,
              border: 'none',
            }}
          >
            Continue
          </Button>
          <Popconfirm title="Delete this draft?" onConfirm={() => deleteDraft(row.id)}>
            <Button danger size="small" icon={<DeleteOutlined />} style={{ borderRadius: 8 }}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const columns = [
    {
      title: 'PRODUCT / SKU',
      key: 'name',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: GRADIENT_SOFT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#764ba2',
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            <BuildOutlined />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#1a1a2e', fontSize: 14 }}>{record.name}</div>
            <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>{record.sku}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'FULFILLMENT',
      dataIndex: 'kit_fulfillment_mode',
      key: 'mode',
      width: 170,
      render: (v) => fulfillmentBadge(v),
    },
    {
      title: 'STOCK',
      dataIndex: 'current_stock',
      key: 'stock',
      width: 100,
      align: 'center',
      render: (v) => stockDisplay(v),
    },
    {
      title: 'STATUS',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v) => {
        const active = (v || 'active') === 'active';
        return (
          <Tag
            style={{
              borderRadius: 20,
              fontWeight: 600,
              border: 'none',
              padding: '2px 12px',
              background: active ? '#f6ffed' : '#f5f5f5',
              color: active ? '#389e0d' : '#8c8c8c',
            }}
          >
            {active ? '● Active' : '○ Inactive'}
          </Tag>
        );
      },
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      width: canManage ? 150 : 80,
      align: 'center',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="View product details">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openItemDetails(record)}
              style={{ borderRadius: 8, background: '#f0f0ff', borderColor: '#667eea', color: '#667eea' }}
            />
          </Tooltip>
          {canManage ? (
            <>
              <Tooltip title="Edit BOM & components">
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openEdit(record)}
                  style={{
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    border: 'none',
                    color: '#fff',
                    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.35)',
                  }}
                />
              </Tooltip>
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    ...(record.status === 'active' ? [{
                      key: 'deactivate',
                      icon: <StopOutlined style={{ color: '#ff4d4f' }} />,
                      label: 'Deactivate',
                      onClick: () => deactivateBomItem(record),
                    }] : []),
                    ...(record.status === 'inactive' ? [{
                      key: 'activate',
                      icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
                      label: 'Activate',
                      onClick: () => activateBomItem(record),
                    }] : []),
                  ],
                }}
              >
                <Tooltip title="More actions">
                  <Button
                    size="small"
                    icon={<MoreOutlined />}
                    style={{ borderRadius: 8, border: '1px solid #d9d9d9', color: '#595959' }}
                  />
                </Tooltip>
              </Dropdown>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: PAGE_BG, minHeight: '100vh' }}>
      {/* Hero header */}
      <div
        style={{
          background: GRADIENT,
          borderRadius: 16,
          padding: '24px 28px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '10px 14px' }}>
            <BuildOutlined style={{ fontSize: 28, color: '#fff' }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>BOM Items</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, maxWidth: 420 }}>
              Finished products with bill of materials — manage components, fulfillment mode & opening stock
            </div>
          </div>
        </div>
        {canManage && (
          <Button
            icon={<PlusOutlined />}
            size="large"
            onClick={() => openCreate()}
            style={{
              background: '#fff',
              color: '#764ba2',
              border: '2px solid rgba(255,255,255,0.6)',
              fontWeight: 700,
              borderRadius: 10,
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              fontSize: 15,
              height: 44,
              paddingInline: 22,
            }}
          >
            Create BOM item
          </Button>
        )}
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { title: 'Total products', value: stats.total, icon: <AppstoreOutlined />, color: '#667eea', bg: '#f0f0ff' },
          { title: 'Active', value: stats.active, icon: <BlockOutlined />, color: '#52c41a', bg: '#f6ffed' },
          { title: 'Pre-built', value: stats.prebuilt, icon: <InboxOutlined />, color: '#2563eb', bg: '#eff6ff' },
          { title: 'Total stock', value: stats.totalStock, icon: <BuildOutlined />, color: '#fa8c16', bg: '#fff7e6' },
        ].map((s) => (
          <Col xs={12} sm={6} key={s.title}>
            <Card
              variant="borderless"
              style={{ borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', height: '100%' }}
              styles={{ body: { padding: '18px 20px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ background: s.bg, borderRadius: 10, padding: 10, fontSize: 22, color: s.color }}>
                  {s.icon}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.1 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>{s.title}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Main table */}
      <Card
        variant="borderless"
        style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}
        styles={{ body: { padding: 0 } }}
      >
        <div
          style={{
            padding: '18px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            borderBottom: '1px solid #f0f0f5',
            background: 'linear-gradient(180deg, #fafbff 0%, #fff 100%)',
          }}
        >
          <Space size={8} wrap>
            {statusFilters.map((f) => (
              <span
                key={f.key}
                role="button"
                tabIndex={0}
                onClick={() => setStatusFilter(f.key)}
                onKeyDown={(e) => e.key === 'Enter' && setStatusFilter(f.key)}
                style={pillFilter(statusFilter === f.key, f.color, f.bg, f.border)}
              >
                {f.label}
                <span
                  style={{
                    background: statusFilter === f.key ? f.color : '#d9d9d9',
                    color: '#fff',
                    borderRadius: 10,
                    padding: '0 7px',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {f.count}
                </span>
              </span>
            ))}
          </Space>
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: '#bbb' }} />}
              placeholder="Search SKU or name..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 280, borderRadius: 10, height: 38 }}
            />
            <Tooltip title="Reload list">
              <Button
                icon={<ReloadOutlined />}
                onClick={refreshAll}
                style={{ borderRadius: 10, height: 38 }}
              >
                Refresh
              </Button>
            </Tooltip>
          </Space>
        </div>

        <Table
          rowKey="id"
          loading={isDraftView ? draftsLoading : loading}
          dataSource={isDraftView ? filteredDrafts : filteredItems}
          columns={isDraftView ? draftColumns : columns}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showTotal: (t) => (
              isDraftView
                ? `Showing ${t} draft${t !== 1 ? 's' : ''}`
                : `Showing ${t} product${t !== 1 ? 's' : ''}`
            ),
            style: { padding: '12px 24px 20px', margin: 0 },
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={(
                  <span style={{ color: '#8c8c8c' }}>
                    {isDraftView
                      ? 'No BOM drafts saved yet.'
                      : 'No BOM items yet.'}
                    {!isDraftView && canManage ? ' Create your first BOM product to get started.' : ''}
                  </span>
                )}
              >
                {canManage && (
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => openCreate()}
                    style={{
                      borderRadius: 10,
                      fontWeight: 600,
                      background: GRADIENT,
                      border: 'none',
                      boxShadow: '0 4px 14px rgba(102,126,234,0.4)',
                    }}
                  >
                    Create BOM item
                  </Button>
                )}
              </Empty>
            ),
          }}
          rowClassName={(_, i) => (i % 2 === 0 ? 'bom-row-light' : 'bom-row-dark')}
          style={{ padding: '0 8px' }}
        />
      </Card>

      <style>{`
        .bom-row-light td { background: #fafbff !important; }
        .bom-row-dark td { background: #fff !important; }
        .bom-row-light:hover td,
        .bom-row-dark:hover td { background: #f0f4ff !important; }
      `}</style>

      <Suspense fallback={null}>
        <BomItemForm
          open={formOpen}
          itemId={editingId}
          resumeDraftId={resumeDraftId}
          onCancel={() => {
            setFormOpen(false);
            setEditingId(null);
            setResumeDraftId(null);
            fetchDrafts();
          }}
          onSuccess={() => {
            setFormOpen(false);
            setEditingId(null);
            setResumeDraftId(null);
            refreshAll();
          }}
          onDraftsChange={fetchDrafts}
        />
      </Suspense>

      {viewingItem ? (
        <Suspense fallback={null}>
          <ItemDetailsModal
            open
            item={viewingItem}
            onClose={() => setViewingItem(null)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
