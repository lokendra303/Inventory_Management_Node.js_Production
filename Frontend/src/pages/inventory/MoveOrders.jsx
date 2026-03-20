import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Select, InputNumber, Input, message, DatePicker } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import moment from 'moment';
import apiService from '../../services/apiService';
import { useAuth } from '../../hooks/useAuth.jsx';
import { formatQuantity } from '../../utils/numberFormat';

const MoveOrders = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [allItemStocks, setAllItemStocks] = useState({});
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [list, setList] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  useEffect(() => { fetchLookups(); fetchHistory(); }, []);

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await apiService.get('/inventory/transfers');
      if (res.success) setList(res.data);
    } catch {
      // non-critical
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchLookups = async () => {
    try {
      setLoading(true);
      const [itemsRes, whRes, stockRes] = await Promise.all([
        apiService.get('/items'),
        apiService.get('/warehouses'),
        apiService.get('/inventory')
      ]);
      setItems(itemsRes.success ? itemsRes.data : []);
      setWarehouses(whRes.success ? whRes.data : []);
      if (stockRes.success) {
        const map = {};
        stockRes.data.forEach(inv => {
          if (!map[inv.item_id]) map[inv.item_id] = {};
          map[inv.item_id][inv.warehouse_id] = Number(inv.quantity_available) || 0;
        });
        setAllItemStocks(map);
      }
    } catch {
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({ moveNumber: `MO-${Date.now()}`, moveDate: moment(), lines: [] });
    setModalVisible(true);
  };

  const onFinish = async (values) => {
    const lines = values.lines || [];
    if (lines.length === 0) return message.warning('Add at least one line item');

    // Validate no same from/to warehouse per line
    for (const line of lines) {
      if (line.fromWarehouseId === line.toWarehouseId) {
        return message.error('Source and destination warehouse cannot be the same for a line item');
      }
    }

    try {
      setLoading(true);
      // Transfer each line sequentially
      const results = [];
      for (const line of lines) {
        const res = await apiService.post('/inventory/transfer', {
          itemId: line.itemId,
          fromWarehouseId: line.fromWarehouseId,
          toWarehouseId: line.toWarehouseId,
          quantity: line.quantity
        });
        if (!res.success) throw new Error(res.message || `Transfer failed for line`);
        results.push(res.data);
      }

      message.success('Move order completed successfully');
      setList(prev => [{
        id: Date.now(),
        moveNumber: values.moveNumber,
        lines,
        status: 'completed',
        created_at: new Date().toISOString(),
        createdBy: user?.email || user?.id
      }, ...prev]);
      setModalVisible(false);
      form.resetFields();
      fetchLookups(); // refresh stock
      fetchHistory(); // refresh history
    } catch (err) {
      message.error(err.message || 'Move order failed');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: 'Item', dataIndex: 'item_name', key: 'item_name', render: (v, r) => v ? `${v} (${r.sku})` : r.itemId },
    { title: 'From', dataIndex: 'from_warehouse_name', key: 'from_warehouse_name', render: (v, r) => v || r.fromWarehouseId },
    { title: 'To', dataIndex: 'to_warehouse_name', key: 'to_warehouse_name', render: (v, r) => v || r.toWarehouseId },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity' },
    { title: 'Date', dataIndex: 'created_at', key: 'created_at', render: (v) => v ? new Date(v).toLocaleString() : '-' }
  ];

  const filteredList = list.filter(r => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return (
      r.item_name?.toLowerCase().includes(s) ||
      r.from_warehouse_name?.toLowerCase().includes(s) ||
      r.to_warehouse_name?.toLowerCase().includes(s) ||
      r.sku?.toLowerCase().includes(s)
    );
  });

  return (
    <div style={{ padding: 24 }}>
      <h1>Move Orders</h1>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Create Move Order
          </Button>
          <Input
            placeholder="Search by move number..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
        </Space>
        <Table dataSource={filteredList} columns={columns} rowKey="id" loading={historyLoading} />
      </Card>

      <Modal
        title="Create Move Order"
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        footer={null}
        width={900}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Space style={{ width: '100%' }} size="middle">
            <Form.Item name="moveNumber" label="Move Order #" rules={[{ required: true }]} style={{ flex: 1, marginBottom: 0 }}>
              <Input />
            </Form.Item>
            <Form.Item name="moveDate" label="Date" style={{ flex: 1, marginBottom: 0 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Form.Item name="notes" label="Notes" style={{ marginTop: 16 }}>
            <Input.TextArea rows={2} placeholder="Optional notes" />
          </Form.Item>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name }) => {
                  const lineValues = form.getFieldValue(['lines', name]) || {};
                  const { itemId, fromWarehouseId, toWarehouseId, quantity } = lineValues;

                  const fromAvailable = (itemId && fromWarehouseId)
                    ? (allItemStocks[itemId]?.[fromWarehouseId] ?? null)
                    : null;
                  const toCurrentStock = (itemId && toWarehouseId)
                    ? (allItemStocks[itemId]?.[toWarehouseId] ?? 0)
                    : null;

                  const afterFrom = fromAvailable !== null && quantity ? fromAvailable - quantity : null;
                  const afterTo = toCurrentStock !== null && quantity ? toCurrentStock + quantity : null;

                  return (
                    <div key={key} style={{ marginTop: 16, padding: 16, border: '1px solid #d9d9d9', borderRadius: 6, backgroundColor: '#fafafa' }}>
                      <Space direction="vertical" style={{ width: '100%' }} size="small">
                        <Space align="start" style={{ width: '100%', flexWrap: 'wrap' }}>

                          {/* Item */}
                          <Form.Item
                            name={[name, 'itemId']}
                            label="Item"
                            rules={[{ required: true, message: 'Select item' }]}
                            style={{ marginBottom: 0, minWidth: 220, flex: 1 }}
                          >
                            <Select
                              placeholder="Select item"
                              showSearch
                              optionLabelProp="label"
                              filterOption={(input, option) => (option.label || '').toLowerCase().includes(input.toLowerCase())}
                              onChange={() => {
                                const lines = form.getFieldValue('lines');
                                lines[name] = { ...lines[name], fromWarehouseId: undefined, toWarehouseId: undefined, quantity: null };
                                form.setFieldsValue({ lines });
                              }}
                            >
                              {items.filter(i => i.status === 'active').map(item => {
                                const totalStock = Object.values(allItemStocks[item.id] || {}).reduce((s, q) => s + q, 0);
                                return (
                                  <Select.Option key={item.id} value={item.id} label={`${item.name} (${item.sku})`}>
                                    <div>
                                      <strong>{item.name}</strong> ({item.sku})
                                      <br />
                                      <span style={{ fontSize: 12, color: '#1890ff' }}>Total stock: {totalStock}</span>
                                    </div>
                                  </Select.Option>
                                );
                              })}
                            </Select>
                          </Form.Item>

                          {/* From Warehouse */}
                          <Form.Item
                            name={[name, 'fromWarehouseId']}
                            label="From Warehouse"
                            rules={[{ required: true, message: 'Select source' }]}
                            style={{ marginBottom: 0, minWidth: 200, flex: 1 }}
                          >
                            <Select
                              placeholder="Source warehouse"
                              showSearch
                              optionLabelProp="label"
                              optionFilterProp="label"
                              onChange={() => {
                                const lines = form.getFieldValue('lines');
                                lines[name] = { ...lines[name], quantity: null };
                                form.setFieldsValue({ lines });
                              }}
                            >
                              {warehouses.filter(w => w.status === 'active').map(wh => {
                                const stock = itemId ? (allItemStocks[itemId]?.[wh.id] ?? 0) : null;
                                return (
                                  <Select.Option key={wh.id} value={wh.id} label={wh.name}>
                                    <div>
                                      <strong>{wh.name}</strong>
                                      {itemId && <><br /><span style={{ fontSize: 12, color: '#1890ff' }}>Available: {stock}</span></>}
                                    </div>
                                  </Select.Option>
                                );
                              })}
                            </Select>
                          </Form.Item>

                          {/* To Warehouse */}
                          <Form.Item
                            name={[name, 'toWarehouseId']}
                            label="To Warehouse"
                            rules={[
                              { required: true, message: 'Select destination' },
                              ({ getFieldValue }) => ({
                                validator(_, value) {
                                  const from = getFieldValue(['lines', name, 'fromWarehouseId']);
                                  if (value && value === from) return Promise.reject('Cannot be same as source');
                                  return Promise.resolve();
                                }
                              })
                            ]}
                            style={{ marginBottom: 0, minWidth: 200, flex: 1 }}
                          >
                            <Select
                              placeholder="Destination warehouse"
                              showSearch
                              optionLabelProp="label"
                              optionFilterProp="label"
                            >
                              {warehouses
                                .filter(w => w.status === 'active' && w.id !== fromWarehouseId)
                                .map(wh => {
                                  const stock = itemId ? (allItemStocks[itemId]?.[wh.id] ?? 0) : null;
                                  return (
                                    <Select.Option key={wh.id} value={wh.id} label={wh.name}>
                                      <div>
                                        <strong>{wh.name}</strong>
                                        {itemId && <><br /><span style={{ fontSize: 12, color: '#52c41a' }}>Current: {stock}</span></>}
                                      </div>
                                    </Select.Option>
                                  );
                                })}
                            </Select>
                          </Form.Item>

                          {/* Quantity */}
                          <Form.Item
                            name={[name, 'quantity']}
                            label={fromAvailable !== null ? `Qty (max: ${fromAvailable})` : 'Quantity'}
                            rules={[
                              { required: true, message: 'Enter qty' },
                              { type: 'integer', min: 1, message: 'Must be a whole number min 1' },
                              ...(fromAvailable !== null ? [{ type: 'integer', max: fromAvailable, message: `Cannot exceed available qty of ${fromAvailable}` }] : [])
                            ]}
                            style={{ marginBottom: 0, width: 130 }}
                          >
                            <InputNumber
                              min={1}
                              max={fromAvailable ?? undefined}
                              precision={0}
                              step={1}
                              disabled={!fromAvailable || fromAvailable <= 0}
                              placeholder={!itemId || !fromWarehouseId ? 'Select first' : fromAvailable <= 0 ? 'No stock' : ''}
                              style={{ width: '100%' }}
                              onChange={() => form.setFieldsValue({})}
                            />
                          </Form.Item>

                          <Form.Item label=" " style={{ marginBottom: 0 }}>
                            <Button danger onClick={() => remove(name)}>Remove</Button>
                          </Form.Item>
                        </Space>

                        {/* Stock preview — same style as PO */}
                        {itemId && fromWarehouseId && toWarehouseId && (
                          <div style={{ padding: '8px 12px', backgroundColor: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 4 }}>
                            <span style={{ fontSize: 13, color: '#0050b3' }}>
                              ℹ️ <strong>{items.find(i => i.id === itemId)?.name}</strong>
                              {' — '}
                              <strong>{warehouses.find(w => w.id === fromWarehouseId)?.name}</strong>:{' '}
                              <strong style={{ color: '#1890ff' }}>{formatQuantity(fromAvailable ?? 0)}</strong>
                              {afterFrom !== null && (
                                <span style={{ color: afterFrom < 0 ? '#ff4d4f' : '#52c41a', marginLeft: 4 }}>
                                  → {formatQuantity(afterFrom)} after move
                                </span>
                              )}
                              {' | '}
                              <strong>{warehouses.find(w => w.id === toWarehouseId)?.name}</strong>:{' '}
                              <strong style={{ color: '#1890ff' }}>{formatQuantity(toCurrentStock ?? 0)}</strong>
                              {afterTo !== null && (
                                <span style={{ color: '#52c41a', marginLeft: 4 }}>
                                  → {formatQuantity(afterTo)} after move
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </Space>
                    </div>
                  );
                })}

                <Form.Item style={{ marginTop: 16 }}>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Add Line Item
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item style={{ marginTop: 8 }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>Confirm Move Order</Button>
              <Button onClick={() => { setModalVisible(false); form.resetFields(); }}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MoveOrders;
