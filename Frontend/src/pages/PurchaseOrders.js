import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, InputNumber, message, DatePicker } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import apiService from '../services/apiService';

const PurchaseOrders = () => {
  const [pos, setPOs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [form] = Form.useForm();
  const [receiveForm] = Form.useForm();

  const columns = [
    { title: 'PO Number', dataIndex: 'po_number', key: 'po_number' },
    { title: 'Vendor', dataIndex: 'vendor_name', key: 'vendor_name' },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => {
        const colors = {
          draft: 'gray',
          sent: 'blue', 
          confirmed: 'orange',
          partially_received: 'yellow',
          received: 'green',
          cancelled: 'red'
        };
        return <span style={{ color: colors[status] || 'black' }}>{status?.toUpperCase()}</span>;
      }
    },
    { title: 'Total', dataIndex: 'total_amount', key: 'total_amount', render: (val) => `$${val || 0}` },
    { title: 'Order Date', dataIndex: 'order_date', key: 'order_date' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => viewPO(record)}>View</Button>
          {record.status === 'draft' && (
            <Button size="small" type="primary" onClick={() => sendPO(record)}>Send</Button>
          )}
          {record.status === 'sent' && (
            <Button size="small" onClick={() => confirmPO(record)}>Confirm</Button>
          )}
          {['sent', 'confirmed', 'partially_received'].includes(record.status) && (
            <Button size="small" type="dashed" onClick={() => receivePO(record)}>Receive</Button>
          )}
          {record.status === 'draft' && (
            <Button size="small" danger onClick={() => cancelPO(record)}>Cancel</Button>
          )}
        </Space>
      )
    }
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      const [posRes, vendorsRes, warehousesRes, itemsRes] = await Promise.all([
        apiService.get('/purchase-orders').catch(() => ({ success: false, data: [] })),
        apiService.get('/vendors').catch(() => ({ success: false, data: [] })),
        apiService.get('/warehouses'),
        apiService.get('/items')
      ]);
      
      setPOs(posRes.success ? posRes.data : []);
      setVendors(vendorsRes.success ? vendorsRes.data : []);
      setWarehouses(warehousesRes.success ? warehousesRes.data : []);
      setItems(itemsRes.success ? itemsRes.data : []);
    } catch (error) {
      message.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePO = async (values) => {
    try {
      const poData = {
        ...values,
        orderDate: values.orderDate.format('YYYY-MM-DD'),
        expectedDate: values.expectedDate?.format('YYYY-MM-DD'),
        lines: values.lines || []
      };

      const response = await apiService.post('/purchase-orders', poData);
      
      if (response.success) {
        message.success('Purchase order created successfully');
        setModalVisible(false);
        form.resetFields();
        fetchData();
      }
    } catch (error) {
      message.error('Failed to create purchase order');
    }
  };

  const sendPO = async (po) => {
    try {
      await apiService.put(`/purchase-orders/${po.id}/status`, { status: 'sent' });
      message.success('Purchase order sent to vendor');
      fetchData();
    } catch (error) {
      message.error('Failed to send purchase order');
    }
  };

  const confirmPO = async (po) => {
    try {
      await apiService.put(`/purchase-orders/${po.id}/status`, { status: 'confirmed' });
      message.success('Purchase order confirmed');
      fetchData();
    } catch (error) {
      message.error('Failed to confirm purchase order');
    }
  };

  const cancelPO = async (po) => {
    try {
      await apiService.put(`/purchase-orders/${po.id}/status`, { status: 'cancelled' });
      message.success('Purchase order cancelled');
      fetchData();
    } catch (error) {
      message.error('Failed to cancel purchase order');
    }
  };

  const viewPO = (po) => {
    message.info(`Viewing PO: ${po.po_number}`);
  };

  const receivePO = async (po) => {
    try {
      console.log('Original PO object:', po);
      // Fetch PO details with lines
      const response = await apiService.get(`/purchase-orders/${po.id}`);
      console.log('API response:', response);
      
      if (response.success) {
        const poData = response.data;
        console.log('PO data from API:', poData);
        
        // Ensure we have the PO id and warehouse_id from the original po object if missing from response
        const completePO = {
          ...poData,
          id: poData.id || po.id,
          warehouse_id: poData.warehouse_id || po.warehouse_id
        };
        
        console.log('Complete PO object:', completePO);
        setSelectedPO(completePO);
        
        receiveForm.setFieldsValue({
          grnNumber: `GRN-${Date.now()}`,
          receiptDate: new Date().toISOString().split('T')[0],
          lines: completePO.lines?.map(line => ({
            poLineId: line.id,
            itemId: line.item_id,
            itemName: line.item_name,
            quantityOrdered: line.quantity_ordered,
            quantityReceived: line.quantity_ordered - (line.quantity_received || 0),
            unitCost: line.unit_cost
          })) || []
        });
        setReceiveModalVisible(true);
      }
    } catch (error) {
      console.error('Error in receivePO:', error);
      message.error('Failed to load PO details');
    }
  };

  const handleReceiveGoods = async (values) => {
    try {
      console.log('Form values:', values);
      console.log('Selected PO:', selectedPO);
      
      // Get PO data from the table if selectedPO is incomplete
      const currentPO = pos.find(p => p.id === selectedPO?.id) || selectedPO;
      console.log('Current PO from table:', currentPO);
      
      const grnData = {
        grnNumber: values.grnNumber,
        poId: currentPO?.id || selectedPO?.id,
        warehouseId: currentPO?.warehouse_id || selectedPO?.warehouse_id,
        receiptDate: values.receiptDate,
        notes: values.notes,
        lines: (values.lines || []).map(line => ({
          ...line,
          quantityReceived: Number(line.quantityReceived),
          unitCost: Number(line.unitCost)
        }))
      };
      
      console.log('Sending GRN data:', grnData);

      const response = await apiService.post('/grn', grnData);
      
      if (response.success) {
        message.success('Goods received successfully! Inventory updated.');
        setReceiveModalVisible(false);
        receiveForm.resetFields();
        setSelectedPO(null);
        fetchData();
      }
    } catch (error) {
      console.error('GRN creation error:', error);
      message.error('Failed to receive goods');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <h1>Purchase Orders</h1>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
          >
            Create PO
          </Button>
        </Space>
        <Table 
          columns={columns} 
          dataSource={pos} 
          loading={loading}
          rowKey="id"
        />
      </Card>

      <Modal
        title="Create Purchase Order"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreatePO}
        >
          <Form.Item name="poNumber" label="PO Number" rules={[{ required: true }]}>
            <Input placeholder="Enter PO number" />
          </Form.Item>
          
          <Form.Item name="vendorName" label="Vendor Name" rules={[{ required: true }]}>
            <Input placeholder="Enter vendor name" />
          </Form.Item>
          
          <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}>
            <Select placeholder="Select warehouse">
              {warehouses.map(wh => (
                <Select.Option key={wh.id} value={wh.id}>{wh.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item name="orderDate" label="Order Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item name="expectedDate" label="Expected Date">
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
                      name={[name, 'unitCost']}
                      rules={[{ required: true, message: 'Enter unit cost' }]}
                    >
                      <InputNumber placeholder="Unit Cost" min={0} step={0.01} />
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
                Create Purchase Order
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Goods Receipt Modal */}
      <Modal
        title={`Receive Goods - PO: ${selectedPO?.po_number}`}
        open={receiveModalVisible}
        onCancel={() => {
          setReceiveModalVisible(false);
          setSelectedPO(null);
          receiveForm.resetFields();
        }}
        footer={null}
        width={1000}
      >
        <Form
          form={receiveForm}
          layout="vertical"
          onFinish={handleReceiveGoods}
        >
          <Form.Item name="grnNumber" label="GRN Number" rules={[{ required: true }]}>
            <Input placeholder="GRN Number" />
          </Form.Item>
          
          <Form.Item name="receiptDate" label="Receipt Date" rules={[{ required: true }]}>
            <Input type="date" />
          </Form.Item>

          <Form.List name="lines">
            {(fields) => (
              <div>
                <h4>Items to Receive:</h4>
                {fields.map(({ key, name }) => (
                  <div key={key} style={{ 
                    border: '1px solid #d9d9d9', 
                    padding: '16px', 
                    marginBottom: '8px',
                    borderRadius: '6px'
                  }}>
                    <Form.Item name={[name, 'poLineId']} hidden>
                      <Input />
                    </Form.Item>
                    <Form.Item name={[name, 'itemId']} hidden>
                      <Input />
                    </Form.Item>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '16px', alignItems: 'end' }}>
                      <Form.Item label="Item">
                        <Form.Item name={[name, 'itemName']} noStyle>
                          <Input disabled />
                        </Form.Item>
                      </Form.Item>
                      
                      <Form.Item label="Ordered">
                        <Form.Item name={[name, 'quantityOrdered']} noStyle>
                          <InputNumber disabled style={{ width: '100%' }} />
                        </Form.Item>
                      </Form.Item>
                      
                      <Form.Item 
                        name={[name, 'quantityReceived']} 
                        label="Receiving"
                        rules={[{ required: true, message: 'Enter quantity' }]}
                      >
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>
                      
                      <Form.Item 
                        name={[name, 'unitCost']} 
                        label="Unit Cost"
                        rules={[{ required: true, message: 'Enter cost' }]}
                      >
                        <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                      </Form.Item>
                      
                      <Form.Item name={[name, 'qualityStatus']} label="Quality" initialValue="accepted">
                        <Select style={{ width: '100%' }}>
                          <Select.Option value="accepted">Accepted</Select.Option>
                          <Select.Option value="rejected">Rejected</Select.Option>
                        </Select>
                      </Form.Item>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Form.List>
          
          <Form.Item name="notes" label="Notes">
            <Input.TextArea placeholder="Receipt notes" rows={3} />
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Receive Goods & Update Inventory
              </Button>
              <Button onClick={() => {
                setReceiveModalVisible(false);
                setSelectedPO(null);
                receiveForm.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PurchaseOrders;