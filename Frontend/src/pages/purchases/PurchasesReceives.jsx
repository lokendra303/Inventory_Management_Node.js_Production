import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, InputNumber, Select, message, Tag, Tabs, DatePicker, Tooltip, Alert } from 'antd';
import { PlusOutlined, EyeOutlined, FileTextOutlined, SearchOutlined, StopOutlined, InfoCircleOutlined } from '@ant-design/icons';
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

  const fetchGRNs = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/purchase-orders');
      if (!response.success) return;

      // PENDING tab: confirmed = no goods received yet; partially_received = some received, more pending
      const pending = response.data.filter(po =>
        po.status === 'confirmed' || po.status === 'partially_received'
      );
      setPendingPOs(pending);

      // RECEIVED tab: collect all GRNs from POs that have at least one receipt
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
    } catch {
      message.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const openReceiveModal = async (po) => {
    try {
      const response = await apiService.get(`/purchase-orders/${po.id}`);
      if (!response.success) return;
      const poData = response.data;
      setSelectedPO({ ...poData, id: poData.id || po.id });

      // Only show lines that still have pending qty — this is what "partially_received" means:
      // some lines are done, others still have remaining qty to receive
      const pendingLines = (poData.lines || []).filter(
        line => (Number(line.quantity_ordered) - Number(line.quantity_received || 0)) > 0
      );

      if (pendingLines.length === 0) {
        message.info('All items in this PO have already been fully received.');
        return;
      }

      receiveForm.setFieldsValue({
        grnNumber: `GRN-${Date.now()}`,
        receiptDate: new Date().toISOString().split('T')[0],
        lines: pendingLines.map(line => {
          const pending = Number(line.quantity_ordered) - Number(line.quantity_received || 0);
          return {
            poLineId: line.id,
            itemId: line.item_id,
            warehouseId: line.warehouse_id,
            itemName: line.item_name,
            warehouseName: line.warehouse_name,
            quantityOrdered: line.quantity_ordered,
            alreadyReceived: line.quantity_received || 0,
            pendingQty: pending,
            quantityReceived: pending,  // default to full pending qty; user can reduce for partial
            unitCost: line.unit_cost,
            qualityStatus: 'accepted'
          };
        })
      });
      setReceiveModalVisible(true);
    } catch {
      message.error('Failed to load PO details');
    }
  };

  const handleReceiveGoods = async (values) => {
    try {
      // Drop lines where user entered 0 — nothing to receive for those
      const linesToSubmit = (values.lines || []).filter(line => Number(line.quantityReceived) > 0);
      if (linesToSubmit.length === 0) {
        message.warning('Please enter a quantity greater than 0 for at least one item.');
        return;
      }

      const grnData = {
        grnNumber: values.grnNumber,
        poId: selectedPO?.id,
        receiptDate: values.receiptDate,
        notes: values.notes,
        lines: linesToSubmit.map(line => ({
          poLineId: line.poLineId,
          itemId: line.itemId,
          warehouseId: line.warehouseId,
          quantityReceived: Number(line.quantityReceived),
          unitCost: Number(line.unitCost),
          // qualityStatus controls inventory: accepted = stock updated, rejected = stock NOT updated
          qualityStatus: line.qualityStatus || 'accepted'
        }))
      };

      const response = await apiService.post('/grn', grnData);
      if (response.success) {
        const rejectedCount = linesToSubmit.filter(l => l.qualityStatus === 'rejected').length;
        const acceptedCount = linesToSubmit.length - rejectedCount;

        if (rejectedCount > 0 && acceptedCount > 0) {
          message.success(
            `GRN created. ${acceptedCount} line(s) ACCEPTED → inventory updated. ` +
            `${rejectedCount} line(s) REJECTED → inventory NOT updated, pending qty unchanged.`
          );
        } else if (rejectedCount > 0 && acceptedCount === 0) {
          message.warning('All items marked as REJECTED. GRN recorded for traceability but inventory was NOT updated.');
        } else {
          message.success('Goods received successfully! Inventory and warehouse stock updated.');
        }

        setReceiveModalVisible(false);
        receiveForm.resetFields();
        setSelectedPO(null);
        fetchGRNs();
      }
    } catch (error) {
      message.error(error.response?.data?.error || error.message || 'Failed to receive goods');
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
    } catch {
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
      title: 'Lines',
      dataIndex: 'line_count',
      key: 'line_count',
      render: (val) => val || '-'
    },
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
        <Tooltip title={
          status === 'confirmed'
            ? 'PO confirmed — no goods received yet. Click Receive Goods to start.'
            : 'Some items received, remaining qty still pending. Click Receive Goods to receive the rest.'
        }>
          <Tag style={status === 'partially_received' ? { backgroundColor: '#7c3aed', color: '#fff', borderColor: '#7c3aed' } : {}} color={status === 'confirmed' ? 'orange' : undefined}>{status?.toUpperCase()}</Tag>
        </Tooltip>
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
      render: (val, record) => {
        const ordered = Number(record.total_quantity_ordered) || 0;
        const received = Number(val) || 0;
        const pending = ordered - received;
        return (
          <span>
            {received}
            {pending > 0 && <Tag style={{ marginLeft: 6, backgroundColor: '#7c3aed', color: '#fff', borderColor: '#7c3aed' }}>{pending} pending</Tag>}
          </span>
        );
      }
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
            <Input placeholder="Search PO or vendor..." prefix={<SearchOutlined />} value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: '100%', maxWidth: 220 }} allowClear />
            <DatePicker placeholder="From Date" value={fromDate} onChange={date => setFromDate(date)} style={{ width: 140 }} allowClear />
            <DatePicker placeholder="To Date" value={toDate} onChange={date => setToDate(date)} style={{ width: 140 }} allowClear />
            <Select placeholder="All Statuses" value={statusFilter} onChange={val => setStatusFilter(val)} style={{ width: 180 }} allowClear>
              <Select.Option value="confirmed">Confirmed (not yet received)</Select.Option>
              <Select.Option value="partially_received">Partially Received</Select.Option>
            </Select>
          </Space>
          <Table columns={pendingColumns} dataSource={pendingPOs.filter(po => {
              const textMatch = !searchText || po.po_number?.toLowerCase().includes(searchText.toLowerCase()) || po.vendor_name?.toLowerCase().includes(searchText.toLowerCase());
              const dateMatch = (!fromDate || !toDate) || (() => { const d = new Date(po.order_date); return d >= fromDate.startOf('day').toDate() && d <= toDate.endOf('day').toDate(); })();
              const statusMatch = !statusFilter || po.status === statusFilter;
              return textMatch && dateMatch && statusMatch;
            })}
            loading={loading} rowKey="id" scroll={{ x: 'max-content' }} size="small"
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
            <Input placeholder="Search GRN, PO or vendor..." prefix={<SearchOutlined />} value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: '100%', maxWidth: 220 }} allowClear />
            <DatePicker placeholder="From Date" value={fromDate} onChange={date => setFromDate(date)} style={{ width: 140 }} allowClear />
            <DatePicker placeholder="To Date" value={toDate} onChange={date => setToDate(date)} style={{ width: 140 }} allowClear />
          </Space>
          <Table columns={grnColumns} dataSource={grns.filter(grn => {
              const textMatch = !searchText || grn.grn_number?.toLowerCase().includes(searchText.toLowerCase()) || grn.po_number?.toLowerCase().includes(searchText.toLowerCase()) || grn.vendor_name?.toLowerCase().includes(searchText.toLowerCase());
              const dateMatch = (!fromDate || !toDate) || (() => { const d = new Date(grn.receipt_date); return d >= fromDate.startOf('day').toDate() && d <= toDate.endOf('day').toDate(); })();
              return textMatch && dateMatch;
            })}
            loading={loading} rowKey="id" scroll={{ x: 'max-content' }} size="small"
            locale={{ emptyText: 'No goods received yet' }}
          />
        </>
      )
    }
  ];

  return (
    <div style={{ padding: '16px' }}>
      <h1 style={{ fontSize: '20px', marginBottom: 16 }}>Purchase Receives</h1>
      <Card>
        <Tabs items={tabItems} />
      </Card>

      <Modal title={`Receive Goods — PO: ${selectedPO?.po_number}`} open={receiveModalVisible}
        onCancel={() => { setReceiveModalVisible(false); setSelectedPO(null); receiveForm.resetFields(); }}
        footer={null} width="min(1100px, 96vw)" style={{ top: 16 }}>
        <Alert
          style={{ marginBottom: 12 }}
          type="info"
          showIcon
          message={
            <span>
              <strong>Accepted</strong> lines → warehouse stock increases + average cost recalculated.{' '}
              <strong>Rejected</strong> lines → GRN recorded for traceability but inventory is <strong>NOT</strong> updated and pending qty stays unchanged (so you can receive again later).
              If you receive fewer than the pending qty, the PO stays <strong>PARTIALLY RECEIVED</strong> and appears here again for the remainder.
            </span>
          }
        />

        <Form form={receiveForm} layout="vertical" onFinish={handleReceiveGoods}>
          <Space style={{ width: '100%', flexWrap: 'wrap' }} size={16}>
            <Form.Item name="grnNumber" label="GRN Number" rules={[{ required: true }]} style={{ flex: 1, minWidth: 160 }}>
              <Input placeholder="GRN Number" />
            </Form.Item>
            <Form.Item name="receiptDate" label="Receipt Date" rules={[{ required: true }]} style={{ flex: 1, minWidth: 140 }}>
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
                    {/* hidden fields — sent to backend */}
                    <Form.Item name={[name, 'poLineId']} hidden><Input /></Form.Item>
                    <Form.Item name={[name, 'itemId']} hidden><Input /></Form.Item>
                    <Form.Item name={[name, 'warehouseId']} hidden><Input /></Form.Item>
                    <Form.Item name={[name, 'quantityOrdered']} hidden><Input /></Form.Item>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
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

                      <Form.Item label="Already Received">
                        <Form.Item name={[name, 'alreadyReceived']} noStyle>
                          <InputNumber disabled style={{ width: '100%' }} />
                        </Form.Item>
                      </Form.Item>

                      <Form.Item label="Pending Qty">
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

                      <Form.Item
                        name={[name, 'qualityStatus']}
                        label={
                          <span>
                            Quality{' '}
                            <Tooltip title="Accepted: goods pass inspection → inventory updated. Rejected: goods fail inspection → inventory NOT updated, pending qty unchanged so you can re-receive.">
                              <InfoCircleOutlined style={{ color: '#1890ff' }} />
                            </Tooltip>
                          </span>
                        }
                      >
                        <Select style={{ width: '100%' }}>
                          <Select.Option value="accepted">✅ Accepted</Select.Option>
                          <Select.Option value="rejected">❌ Rejected</Select.Option>
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
              <Button type="primary" htmlType="submit">Receive &amp; Update Inventory</Button>
              <Button onClick={() => { setReceiveModalVisible(false); setSelectedPO(null); receiveForm.resetFields(); }}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Cancel PO Modal ── */}
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

      <Modal title={`GRN Details — ${viewingGRN?.grn_number}`} open={viewModalVisible}
        onCancel={() => { setViewModalVisible(false); setViewingGRN(null); }}
        footer={[<Button key="close" onClick={() => { setViewModalVisible(false); setViewingGRN(null); }}>Close</Button>]}
        width="min(900px, 96vw)" style={{ top: 16 }}>
        {viewingGRN && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 16 }}>
              <div><strong>GRN Number:</strong> {viewingGRN.grn_number}</div>
              <div><strong>PO Number:</strong> {viewingGRN.po_number}</div>
              <div><strong>Vendor:</strong> {viewingGRN.vendor_name}</div>
              <div><strong>Receipt Date:</strong> {viewingGRN.receipt_date}</div>
              <div><strong>Status:</strong> <Tag color="green">{viewingGRN.status?.toUpperCase()}</Tag></div>
              {viewingGRN.notes && <div><strong>Notes:</strong> {viewingGRN.notes}</div>}
            </div>
            <h4>Received Items:</h4>
            <Table dataSource={viewingGRN.lines || []} rowKey="id" pagination={false} size="small" scroll={{ x: 'max-content' }}
              columns={[
                { title: 'Item', dataIndex: 'item_name', key: 'item_name', width: 130, ellipsis: true },
                { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 90, ellipsis: true },
                { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name', width: 110, ellipsis: true },
                { title: 'Ordered', dataIndex: 'quantity_ordered', key: 'quantity_ordered', width: 80 },
                { title: 'Received', dataIndex: 'quantity_received', key: 'quantity_received', width: 80 },
                { title: 'Unit Cost', dataIndex: 'unit_cost', key: 'unit_cost', width: 100, render: v => `${currency} ${formatAmount(v)}` },
                { title: 'Total', dataIndex: 'line_total', key: 'line_total', width: 100, render: v => `${currency} ${formatAmount(v)}` },
                { title: 'Quality', dataIndex: 'quality_status', key: 'quality_status', width: 90,
                  render: v => <Tag color={v === 'accepted' ? 'green' : 'red'}>{v?.toUpperCase()}</Tag> }
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PurchasesReceives;
