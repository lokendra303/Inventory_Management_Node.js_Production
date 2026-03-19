import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, InputNumber, Select, message, Tag, Tabs, DatePicker } from 'antd';
import { PlusOutlined, EyeOutlined, FileTextOutlined, SearchOutlined, StopOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatAmount } from '../../utils/numberFormat';

const PurchasesReceives = () => {
  const { currency } = useCurrency();
  const [grns, setGrns] = useState([]);
  const [pendingPOs, setPendingPOs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [viewingGRN, setViewingGRN] = useState(null);
  const [receiveForm] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancellingPO, setCancellingPO] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // ── fetch all GRNs by loading confirmed/partially_received POs and their grns
  const fetchGRNs = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/purchase-orders');
      if (response.success) {
        const posWithGRNs = response.data.filter(po =>
          ['partially_received', 'received'].includes(po.status)
        );

        const grnList = [];
        await Promise.all(posWithGRNs.map(async (po) => {
          try {
            const detail = await apiService.get(`/purchase-orders/${po.id}`);
            if (detail.success && detail.data.grns) {
              detail.data.grns.forEach(grn => {
                grnList.push({
                  ...grn,
                  po_number: po.po_number,
                  vendor_name: po.vendor_name,
                  po_currency: po.currency
                });
              });
            }
          } catch {}
        }));
        setGrns(grnList.sort((a, b) => new Date(b.receipt_date) - new Date(a.receipt_date)));

        const pending = response.data.filter(po =>
          po.status === 'confirmed' || po.status === 'partially_received'
        );
        setPendingPOs(pending);
      }
    } catch (error) {
      message.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const openReceiveModal = async (po) => {
    try {
      const response = await apiService.get(`/purchase-orders/${po.id}`);
      if (response.success) {
        const poData = response.data;
        setSelectedPO({ ...poData, id: poData.id || po.id });

        // only show lines that still have pending qty
        const pendingLines = poData.lines?.filter(
          line => (line.quantity_ordered - (line.quantity_received || 0)) > 0
        ) || [];

        receiveForm.setFieldsValue({
          grnNumber: `GRN-${Date.now()}`,
          receiptDate: new Date().toISOString().split('T')[0],
          lines: pendingLines.map(line => ({
            poLineId: line.id,
            itemId: line.item_id,
            warehouseId: line.warehouse_id,
            itemName: line.item_name,
            warehouseName: line.warehouse_name,
            quantityOrdered: line.quantity_ordered,
            alreadyReceived: line.quantity_received || 0,
            pendingQty: line.quantity_ordered - (line.quantity_received || 0),
            quantityReceived: line.quantity_ordered - (line.quantity_received || 0),
            unitCost: line.unit_cost,
            qualityStatus: 'accepted'
          }))
        });
        setReceiveModalVisible(true);
      }
    } catch (error) {
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
          poLineId: line.poLineId,
          itemId: line.itemId,
          warehouseId: line.warehouseId,
          itemName: line.itemName,
          warehouseName: line.warehouseName,
          quantityOrdered: Number(line.quantityOrdered),
          quantityReceived: Number(line.quantityReceived),
          unitCost: Number(line.unitCost),
          qualityStatus: line.qualityStatus
        }))
      };

      const response = await apiService.post('/grn', grnData);
      if (response.success) {
        message.success('Goods received successfully! Inventory updated.');
        setReceiveModalVisible(false);
        receiveForm.resetFields();
        setSelectedPO(null);
        fetchGRNs();
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to receive goods');
    }
  };

  const generateInvoice = async (grn) => {
    try {
      setLoading(true);
      const response = await apiService.post(`/purchase-invoices/generate-from-grn/${grn.id}`);
      if (response.success) {
        message.success(`Invoice ${response.data.invoiceNumber} generated successfully`);
        fetchGRNs();
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to generate invoice');
    } finally {
      setLoading(false);
    }
  };

  const openCancelModal = (po) => {
    setCancellingPO(po);
    setCancelReason('');
    setCancelModalVisible(true);
  };

  const handleCancelPO = async () => {
    if (!cancelReason.trim()) {
      message.error('Please enter a cancellation reason');
      return;
    }
    try {
      setCancelLoading(true);
      const response = await apiService.post(`/purchase-orders/${cancellingPO.id}/cancel`, {
        cancellationReason: cancelReason.trim()
      });
      if (response.success) {
        message.success(`PO ${cancellingPO.po_number} cancelled successfully`);
        setCancelModalVisible(false);
        setCancellingPO(null);
        setCancelReason('');
        fetchGRNs();
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to cancel purchase order');
    } finally {
      setCancelLoading(false);
    }
  };

  const viewGRN = async (grn) => {
    try {
      const response = await apiService.get(`/grn/${grn.id}`);
      if (response.success) {
        setViewingGRN({ ...response.data, po_number: grn.po_number, vendor_name: grn.vendor_name });
        setViewModalVisible(true);
      }
    } catch (error) {
      message.error('Failed to load GRN details');
    }
  };

  useEffect(() => { fetchGRNs(); }, []);

  const grnColumns = [
    { title: 'GRN Number', dataIndex: 'grn_number', key: 'grn_number' },
    { title: 'PO Number', dataIndex: 'po_number', key: 'po_number' },
    { title: 'Vendor', dataIndex: 'vendor_name', key: 'vendor_name' },
    { title: 'Receipt Date', dataIndex: 'receipt_date', key: 'receipt_date' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'confirmed' ? 'green' : 'orange'}>{status?.toUpperCase()}</Tag>
      )
    },
    {
      title: 'Invoice',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      render: (invoiceNumber) => invoiceNumber
        ? <Tag color="blue">{invoiceNumber}</Tag>
        : <Tag color="default">Not Generated</Tag>
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => viewGRN(record)}>View</Button>
          {!record.invoice_number && (
            <Button
              size="small"
              type="primary"
              icon={<FileTextOutlined />}
              onClick={() => generateInvoice(record)}
            >
              Generate Invoice
            </Button>
          )}
        </Space>
      )
    }
  ];

  const pendingColumns = [
    { title: 'PO Number', dataIndex: 'po_number', key: 'po_number' },
    { title: 'Vendor', dataIndex: 'vendor_name', key: 'vendor_name' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'confirmed' ? 'orange' : 'gold'}>{status?.toUpperCase()}</Tag>
      )
    },
    { title: 'Order Date', dataIndex: 'order_date', key: 'order_date' },
    {
      title: 'Ordered',
      dataIndex: 'total_quantity_ordered',
      key: 'total_quantity_ordered',
      render: (val) => val || '-'
    },
    {
      title: 'Received',
      dataIndex: 'total_quantity_received',
      key: 'total_quantity_received',
      render: (val) => val || 0
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => openReceiveModal(record)}>
            Receive Goods
          </Button>
          {record.status === 'confirmed' && (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => openCancelModal(record)}
            >
              Cancel PO
            </Button>
          )}
        </Space>
      )
    }
  ];

  const tabItems = [
    {
      key: 'pending',
      label: `Pending Receipts (${pendingPOs.length})`,
      children: (
        <>
          <Space style={{ marginBottom: 12, flexWrap: 'wrap' }}>
            <Input
              placeholder="Search by PO number or vendor..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 280 }}
              allowClear
            />
            <DatePicker
              placeholder="From Date"
              value={fromDate}
              onChange={date => setFromDate(date)}
              style={{ width: 150 }}
              allowClear
            />
            <DatePicker
              placeholder="To Date"
              value={toDate}
              onChange={date => setToDate(date)}
              style={{ width: 150 }}
              allowClear
            />
            <Select
              placeholder="All Statuses"
              value={statusFilter}
              onChange={val => setStatusFilter(val)}
              style={{ width: 180 }}
              allowClear
            >
              <Select.Option value="confirmed">Confirmed</Select.Option>
              <Select.Option value="partially_received">Partially Received</Select.Option>
            </Select>
          </Space>
          <Table
            columns={pendingColumns}
            dataSource={pendingPOs.filter(po => {
              const textMatch = !searchText ||
                po.po_number?.toLowerCase().includes(searchText.toLowerCase()) ||
                po.vendor_name?.toLowerCase().includes(searchText.toLowerCase());
              const dateMatch = (!fromDate || !toDate) || (() => {
                const d = new Date(po.order_date);
                return d >= fromDate.startOf('day').toDate() && d <= toDate.endOf('day').toDate();
              })();
              const statusMatch = !statusFilter || po.status === statusFilter;
              return textMatch && dateMatch && statusMatch;
            })}
            loading={loading}
            rowKey="id"
            locale={{ emptyText: 'No pending receipts — all confirmed POs have been fully received' }}
          />
        </>
      )
    },
    {
      key: 'received',
      label: `Received (${grns.length})`,
      children: (
        <>
          <Space style={{ marginBottom: 12, flexWrap: 'wrap' }}>
            <Input
              placeholder="Search by GRN number, PO number or vendor..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 280 }}
              allowClear
            />
            <DatePicker
              placeholder="From Date"
              value={fromDate}
              onChange={date => setFromDate(date)}
              style={{ width: 150 }}
              allowClear
            />
            <DatePicker
              placeholder="To Date"
              value={toDate}
              onChange={date => setToDate(date)}
              style={{ width: 150 }}
              allowClear
            />
            <Select
              placeholder="All Statuses"
              value={statusFilter}
              onChange={val => setStatusFilter(val)}
              style={{ width: 160 }}
              allowClear
            >
              <Select.Option value="confirmed">Confirmed</Select.Option>
              <Select.Option value="pending">Pending</Select.Option>
            </Select>
          </Space>
          <Table
            columns={grnColumns}
            dataSource={grns.filter(grn => {
              const textMatch = !searchText ||
                grn.grn_number?.toLowerCase().includes(searchText.toLowerCase()) ||
                grn.po_number?.toLowerCase().includes(searchText.toLowerCase()) ||
                grn.vendor_name?.toLowerCase().includes(searchText.toLowerCase());
              const dateMatch = (!fromDate || !toDate) || (() => {
                const d = new Date(grn.receipt_date);
                return d >= fromDate.startOf('day').toDate() && d <= toDate.endOf('day').toDate();
              })();
              const statusMatch = !statusFilter || grn.status === statusFilter;
              return textMatch && dateMatch && statusMatch;
            })}
            loading={loading}
            rowKey="id"
            locale={{ emptyText: 'No goods received yet' }}
          />
        </>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h1>Purchase Receives</h1>
      <Card>
        <Tabs items={tabItems} />
      </Card>

      {/* Receive Goods Modal */}
      <Modal
        title={`Receive Goods — PO: ${selectedPO?.po_number}`}
        open={receiveModalVisible}
        onCancel={() => { setReceiveModalVisible(false); setSelectedPO(null); receiveForm.resetFields(); }}
        footer={null}
        width={1000}
      >
        <Form form={receiveForm} layout="vertical" onFinish={handleReceiveGoods}>
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item name="grnNumber" label="GRN Number" rules={[{ required: true }]} style={{ flex: 1, minWidth: 200 }}>
              <Input placeholder="GRN Number" />
            </Form.Item>
            <Form.Item name="receiptDate" label="Receipt Date" rules={[{ required: true }]} style={{ flex: 1, minWidth: 160 }}>
              <Input type="date" />
            </Form.Item>
          </Space>

          <Form.List name="lines">
            {(fields) => (
              <div>
                <h4>Items to Receive:</h4>
                {fields.length === 0 && (
                  <div style={{ padding: 16, color: '#999', textAlign: 'center', border: '1px dashed #d9d9d9', borderRadius: 6 }}>
                    All items in this PO have been fully received
                  </div>
                )}
                {fields.map(({ key, name }) => (
                  <div key={key} style={{ border: '1px solid #d9d9d9', padding: 16, marginBottom: 8, borderRadius: 6, backgroundColor: '#fafafa' }}>
                    {/* hidden fields */}
                    <Form.Item name={[name, 'poLineId']} hidden><Input /></Form.Item>
                    <Form.Item name={[name, 'itemId']} hidden><Input /></Form.Item>
                    <Form.Item name={[name, 'warehouseId']} hidden><Input /></Form.Item>
                    <Form.Item name={[name, 'quantityOrdered']} hidden><Input /></Form.Item>
                    <Form.Item name={[name, 'alreadyReceived']} hidden><Input /></Form.Item>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
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
                        <Form.Item name={[name, 'pendingQty']} noStyle>
                          <InputNumber disabled style={{ width: '100%' }} />
                        </Form.Item>
                      </Form.Item>

                      <Form.Item
                        name={[name, 'quantityReceived']}
                        label="Receiving Now"
                        rules={[
                          { required: true, message: 'Required' },
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              const lines = getFieldValue('lines');
                              const pending = lines?.[name]?.pendingQty || 0;
                              if (value < 0) return Promise.reject('Must be ≥ 0');
                              if (value > pending) return Promise.reject(`Max: ${pending}`);
                              return Promise.resolve();
                            }
                          })
                        ]}
                      >
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>

                      <Form.Item
                        name={[name, 'unitCost']}
                        label="Unit Cost"
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                      </Form.Item>

                      <Form.Item name={[name, 'qualityStatus']} label="Quality">
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

          <Form.Item name="notes" label="Notes" style={{ marginTop: 8 }}>
            <Input.TextArea placeholder="Receipt notes (optional)" rows={2} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">Receive & Update Inventory</Button>
              <Button onClick={() => { setReceiveModalVisible(false); setSelectedPO(null); receiveForm.resetFields(); }}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Cancel PO Modal */}
      <Modal
        title={`Cancel Purchase Order — ${cancellingPO?.po_number}`}
        open={cancelModalVisible}
        onCancel={() => { setCancelModalVisible(false); setCancellingPO(null); setCancelReason(''); }}
        footer={[
          <Button key="back" onClick={() => { setCancelModalVisible(false); setCancellingPO(null); setCancelReason(''); }}>
            Go Back
          </Button>,
          <Button key="confirm" danger type="primary" loading={cancelLoading} onClick={handleCancelPO}>
            Confirm Cancellation
          </Button>
        ]}
      >
        <p style={{ marginBottom: 12 }}>
          This PO is <strong>confirmed</strong> but no goods have been received yet.
          Cancelling will mark it as <strong>cancelled</strong> and preserve it in order history and audit log.
        </p>
        <Input.TextArea
          rows={3}
          placeholder="Enter cancellation reason (required)"
          value={cancelReason}
          onChange={e => setCancelReason(e.target.value)}
          maxLength={500}
          showCount
        />
      </Modal>

      {/* View GRN Modal */}
      <Modal
        title={`GRN Details — ${viewingGRN?.grn_number}`}
        open={viewModalVisible}
        onCancel={() => { setViewModalVisible(false); setViewingGRN(null); }}
        footer={[
          <Button key="close" onClick={() => { setViewModalVisible(false); setViewingGRN(null); }}>Close</Button>
        ]}
        width={900}
      >
        {viewingGRN && (
          <div>
            <div style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><strong>GRN Number:</strong> {viewingGRN.grn_number}</div>
              <div><strong>PO Number:</strong> {viewingGRN.po_number}</div>
              <div><strong>Vendor:</strong> {viewingGRN.vendor_name}</div>
              <div><strong>Receipt Date:</strong> {viewingGRN.receipt_date}</div>
              <div>
                <strong>Status:</strong>{' '}
                <Tag color="green">{viewingGRN.status?.toUpperCase()}</Tag>
              </div>
              {viewingGRN.notes && <div><strong>Notes:</strong> {viewingGRN.notes}</div>}
            </div>

            <h4>Received Items:</h4>
            <Table
              dataSource={viewingGRN.lines || []}
              rowKey="id"
              pagination={false}
              columns={[
                { title: 'Item', dataIndex: 'item_name', key: 'item_name' },
                { title: 'SKU', dataIndex: 'sku', key: 'sku' },
                { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name' },
                { title: 'Qty Ordered', dataIndex: 'quantity_ordered', key: 'quantity_ordered' },
                { title: 'Qty Received', dataIndex: 'quantity_received', key: 'quantity_received' },
                {
                  title: 'Unit Cost',
                  dataIndex: 'unit_cost',
                  key: 'unit_cost',
                  render: (val) => `${currency} ${formatAmount(val)}`
                },
                {
                  title: 'Line Total',
                  dataIndex: 'line_total',
                  key: 'line_total',
                  render: (val) => `${currency} ${formatAmount(val)}`
                },
                {
                  title: 'Quality',
                  dataIndex: 'quality_status',
                  key: 'quality_status',
                  render: (val) => (
                    <Tag color={val === 'accepted' ? 'green' : 'red'}>{val?.toUpperCase()}</Tag>
                  )
                }
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PurchasesReceives;
