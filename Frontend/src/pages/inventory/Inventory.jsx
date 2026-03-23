import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, InputNumber, message, Statistic, Row, Col, Empty, Tag, Timeline, Spin } from 'antd';
import { PlusOutlined, EyeOutlined, SearchOutlined, InboxOutlined, WarningOutlined, HistoryOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import { useAuth } from '../../hooks/useAuth.jsx';
import { formatNumber } from '../../utils/currency.js';
import { useCurrency } from '../../contexts/CurrencyContext';

const Inventory = () => {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [inventory, setInventory] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('receive');
  const [form] = Form.useForm();
  const [viewingRecord, setViewingRecord] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [stats, setStats] = useState({ totalValue: 0, totalItems: 0, lowStockCount: 0 });
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Permission checks
  const canReceive = user?.permissions?.inventory_receive || user?.permissions?.all;
  const allowManualOperations = user?.permissions?.manual_inventory || user?.role === 'admin';
  const showManualButtons = process.env.REACT_APP_ENABLE_MANUAL_INVENTORY !== 'false' && allowManualOperations;

  const columns = [
    { 
      title: 'Item', 
      dataIndex: 'item_name', 
      key: 'item_name',
      sorter: (a, b) => (a.item_name || '').localeCompare(b.item_name || ''),
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value, record) => 
        (record.item_name?.toLowerCase().includes(value.toLowerCase()) ||
         record.sku?.toLowerCase().includes(value.toLowerCase()))
    },
    { 
      title: 'SKU', 
      dataIndex: 'sku', 
      key: 'sku',
      sorter: (a, b) => (a.sku || '').localeCompare(b.sku || '')
    },
    { title: 'Unit', dataIndex: 'unit', key: 'unit' },
    { 
      title: 'Warehouse', 
      dataIndex: 'warehouse_name', 
      key: 'warehouse_name',
      sorter: (a, b) => (a.warehouse_name || '').localeCompare(b.warehouse_name || '')
    },
    { 
      title: 'On Hand', 
      dataIndex: 'quantity_on_hand', 
      key: 'quantity_on_hand', 
      render: (val) => <span style={{ fontWeight: 500 }}>{formatNumber(val || 0)}</span>,
      sorter: (a, b) => (a.quantity_on_hand || 0) - (b.quantity_on_hand || 0),
      align: 'right'
    },
    { 
      title: 'Available', 
      dataIndex: 'quantity_available', 
      key: 'quantity_available', 
      render: (val) => {
        const isLow = val <= 10;
        return (
          <span style={{ color: isLow ? '#ff4d4f' : 'inherit', fontWeight: isLow ? 600 : 400 }}>
            {formatNumber(val || 0)}
            {isLow && <WarningOutlined style={{ marginLeft: 4, fontSize: 12 }} />}
          </span>
        );
      },
      sorter: (a, b) => (a.quantity_available || 0) - (b.quantity_available || 0),
      align: 'right'
    },
    { 
      title: 'Reserved', 
      dataIndex: 'quantity_reserved', 
      key: 'quantity_reserved', 
      render: (val) => formatNumber(val || 0),
      sorter: (a, b) => (a.quantity_reserved || 0) - (b.quantity_reserved || 0),
      align: 'right'
    },
    { 
      title: 'Avg Cost', 
      dataIndex: 'average_cost', 
      key: 'average_cost', 
      render: (val) => (val && !isNaN(Number(val))) ? formatCurrency(val) : '-',
      sorter: (a, b) => (a.average_cost || 0) - (b.average_cost || 0),
      align: 'right'
    },
    { 
      title: 'Total Value', 
      dataIndex: 'total_value', 
      key: 'total_value', 
      render: (val, record) => {
        const quantity = parseFloat(record.quantity_on_hand) || 0;
        const avgCost = parseFloat(record.average_cost) || 0;
        const calculatedValue = quantity * avgCost;
        return calculatedValue > 0 ? (
          <span style={{ fontWeight: 500, color: '#1890ff' }}>
            {formatCurrency(calculatedValue)}
          </span>
        ) : '-';
      },
      sorter: (a, b) => {
        const valA = (parseFloat(a.quantity_on_hand) || 0) * (parseFloat(a.average_cost) || 0);
        const valB = (parseFloat(b.quantity_on_hand) || 0) * (parseFloat(b.average_cost) || 0);
        return valA - valB;
      },
      align: 'right'
    },
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
      
      if (inventoryRes.success && inventoryRes.data.length > 0) {
        // Calculate stats
        const totalValue = inventoryRes.data.reduce((sum, item) => {
          const quantity = parseFloat(item.quantity_on_hand) || 0;
          const avgCost = parseFloat(item.average_cost) || 0;
          return sum + (quantity * avgCost);
        }, 0);
        const lowStock = inventoryRes.data.filter(item => (item.quantity_available || 0) <= 10).length;
        setStats({
          totalValue,
          totalItems: inventoryRes.data.length,
          lowStockCount: lowStock
        });
      } else {
        setStats({ totalValue: 0, totalItems: 0, lowStockCount: 0 });
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

  const openViewModal = async (record) => {
    setViewingRecord(record);
    setModalType('view');
    setModalVisible(true);
    
    // Fetch history
    setLoadingHistory(true);
    try {
      const response = await apiService.get(`/inventory/${record.item_id}/${record.warehouse_id}/history`);
      if (response.success) {
        setHistoryData(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
      setHistoryData([]);
    } finally {
      setLoadingHistory(false);
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
      const getEventColor = (eventType) => {
        if (eventType?.includes('RECEIVED')) return 'green';
        if (eventType?.includes('SHIPPED')) return 'red';
        if (eventType?.includes('RESERVED')) return 'orange';
        if (eventType?.includes('ADJUSTED')) return 'blue';
        if (eventType?.includes('TRANSFER')) return 'purple';
        return 'gray';
      };

      const getEventLabel = (eventType) => {
        if (eventType?.includes('RECEIVED')) return 'Stock Received';
        if (eventType?.includes('SHIPPED')) return 'Stock Shipped';
        if (eventType?.includes('RESERVED')) return 'Stock Reserved';
        if (eventType?.includes('CANCELLED')) return 'Reservation Cancelled';
        if (eventType?.includes('ADJUSTED')) return 'Stock Adjusted';
        if (eventType?.includes('TRANSFER_IN')) return 'Transfer In';
        if (eventType?.includes('TRANSFER_OUT')) return 'Transfer Out';
        return eventType;
      };

      return (
        <div style={{ padding: '16px 0' }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>Item</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{viewingRecord.item_name}</div>
              </div>
            </Col>
            <Col span={12}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>SKU</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{viewingRecord.sku}</div>
              </div>
            </Col>
            <Col span={12}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>Unit</div>
                <div style={{ fontSize: 14 }}>{viewingRecord.unit}</div>
              </div>
            </Col>
            <Col span={12}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>Warehouse</div>
                <div style={{ fontSize: 14 }}>{viewingRecord.warehouse_name}</div>
              </div>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ background: '#f0f5ff', border: '1px solid #adc6ff' }}>
                <Statistic
                  title="On Hand"
                  value={viewingRecord.quantity_on_hand || 0}
                  valueStyle={{ fontSize: 20, color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                <Statistic
                  title="Available"
                  value={viewingRecord.quantity_available || 0}
                  valueStyle={{ fontSize: 20, color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ background: '#fff7e6', border: '1px solid #ffd591' }}>
                <Statistic
                  title="Reserved"
                  value={viewingRecord.quantity_reserved || 0}
                  valueStyle={{ fontSize: 20, color: '#fa8c16' }}
                />
              </Card>
            </Col>
            <Col span={12}>
              <div style={{ marginTop: 8 }}>
                <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>Average Cost</div>
                <div style={{ fontSize: 16, fontWeight: 500, color: '#1890ff' }}>
                  {viewingRecord.average_cost && !isNaN(Number(viewingRecord.average_cost)) 
                    ? formatCurrency(viewingRecord.average_cost)
                    : '-'}
                </div>
              </div>
            </Col>
            <Col span={12}>
              <div style={{ marginTop: 8 }}>
                <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>Total Value</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#52c41a' }}>
                  {(() => {
                    const quantity = parseFloat(viewingRecord.quantity_on_hand) || 0;
                    const avgCost = parseFloat(viewingRecord.average_cost) || 0;
                    const calculatedValue = quantity * avgCost;
                    return calculatedValue > 0 
                      ? formatCurrency(calculatedValue)
                      : '-';
                  })()}
                </div>
              </div>
            </Col>
          </Row>

          <div style={{ marginTop: 24, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
            <h4 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <HistoryOutlined /> Transaction History
            </h4>
            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Spin />
              </div>
            ) : historyData.length > 0 ? (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                <Timeline>
                  {historyData.map((event, index) => (
                    <Timeline.Item key={index} color={getEventColor(event.event_type)}>
                      <div style={{ marginBottom: 8 }}>
                        <Tag color={getEventColor(event.event_type)}>{getEventLabel(event.event_type)}</Tag>
                        <span style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 8 }}>
                          {new Date(event.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: 13 }}>
                        {event.event_data?.quantity && (
                          <div>Quantity: <strong>{event.event_data.quantity}</strong></div>
                        )}
                        {event.event_data?.quantityChange && (
                          <div>Change: <strong>{event.event_data.quantityChange > 0 ? '+' : ''}{event.event_data.quantityChange}</strong></div>
                        )}
                        {event.event_data?.unitCost && (
                          <div>Unit Cost: <strong>{formatCurrency(event.event_data.unitCost)}</strong></div>
                        )}
                        {event.event_data?.reason && (
                          <div style={{ color: '#8c8c8c', fontSize: 12 }}>Reason: {event.event_data.reason}</div>
                        )}
                      </div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </div>
            ) : (
              <Empty description="No transaction history available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>
        </div>
      );
    }

    return null;
  }; 

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      <h1 style={{ marginBottom: 24 }}>Inventory Overview</h1>
      
      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Inventory Value"
              value={stats.totalValue}
              precision={2}
              prefix={null}
              formatter={v => formatCurrency(v)}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Items"
              value={stats.totalItems}
              valueStyle={{ color: '#1890ff' }}
              suffix={<InboxOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Low Stock Items"
              value={stats.lowStockCount}
              valueStyle={{ color: stats.lowStockCount > 0 ? '#cf1322' : '#3f8600' }}
              suffix={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Inventory Table */}
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space wrap>
            {showManualButtons && canReceive && (
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => openModal('receive')}
              >
                Manual Receive
              </Button>
            )}
            <Input
              placeholder="Search by item name or SKU"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 250 }}
              allowClear
            />
          </Space>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Warehouse:</span>
            <Select
              value={selectedWarehouse}
              onChange={handleWarehouseChange}
              style={{ width: 200 }}
            >
              <Select.Option value="all">All Warehouses</Select.Option>
              {warehouses.filter(wh => wh.status === 'active').map(wh => (
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
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} items`,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No inventory data available"
              />
            )
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title="Inventory Details"
        open={modalVisible && modalType === 'view'}
        onCancel={() => {
          setModalVisible(false);
          setViewingRecord(null);
          setHistoryData([]);
        }}
        footer={[
          <Button key="close" type="primary" onClick={() => {
            setModalVisible(false);
            setViewingRecord(null);
            setHistoryData([]);
          }}>
            Close
          </Button>
        ]}
        width={700}
      >
        {renderModalContent()}
      </Modal>
      <Modal
        title="Receive Stock"
        open={modalVisible && modalType === 'receive'}
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
                Receive Stock
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