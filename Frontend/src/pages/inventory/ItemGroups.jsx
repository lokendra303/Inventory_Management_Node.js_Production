import React, { useEffect, useMemo, useState } from 'react';
import { Card, Form, Select, Input, Button, Table, message, Space, Row, Col, Statistic, Modal, Tag, Tooltip, Empty } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, TagsOutlined, EyeOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/apiService.js';
import { useAuth } from '../../hooks/useAuth.jsx';

const ItemGroups = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageItems = user?.permissions?.item_management || user?.permissions?.all;
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [form] = Form.useForm();

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/item-groups');
      const data = Array.isArray(response) ? response : (response?.data || []);
      setGroups(Array.isArray(data) ? data : []);
    } catch (error) {
      message.error(error?.response?.data?.error || 'Failed to load item groups');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const filteredGroups = useMemo(() => (
    groups.filter((group) => {
      if (statusFilter === 'active' && !group.is_active) return false;
      if (statusFilter === 'inactive' && group.is_active) return false;
      if (statusFilter === 'in_use' && Number(group.usage_count || 0) === 0) return false;
      if (statusFilter === 'unused' && Number(group.usage_count || 0) > 0) return false;
      if (!searchText) return true;
      const search = String(searchText).toLowerCase();
      return (
        String(group.name || '').toLowerCase().includes(search) ||
        String(group.description || '').toLowerCase().includes(search)
      );
    })
  ), [groups, searchText, statusFilter]);

  const openCreateModal = () => {
    setEditingGroup(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true });
    setModalOpen(true);
  };

  const openEditModal = (group) => {
    setEditingGroup(group);
    form.setFieldsValue({
      name: group.name,
      description: group.description || '',
      isActive: group.is_active !== false
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        name: values.name,
        description: values.description || '',
        isActive: values.isActive !== false
      };

      if (editingGroup) {
        await apiService.put(`/item-groups/${editingGroup.id}`, payload);
        message.success('Item group updated successfully');
      } else {
        await apiService.post('/item-groups', payload);
        message.success('Item group created successfully');
      }

      setModalOpen(false);
      setEditingGroup(null);
      form.resetFields();
      fetchGroups();
    } catch (error) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.error || 'Failed to save item group');
    }
  };

  const handleDelete = async (groupId) => {
    try {
      await apiService.delete(`/item-groups/${groupId}`);
      message.success('Item group deleted successfully');
      fetchGroups();
    } catch (error) {
      message.error(error?.response?.data?.error || 'Failed to delete item group');
    }
  };

  const handleQuickStatusToggle = async (group) => {
    try {
      await apiService.put(`/item-groups/${group.id}`, {
        name: group.name,
        description: group.description || '',
        isActive: !group.is_active
      });
      message.success(`Item group ${group.is_active ? 'set to inactive' : 'activated'} successfully`);
      fetchGroups();
    } catch (error) {
      message.error(error?.response?.data?.error || 'Failed to update item group status');
    }
  };

  const activeCount = groups.filter((group) => group.is_active).length;
  const inUseCount = groups.filter((group) => Number(group.usage_count || 0) > 0).length;
  const inactiveCount = groups.length - activeCount;
  const unusedCount = groups.filter((group) => Number(group.usage_count || 0) === 0).length;

  const openGroupedItems = (group) => {
    if (!group?.id) return;
    navigate(`/items?itemGroupId=${encodeURIComponent(group.id)}`);
  };

  const columns = [
    {
      title: 'Group Name',
      dataIndex: 'name',
      key: 'name',
      render: (value, record) => (
        <div>
          <div style={{ fontWeight: 700, color: '#1f2937' }}>{value}</div>
          {record.description && (
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>{record.description}</div>
          )}
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 110,
      render: (value) => (
        <Tag color={value ? 'green' : 'default'} style={{ borderRadius: 20 }}>
          {value ? 'Active' : 'Inactive'}
        </Tag>
      )
    },
    {
      title: 'Assigned Items',
      dataIndex: 'usage_count',
      key: 'usage_count',
      width: 130,
      render: (value, record) => (
        <Button
          type="link"
          onClick={() => openGroupedItems(record)}
          style={{ padding: 0, height: 'auto', fontWeight: 700, color: Number(value || 0) > 0 ? '#7c3aed' : '#6b7280' }}
        >
          {Number(value || 0)}
        </Button>
      )
    },
    {
      title: 'Usage',
      key: 'usage_status',
      width: 140,
      render: (_, record) => {
        const count = Number(record.usage_count || 0);
        if (count === 0) {
          return <Tag color="default" style={{ borderRadius: 20 }}>Unused</Tag>;
        }
        if (count >= 10) {
          return <Tag color="purple" style={{ borderRadius: 20 }}>High Usage</Tag>;
        }
        return <Tag color="blue" style={{ borderRadius: 20 }}>In Use</Tag>;
      }
    },
    {
      title: 'Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (value) => value ? new Date(value).toLocaleString() : '-'
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_, record) => {
        const isInUse = Number(record.usage_count || 0) > 0;
        return (
          <Space size={6}>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openGroupedItems(record)}
              style={{ borderRadius: 8 }}
            >
              View Items
            </Button>
            {canManageItems && (
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEditModal(record)}
                style={{ borderRadius: 8 }}
              >
                Edit
              </Button>
            )}
            {canManageItems && (
              <Button
                size="small"
                icon={record.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
                onClick={() => handleQuickStatusToggle(record)}
                style={{ borderRadius: 8 }}
              >
                {record.is_active ? 'Set Inactive' : 'Activate'}
              </Button>
            )}
            {canManageItems && (
              <Tooltip title={isInUse ? 'Remove item assignments before deleting this group' : 'Delete group'}>
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={isInUse}
                  onClick={() => {
                    Modal.confirm({
                      title: 'Delete item group',
                      content: `Delete "${record.name}"? This cannot be undone.`,
                      okText: 'Delete',
                      okButtonProps: { danger: true },
                      onOk: () => handleDelete(record.id)
                    });
                  }}
                  style={{ borderRadius: 8 }}
                >
                  Delete
                </Button>
              </Tooltip>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <div style={{ padding: 24, background: '#f5f7fb', minHeight: '100vh' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 16,
          padding: '24px 28px',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 12, padding: '10px 14px' }}>
            <TagsOutlined style={{ fontSize: 26, color: '#fff' }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>Item Groups</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
              Organize items into reusable business groups for filtering and reporting.
            </div>
          </div>
        </div>
        {canManageItems && (
          <Button
            icon={<PlusOutlined />}
            size="large"
            onClick={openCreateModal}
            style={{
              background: '#fff',
              color: '#764ba2',
              border: '2px solid rgba(255,255,255,0.6)',
              borderRadius: 10,
              fontWeight: 700
            }}
          >
            Add Item Group
          </Button>
        )}
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Statistic title="Total Groups" value={groups.length} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Statistic title="Active Groups" value={activeCount} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Statistic title="Groups In Use" value={inUseCount} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Statistic title="Unused Groups" value={unusedCount} />
          </Card>
        </Col>
      </Row>

      <Card
        bordered={false}
        style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', marginBottom: 24 }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, color: '#1f2937', fontSize: 15, marginBottom: 4 }}>Operational View</div>
            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
              Create business groups, assign items from the item form, then use <strong>View Items</strong> or the usage count to jump directly into the filtered item list.
            </div>
          </div>
          <Space wrap size={8}>
            <Tag color="green" style={{ borderRadius: 20, marginInlineEnd: 0 }}>Active: {activeCount}</Tag>
            <Tag color="default" style={{ borderRadius: 20, marginInlineEnd: 0 }}>Inactive: {inactiveCount}</Tag>
            <Tag color="purple" style={{ borderRadius: 20, marginInlineEnd: 0 }}>In Use: {inUseCount}</Tag>
            <Tag color="gold" style={{ borderRadius: 20, marginInlineEnd: 0 }}>Unused: {unusedCount}</Tag>
          </Space>
        </div>
      </Card>

      <Card
        bordered={false}
        style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}
        bodyStyle={{ padding: 20 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <Space wrap>
            {[
              { key: 'all', label: 'All', count: groups.length },
              { key: 'active', label: 'Active', count: activeCount },
              { key: 'inactive', label: 'Inactive', count: inactiveCount },
              { key: 'in_use', label: 'In Use', count: inUseCount },
              { key: 'unused', label: 'Unused', count: unusedCount }
            ].map((filter) => (
              <span
                key={filter.key}
                onClick={() => setStatusFilter(filter.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 20,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                  border: `1px solid ${statusFilter === filter.key ? '#667eea' : '#e5e7eb'}`,
                  background: statusFilter === filter.key ? '#eef2ff' : '#fff',
                  color: statusFilter === filter.key ? '#4f46e5' : '#6b7280'
                }}
              >
                {filter.label}
                <span style={{ background: statusFilter === filter.key ? '#4f46e5' : '#cbd5e1', color: '#fff', borderRadius: 999, padding: '0 7px', fontSize: 11 }}>
                  {filter.count}
                </span>
              </span>
            ))}
          </Space>
          <Input
            allowClear
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search item groups..."
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            style={{ width: 280, borderRadius: 10 }}
          />
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredGroups}
          locale={{
            emptyText: (
              <Empty
                description={searchText ? 'No item groups matched your search' : 'No item groups created yet'}
              />
            )
          }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 760 }}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={editingGroup ? 'Edit Item Group' : 'Create Item Group'}
        onCancel={() => {
          setModalOpen(false);
          setEditingGroup(null);
          form.resetFields();
        }}
        onOk={handleSubmit}
        okText={editingGroup ? 'Update Group' : 'Create Group'}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Group Name"
            rules={[{ required: true, message: 'Please enter item group name' }]}
          >
            <Input placeholder="e.g. Personal Care, Consumables, Premium Range" />
          </Form.Item>
          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea rows={3} placeholder="Optional note about what belongs in this group" />
          </Form.Item>
          <Form.Item name="isActive" label="Status" initialValue={true}>
            <Select
              options={[
                { value: true, label: 'Active' },
                { value: false, label: 'Inactive' }
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ItemGroups;
