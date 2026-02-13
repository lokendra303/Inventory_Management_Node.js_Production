import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, InputNumber, message, DatePicker } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import apiService from '../services/apiService';
import { useCurrency } from '../contexts/CurrencyContext.jsx';
import { formatPrice } from '../utils/currency';

const PurchaseOrders = () => {
  const { currency } = useCurrency();
  const [pos, setPOs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [selectedPOForView, setSelectedPOForView] = useState(null);
  const [allItemStocks, setAllItemStocks] = useState({});
  const [form] = Form.useForm();
  const [receiveForm] = Form.useForm();

  const fetchAllStocks = async () => {
    try {
      const response = await apiService.get('/inventory');
      if (response.success) {
        const stockByItemAndWarehouse = {};
        response.data.forEach((inv) => {
          if (!stockByItemAndWarehouse[inv.item_id]) {
            stockByItemAndWarehouse[inv.item_id] = {};
          }
          stockByItemAndWarehouse[inv.item_id][inv.warehouse_id] = inv.quantity_available || 0;
        });
        setAllItemStocks(stockByItemAndWarehouse);
      }
    } catch (error) {
      console.error('Failed to fetch stock', error);
    }
  };

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
    { title: 'Total', dataIndex: 'total_amount', key: 'total_amount', render: (val, record) => formatPrice(val, currency, record.currency || 'USD') },
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
      // Get selected vendor details
      const selectedVendor = vendors.find(v => v.id === values.vendorId);
      
      // Ensure dates are properly formatted
      const orderDate = values.orderDate ? values.orderDate.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0];
      const expectedDate = values.expectedDate ? values.expectedDate.format('YYYY-MM-DD') : null;
      
      const poData = {
        ...values,
        vendorName: selectedVendor?.display_name || selectedVendor?.company_name || 'Unknown Vendor',
        orderDate: orderDate,
        expectedDate: expectedDate,
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
      console.error('PO creation error:', error);
      message.error(error.response?.data?.error || 'Failed to create purchase order');
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
      // First, try to auto-generate invoice BEFORE changing status
      let invoiceGenerated = false;
      let invoiceNumber = null;
      
      try {
        console.log('Attempting to generate invoice for PO:', po.id);
        const invoiceResponse = await apiService.post(`/purchase-invoices/generate-from-po/${po.id}`);
        console.log('Invoice generation response:', invoiceResponse);
        if (invoiceResponse.success) {
          invoiceGenerated = true;
          invoiceNumber = invoiceResponse.data.invoiceNumber;
        }
      } catch (invoiceError) {
        console.error('Invoice generation failed:', invoiceError);
        console.error('Error response:', invoiceError.response?.data);
      }
      
      // Then confirm the PO
      await apiService.put(`/purchase-orders/${po.id}/status`, { status: 'confirmed' });
      
      // Show appropriate message
      if (invoiceGenerated) {
        message.success(`Purchase order confirmed and invoice ${invoiceNumber} auto-generated`);
      } else {
        message.success('Purchase order confirmed');
        message.info('You can create invoice manually from Invoices page');
      }
      
      fetchData();
    } catch (error) {
      console.error('PO confirmation error:', error);
      message.error(error.response?.data?.error || 'Failed to confirm purchase order');
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

  const viewPO = async (po) => {
    try {
      const response = await apiService.get(`/purchase-orders/${po.id}`);
      if (response.success) {
        setSelectedPOForView(response.data);
        setViewModalVisible(true);
      }
    } catch (error) {
      message.error('Failed to load PO details');
    }
  };

  const receivePO = async (po) => {
    try {
      const response = await apiService.get(`/purchase-orders/${po.id}`);
      
      if (response.success) {
        const poData = response.data;
        const completePO = { ...poData, id: poData.id || po.id };
        
        setSelectedPO(completePO);
        
        receiveForm.setFieldsValue({
          grnNumber: `GRN-${Date.now()}`,
          receiptDate: new Date().toISOString().split('T')[0],
          lines: completePO.lines?.map(line => ({
            poLineId: line.id,
            itemId: line.item_id,
            warehouseId: line.warehouse_id,
            itemName: line.item_name,
            warehouseName: line.warehouse_name,
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
      const grnData = {
        grnNumber: values.grnNumber,
        poId: selectedPO?.id,
        receiptDate: values.receiptDate,
        notes: values.notes,
        lines: (values.lines || []).map(line => ({
          ...line,
          quantityReceived: Number(line.quantityReceived),
          unitCost: Number(line.unitCost)
        }))
      };

      const response = await apiService.post('/grn', grnData);
      
      if (response.success) {
        message.success('Goods received successfully! Inventory updated.');
        setReceiveModalVisible(false);
        receiveForm.resetFields();
        setSelectedPO(null);
        fetchData();
        fetchAllStocks();
      }
    } catch (error) {
      console.error('GRN creation error:', error);
      message.error(error.response?.data?.error || 'Failed to receive goods');
    }
  };

  useEffect(() => {
    fetchData();
    fetchAllStocks();
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
          
          <Form.Item name="vendorId" label="Vendor" rules={[{ required: true }]}>
            <Select placeholder="Select vendor" showSearch optionFilterProp="children">
              {vendors.filter(vendor => vendor.status === 'active').map(vendor => (
                <Select.Option key={vendor.id} value={vendor.id}>
                  {vendor.display_name} {vendor.company_name && `- ${vendor.company_name}`}
                </Select.Option>
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
          
          <Form.Item name="orderDate" label="Order Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item name="expectedDate" label="Expected Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => {
                  const selectedItemId = form.getFieldValue(['lines', name, 'itemId']);
                  const selectedWarehouseId = form.getFieldValue(['lines', name, 'warehouseId']);
                  const allLines = form.getFieldValue('lines') || [];

                  const allocatedStock = {};
                  allLines.forEach((line, idx) => {
                    if (idx !== name && line?.itemId && line?.warehouseId && line?.quantity) {
                      const key = `${line.itemId}_${line.warehouseId}`;
                      allocatedStock[key] = (allocatedStock[key] || 0) + line.quantity;
                    }
                  });

                  const availableWarehouses = selectedItemId
                    ? warehouses.filter(wh => wh.status === 'active')
                    : warehouses.filter(wh => wh.status === 'active');

                  const availableItems = selectedWarehouseId
                    ? items.filter(item => item.status === 'active')
                    : items.filter(item => item.status === 'active');

                  const currentStock = selectedItemId && selectedWarehouseId
                    ? allItemStocks[selectedItemId]?.[selectedWarehouseId] || 0
                    : 0;

                  return (
                    <div key={key} style={{ marginBottom: 16, padding: 16, border: '1px solid #d9d9d9', borderRadius: 4, backgroundColor: '#fafafa' }}>
                      <Space direction="vertical" style={{ width: '100%' }} size="small">
                        <Space align="start" style={{ width: '100%', flexWrap: 'wrap' }}>
                          <Form.Item
                            {...restField}
                            name={[name, 'itemId']}
                            label="Item"
                            rules={[{ required: true, message: 'Select item' }]}
                            style={{ marginBottom: 0, minWidth: 250, flex: 1 }}
                          >
                            <Select
                              placeholder="Select item"
                              showSearch
                              optionLabelProp="label"
                              filterOption={(input, option) => {
                                const label = option.label || '';
                                return label.toLowerCase().includes(input.toLowerCase());
                              }}
                              dropdownStyle={{ minWidth: 350 }}
                              onChange={(itemId) => {
                                const selectedItem = items.find(i => i.id === itemId);
                                if (selectedItem) {
                                  const lines = form.getFieldValue('lines') || [];
                                  lines[name] = { ...lines[name], unitCost: selectedItem.cost_price || 0 };
                                  form.setFieldsValue({ lines });
                                }
                              }}
                            >
                              {availableItems.map(item => {
                                let available = 0;
                                if (selectedWarehouseId) {
                                  available = allItemStocks[item.id]?.[selectedWarehouseId] || 0;
                                } else {
                                  available = Object.values(allItemStocks[item.id] || {}).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
                                }
                                return (
                                  <Select.Option key={item.id} value={item.id} label={`${item.name} (${item.sku})`}>
                                    <div>
                                      <strong>{item.name}</strong> ({item.sku})<br />
                                      <span style={{ fontSize: '12px', color: '#1890ff' }}>
                                        Current Stock: {available} {!selectedWarehouseId && '(all warehouses)'}
                                      </span>
                                    </div>
                                  </Select.Option>
                                );
                              })}
                            </Select>
                          </Form.Item>

                          <Form.Item
                            {...restField}
                            name={[name, 'warehouseId']}
                            label="Warehouse"
                            rules={[{ required: true, message: 'Select warehouse' }]}
                            style={{ marginBottom: 0, minWidth: 250, flex: 1 }}
                          >
                            <Select placeholder="Select warehouse" showSearch optionLabelProp="label" optionFilterProp="label" dropdownStyle={{ minWidth: 300 }}>
                              {availableWarehouses.map(wh => {
                                const stock = allItemStocks[selectedItemId]?.[wh.id] || 0;
                                return (
                                  <Select.Option key={wh.id} value={wh.id} label={wh.name}>
                                    <div>
                                      <strong>{wh.name}</strong>
                                      {selectedItemId && (
                                        <>
                                          <br />
                                          <span style={{ fontSize: '12px', color: '#1890ff' }}>
                                            Current Stock: {stock} units
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </Select.Option>
                                );
                              })}
                            </Select>
                          </Form.Item>

                          <Form.Item
                            {...restField}
                            name={[name, 'quantity']}
                            label="Quantity"
                            rules={[{ required: true, message: 'Enter qty' }]}
                            style={{ marginBottom: 0, width: 100 }}
                          >
                            <InputNumber
                              placeholder="Qty"
                              min={1}
                              style={{ width: '100%' }}
                              onChange={() => form.setFieldsValue({})}
                            />
                          </Form.Item>

                          <Form.Item
                            {...restField}
                            name={[name, 'unitCost']}
                            label="Unit Cost"
                            rules={[{ required: true, message: 'Enter cost' }]}
                            style={{ marginBottom: 0, width: 120 }}
                          >
                            <InputNumber placeholder="Cost" min={0} step={0.01} style={{ width: '100%' }} />
                          </Form.Item>

                          <Form.Item label=" " style={{ marginBottom: 0 }}>
                            <Button onClick={() => remove(name)} danger>Remove</Button>
                          </Form.Item>
                        </Space>

                        {selectedItemId && selectedWarehouseId && (
                          <div style={{ padding: '8px 12px', backgroundColor: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 4 }}>
                            <span style={{ fontSize: '13px', color: '#0050b3' }}>
                              ℹ️ <strong>{items.find(i => i.id === selectedItemId)?.name}</strong> at <strong>{warehouses.find(w => w.id === selectedWarehouseId)?.name}</strong>:
                              <strong style={{ color: '#1890ff', marginLeft: 4 }}>Current: {parseFloat(currentStock).toFixed(2)} units</strong>
                              {form.getFieldValue(['lines', name, 'quantity']) && (
                                <span style={{ color: '#52c41a', marginLeft: 4 }}>
                                  → After receiving: {(parseFloat(currentStock) + parseFloat(form.getFieldValue(['lines', name, 'quantity']) || 0)).toFixed(2)} units
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </Space>
                    </div>
                  );
                })}
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
                    
                    <Form.Item name={[name, 'warehouseId']} hidden>
                      <Input />
                    </Form.Item>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: '16px', alignItems: 'end' }}>
                      <Form.Item label="Item">
                        <Form.Item name={[name, 'itemName']} noStyle>
                          <Input disabled />
                        </Form.Item>
                      </Form.Item>
                      
                      <Form.Item label="Warehouse">
                        <Form.Item name={[name, 'warehouseName']} noStyle>
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

      {/* View PO Modal */}
      <Modal
        title={`Purchase Order Details - ${selectedPOForView?.po_number}`}
        open={viewModalVisible}
        onCancel={() => {
          setViewModalVisible(false);
          setSelectedPOForView(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setViewModalVisible(false);
            setSelectedPOForView(null);
          }}>
            Close
          </Button>
        ]}
        width={1000}
      >
        {selectedPOForView && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <strong>Vendor:</strong> {selectedPOForView.vendor_name}<br/>
              <strong>Warehouse:</strong> {selectedPOForView.warehouse_name}<br/>
              <strong>Status:</strong> {selectedPOForView.status?.toUpperCase()}<br/>
              <strong>Order Date:</strong> {selectedPOForView.order_date}<br/>
              <strong>Expected Date:</strong> {selectedPOForView.expected_date}<br/>
              <strong>Currency:</strong> {selectedPOForView.currency}<br/>
              <strong>Total Amount:</strong> {selectedPOForView.currency} {selectedPOForView.total_amount}
            </div>
            
            <h4>Line Items:</h4>
            <Table
              dataSource={selectedPOForView.lines || []}
              rowKey="id"
              pagination={false}
              columns={[
                { title: 'Item', dataIndex: 'item_name', key: 'item_name' },
                { title: 'SKU', dataIndex: 'sku', key: 'sku' },
                { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name' },
                { title: 'Ordered', dataIndex: 'quantity_ordered', key: 'quantity_ordered' },
                { title: 'Received', dataIndex: 'quantity_received', key: 'quantity_received', render: (val) => val || 0 },
                { title: 'Unit Cost', dataIndex: 'unit_cost', key: 'unit_cost', render: (val) => `${selectedPOForView.currency} ${val}` },
                { title: 'Line Total', dataIndex: 'line_total', key: 'line_total', render: (val) => `${selectedPOForView.currency} ${val}` },
                { title: 'Status', dataIndex: 'status', key: 'status', render: (val) => val?.toUpperCase() }
              ]}
            />
            
            {selectedPOForView.grns && selectedPOForView.grns.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4>Goods Receipt Notes:</h4>
                <Table
                  dataSource={selectedPOForView.grns}
                  rowKey="id"
                  pagination={false}
                  columns={[
                    { title: 'GRN Number', dataIndex: 'grn_number', key: 'grn_number' },
                    { title: 'Receipt Date', dataIndex: 'receipt_date', key: 'receipt_date' },
                    { title: 'Status', dataIndex: 'status', key: 'status', render: (val) => val?.toUpperCase() }
                  ]}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PurchaseOrders;