import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, Table, Button, Space, Tag, message, Modal, Form,
  Input, InputNumber, Select, DatePicker, Typography, Alert, Tooltip, Popconfirm
} from 'antd';
import {
  EyeOutlined, DollarOutlined, SearchOutlined,
  CheckCircleOutlined, WarningOutlined, SendOutlined
} from '@ant-design/icons';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatAmount } from '../../utils/numberFormat';

const { Title } = Typography;

const STATUS_COLORS = {
  draft: 'orange',
  posted: 'blue',
  partially_paid: 'purple',
  paid: 'green',
  cancelled: 'red',
};

const PurchasesBills = () => {
  const { currency } = useCurrency();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  // View / Review modal
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingBill, setViewingBill] = useState(null);
  const [billLines, setBillLines] = useState([]);
  const [billPayments, setBillPayments] = useState([]);
  const [masterItems, setMasterItems] = useState({});   // itemId -> master item data
  const [viewLoading, setViewLoading] = useState(false);
  const [postLoading, setPostLoading] = useState(false);

  // Payment modal
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [payingBill, setPayingBill] = useState(null);
  const [paymentForm] = Form.useForm();
  const [paymentLoading, setPaymentLoading] = useState(false);

  const fetchBills = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: pageSize };
      if (statusFilter) params.status = statusFilter;
      if (fromDate) params.dateFrom = fromDate.format('YYYY-MM-DD');
      if (toDate) params.dateTo = toDate.format('YYYY-MM-DD');

      const response = await apiService.get('/purchase-invoices', { params });
      if (response.success) {
        setBills(response.data?.invoices || []);
        setTotal(response.data?.pagination?.total || 0);
      } else {
        message.error(response.error || 'Failed to fetch bills');
      }
    } catch (error) {
      message.error('Error loading bills: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, fromDate, toDate]);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const openViewModal = async (bill) => {
    try {
      setViewLoading(true);
      setViewModalVisible(true);
      setMasterItems({});

      const response = await apiService.get(`/purchase-invoices/${bill.id}`);
      if (!response.success) { message.error('Failed to load bill details'); return; }

      const invoiceData = response.data;
      setViewingBill(invoiceData.invoice);
      setBillLines(invoiceData.lines || []);
      setBillPayments(invoiceData.payments || []);

      // Fetch master item data — single call to get all items, filter by IDs
      const itemIds = [...new Set((invoiceData.lines || []).map(l => l.item_id).filter(Boolean))];
      if (itemIds.length > 0) {
        try {
          const itemsRes = await apiService.get('/items');
          if (itemsRes.success) {
            const masterData = {};
            (itemsRes.data || []).forEach(item => {
              if (itemIds.includes(item.id)) masterData[item.id] = item;
            });
            setMasterItems(masterData);
          }
        } catch { /* silently skip master comparison */ }
      }
    } catch {
      message.error('Failed to load bill details');
    } finally {
      setViewLoading(false);
    }
  };

  const closeViewModal = () => {
    setViewModalVisible(false);
    setViewingBill(null);
    setBillLines([]);
    setBillPayments([]);
    setMasterItems({});
  };

  const handlePostBill = async (billId) => {
    try {
      setPostLoading(true);
      const response = await apiService.post(`/purchase-invoices/${billId}/post`);
      if (response.success) {
        message.success('Bill posted successfully');
        closeViewModal();
        fetchBills();
      } else {
        message.error(response.error || 'Failed to post bill');
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to post bill');
    } finally {
      setPostLoading(false);
    }
  };

  const openPaymentModal = (bill) => {
    setPayingBill(bill);
    paymentForm.setFieldsValue({
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'bank_transfer',
      amount: bill.balance_amount, // Auto-populate with due balance
    });
    setPaymentModalVisible(true);
  };

  const handleAddPayment = async (values) => {
    try {
      setPaymentLoading(true);
      console.log('Payment values:', values); // Debug log
      const response = await apiService.post(`/purchase-invoices/${payingBill.id}/payments`, {
        paymentDate: values.paymentDate,
        amount: values.amount,
        paymentMethod: values.paymentMethod,
        reference: values.reference || null,
        notes: values.notes || null,
      });
      if (response.success) {
        message.success('Payment recorded successfully');
        setPaymentModalVisible(false);
        paymentForm.resetFields();
        fetchBills();
      } else {
        message.error(response.error || 'Failed to record payment');
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to record payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Build line columns with master item comparison
  const buildReviewColumns = () => [
    {
      title: 'Item (Bill)',
      dataIndex: 'item_name',
      key: 'item_name',
      render: (name, record) => {
        const master = masterItems[record.item_id];
        if (!master) return name;
        const nameMatch = master.name?.toLowerCase() === name?.toLowerCase();
        return (
          <Space direction="vertical" size={0}>
            <span>{name}</span>
            {!nameMatch && (
              <Tooltip title={`Master item name: ${master.name}`}>
                <Tag color="red" style={{ fontSize: 11 }}>
                  <WarningOutlined /> Master: {master.name}
                </Tag>
              </Tooltip>
            )}
            {nameMatch && (
              <Tag color="green" style={{ fontSize: 11 }}>
                <CheckCircleOutlined /> Matched
              </Tag>
            )}
          </Space>
        );
      },
    },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', render: v => v || '-' },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity' },
    {
      title: 'Unit Cost (Bill)',
      dataIndex: 'unit_cost',
      key: 'unit_cost',
      render: (cost, record) => {
        const master = masterItems[record.item_id];
        const billCost = Math.round(parseFloat(cost || 0) * 100) / 100;
        const masterCost = Math.round(parseFloat(master?.cost_price || 0) * 100) / 100;
        const diff = master ? Math.abs(billCost - masterCost) : 0;
        const hasDiff = master && diff > 0;
        return (
          <Space direction="vertical" size={0}>
            <span>{currency} {formatAmount(billCost)}</span>
            {master && hasDiff && (
              <Tooltip title={`Master cost price: ${currency} ${formatAmount(masterCost)}`}>
                <Tag color="red" style={{ fontSize: 11 }}>
                  <WarningOutlined /> Master: {currency} {formatAmount(masterCost)}
                </Tag>
              </Tooltip>
            )}
            {master && !hasDiff && (
              <Tag color="green" style={{ fontSize: 11 }}>
                <CheckCircleOutlined /> Matched
              </Tag>
            )}
            {!master && record.item_id && (
              <Tag color="default" style={{ fontSize: 11 }}>No master data</Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Tax Rate',
      dataIndex: 'tax_rate',
      key: 'tax_rate',
      render: (rate, record) => {
        const master = masterItems[record.item_id];
        const billRate = Math.round(parseFloat(rate || 0) * 100) / 100;
        const masterRate = Math.round(parseFloat(master?.tax_rate || 0) * 100) / 100;
        const hasDiff = master && Math.abs(billRate - masterRate) > 0;
        return (
          <Space direction="vertical" size={0}>
            <span>{billRate}%</span>
            {master && hasDiff && (
              <Tooltip title={`Master tax rate: ${masterRate}%`}>
                <Tag color="orange" style={{ fontSize: 11 }}>
                  <WarningOutlined /> Master: {masterRate}%
                </Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Discount %',
      dataIndex: 'discount_rate',
      key: 'discount_rate',
      render: v => `${v || 0}%`,
    },
    {
      title: 'Line Total',
      dataIndex: 'line_total',
      key: 'line_total',
      render: v => `${currency} ${formatAmount(v)}`,
    },
  ];

  // Check if any line has mismatches
  const hasMismatches = billLines.some(line => {
    const master = masterItems[line.item_id];
    if (!master) return false;
    const costDiff = Math.round(parseFloat(line.unit_cost || 0) * 100) / 100 !== Math.round(parseFloat(master.cost_price || 0) * 100) / 100;
    const nameDiff = master.name?.toLowerCase() !== line.item_name?.toLowerCase();
    return costDiff || nameDiff;
  });

  const allLinesMatched = billLines.length > 0 && !hasMismatches &&
    billLines.every(l => !l.item_id || masterItems[l.item_id]);

  const filteredBills = useMemo(() =>
    bills.filter(bill =>
      !searchText ||
      bill.invoice_number?.toLowerCase().includes(searchText.toLowerCase()) ||
      bill.vendor_name?.toLowerCase().includes(searchText.toLowerCase())
    ), [bills, searchText]);

  const columns = [
    { title: 'Bill #', dataIndex: 'invoice_number', key: 'invoice_number' },
    { title: 'Vendor', dataIndex: 'vendor_name', key: 'vendor_name' },
    {
      title: 'Bill Date',
      dataIndex: 'invoice_date',
      key: 'invoice_date',
      render: d => d ? new Date(d).toLocaleDateString() : '-',
    },
    {
      title: 'Due Date',
      dataIndex: 'due_date',
      key: 'due_date',
      render: d => d ? new Date(d).toLocaleDateString() : '-',
    },
    {
      title: 'Total Amount',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: v => `${currency} ${formatAmount(v)}`,
    },
    {
      title: 'Balance Due',
      dataIndex: 'balance_amount',
      key: 'balance_amount',
      render: v => `${currency} ${formatAmount(v)}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: status => (
        <Tag color={STATUS_COLORS[status] || 'default'}>
          {status?.replace(/_/g, ' ').toUpperCase() || 'UNKNOWN'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openViewModal(record)}>
            Review
          </Button>
          {record.status === 'draft' && (
            <Popconfirm
              title="Post this bill?"
              description="This will confirm the bill as an official liability."
              onConfirm={() => handlePostBill(record.id)}
              okText="Post"
              cancelText="Cancel"
            >
              <Button size="small" type="default" icon={<SendOutlined />}>
                Post
              </Button>
            </Popconfirm>
          )}
          {['posted', 'partially_paid'].includes(record.status) && (
            <Button size="small" type="primary" icon={<DollarOutlined />} onClick={() => openPaymentModal(record)}>
              Pay
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Purchase Bills</Title>
      </div>

      <Card>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input placeholder="Search bill # or vendor..." prefix={<SearchOutlined />} value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: '100%', maxWidth: 220 }} allowClear />
          <DatePicker placeholder="From Date" value={fromDate} onChange={setFromDate} style={{ width: 140 }} allowClear />
          <DatePicker placeholder="To Date" value={toDate} onChange={setToDate} style={{ width: 140 }} allowClear />
          <Select placeholder="All Statuses" value={statusFilter} onChange={setStatusFilter} style={{ width: 150 }} allowClear>
            <Select.Option value="draft">Draft</Select.Option>
            <Select.Option value="posted">Posted</Select.Option>
            <Select.Option value="partially_paid">Partially Paid</Select.Option>
            <Select.Option value="paid">Paid</Select.Option>
            <Select.Option value="cancelled">Cancelled</Select.Option>
          </Select>
        </Space>
        <Table columns={columns} dataSource={filteredBills} loading={loading} rowKey="id"
          pagination={{ current: page, pageSize: pageSize, total: total, showSizeChanger: true, size: 'small' }}
          onChange={p => { setPage(p.current); setPageSize(p.pageSize); }}
          scroll={{ x: 'max-content' }} size="small"
        />
      </Card>

      <Modal title={`Review Bill — ${viewingBill?.invoice_number}`} open={viewModalVisible} onCancel={closeViewModal}
        width="min(1100px, 96vw)" style={{ top: 16 }}
        footer={[
          viewingBill?.status === 'draft' && (
            <Popconfirm key="post" title="Post this bill?" description="This confirms it as an official liability and creates accounting entries."
              onConfirm={() => handlePostBill(viewingBill.id)} okText="Post" cancelText="Cancel">
              <Button type="primary" icon={<SendOutlined />} loading={postLoading}>Post Bill</Button>
            </Popconfirm>
          ),
          <Button key="close" onClick={closeViewModal}>Close</Button>,
        ].filter(Boolean)}>
        {viewLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>Loading & matching with master items...</div>
        ) : viewingBill && (
          <>
            {/* Bill Header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 16 }}>
              <div><strong>Bill #:</strong> {viewingBill.invoice_number}</div>
              <div><strong>Vendor:</strong> {viewingBill.vendor_name}</div>
              <div><strong>Bill Date:</strong> {viewingBill.invoice_date ? new Date(viewingBill.invoice_date).toLocaleDateString() : '-'}</div>
              <div><strong>Due Date:</strong> {viewingBill.due_date ? new Date(viewingBill.due_date).toLocaleDateString() : '-'}</div>
              <div><strong>Total:</strong> {currency} {formatAmount(viewingBill.total_amount)}</div>
              <div><strong>Balance Due:</strong> {currency} {formatAmount(viewingBill.balance_amount)}</div>
              <div>
                <strong>Status:</strong>{' '}
                <Tag color={STATUS_COLORS[viewingBill.status]}>
                  {viewingBill.status?.replace(/_/g, ' ').toUpperCase()}
                </Tag>
              </div>
              {viewingBill.reference && <div><strong>Reference:</strong> {viewingBill.reference}</div>}
            </div>

            {/* Mismatch Alert */}
            {hasMismatches && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message="Price / Name Mismatch Detected"
                description="Some line items differ from master item records. Review the highlighted rows before posting."
              />
            )}
            {!hasMismatches && allLinesMatched && (
              <Alert
                type="success"
                showIcon
                style={{ marginBottom: 12 }}
                message="All line items match master item records"
              />
            )}

            {/* Line Items with master comparison */}
            <h4>Line Items (vs Master Item Data)</h4>
            <Table dataSource={billLines} rowKey="id" pagination={false} size="small" scroll={{ x: 'max-content' }} columns={buildReviewColumns()}
              rowClassName={record => {
                const master = masterItems[record.item_id];
                if (!master) return '';
                const costDiff = Math.round(parseFloat(record.unit_cost || 0) * 100) / 100 !== Math.round(parseFloat(master.cost_price || 0) * 100) / 100;
                const nameDiff = master.name?.toLowerCase() !== record.item_name?.toLowerCase();
                return costDiff || nameDiff ? 'ant-table-row-warning' : '';
              }}
            />

            {/* Totals */}
            <div style={{ textAlign: 'right', marginTop: 12 }}>
              <Space direction="vertical" size={2} style={{ alignItems: 'flex-end' }}>
                <span>Subtotal: <strong>{currency} {formatAmount(viewingBill.subtotal)}</strong></span>
                <span>Tax: <strong>{currency} {formatAmount(viewingBill.tax_amount)}</strong></span>
                <span>Discount: <strong>- {currency} {formatAmount(viewingBill.discount_amount)}</strong></span>
                <span style={{ fontSize: 16 }}>Grand Total: <strong>{currency} {formatAmount(viewingBill.total_amount)}</strong></span>
              </Space>
            </div>

            {billPayments.length > 0 && (
              <>
                <h4 style={{ marginTop: 16 }}>Payment History</h4>
                <Table dataSource={billPayments} rowKey="id" pagination={false} size="small" scroll={{ x: 'max-content' }}
                  columns={[
                    { title: 'Date', dataIndex: 'payment_date', key: 'payment_date', width: 100, render: d => new Date(d).toLocaleDateString() },
                    { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 110, render: v => `${currency} ${formatAmount(v)}` },
                    { title: 'Method', dataIndex: 'payment_method', key: 'payment_method', width: 110 },
                    { title: 'Reference', dataIndex: 'reference', key: 'reference', render: v => v || '-' },
                  ]}
                />
              </>
            )}
          </>
        )}
      </Modal>

      <Modal title={`Record Payment — ${payingBill?.invoice_number}`} open={paymentModalVisible}
        onCancel={() => { setPaymentModalVisible(false); paymentForm.resetFields(); }}
        footer={null} width="min(480px, 96vw)" style={{ top: 16 }}>
        {payingBill && (
          <p style={{ marginBottom: 16 }}>
            Balance Due: <strong>{currency} {formatAmount(payingBill.balance_amount)}</strong>
          </p>
        )}
        <Form form={paymentForm} layout="vertical" onFinish={handleAddPayment}>
          <Form.Item name="paymentDate" label="Payment Date" rules={[{ required: true }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item
            name="amount"
            label="Payment Amount"
            help={`Full payment: ${currency} ${formatAmount(payingBill?.balance_amount || 0)} | Enter partial amount if needed`}
            rules={[
              { required: true, message: 'Amount is required' },
              { type: 'number', min: 0.01, message: 'Amount must be greater than 0' },
              { type: 'number', max: payingBill?.balance_amount, message: 'Amount cannot exceed balance due' },
            ]}
          >
            <InputNumber 
              min={0.01} 
              step={0.01} 
              max={payingBill?.balance_amount} 
              style={{ width: '100%' }}
              placeholder={`Max: ${currency} ${formatAmount(payingBill?.balance_amount || 0)}`}
            />
          </Form.Item>
          <Form.Item name="paymentMethod" label="Payment Method" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="bank_transfer">Bank Transfer</Select.Option>
              <Select.Option value="cash">Cash</Select.Option>
              <Select.Option value="cheque">Cheque</Select.Option>
              <Select.Option value="online">Online</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="reference" label="Reference">
            <Input placeholder="Transaction reference (optional)" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Notes (optional)" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={paymentLoading}>Record Payment</Button>
              <Button onClick={() => { setPaymentModalVisible(false); paymentForm.resetFields(); }}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .ant-table-row-warning td { background-color: #fff7e6 !important; }
      `}</style>
    </div>
  );
};

export default PurchasesBills;
