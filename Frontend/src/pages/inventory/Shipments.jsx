import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, Modal, Form, Select, InputNumber, Input, message, Card, Row, Col, Statistic, Typography, Alert } from 'antd';
import { PlusOutlined, SendOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import dayjs from 'dayjs';

const { Option } = Select;
const { Text } = Typography;

export default function Shipments() {
  const [shipments, setShipments] = useState([]);
  const [shipReadyOrders, setShipReadyOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewOrder, setViewOrder] = useState(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [confirmedRes, partialRes, shippedRes] = await Promise.all([
        apiService.get('/sales-orders', { params: { status: 'confirmed' } }),
        apiService.get('/sales-orders', { params: { status: 'partially_shipped' } }),
        apiService.get('/sales-orders', { params: { status: 'shipped' } })
      ]);

      const shipCandidates = [...(confirmedRes.data || []), ...(partialRes.data || [])];
      const allOrders = [...shipCandidates, ...(shippedRes.data || [])];
      setShipReadyOrders(shipCandidates);

      const shipmentRows = allOrders
        .filter((so) => Number(so.total_quantity_shipped || 0) > 0)
        .map((so) => ({
          id: so.id,
          so_number: so.so_number,
          customer_name: so.customer_name,
          status: so.status,
          total_quantity_shipped: Number(so.total_quantity_shipped || 0),
          total_quantity_ordered: Number(so.total_quantity_ordered || 0),
          created_at: so.created_at
        }));
      setShipments(shipmentRows);
    } catch { message.error('Failed to load shipments'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleOrderChange = async (soId) => {
    form.setFieldsValue({ lines: [] });
    setSelectedOrder(null);
    if (!soId) return;

    try {
      const res = await apiService.get(`/sales-orders/${soId}`);
      const so = res.data;
      const lines = (so.lines || [])
        .map((line) => {
          const ordered = Number(line.quantity_ordered || 0);
          const shipped = Number(line.quantity_shipped || 0);
          const pending = Math.max(ordered - shipped, 0);
          return {
            soLineId: line.id,
            itemName: line.item_name,
            warehouseName: line.warehouse_name,
            quantityOrdered: ordered,
            quantityShipped: shipped,
            pendingQuantity: pending,
            quantity: pending > 0 ? pending : 0
          };
        })
        .filter((line) => line.pendingQuantity > 0);

      setSelectedOrder(so);
      form.setFieldsValue({
        soId,
        shipmentNumber: `SHIP-${Date.now()}`,
        lines
      });
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to load sales order lines');
    }
  };

  const handleShip = async (values) => {
    const soId = values.soId;
    const lines = (values.lines || [])
      .filter((line) => Number(line.quantity) > 0)
      .map((line) => ({
        soLineId: line.soLineId,
        quantity: Number(line.quantity)
      }));

    if (!soId) {
      message.error('Select a sales order');
      return;
    }
    if (lines.length === 0) {
      message.error('Enter shipment quantity for at least one line');
      return;
    }

    try {
      setSubmitting(true);
      await apiService.post(`/sales-orders/${soId}/ship`, {
        shipmentNumber: values.shipmentNumber,
        lines
      });
      message.success('Stock shipped successfully');
      setCreateModal(false);
      form.resetFields();
      setSelectedOrder(null);
      load();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to ship stock');
    } finally {
      setSubmitting(false);
    }
  };

  const openView = async (row) => {
    try {
      setViewLoading(true);
      setViewModal(true);
      const res = await apiService.get(`/sales-orders/${row.id}`);
      setViewOrder(res.data || null);
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to load shipment details');
      setViewModal(false);
    } finally {
      setViewLoading(false);
    }
  };

  const totalShipped = shipments.reduce((s, r) => s + Number(r.total_quantity_shipped || 0), 0);

  const columns = [
    { title: 'SO Number', dataIndex: 'so_number', key: 'so_number', width: 140, ellipsis: true },
    { title: 'Customer', dataIndex: 'customer_name', key: 'customer_name', width: 180, ellipsis: true },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 130, render: (status) => <Tag color={status === 'shipped' ? 'green' : 'blue'}>{status}</Tag> },
    { title: 'Qty Shipped', dataIndex: 'total_quantity_shipped', key: 'total_quantity_shipped', width: 120,
      render: v => <Tag color="blue">{parseFloat(v || 0).toFixed(2)}</Tag> },
    { title: 'Qty Ordered', dataIndex: 'total_quantity_ordered', key: 'total_quantity_ordered', width: 120,
      render: v => parseFloat(v || 0).toFixed(2) },
    { title: 'Date', dataIndex: 'created_at', key: 'created_at', width: 150,
      render: v => v ? dayjs(v).format('DD MMM YYYY HH:mm') : '-' },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      render: (_, row) => <Button size="small" onClick={() => openView(row)}>View</Button>
    }
  ];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>Shipments</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
          Ship Stock
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic title="Total Shipments" value={shipments.length} prefix={<SendOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic title="Units Shipped" value={totalShipped.toFixed(2)} />
          </Card>
        </Col>
      </Row>

      <Table columns={columns} dataSource={shipments} rowKey={(r, i) => r.id || i}
        loading={loading} size="small" pagination={{ pageSize: 20, size: 'small' }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'No shipments recorded yet' }} />

      <Modal title="Ship Stock" open={createModal}
        onCancel={() => { setCreateModal(false); form.resetFields(); setSelectedOrder(null); }}
        onOk={() => form.submit()} okText="Create Shipment" confirmLoading={submitting}
        width="min(480px, 96vw)" style={{ top: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleShip}>
          <Form.Item name="soId" label="Sales Order" rules={[{ required: true, message: 'Sales order is required' }]}>
            <Select
              showSearch
              optionFilterProp="children"
              placeholder="Select sales order"
              onChange={handleOrderChange}
              notFoundContent="No confirmed or partially shipped orders available"
            >
              {shipReadyOrders.map(so => <Option key={so.id} value={so.id}>{so.so_number} — {so.customer_name}</Option>)}
            </Select>
          </Form.Item>
          {shipReadyOrders.length === 0 && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="No shippable sales orders"
              description="Only Sales Orders in Confirmed or Partially Shipped status appear here."
            />
          )}
          <Form.Item name="shipmentNumber" label="Shipment Number (optional)">
            <Input placeholder="Auto-generated if empty" />
          </Form.Item>

          {selectedOrder && (
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">Customer: {selectedOrder.customer_name || '-'}</Text>
            </div>
          )}

          <Form.List name="lines">
            {(fields) => (
              <>
                {fields.map((field) => {
                  const row = form.getFieldValue(['lines', field.name]) || {};
                  return (
                    <Card key={field.key} size="small" style={{ marginBottom: 8 }}>
                      <Form.Item name={[field.name, 'soLineId']} hidden><Input /></Form.Item>
                      <div style={{ marginBottom: 8 }}>
                        <strong>{row.itemName || 'Item'}</strong>
                        <div style={{ fontSize: 12, color: '#666' }}>{row.warehouseName || '-'}</div>
                        <div style={{ fontSize: 12, color: '#666' }}>
                          Ordered: {row.quantityOrdered || 0}, Shipped: {row.quantityShipped || 0}, Pending: {row.pendingQuantity || 0}
                        </div>
                      </div>
                      <Form.Item
                        name={[field.name, 'quantity']}
                        label="Ship Quantity"
                        rules={[{
                          validator: (_, value) => {
                            const qty = Number(value || 0);
                            const pending = Number(row.pendingQuantity || 0);
                            if (qty < 0) return Promise.reject(new Error('Quantity cannot be negative'));
                            if (qty > pending) return Promise.reject(new Error(`Cannot exceed pending quantity (${pending})`));
                            return Promise.resolve();
                          }
                        }]}
                      >
                        <InputNumber min={0} max={Number(row.pendingQuantity || 0)} step={0.01} style={{ width: '100%' }} />
                      </Form.Item>
                    </Card>
                  );
                })}
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal
        title="Shipment Details"
        open={viewModal}
        onCancel={() => { setViewModal(false); setViewOrder(null); }}
        footer={null}
        width="min(900px, 96vw)"
      >
        {viewOrder && (
          <>
            <div style={{ marginBottom: 12 }}>
              <Tag color="blue">{viewOrder.so_number}</Tag>
              <Tag color={viewOrder.status === 'shipped' ? 'green' : 'gold'}>{viewOrder.status}</Tag>
              <Text style={{ marginLeft: 8 }}>Customer: {viewOrder.customer_name || '-'}</Text>
            </div>
            <Table
              size="small"
              loading={viewLoading}
              rowKey={(r) => r.id}
              pagination={false}
              dataSource={viewOrder.lines || []}
              columns={[
                { title: 'Item', dataIndex: 'item_name', key: 'item_name' },
                { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name' },
                { title: 'Ordered', dataIndex: 'quantity_ordered', key: 'quantity_ordered' },
                { title: 'Shipped', dataIndex: 'quantity_shipped', key: 'quantity_shipped' },
                {
                  title: 'Pending',
                  key: 'pending',
                  render: (_, r) => Number(r.quantity_ordered || 0) - Number(r.quantity_shipped || 0)
                },
                { title: 'Line Status', dataIndex: 'status', key: 'status' }
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
