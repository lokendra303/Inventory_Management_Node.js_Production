import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, message, Statistic, Row, Col, Descriptions, Tag } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import apiService from '../services/apiService';
import { usePermissions } from '../components/PermissionWrapper';
import { useCurrency } from '../contexts/CurrencyContext';

const Warehouses = () => {
  const { hasPermission } = usePermissions();
  const { currency, exchangeRate } = useCurrency();
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseTypes, setWarehouseTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [warehouseDetails, setWarehouseDetails] = useState(null);
  const [form] = Form.useForm();
  const [typeForm] = Form.useForm();

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
      render: (_, record) => (
        <Space>
          <Button 
            size="small"
            icon={<EyeOutlined />}
            onClick={() => viewWarehouseDetails(record)}
          >
            View Details
          </Button>
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
        apiService.get('/warehouses'),
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

  const handleAddWarehouse = async (values) => {
    try {
      const response = await apiService.post('/warehouses', values);
      if (response.success) {
        message.success('Warehouse created successfully');
        setModalVisible(false);
        form.resetFields();
        fetchWarehouses();
      }
    } catch (error) {
      message.error('Failed to create warehouse');
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <h1>Warehouses</h1>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          {canManageWarehouses && (
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => setModalVisible(true)}
            >
              Add Warehouse
            </Button>
          )}
          {canManageWarehouseTypes && (
            <Button 
              onClick={() => setTypeModalVisible(true)}
            >
              Manage Types
            </Button>
          )}
        </Space>
        <Table 
          columns={columns} 
          dataSource={warehouses} 
          loading={loading}
          rowKey="id"
        />
      </Card>

      <Modal
        title="Add New Warehouse"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
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
                Create Warehouse
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Warehouse Type Modal */}
      <Modal
        title="Manage Warehouse Types"
        open={typeModalVisible}
        onCancel={() => setTypeModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={typeForm}
          layout="vertical"
          onFinish={async (values) => {
            try {
              const response = await apiService.post('/warehouse-types', values);
              if (response.success) {
                message.success('Warehouse type created successfully');
                typeForm.resetFields();
                fetchWarehouses();
              }
            } catch (error) {
              message.error('Failed to create warehouse type');
            }
          }}
        >
          <Form.Item
            name="name"
            label="Type Name"
            rules={[{ required: true, message: 'Please input type name!' }]}
          >
            <Input placeholder="Enter warehouse type name" />
          </Form.Item>
          
          <Form.Item name="description" label="Description">
            <Input.TextArea placeholder="Enter description" rows={3} />
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Create Type
              </Button>
              <Button onClick={() => typeForm.resetFields()}>
                Reset
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
                    title="Total Value" 
                    value={formatPrice(warehouseDetails.summary?.total_value || 0)} 
                  />
                </Col>
                <Col span={6}>
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