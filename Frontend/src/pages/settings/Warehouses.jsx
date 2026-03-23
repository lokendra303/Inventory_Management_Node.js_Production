import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, message, Statistic, Row, Col, Descriptions, Tag, Divider, Popconfirm } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, CloseOutlined, SearchOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import { usePermissions } from '../../components/common/PermissionWrapper';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';

const Warehouses = () => {
  const { hasPermission } = usePermissions();
  const { currency, exchangeRate } = useCurrency();
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
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');

  const canManageWarehouses = hasPermission('warehouse_management');
  const canManageWarehouseTypes = hasPermission('warehouse_type_management');

  const formatPrice = (value) => {
    const convertedValue = (value || 0) * exchangeRate;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(convertedValue);
  };

  const columns = [
    { title: 'Code', dataIndex: 'code', key: 'code' },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Type', dataIndex: 'type_name', key: 'type_name' },
    { title: 'Address', dataIndex: 'address', key: 'address' },
    { title: 'Contact', dataIndex: 'contact_person', key: 'contact_person' },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => (
        <span style={{ color: status === 'active' ? '#52c41a' : '#ff4d4f' }}>
          {status === 'active' ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button 
            size="small"
            icon={<EyeOutlined />}
            onClick={() => viewWarehouseDetails(record)}
          >
            View
          </Button>
          {canManageWarehouses && (
            <Button 
              size="small"
              icon={<EditOutlined />}
              onClick={() => editWarehouse(record)}
            >
              Edit
            </Button>
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
    try {
      setSelectedWarehouse(warehouse);
      setDetailsModalVisible(true);
      const response = await apiService.get(`/warehouses/${warehouse.id}/details`);
      if (response.success) {
        setWarehouseDetails(response.data);
      }
    } catch (error) {
      message.error('Failed to load warehouse details');
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
      message.error('Failed to update warehouse status');
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
      console.error('Warehouse operation error:', error);
      message.error(`Failed to ${editingWarehouse ? 'update' : 'create'} warehouse: ${error.response?.data?.error || error.message}`);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <h1>Warehouses</h1>
      <Card>
        {canManageWarehouses && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
            style={{ marginBottom: 16 }}
          >
            Add Warehouse
          </Button>
        )}
        <Input
          placeholder="Search by name or code..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ marginBottom: 16, maxWidth: 300, marginLeft: canManageWarehouses ? 8 : 0 }}
          allowClear
        />
        <Table 
          columns={columns} 
          dataSource={warehouses.filter(wh =>
            !searchText ||
            wh.name?.toLowerCase().includes(searchText.toLowerCase()) ||
            wh.code?.toLowerCase().includes(searchText.toLowerCase())
          )} 
          loading={loading}
          rowKey="id"
        />
      </Card>

      <Modal
        title={editingWarehouse ? "Edit Warehouse" : "Add New Warehouse"}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingWarehouse(null);
          form.resetFields();
        }}
        footer={null}
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

      {/* Warehouse Details Modal */}
      <Modal
        title={`Warehouse Details - ${selectedWarehouse?.name}`}
        open={detailsModalVisible}
        onCancel={() => {
          setDetailsModalVisible(false);
          setSelectedWarehouse(null);
          setWarehouseDetails(null);
        }}
        footer={null}
        width={1000}
      >
        {warehouseDetails && (
          <div>
            {/* Basic Info */}
            <Descriptions title="Basic Information" bordered column={2} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="Code">{warehouseDetails.code}</Descriptions.Item>
              <Descriptions.Item label="Name">{warehouseDetails.name}</Descriptions.Item>
              <Descriptions.Item label="Type">{warehouseDetails.type_name || 'Standard'}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={warehouseDetails.status === 'active' ? 'green' : 'red'}>
                  {warehouseDetails.status?.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Address" span={2}>{warehouseDetails.address || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Contact Person">{warehouseDetails.contact_person || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Phone">{warehouseDetails.phone || 'N/A'}</Descriptions.Item>
            </Descriptions>

            {/* Inventory Summary */}
            <Card title="Inventory Summary" style={{ marginBottom: 24 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic 
                    title="Total Items" 
                    value={warehouseDetails.summary?.total_items || 0} 
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="Total Quantity" 
                    value={warehouseDetails.summary?.total_quantity || 0} 
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="Available Quantity" 
                    value={warehouseDetails.summary?.total_available || 0}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="Reserved Quantity" 
                    value={warehouseDetails.summary?.total_reserved || 0}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={12}>
                  <Statistic 
                    title="Total Value" 
                    value={formatPrice(warehouseDetails.summary?.total_value || 0)} 
                  />
                </Col>
                <Col span={12}>
                  <Statistic 
                    title="Low Stock Items" 
                    value={warehouseDetails.summary?.low_stock_items || 0}
                    valueStyle={{ color: warehouseDetails.summary?.low_stock_items > 0 ? '#cf1322' : '#3f8600' }}
                  />
                </Col>
              </Row>
            </Card>

            {/* Items by Category */}
            <Card title="Items by Category" style={{ marginBottom: 24 }}>
              <Table
                dataSource={warehouseDetails.categories || []}
                columns={[
                  { title: 'Category', dataIndex: 'category', key: 'category' },
                  { title: 'Item Count', dataIndex: 'item_count', key: 'item_count' },
                  { title: 'Total Quantity', dataIndex: 'total_quantity', key: 'total_quantity' },
                  { 
                    title: 'Total Value', 
                    dataIndex: 'total_value', 
                    key: 'total_value',
                    render: (value) => formatPrice(value)
                  }
                ]}
                pagination={false}
                size="small"
              />
            </Card>

            {/* Top Items by Value */}
            <Card title="Top Items by Value">
              <Table
                dataSource={warehouseDetails.topItems || []}
                columns={[
                  { title: 'SKU', dataIndex: 'sku', key: 'sku' },
                  { title: 'Name', dataIndex: 'name', key: 'name' },
                  { title: 'Category', dataIndex: 'category', key: 'category' },
                  { title: 'Quantity', dataIndex: 'quantity_on_hand', key: 'quantity_on_hand' },
                  { title: 'Unit', dataIndex: 'unit', key: 'unit' },
                  { 
                    title: 'Avg Cost', 
                    dataIndex: 'average_cost', 
                    key: 'average_cost',
                    render: (value) => formatPrice(value)
                  },
                  { 
                    title: 'Total Value', 
                    dataIndex: 'total_value', 
                    key: 'total_value',
                    render: (value) => formatPrice(value)
                  }
                ]}
                pagination={{ pageSize: 10 }}
                size="small"
              />
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Warehouses;