import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Button, message, Space, Input, Tag, Modal, Empty, Tooltip,
} from 'antd';
import {
  DeleteOutlined, SearchOutlined, RestOutlined, UndoOutlined, EyeOutlined,
} from '@ant-design/icons';
import apiService from '../../services/apiService.js';
import { useAuth } from '../../hooks/useAuth.jsx';
import ItemDetailsModal from '../../components/inventory/ItemDetailsModal.jsx';

const ItemTrash = () => {
  const { user } = useAuth();
  const canManageItems = user?.permissions?.item_management || user?.permissions?.all;
  const canDeletePermanently = user?.role === 'admin' || user?.role === 'super_admin';

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewItemSeed, setViewItemSeed] = useState(null);

  const fetchTrash = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/items', { params: { status: 'trashed' } });
      if (response.success) {
        setItems(response.data || []);
      } else {
        message.error(response.error || 'Failed to load trash');
        setItems([]);
      }
    } catch (error) {
      message.error(error?.response?.data?.error || 'Failed to load trash');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrash();
  }, []);

  const viewItem = (item) => {
    setViewItemSeed(item);
    setViewModalVisible(true);
  };

  const restoreItem = (item) => {
    Modal.confirm({
      title: 'Restore item to inactive?',
      icon: <UndoOutlined style={{ color: '#52c41a' }} />,
      content: (
        <div>
          <p style={{ marginBottom: 8 }}>
            Restore <strong>{item.name}</strong>
            {item.sku ? ` (${item.sku})` : ''} to the <strong>Inactive</strong> list?
          </p>
          <p style={{ margin: 0, color: '#8c8c8c', fontSize: 13 }}>
            The item will not be active yet. Open Items, filter Inactive, then use Activate when you are ready.
          </p>
        </div>
      ),
      okText: 'Restore to inactive',
      onOk: async () => {
        try {
          const response = await apiService.put(`/items/${item.id}`, { status: 'inactive' });
          if (response.success) {
            message.success('Item restored to inactive. Activate it from the Items page when ready.');
            fetchTrash();
          } else {
            message.error(response.error || 'Failed to restore item');
          }
        } catch (error) {
          message.error(error?.response?.data?.error || error?.message || 'Failed to restore item');
        }
      },
    });
  };

  const permanentlyDeleteItem = (item) => {
    if (!canDeletePermanently) return;
    if ((item.current_stock || 0) > 0) {
      message.warning('Reduce on-hand stock to zero before permanently deleting this item.');
      return;
    }

    Modal.confirm({
      title: 'Permanently delete item?',
      icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <p style={{ marginBottom: 8 }}>
            This will permanently remove <strong>{item.name}</strong>
            {item.sku ? ` (${item.sku})` : ''} from your catalog. This cannot be undone.
          </p>
          <p style={{ margin: 0, color: '#8c8c8c', fontSize: 13 }}>
            Stock must already be zero. Items linked to sales, purchases, or BOM products cannot be deleted.
          </p>
        </div>
      ),
      okText: 'Delete permanently',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const response = await apiService.deleteItem(item.id);
          if (response.success) {
            message.success('Item permanently deleted');
            fetchTrash();
          } else {
            message.error(response.error || 'Failed to delete item');
          }
        } catch (error) {
          message.error(error?.response?.data?.error || error?.message || 'Failed to delete item', 8);
        }
      },
    });
  };

  const filteredItems = useMemo(() => {
    if (!searchText) return items;
    const search = searchText.toLowerCase();
    return items.filter((item) => (
      item.name?.toLowerCase().includes(search) ||
      item.sku?.toLowerCase().includes(search) ||
      item.category?.toLowerCase().includes(search) ||
      item.item_group_name?.toLowerCase().includes(search)
    ));
  }, [items, searchText]);

  const columns = [
    {
      title: 'Item',
      key: 'name',
      render: (_, record) => (
        <div>
          <button
            type="button"
            onClick={() => viewItem(record)}
            style={{
              fontWeight: 700,
              color: '#667eea',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {record.name}
          </button>
          {record.sku && (
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>SKU: {record.sku}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      render: (value) => value || '—',
    },
    {
      title: 'Group',
      dataIndex: 'item_group_name',
      key: 'item_group_name',
      width: 140,
      render: (value) => value || '—',
    },
    {
      title: 'Stock',
      dataIndex: 'current_stock',
      key: 'current_stock',
      width: 90,
      render: (value) => Number(value || 0),
    },
    {
      title: 'Trashed',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 170,
      render: (value) => (value ? new Date(value).toLocaleString() : '—'),
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: () => <Tag color="default" style={{ borderRadius: 20 }}>In Trash</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 280,
      render: (_, record) => (
        <Space size={6}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => viewItem(record)}
            style={{ borderRadius: 8 }}
          >
            View
          </Button>
          {canManageItems && (
            <Button
              size="small"
              icon={<UndoOutlined />}
              onClick={() => restoreItem(record)}
              style={{ borderRadius: 8 }}
            >
              Restore to inactive
            </Button>
          )}
          {canDeletePermanently && (
            <Tooltip title={(record.current_stock || 0) > 0 ? 'Stock must be zero before permanent delete' : 'Delete permanently'}>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={(record.current_stock || 0) > 0}
                onClick={() => permanentlyDeleteItem(record)}
                style={{ borderRadius: 8 }}
              >
                Delete
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#f5f7fb', minHeight: '100vh' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #434343 0%, #1a1a2e 100%)',
          borderRadius: 16,
          padding: '24px 28px',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 14px' }}>
            <RestOutlined style={{ fontSize: 26, color: '#fff' }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>Trash</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
              Lifecycle: Active → Inactive → Trash. Restore moves items back to Inactive; activate them separately from the Items page.
            </div>
          </div>
        </div>
        <Tag
          style={{
            borderRadius: 20,
            padding: '4px 14px',
            fontSize: 13,
            fontWeight: 600,
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.25)',
            color: '#fff',
          }}
        >
          {items.length} item{items.length === 1 ? '' : 's'}
        </Tag>
      </div>

      <Card
        bordered={false}
        style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}
        bodyStyle={{ padding: 20 }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Input
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search trashed items..."
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            style={{ width: 300, borderRadius: 10 }}
          />
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredItems}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={searchText ? 'No trashed items matched your search' : 'Trash is empty'}
              />
            ),
          }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 900 }}
        />
      </Card>

      <ItemDetailsModal
        open={viewModalVisible}
        item={viewItemSeed}
        onClose={() => {
          setViewModalVisible(false);
          setViewItemSeed(null);
        }}
      />
    </div>
  );
};

export default ItemTrash;
