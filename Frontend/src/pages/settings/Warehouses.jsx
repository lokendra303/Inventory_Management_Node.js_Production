import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, message, Statistic, Row, Col, Tag, Divider, Popconfirm, Tabs, Spin } from 'antd';
import {
  PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, CloseOutlined, SearchOutlined,
  BankOutlined, EnvironmentOutlined, PhoneOutlined, MailOutlined, IdcardOutlined, ClockCircleOutlined,
  BarChartOutlined, AppstoreOutlined, LineChartOutlined, WarningOutlined, TeamOutlined, UserOutlined,
} from '@ant-design/icons';
import './Warehouses.css';
import apiService from '../../services/apiService';
import { usePermissions } from '../../components/common/PermissionWrapper';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import UpgradePlanModal from '../../components/common/UpgradePlanModal';

const Warehouses = () => {
  const { hasPermission } = usePermissions();
  const { currency, baseCurrency, exchangeRate } = useCurrency();
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseTypes, setWarehouseTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [editingTypeId, setEditingTypeId] = useState(null);
  const [editingTypeName, setEditingTypeName] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [warehouseDetails, setWarehouseDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [statusCategory, setStatusCategory] = useState('all');
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const detailsModalContentRef = useRef(null);
  /** 'all' | 'active' | 'inactive' — category view for warehouse status */
  const [upgradeModal, setUpgradeModal] = useState({ open: false, limit: null, plan: null });

  const canManageWarehouses = hasPermission('warehouse_management');
  const canManageWarehouseTypes = hasPermission('warehouse_type_management');

  const closeDetailsModal = useCallback(() => {
    setDetailsModalVisible(false);
    setSelectedWarehouse(null);
    setWarehouseDetails(null);
    setDetailsLoading(false);
  }, []);

  const formatPrice = (value) => {
    const convertedValue =
      currency === baseCurrency ? (value || 0) : (value || 0) * exchangeRate;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(convertedValue);
  };

  const formatDateTime = (value) => {
    if (value == null || value === '') return '—';
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return '—';
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', width: 150, ellipsis: true },
    { title: 'Code', dataIndex: 'code', key: 'code', width: 80, ellipsis: true, responsive: ['sm'] },
    { title: 'Type', dataIndex: 'type_name', key: 'type_name', width: 100, ellipsis: true, responsive: ['md'] },
    { title: 'Address', dataIndex: 'address', key: 'address', width: 150, ellipsis: true, responsive: ['lg'] },
    { title: 'Contact', dataIndex: 'contact_person', key: 'contact_person', width: 110, ellipsis: true, responsive: ['lg'] },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => (
        <Tag color={status === 'active' ? 'success' : 'error'} style={{ margin: 0 }}>
          {status === 'active' ? 'Active' : 'Inactive'}
        </Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button size="small" icon={<EyeOutlined />} onClick={() => viewWarehouseDetails(record)}>View</Button>
          {canManageWarehouses && (
            <Button size="small" icon={<EditOutlined />} onClick={() => editWarehouse(record)}>Edit</Button>
          )}
          {canManageWarehouses && (
            <Button
              size="small"
              type={record.status === 'active' ? 'default' : 'primary'}
              onClick={() => toggleWarehouseStatus(record)}
            >
              {record.status === 'active' ? 'Deactivate' : 'Activate'}
            </Button>
          )}
        </Space>
      )
    }
  ];

  const viewWarehouseDetails = async (warehouse) => {
    setSelectedWarehouse(warehouse);
    setWarehouseDetails(null);
    setDetailsLoading(true);
    setDetailsModalVisible(true);
    try {
      const response = await apiService.get(`/warehouses/${warehouse.id}/details`);
      if (response.success) {
        setWarehouseDetails(response.data);
      }
    } catch (error) {
      message.error('Failed to load warehouse details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const toggleWarehouseStatus = async (warehouse) => {
    try {
      const newStatus = warehouse.status === 'active' ? 'inactive' : 'active';
      const response = await apiService.put(`/warehouses/${warehouse.id}`, { status: newStatus });
      if (response.success) {
        message.success(`Warehouse ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
        fetchWarehouses();
      }
    } catch (error) {
      if (error?.response?.data?.code === 'SUBSCRIPTION_LIMIT') {
        const msg = error.response.data.error || '';
        const limitMatch = msg.match(/limit \((\d+)\)/);
        const planMatch  = msg.match(/your (.+?) plan/);
        setUpgradeModal({
          open: true,
          limit: limitMatch ? limitMatch[1] : '1',
          plan:  planMatch  ? planMatch[1]  : 'current',
        });
      } else {
        message.error('Failed to update warehouse status');
      }
    }
  };

const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const [warehousesResponse, typesResponse] = await Promise.all([
        apiService.get('/warehouses', { params: { status: 'all' } }),
        apiService.get('/warehouse-types')
      ]);
      
      if (warehousesResponse.success) {
        setWarehouses(warehousesResponse.data);
      }
      
      if (typesResponse.success) {
        setWarehouseTypes(typesResponse.data);
      }
    } catch (error) {
      if (error.isPermissionError) {
        message.error('You do not have permission to view warehouses');
      } else {
        message.error('Failed to fetch warehouses');
      }
    } finally {
      setLoading(false);
    }
  };

  const editWarehouse = (warehouse) => {
    setEditingWarehouse(warehouse);
    form.setFieldsValue({
      code: warehouse.code,
      name: warehouse.name,
      type: warehouse.type,
      address: warehouse.address,
      contactPerson: warehouse.contact_person,
      phone: warehouse.phone,
      email: warehouse.email
    });
    setModalVisible(true);
  };

  const handleAddWarehouse = async (values) => {
    try {
      // Clean up the values to avoid undefined parameters
      const cleanedValues = {
        code: values.code || null,
        name: values.name || null,
        type: values.type || null,
        address: values.address || null,
        contactPerson: values.contactPerson || null,
        phone: values.phone || null,
        email: values.email || null
      };
      
      if (editingWarehouse) {
        const response = await apiService.put(`/warehouses/${editingWarehouse.id}`, cleanedValues);
        if (response.success) {
          message.success('Warehouse updated successfully');
        }
      } else {
        const response = await apiService.post('/warehouses', cleanedValues);
        if (response.success) {
          message.success('Warehouse created successfully');
        }
      }
      setModalVisible(false);
      setEditingWarehouse(null);
      form.resetFields();
      fetchWarehouses();
    } catch (error) {
      if (error?.response?.data?.code === 'SUBSCRIPTION_LIMIT') {
        const msg = error.response.data.error || '';
        const limitMatch = msg.match(/limit \((\d+)\)/);
        const planMatch  = msg.match(/your (.+?) plan/);
        setUpgradeModal({
          open: true,
          limit: limitMatch ? limitMatch[1] : '1',
          plan:  planMatch  ? planMatch[1]  : 'current',
        });
      } else {
        message.error(`Failed to ${editingWarehouse ? 'update' : 'create'} warehouse: ${error.response?.data?.error || error.message}`);
      }
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (!detailsModalVisible) return undefined;

    const handlePointerDownOutside = (event) => {
      const modalNode = detailsModalContentRef.current;
      if (!modalNode) return;
      if (modalNode.contains(event.target)) return;
      closeDetailsModal();
    };

    document.addEventListener('mousedown', handlePointerDownOutside, true);
    document.addEventListener('touchstart', handlePointerDownOutside, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside, true);
      document.removeEventListener('touchstart', handlePointerDownOutside, true);
    };
  }, [detailsModalVisible, closeDetailsModal]);

  const statusSummary = useMemo(() => {
    const active = warehouses.filter((w) => w.status === 'active').length;
    const inactive = warehouses.filter((w) => w.status === 'inactive').length;
    return { active, inactive, total: warehouses.length };
  }, [warehouses]);

  const tableData = useMemo(() => {
    const searched = warehouses.filter(
      (wh) =>
        !searchText ||
        wh.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        wh.code?.toLowerCase().includes(searchText.toLowerCase())
    );
    if (statusCategory === 'active') return searched.filter((w) => w.status === 'active');
    if (statusCategory === 'inactive') return searched.filter((w) => w.status === 'inactive');
    return searched;
  }, [warehouses, searchText, statusCategory]);

  return (
    <div style={{ padding: '16px' }}>
      <h1 style={{ fontSize: '20px', marginBottom: 16 }}>Warehouses</h1>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small" bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Statistic title="Total warehouses" value={statusSummary.total} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Statistic
              title="Active"
              value={statusSummary.active}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Statistic
              title="Inactive"
              value={statusSummary.inactive}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          {canManageWarehouses && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              Add Warehouse
            </Button>
          )}
          <Input
            placeholder="Search by name or code..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ flex: 1, maxWidth: 300, minWidth: 200 }}
            allowClear
          />
        </div>

        <Tabs
          activeKey={statusCategory}
          onChange={setStatusCategory}
          style={{ marginBottom: 12 }}
          items={[
            {
              key: 'all',
              label: `All (${statusSummary.total})`,
            },
            {
              key: 'active',
              label: (
                <span>
                  <Tag color="success" style={{ marginRight: 6 }}>Active</Tag>
                  ({statusSummary.active})
                </span>
              ),
            },
            {
              key: 'inactive',
              label: (
                <span>
                  <Tag color="error" style={{ marginRight: 6 }}>Inactive</Tag>
                  ({statusSummary.inactive})
                </span>
              ),
            },
          ]}
        />

        <Table
          columns={columns}
          dataSource={tableData}
          loading={loading}
          rowKey="id"
          scroll={{ x: 400 }}
          size="small"
          pagination={{ size: 'small' }}
          locale={{
            emptyText:
              statusCategory === 'active'
                ? 'No active warehouses. Switch to Inactive or create a new warehouse.'
                : statusCategory === 'inactive'
                  ? 'No inactive warehouses.'
                  : 'No warehouses yet.',
          }}
        />
      </Card>

      <Modal
        title={editingWarehouse ? "Edit Warehouse" : "Add New Warehouse"}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingWarehouse(null); form.resetFields(); }}
        footer={null}
        width="min(520px, 96vw)"
        style={{ top: 16 }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddWarehouse}
        >
          <Form.Item
            name="code"
            label="Code"
            rules={[{ required: true, message: 'Please input code!' }]}
          >
            <Input placeholder="Enter warehouse code" />
          </Form.Item>
          
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please input name!' }]}
          >
            <Input placeholder="Enter warehouse name" />
          </Form.Item>
          
          <Form.Item
            name="type"
            label="Type"
          >
            <Select 
              placeholder="Select warehouse type"
              allowClear
              dropdownRender={(menu) => (
                <>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {warehouseTypes.map(type => (
                      <div key={type.id} style={{ padding: '5px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {editingTypeId === type.id ? (
                          <>
                            <Input
                              size="small"
                              value={editingTypeName}
                              onChange={(e) => setEditingTypeName(e.target.value)}
                              onKeyDown={(e) => e.stopPropagation()}
                              style={{ flex: 1, marginRight: 8 }}
                            />
                            <Space size="small">
                              <Button
                                size="small"
                                type="primary"
                                onClick={async () => {
                                  if (!editingTypeName.trim()) {
                                    message.warning('Type name cannot be empty');
                                    return;
                                  }
                                  try {
                                    const response = await apiService.put(`/warehouse-types/${type.id}`, { name: editingTypeName });
                                    if (response.success) {
                                      message.success('Type updated successfully');
                                      setEditingTypeId(null);
                                      setEditingTypeName('');
                                      fetchWarehouses();
                                    }
                                  } catch (error) {
                                    message.error('Failed to update type');
                                  }
                                }}
                              >
                                Save
                              </Button>
                              <Button
                                size="small"
                                icon={<CloseOutlined />}
                                onClick={() => {
                                  setEditingTypeId(null);
                                  setEditingTypeName('');
                                }}
                              />
                            </Space>
                          </>
                        ) : (
                          <>
                            <span 
                              style={{ flex: 1, cursor: 'pointer' }}
                              onClick={() => form.setFieldsValue({ type: type.id })}
                            >
                              {type.name}
                            </span>
                            {canManageWarehouseTypes && (
                              <Space size="small">
                                <Button
                                  size="small"
                                  type="text"
                                  icon={<EditOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTypeId(type.id);
                                    setEditingTypeName(type.name);
                                  }}
                                />
                                <Popconfirm
                                  title="Delete this type?"
                                  description="This will affect warehouses using this type."
                                  onConfirm={async (e) => {
                                    e?.stopPropagation();
                                    try {
                                      const response = await apiService.delete(`/warehouse-types/${type.id}`);
                                      if (response.success) {
                                        message.success('Type deleted successfully');
                                        fetchWarehouses();
                                      }
                                    } catch (error) {
                                      message.error('Failed to delete type');
                                    }
                                  }}
                                  onCancel={(e) => e?.stopPropagation()}
                                >
                                  <Button
                                    size="small"
                                    type="text"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </Popconfirm>
                              </Space>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  {canManageWarehouseTypes && (
                    <>
                      <Divider style={{ margin: '8px 0' }} />
                      <Space style={{ padding: '0 8px 4px' }}>
                        <Input
                          placeholder="New type name"
                          value={newTypeName}
                          onChange={(e) => setNewTypeName(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                        <Button
                          type="text"
                          icon={<PlusOutlined />}
                          onClick={async () => {
                            if (!newTypeName.trim()) {
                              message.warning('Please enter a type name');
                              return;
                            }
                            try {
                              const response = await apiService.post('/warehouse-types', { name: newTypeName });
                              if (response.success) {
                                message.success('Type created successfully');
                                setNewTypeName('');
                                fetchWarehouses();
                              }
                            } catch (error) {
                              message.error('Failed to create type');
                            }
                          }}
                        >
                          Add
                        </Button>
                      </Space>
                    </>
                  )}
                </>
              )}
            >
              {warehouseTypes.map(type => (
                <Select.Option key={type.id} value={type.id}>
                  {type.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item name="address" label="Address">
            <Input.TextArea placeholder="Enter address" />
          </Form.Item>
          
          <Form.Item name="contactPerson" label="Contact Person">
            <Input placeholder="Enter contact person" />
          </Form.Item>
          
          <Form.Item name="phone" label="Phone">
            <Input placeholder="Enter phone number" />
          </Form.Item>
          
          <Form.Item name="email" label="Email">
            <Input placeholder="Enter email" />
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingWarehouse ? 'Update Warehouse' : 'Create Warehouse'}
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                setEditingWarehouse(null);
                form.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* details close: custom native <button> in .wh-details-root (z-index) — ant .ant-modal-close was unreliable with flex/body hit-testing in this screen */}
      <Modal
        title={null}
        open={detailsModalVisible}
        closable={false}
        footer={null}
        mask
        maskClosable={true}
        keyboard
        onCancel={closeDetailsModal}
        getContainer={() => document.body}
        zIndex={10050}
        wrapClassName="wh-details-modal-wrap"
        width="min(1100px, 90vw)"
        centered
        className="warehouse-details-modal"
        styles={{
          content: {
            position: 'relative',
            padding: 0,
            borderRadius: 16,
            maxHeight: 'min(86vh, 1040px)',
            display: 'flex',
            flexDirection: 'column',
          },
          /* Do not set body overflow: auto — the scrollbar sits on the right edge and overlaps the hero X; scroll .wh-details-body only */
          body: { padding: 0, flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
        }}
        destroyOnClose
        /* No enter/exit motion: zoom/fade can leave content in a bad hit-testing state during/after open */
        maskTransitionName=""
        transitionName=""
      >
        <div className="wh-details-root" ref={detailsModalContentRef}>
          <div className="wh-details-hero">
            <div className="wh-details-hero-inner">
              <div className="wh-details-hero-icon" aria-hidden>
                <BankOutlined />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2>{selectedWarehouse?.name || 'Warehouse'}</h2>
                <div className="wh-details-hero-sub">
                  {selectedWarehouse?.code && <span className="wh-code-pill">{selectedWarehouse.code}</span>}
                  {warehouseDetails && (
                    <Tag color={warehouseDetails.status === 'active' ? 'success' : 'error'} style={{ margin: 0 }}>
                      {warehouseDetails.status === 'active' ? 'Active' : 'Inactive'}
                    </Tag>
                  )}
                  {warehouseDetails?.type_name && (
                    <span style={{ opacity: 0.9 }}>{warehouseDetails.type_name}</span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="wh-details-close-btn"
              aria-label="Close"
              onClick={(e) => {
                e.stopPropagation();
                closeDetailsModal();
              }}
            >
              <CloseOutlined />
            </button>
          </div>

          {detailsLoading && (
            <div className="wh-details-spin">
              <Spin size="large" tip="Loading details…" />
            </div>
          )}

          {!detailsLoading && warehouseDetails && (
            <div className="wh-details-body">
              <div className="wh-section">
                <div className="wh-section-title">
                  <IdcardOutlined /> Contact &amp; location
                </div>
                <div className="wh-info-grid">
                  <div className="wh-info-tile">
                    <div className="wh-info-tile-label">Address</div>
                    <div className="wh-info-tile-value">
                      <EnvironmentOutlined style={{ color: '#6366f1', marginRight: 6 }} />
                      {warehouseDetails.address || '—'}
                    </div>
                  </div>
                  <div className="wh-info-tile">
                    <div className="wh-info-tile-label">Contact</div>
                    <div className="wh-info-tile-value">
                      <UserOutlined style={{ color: '#6366f1', marginRight: 6 }} />
                      {warehouseDetails.contact_person || '—'}
                    </div>
                  </div>
                  <div className="wh-info-tile">
                    <div className="wh-info-tile-label">Phone</div>
                    <div className="wh-info-tile-value">
                      <PhoneOutlined style={{ color: '#6366f1', marginRight: 6 }} />
                      {warehouseDetails.phone || '—'}
                    </div>
                  </div>
                  <div className="wh-info-tile">
                    <div className="wh-info-tile-label">Email</div>
                    <div className="wh-info-tile-value">
                      <MailOutlined style={{ color: '#6366f1', marginRight: 6 }} />
                      {warehouseDetails.email || '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="wh-section">
                <div className="wh-section-title">
                  <ClockCircleOutlined /> Record
                </div>
                <div className="wh-record-row">
                  <div className="wh-info-tile">
                    <div className="wh-info-tile-label">Created</div>
                    <div className="wh-info-tile-value">{formatDateTime(warehouseDetails.created_at)}</div>
                  </div>
                  <div className="wh-info-tile">
                    <div className="wh-info-tile-label">Created by</div>
                    <div className="wh-info-tile-value">
                      <TeamOutlined style={{ color: '#6366f1', marginRight: 6 }} />
                      {warehouseDetails.created_by_name
                        || (warehouseDetails.created_by ? `User ${warehouseDetails.created_by}` : '—')}
                    </div>
                  </div>
                  <div className="wh-info-tile">
                    <div className="wh-info-tile-label">Last updated</div>
                    <div className="wh-info-tile-value">{formatDateTime(warehouseDetails.updated_at)}</div>
                  </div>
                  <div className="wh-info-tile">
                    <div className="wh-info-tile-label">Last updated by</div>
                    <div className="wh-info-tile-value">
                      <UserOutlined style={{ color: '#6366f1', marginRight: 6 }} />
                      {warehouseDetails.updated_by_name
                        || (warehouseDetails.updated_by ? `User ${warehouseDetails.updated_by}` : '—')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="wh-section">
                <div className="wh-section-title">
                  <BarChartOutlined /> Inventory snapshot
                </div>
                <div className="wh-stat-row">
                  <div className="wh-stat-card" style={{ ['--wh-accent']: '#6366f1' }}>
                    <Statistic title="Items" value={warehouseDetails.summary?.total_items || 0} valueStyle={{ color: '#312e81' }} />
                  </div>
                  <div className="wh-stat-card" style={{ ['--wh-accent']: '#7c3aed' }}>
                    <Statistic title="Total Qty" value={warehouseDetails.summary?.total_quantity || 0} valueStyle={{ color: '#4c1d95' }} />
                  </div>
                  <div className="wh-stat-card" style={{ ['--wh-accent']: '#16a34a' }}>
                    <Statistic title="Available" value={warehouseDetails.summary?.total_available || 0} valueStyle={{ color: '#15803d' }} />
                  </div>
                  <div className="wh-stat-card" style={{ ['--wh-accent']: '#ea580c' }}>
                    <Statistic title="Reserved" value={warehouseDetails.summary?.total_reserved || 0} valueStyle={{ color: '#c2410c' }} />
                  </div>
                </div>
                <div className="wh-stat-row" style={{ marginTop: 10 }}>
                  <div className="wh-stat-card" style={{ ['--wh-accent']: '#0d9488', flex: 1, minWidth: 140 }}>
                    <Statistic title="Total value" value={formatPrice(warehouseDetails.summary?.total_value || 0)} valueStyle={{ color: '#0f766e', fontSize: '1.1rem' }} />
                  </div>
                  <div
                    className="wh-stat-card"
                    style={{
                      ['--wh-accent']: (warehouseDetails.summary?.low_stock_items || 0) > 0 ? '#dc2626' : '#16a34a',
                      flex: 1,
                      minWidth: 140
                    }}
                  >
                    <Statistic
                      title="Low stock lines"
                      value={warehouseDetails.summary?.low_stock_items || 0}
                      prefix={(warehouseDetails.summary?.low_stock_items || 0) > 0 ? <WarningOutlined /> : null}
                      valueStyle={{ color: (warehouseDetails.summary?.low_stock_items || 0) > 0 ? '#b91c1c' : '#166534' }}
                    />
                  </div>
                </div>
              </div>

              <div className="wh-section">
                <div className="wh-table-card">
                  <Card title={<span><AppstoreOutlined style={{ marginRight: 8, color: '#6366f1' }} />Items by category</span>} size="small" style={{ border: 'none' }} styles={{ body: { padding: 0 } }}>
                    <Table
                      dataSource={warehouseDetails.categories || []}
                      columns={[
                        { title: 'Category', dataIndex: 'category', key: 'category', ellipsis: true },
                        { title: 'Items', dataIndex: 'item_count', key: 'item_count', width: 80 },
                        { title: 'Total Qty', dataIndex: 'total_quantity', key: 'total_quantity', width: 100 },
                        { title: 'Total Value', dataIndex: 'total_value', key: 'total_value', width: 130, render: (v) => formatPrice(v) }
                      ]}
                      pagination={false}
                      size="small"
                      scroll={{ x: 'max-content' }}
                    />
                  </Card>
                </div>
              </div>

              <div className="wh-section" style={{ marginBottom: 0 }}>
                <div className="wh-table-card">
                  <Card title={<span><LineChartOutlined style={{ marginRight: 8, color: '#6366f1' }} />Top items by value</span>} size="small" style={{ border: 'none' }} styles={{ body: { padding: 0 } }}>
                    <Table
                      dataSource={warehouseDetails.topItems || []}
                      columns={[
                        { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 90, ellipsis: true },
                        { title: 'Name', dataIndex: 'name', key: 'name', width: 130, ellipsis: true },
                        { title: 'Category', dataIndex: 'category', key: 'category', width: 110, ellipsis: true },
                        { title: 'Qty', dataIndex: 'quantity_on_hand', key: 'quantity_on_hand', width: 70 },
                        { title: 'Unit', dataIndex: 'unit', key: 'unit', width: 60 },
                        { title: 'Avg Cost', dataIndex: 'average_cost', key: 'average_cost', width: 110, render: (v) => formatPrice(v) },
                        { title: 'Total Value', dataIndex: 'total_value', key: 'total_value', width: 120, render: (v) => formatPrice(v) }
                      ]}
                      pagination={{ pageSize: 10, size: 'small' }}
                      size="small"
                      scroll={{ x: 'max-content' }}
                    />
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Upgrade Plan Modal */}
      <UpgradePlanModal
        open={upgradeModal.open}
        onClose={() => setUpgradeModal({ open: false, limit: null, plan: null })}
        resource="warehouses"
        currentLimit={upgradeModal.limit}
        currentPlan={upgradeModal.plan}
      />
    </div>
  );
};

export default Warehouses;