import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, InputNumber, message } from 'antd';
import { PlusOutlined, SwapOutlined, EditOutlined } from '@ant-design/icons';
import apiService from '../services/apiService';
import { useAuth } from '../hooks/useAuth';

const Inventory = () => {
  const { user } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('receive');
  const [form] = Form.useForm();

  // Permission checks
  const canReceive = user?.permissions?.inventory_receive || user?.permissions?.all;
  const canAdjust = user?.permissions?.inventory_adjust || user?.permissions?.all;
  const canTransfer = user?.permissions?.inventory_transfer || user?.permissions?.all;

  const columns = [
    { title: 'Item', dataIndex: 'item_name', key: 'item_name' },
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name' },
    { title: 'On Hand', dataIndex: 'quantity_on_hand', key: 'quantity_on_hand', render: (val) => val || 0 },
    { title: 'Available', dataIndex: 'quantity_available', key: 'quantity_available', render: (val) => val || 0 },
    { title: 'Reserved', dataIndex: 'quantity_reserved', key: 'quantity_reserved', render: (val) => val || 0 }
  ];

  const fetchData = async (warehouseFilter = selectedWarehouse) => {
    try {
      setLoading(true);
      const inventoryUrl = warehouseFilter === 'all' ? '/inventory' : `/inventory/warehouse/${warehouseFilter}`;
      
      const [inventoryRes, itemsRes, warehousesRes] = await Promise.all([
        apiService.get(inventoryUrl).catch(() => ({ success: false, data: [] })),
        apiService.get('/items'),
        apiService.get('/warehouses')
      ]);
      
      setInventory(inventoryRes.success ? inventoryRes.data : []);
      setItems(itemsRes.success ? itemsRes.data : []);
      setWarehouses(warehousesRes.success ? warehousesRes.data : []);
    } catch (error) {
      message.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleWarehouseChange = (warehouseId) => {
    setSelectedWarehouse(warehouseId);
    fetchData(warehouseId);
  };

  const handleOperation = async (values) => {
    try {
      let response;
      const operationData = {
        ...values,
        poId: values.poId || '00000000-0000-0000-0000-000000000000',
        poLineId: values.poLineId || '00000000-0000-0000-0000-000000000000',
        grnNumber: values.grnNumber || `GRN-${Date.now()}`,
        soId: values.soId || '00000000-0000-0000-0000-000000000000',
        soLineId: values.soLineId || '00000000-0000-0000-0000-000000000000',
        shipmentNumber: values.shipmentNumber || `SHIP-${Date.now()}`,
        transferId: values.transferId || '00000000-0000-0000-0000-000000000000'
      };

      switch (modalType) {
        case 'receive':
          response = await apiService.post('/inventory/receive', operationData);
          break;
        case 'adjust':
          response = await apiService.post('/inventory/adjust', operationData);
          break;
        case 'transfer':
          response = await apiService.post('/inventory/transfer', operationData);
          break;
        default:
          throw new Error('Unknown operation type');
      }

      if (response.success) {
        message.success(`Stock ${modalType} successful`);
        setModalVisible(false);
        form.resetFields();
        fetchData();
      }
    } catch (error) {
      message.error(`Failed to ${modalType} stock`);
    }
  };

  const openModal = (type) => {
    setModalType(type);
    setModalVisible(true);
    form.resetFields();
  };

  useEffect(() => {
    fetchData();
  }, []);

  const renderModalContent = () => {
    switch (modalType) {
      case 'receive':
        return (
          <>
            <Form.Item name="itemId" label="Item" rules={[{ required: true }]}>
              <Select placeholder="Select item">
                {items.map(item => (
                  <Select.Option key={item.id} value={item.id}>{item.name} ({item.sku})</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}>
              <Select placeholder="Select warehouse">
                {warehouses.map(wh => (
                  <Select.Option key={wh.id} value={wh.id}>{wh.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="unitCost" label="Unit Cost" rules={[{ required: true }]}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
          </>
        );
      case 'adjust':
        return (
          <>
            <Form.Item name="itemId" label="Item" rules={[{ required: true }]}>
              <Select placeholder="Select item">
                {items.map(item => (
                  <Select.Option key={item.id} value={item.id}>{item.name} ({item.sku})</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}>
              <Select placeholder="Select warehouse">
                {warehouses.map(wh => (
                  <Select.Option key={wh.id} value={wh.id}>{wh.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="adjustmentType" label="Type" rules={[{ required: true }]}>
              <Select placeholder="Select adjustment type">
                <Select.Option value="increase">Increase</Select.Option>
                <Select.Option value="decrease">Decrease</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="quantityChange" label="Quantity" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
              <Input placeholder="Enter reason for adjustment" />
            </Form.Item>
          </>
        );
      case 'transfer':
        return (
          <>
            <Form.Item name="itemId" label="Item" rules={[{ required: true }]}>
              <Select placeholder="Select item">
                {items.map(item => (
                  <Select.Option key={item.id} value={item.id}>{item.name} ({item.sku})</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="fromWarehouseId" label="From Warehouse" rules={[{ required: true }]}>
              <Select placeholder="Select source warehouse">
                {warehouses.map(wh => (
                  <Select.Option key={wh.id} value={wh.id}>{wh.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="toWarehouseId" label="To Warehouse" rules={[{ required: true }]}>
              <Select placeholder="Select destination warehouse">
                {warehouses.map(wh => (
                  <Select.Option key={wh.id} value={wh.id}>{wh.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <h1>Inventory</h1>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            {canReceive && (
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => openModal('receive')}
              >
                Receive Stock
              </Button>
            )}
            {canAdjust && (
              <Button 
                icon={<EditOutlined />}
                onClick={() => openModal('adjust')}
              >
                Adjust Stock
              </Button>
            )}
            {canTransfer && (
              <Button 
                icon={<SwapOutlined />}
                onClick={() => openModal('transfer')}
              >
                Transfer Stock
              </Button>
            )}
          </Space>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Warehouse:</span>
            <Select
              value={selectedWarehouse}
              onChange={handleWarehouseChange}
              style={{ width: 200 }}
            >
              <Select.Option value="all">All Warehouses</Select.Option>
              {warehouses.map(wh => (
                <Select.Option key={wh.id} value={wh.id}>{wh.name}</Select.Option>
              ))}
            </Select>
          </div>
        </div>
        <Table 
          columns={columns} 
          dataSource={inventory} 
          loading={loading}
          rowKey="id"
        />
      </Card>

      <Modal
        title={`${modalType.charAt(0).toUpperCase() + modalType.slice(1)} Stock`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleOperation}
        >
          {renderModalContent()}
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {modalType.charAt(0).toUpperCase() + modalType.slice(1)} Stock
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Inventory;