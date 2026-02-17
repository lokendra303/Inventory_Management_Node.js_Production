import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, InputNumber, message } from 'antd';
import { PlusOutlined, EyeOutlined, SettingOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import { useAuth } from '../../hooks/useAuth.jsx';
import { formatNumber } from '../../utils/currency.js';

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

  const [currency, setCurrency] = useState('');

  const [viewingRecord, setViewingRecord] = useState(null);

  // Permission checks
  const canReceive = user?.permissions?.inventory_receive || user?.permissions?.all;
  const allowManualOperations = user?.permissions?.manual_inventory || user?.role === 'admin';
  const showManualButtons = process.env.REACT_APP_ENABLE_MANUAL_INVENTORY !== 'false' && allowManualOperations;

  const columns = [
    { title: 'Item', dataIndex: 'item_name', key: 'item_name' },
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Unit', dataIndex: 'unit', key: 'unit' },
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name' },
    { title: 'On Hand', dataIndex: 'quantity_on_hand', key: 'quantity_on_hand', render: (val) => formatNumber(val || 0) },
    { title: 'Available', dataIndex: 'quantity_available', key: 'quantity_available', render: (val) => formatNumber(val || 0) },
    { title: 'Reserved', dataIndex: 'quantity_reserved', key: 'quantity_reserved', render: (val) => formatNumber(val || 0) },
    { title: 'Avg Cost', dataIndex: 'average_cost', key: 'average_cost', render: (val, record) => (val && !isNaN(Number(val))) ? `${record.currency || currency}${formatNumber(val)}` : '-' },
    { title: 'Total Value', dataIndex: 'total_value', key: 'total_value', render: (val, record) => (val && !isNaN(Number(val))) ? `${record.currency || currency}${formatNumber(val)}` : '-' },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button 
          size="small"
          icon={<EyeOutlined />}
          onClick={() => openViewModal(record)}
        >
          View
        </Button>
      )
    }
  ];

  const fetchData = async (warehouseFilter = selectedWarehouse) => {
    try {
      setLoading(true);
      const inventoryUrl = warehouseFilter === 'all' ? '/inventory' : `/inventory/warehouse/${warehouseFilter}`;
      
      const [inventoryRes, itemsRes, warehousesRes] = await Promise.all([
        apiService.get(inventoryUrl).catch((error) => {
          if (error.response?.status === 401) {
            window.location.href = '/login';
          }
          return { success: false, data: [] };
        }),
        apiService.get('/items').catch((error) => {
          if (error.response?.status === 401) {
            window.location.href = '/login';
          }
          return { success: false, data: [] };
        }),
        apiService.get('/warehouses').catch((error) => {
          if (error.response?.status === 401) {
            window.location.href = '/login';
          }
          return { success: false, data: [] };
        })
      ]);
      
      // Get currency from user settings or first inventory item
      if (inventoryRes.success && inventoryRes.data.length > 0) {
        const firstItem = inventoryRes.data[0];
        if (firstItem.currency) {
          setCurrency(firstItem.currency);
        }
      }
      
      setInventory(inventoryRes.success ? inventoryRes.data : []);
      setItems(itemsRes.success ? itemsRes.data : []);
      setWarehouses(warehousesRes.success ? warehousesRes.data : []);
    } catch (error) {
      if (error.response?.status === 401) {
        window.location.href = '/login';
      }
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

      if (modalType === 'receive') {
        response = await apiService.post('/inventory/receive', operationData);
      }

      if (response && response.success) {
        message.success('Stock receive successful');
        setModalVisible(false);
        form.resetFields();
        setTimeout(() => {
          fetchData();
        }, 500);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        window.location.href = '/login';
        return;
      }
      console.error('Operation error:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      message.error(`Failed to receive stock: ${errorMessage}`);
    }
  };

  const openViewModal = (record) => {
    setViewingRecord(record);
    setModalType('view');
    setModalVisible(true);
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
    if (modalType === 'receive') {
      return (
        <>
          <Form.Item name="itemId" label="Item" rules={[{ required: true }]}>
            <Select placeholder="Select item">
              {items.filter(item => item.status === 'active').map(item => (
                <Select.Option key={item.id} value={item.id}>{item.name} ({item.sku})</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}>
            <Select placeholder="Select warehouse">
              {warehouses.filter(wh => wh.status === 'active').map(wh => (
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
    }

    if (modalType === 'view' && viewingRecord) {
      return (
        <div style={{ padding: '8px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <strong>Item:</strong> {viewingRecord.item_name}
          </div>
          <div style={{ marginBottom: 16 }}>
            <strong>SKU:</strong> {viewingRecord.sku}
          </div>
          <div style={{ marginBottom: 16 }}>
            <strong>Unit:</strong> {viewingRecord.unit}
          </div>
          <div style={{ marginBottom: 16 }}>
            <strong>Warehouse:</strong> {viewingRecord.warehouse_name}
          </div>
          <div style={{ marginBottom: 16 }}>
            <strong>Quantity On Hand:</strong> {formatNumber(viewingRecord.quantity_on_hand || 0)}
          </div>
          <div style={{ marginBottom: 16 }}>
            <strong>Quantity Available:</strong> {formatNumber(viewingRecord.quantity_available || 0)}
          </div>
          <div style={{ marginBottom: 16 }}>
            <strong>Quantity Reserved:</strong> {formatNumber(viewingRecord.quantity_reserved || 0)}
          </div>
          <div style={{ marginBottom: 16 }}>
            <strong>Average Cost:</strong> {viewingRecord.average_cost && !isNaN(Number(viewingRecord.average_cost)) ? `${viewingRecord.currency || currency}${formatNumber(viewingRecord.average_cost)}` : '-'}
          </div>
          <div style={{ marginBottom: 16 }}>
            <strong>Total Value:</strong> {viewingRecord.total_value && !isNaN(Number(viewingRecord.total_value)) ? `${viewingRecord.currency || currency}${formatNumber(viewingRecord.total_value)}` : '-'}
          </div>
        </div>
      );
    }

    return null;
  }; 

  return (
    <div style={{ padding: '24px' }}>
      <h1>Inventory</h1>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            {showManualButtons && canReceive && (
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => openModal('receive')}
              >
                Manual Receive
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
        title={modalType === 'view' ? 'Inventory Details' : `${modalType.charAt(0).toUpperCase() + modalType.slice(1)} Stock`}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setViewingRecord(null);
        }}
        footer={modalType === 'view' ? [
          <Button key="close" onClick={() => {
            setModalVisible(false);
            setViewingRecord(null);
          }}>
            Close
          </Button>
        ] : null}
      >
        {modalType === 'view' ? (
          renderModalContent()
        ) : (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleOperation}
          >
            {renderModalContent()}
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  Receive Stock
                </Button>
                <Button onClick={() => setModalVisible(false)}>
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default Inventory;