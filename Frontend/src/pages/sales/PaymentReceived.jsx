import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Tag, Modal, Form, Select, DatePicker,
  InputNumber, Input, message, Card, Row, Col, Progress, Tooltip
} from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, SearchOutlined, ReloadOutlined
} from '@ant-design/icons';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatAmount } from '../../utils/numberFormat';
import dayjs from 'dayjs';

const { Option } = Select;

export default function PaymentReceived() {
  const { currency, formatCurrency } = useCurrency();
  const [invoices, setInvoices]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [payModal, setPayModal]   = useState(false);
  const [selected, setSelected]   = useState(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.get('/sales-invoices', { params: { limit: 500 } });
      const all = res.data?.invoices || res.data || [];
      setInvoices(all.filter(i => ['posted', 'partially_paid', 'paid'].includes(i.status)));
    } catch { message.error('Failed to load invoices'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openPayModal = (invoice) => {
    setSelected(invoice);
    form.setFieldsValue({
      paymentDate: dayjs(),
      paymentMethod: 'bank_transfer',
      amount: parseFloat(invoice.balance_amount || 0)
    });
    setPayModal(true);
  };

  const handlePayment = async (values) => {
    try {
      await apiService.post(`/sales-invoices/${selected.id}/payments`, {
        paymentDate:   values.paymentDate?.format('YYYY-MM-DD'),
        amount:        values.amount,
        paymentMethod: values.paymentMethod,
        reference:     values.reference,
        notes:         values.notes
      });
      message.success('Payment recorded successfully');
      setPayModal(false);
      form.resetFields();
      load();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to record payment');
    }
  };

  const isOverdue = (inv) =>
    inv.due_date && inv.status !== 'paid' && dayjs(inv.due_date).isBefore(dayjs(), 'day');

  const filtered = invoices.filter(i => {
    const text = !searchText ||
      i.invoice_number?.toLowerCase().includes(searchText.toLowerCase()) ||
      i.customer_name?.toLowerCase().includes(searchText.toLowerCase());
    const status = !statusFilter || i.status === statusFilter;
    return text && status;
  });

  // Summary stats
  const totalReceivable = invoices.reduce((s, i) => s + parseFloat(i.total_amount  || 0), 0);
  const totalReceived   = invoices.reduce((s, i) => s + parseFloat(i.paid_amount   || 0), 0);
  const totalBalance    = invoices.reduce((s, i) => s + parseFloat(i.balance_amount || 0), 0);
  const overdueCount    = invoices.filter(isOverdue).length;

  const columns = [
    {
      title: 'Invoice #',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      width: 140,
      render: (v, r) => (
        <div>
          <span style={{ fontWeight: 700, color: '#667eea' }}>{v}</span>
          {isOverdue(r) && (
            <Tag color="red" style={{ marginLeft: 6, fontSize: 10 }}>OVERDUE</Tag>
          )}
        </div>
      )
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 160,
      ellipsis: true,
      render: v => <span style={{ fontWeight: 500 }}>{v || '—'}</span>
    },
    {
      title: 'Invoice Date',
      dataIndex: 'invoice_date',
      key: 'invoice_date',
      width: 110,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '—'
    },
    {
      title: 'Due Date',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 110,
      render: (v, r) => {
        if (!v) return '—';
        const overdue = isOverdue(r);
        return (
          <span style={{ color: overdue ? '#ff4d4f' : '#595959', fontWeight: overdue ? 600 : 400 }}>
            {overdue && <ExclamationCircleOutlined style={{ marginRight: 4 }} />}
            {dayjs(v).format('DD MMM YYYY')}
          </span>
        );
      }
    },
    {
      title: 'Invoice Amount',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 130,
      align: 'right',
      render: v => <span style={{ fontWeight: 600 }}>{formatCurrency(v)}</span>
    },
    {
      title: 'Received',
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      width: 120,
      align: 'right',
      render: v => <span style={{ color: '#52c41a', fontWeight: 600 }}>{formatCurrency(v || 0)}</span>
    },
    {
      title: 'Balance Due',
      dataIndex: 'balance_amount',
      key: 'balance_amount',
      width: 120,
      align: 'right',
      render: v => (
        <span style={{ color: parseFloat(v || 0) > 0 ? '#ff4d4f' : '#52c41a', fontWeight: 700 }}>
          {formatCurrency(v || 0)}
        </span>
      )
    },
    {
      title: 'Collection',
      key: 'progress',
      width: 130,
      render: (_, r) => {
        const total = parseFloat(r.total_amount || 0);
        const paid  = parseFloat(r.paid_amount  || 0);
        const pct   = total > 0 ? Math.round((paid / total) * 100) : 0;
        return (
          <Tooltip title={`${pct}% collected`}>
            <Progress
              percent={pct}
              size="small"
              strokeColor={pct === 100 ? '#52c41a' : pct > 0 ? '#faad14' : '#ff4d4f'}
              showInfo={false}
            />
            <span style={{ fontSize: 11, color: '#8c8c8c' }}>{pct}%</span>
          </Tooltip>
        );
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: v => {
        const cfg = {
          posted:         { color: 'blue',   icon: <ClockCircleOutlined />,   label: 'Unpaid'   },
          partially_paid: { color: 'orange', icon: <ExclamationCircleOutlined />, label: 'Partial' },
          paid:           { color: 'green',  icon: <CheckCircleOutlined />,   label: 'Paid'     },
        };
        const c = cfg[v] || { color: 'default', label: v };
        return <Tag color={c.color} icon={c.icon} style={{ fontWeight: 600 }}>{c.label}</Tag>;
      }
    },
    {
      title: 'Action',
      key: 'action',
      width: 130,
      render: (_, r) =>
        ['posted', 'partially_paid'].includes(r.status) ? (
          <Button
            size="small" type="primary" icon={<PlusOutlined />}
            onClick={() => openPayModal(r)}
            style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 6 }}
          >
            Add Payment
          </Button>
        ) : (
          <Tag color="green" icon={<CheckCircleOutlined />}>Settled</Tag>
        )
    }
  ];

  return (
    <div style={{ padding: 24, background: '#f5f6fa', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        borderRadius: 16, padding: '24px 28px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
      }}>
        <div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>Payments Received</div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>Track and record customer payments</div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}
          style={{ borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff' }}>
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Receivable', value: formatCurrency(totalReceivable), color: '#667eea', bg: '#f0f0ff' },
          { label: 'Total Received',   value: formatCurrency(totalReceived),   color: '#52c41a', bg: '#f6ffed' },
          { label: 'Outstanding',      value: formatCurrency(totalBalance),    color: '#ff4d4f', bg: '#fff2f0' },
          { label: 'Overdue Invoices', value: overdueCount,                    color: '#fa8c16', bg: '#fff7e6' },
        ].map(s => (
          <Col xs={12} sm={6} key={s.label}>
            <Card bordered={false} style={{ borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
              bodyStyle={{ padding: '18px 20px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>{s.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters + Table */}
      <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }} bodyStyle={{ padding: 0 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f5f5f5', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            placeholder="Search invoice or customer..."
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            value={searchText} onChange={e => setSearchText(e.target.value)}
            allowClear style={{ width: 240, borderRadius: 8 }}
          />
          <Select placeholder="All Statuses" value={statusFilter} onChange={setStatusFilter}
            allowClear style={{ width: 150 }}>
            <Option value="posted">Unpaid</Option>
            <Option value="partially_paid">Partial</Option>
            <Option value="paid">Paid</Option>
          </Select>
        </div>
        <Table
          columns={columns} dataSource={filtered} rowKey="id"
          loading={loading} size="small"
          pagination={{ pageSize: 15, size: 'small', showTotal: (t) => `${t} invoices` }}
          scroll={{ x: 'max-content' }}
          rowClassName={(r) => isOverdue(r) ? 'overdue-row' : ''}
        />
      </Card>

      {/* Payment Modal */}
      <Modal
        title={
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Record Payment</div>
            <div style={{ fontSize: 13, color: '#8c8c8c', fontWeight: 400 }}>{selected?.invoice_number} · {selected?.customer_name}</div>
          </div>
        }
        open={payModal}
        onCancel={() => { setPayModal(false); form.resetFields(); }}
        onOk={() => form.submit()}
        okText="Record Payment"
        okButtonProps={{ style: { background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 8 } }}
        width="min(480px, 96vw)" style={{ top: 20 }}
      >
        {selected && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, padding: '12px 16px', background: '#f9f9ff', borderRadius: 10 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>Invoice Total</div>
              <div style={{ fontWeight: 700, color: '#1a1a2e' }}>{formatCurrency(selected.total_amount)}</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>Already Paid</div>
              <div style={{ fontWeight: 700, color: '#52c41a' }}>{formatCurrency(selected.paid_amount || 0)}</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>Balance Due</div>
              <div style={{ fontWeight: 700, color: '#ff4d4f', fontSize: 16 }}>{formatCurrency(selected.balance_amount)}</div>
            </div>
          </div>
        )}
        <Form form={form} layout="vertical" onFinish={handlePayment}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="paymentDate" label="Payment Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="amount" label="Amount" rules={[
                { required: true, message: 'Required' },
                { validator: (_, v) => {
                  if (!v || v <= 0) return Promise.reject('Must be > 0');
                  if (v > parseFloat(selected?.balance_amount || 0))
                    return Promise.reject(`Max: ${formatCurrency(selected?.balance_amount)}`);
                  return Promise.resolve();
                }}
              ]}>
                <InputNumber min={0.01} step={0.01} max={parseFloat(selected?.balance_amount || 0)}
                  style={{ width: '100%' }} prefix={currency} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="paymentMethod" label="Payment Method" rules={[{ required: true }]}>
            <Select>
              <Option value="bank_transfer">Bank Transfer</Option>
              <Option value="cash">Cash</Option>
              <Option value="cheque">Cheque</Option>
              <Option value="upi">UPI</Option>
              <Option value="online">Online</Option>
              <Option value="card">Card</Option>
            </Select>
          </Form.Item>
          <Form.Item name="reference" label="Reference / Transaction ID">
            <Input placeholder="UTR, cheque no., etc. (optional)" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Optional notes" />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`.overdue-row td { background: #fff9f9 !important; }`}</style>
    </div>
  );
}
