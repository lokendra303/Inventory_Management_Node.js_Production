import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, InputNumber, message, DatePicker } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import apiService from '../services/apiService';

const SalesOrders = () => {
  const [sos, setSOs] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedSOForView, setSelectedSOForView] = useState(null);
  const [form] = Form.useForm();

  const columns = [
    { title: 'SO Number', dataIndex: 'so_number', key: 'so_number' },
    { title: 'Customer', dataIndex: 'customer_name', key: 'customer_name' },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => {
        const colors = {
          draft: 'gray',
          confirmed: 'blue',
          shipped: 'green',
          delivered: 'green',
          cancelled: 'red'
        };
        return <span style={{ color: colors[status] || 'black' }}>{status?.toUpperCase()}</span>;
      }
    },
    { title: 'Total', dataIndex: 'total_amount', key: 'total_amount', render: (val, record) => `${record.currency || 'USD'} ${val || 0}` },
    { title: 'Order Date', dataIndex: 'order_date', key: 'order_date' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => viewSO(record)}>View</Button>
          {record.status === 'draft' && (
            <Button size="small" type="primary" onClick={() => confirmSO(record)}>Confirm</Button>
          )}
          {record.status === 'confirmed' && (
            <Button size="small" onClick={() => shipSO(record)}>Ship</Button>
          )}
          {record.status === 'draft' && (
            <Button size="small" danger onClick={() => cancelSO(record)}>Cancel</Button>
          )}
        </Space>
      )
    }
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sosRes, warehousesRes, itemsRes] = await Promise.all([
        apiService.get('/sales-orders').catch(() => ({ success: false, data: [] })),
        apiService.get('/warehouses'),
        apiService.get('/items')
      ]);
      
      setSOs(sosRes.success ? sosRes.data : []);
      setWarehouses(warehousesRes.success ? warehousesRes.data : []);
      setItems(itemsRes.success ? itemsRes.data : []);
    } catch (error) {
      message.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSO = async (values) => {
    try {
      const soData = {
        ...values,
        orderDate: values.orderDate.format('YYYY-MM-DD'),
        expectedShipDate: values.expectedShipDate?.format('YYYY-MM-DD'),
        lines: values.lines || []
      };

      const response = await apiService.post('/sales-orders', soData);
      
      if (response.success) {
        message.success('Sales order created successfully');
        setModalVisible(false);
        form.resetFields();
        fetchData();
      }
    } catch (error) {
      message.error('Failed to create sales order');
    }
  };

  const confirmSO = async (so) => {
    try {
      await apiService.put(`/sales-orders/${so.id}/status`, { status: 'confirmed' });
      message.success('Sales order confirmed');
      fetchData();
    } catch (error) {
      message.error('Failed to confirm sales order');
    }
  };

  const shipSO = async (so) => {
    try {
      await apiService.put(`/sales-orders/${so.id}/status`, { status: 'shipped' });
      message.success('Sales order shipped');
      fetchData();
    } catch (error) {
      message.error('Failed to ship sales order');
    }
  };

  const cancelSO = async (so) => {
    try {
      await apiService.put(`/sales-orders/${so.id}/status`, { status: 'cancelled' });
      message.success('Sales order cancelled');
      fetchData();
    } catch (error) {
      message.error('Failed to cancel sales order');
    }
  };

  const viewSO = async (so) => {
    try {
      const response = await apiService.get(`/sales-orders/${so.id}`);
      if (response.success) {
        setSelectedSOForView(response.data);
        setViewModalVisible(true);
      }
    } catch (error) {
      message.error('Failed to load SO details');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <h1>Sales Orders</h1>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
          >
            Create SO
          </Button>
        </Space>
        <Table 
          columns={columns} 
          dataSource={sos} 
          loading={loading}
          rowKey="id"
        />
      </Card>

      <Modal
        title="Create Sales Order"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateSO}
        >
          <Form.Item name="soNumber" label="SO Number" rules={[{ required: true }]}>
            <Input placeholder="Enter SO number" />
          </Form.Item>
          
          <Form.Item name="customerName" label="Customer Name" rules={[{ required: true }]}>
            <Input placeholder="Enter customer name" />
          </Form.Item>
          
          <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}>
            <Select placeholder="Select warehouse">
              {warehouses.map(wh => (
                <Select.Option key={wh.id} value={wh.id}>{wh.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item name="currency" label="Currency" initialValue="USD">
            <Select placeholder="Select currency">
              <Select.Option value="USD">USD</Select.Option>
              <Select.Option value="EUR">EUR</Select.Option>
              <Select.Option value="GBP">GBP</Select.Option>
              <Select.Option value="INR">INR</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item name="channel" label="Sales Channel" initialValue="direct">
            <Select placeholder="Select channel">
              <Select.Option value="direct">Direct</Select.Option>
              <Select.Option value="online">Online</Select.Option>
              <Select.Option value="retail">Retail</Select.Option>
              <Select.Option value="wholesale">Wholesale</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item name="orderDate" label="Order Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item name="expectedShipDate" label="Expected Ship Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name, 'itemId']}
                      rules={[{ required: true, message: 'Select item' }]}
                    >
                      <Select placeholder="Select item" style={{ width: 200 }}>
                        {items.map(item => (
                          <Select.Option key={item.id} value={item.id}>
                            {item.name} ({item.sku})
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'quantity']}
                      rules={[{ required: true, message: 'Enter quantity' }]}
                    >
                      <InputNumber placeholder="Quantity" min={1} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'unitPrice']}
                      rules={[{ required: true, message: 'Enter unit price' }]}
                    >
                      <InputNumber placeholder="Unit Price" min={0} step={0.01} />
                    </Form.Item>
                    <Button onClick={() => remove(name)}>Remove</Button>
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Add Line Item
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Create Sales Order
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* View SO Modal */}
      <Modal
        title={`Sales Order Details - ${selectedSOForView?.so_number}`}
        open={viewModalVisible}
        onCancel={() => {
          setViewModalVisible(false);
          setSelectedSOForView(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setViewModalVisible(false);
            setSelectedSOForView(null);
          }}>
            Close
          </Button>
        ]}
        width={1000}
      >
        {selectedSOForView && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <strong>Customer:</strong> {selectedSOForView.customer_name}<br/>
              <strong>Warehouse:</strong> {selectedSOForView.warehouse_name}<br/>
              <strong>Status:</strong> {selectedSOForView.status?.toUpperCase()}<br/>
              <strong>Order Date:</strong> {selectedSOForView.order_date}<br/>
              <strong>Expected Ship Date:</strong> {selectedSOForView.expected_ship_date}<br/>
              <strong>Currency:</strong> {selectedSOForView.currency}<br/>
              <strong>Channel:</strong> {selectedSOForView.channel}<br/>
              <strong>Total Amount:</strong> {selectedSOForView.currency} {selectedSOForView.total_amount}
            </div>
            
            <h4>Line Items:</h4>
            <Table
              dataSource={selectedSOForView.lines || []}
              rowKey="id"
              pagination={false}
              columns={[
                { title: 'Item', dataIndex: 'item_name', key: 'item_name' },
                { title: 'SKU', dataIndex: 'sku', key: 'sku' },
                { title: 'Ordered', dataIndex: 'quantity_ordered', key: 'quantity_ordered' },
                { title: 'Shipped', dataIndex: 'quantity_shipped', key: 'quantity_shipped', render: (val) => val || 0 },
                { title: 'Unit Price', dataIndex: 'unit_price', key: 'unit_price', render: (val) => `${selectedSOForView.currency} ${val}` },
                { title: 'Line Total', dataIndex: 'line_total', key: 'line_total', render: (val) => `${selectedSOForView.currency} ${val}` },
                { title: 'Status', dataIndex: 'status', key: 'status', render: (val) => val?.toUpperCase() }
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SalesOrders;