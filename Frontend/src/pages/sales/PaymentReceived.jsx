import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, Space, Modal, Form, Select, DatePicker, InputNumber, Input, message } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatAmount } from '../../utils/numberFormat';
import dayjs from 'dayjs';

const { Option } = Select;

export default function PaymentReceived() {
  const { currency } = useCurrency();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.get('/sales-invoices');
      const all = res.data?.invoices || res.data || [];
      setInvoices(all.filter(i => ['posted', 'partially_paid', 'paid'].includes(i.status)));
    } catch { message.error('Failed to load invoices'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openPayModal = (invoice) => {
    setSelected(invoice);
    form.setFieldsValue({ paymentDate: dayjs(), paymentMethod: 'bank_transfer' });
    setPayModal(true);
  };

  const handlePayment = async (values) => {
    try {
      await apiService.post(`/sales-invoices/${selected.id}/payments`, {
        paymentDate: values.paymentDate?.format('YYYY-MM-DD'),
        amount: values.amount,
        paymentMethod: values.paymentMethod,
        reference: values.reference,
        notes: values.notes
      });
      message.success('Payment recorded successfully');
      setPayModal(false);
      form.resetFields();
      load();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to record payment');
    }
  };

  const STATUS_COLORS = { posted: 'blue', partially_paid: 'purple', paid: 'green' };

  const columns = [
    { title: 'Invoice #', dataIndex: 'invoice_number', key: 'invoice_number', width: 150 },
    { title: 'Customer', dataIndex: 'customer_name', key: 'customer_name' },
    { title: 'Invoice Date', dataIndex: 'invoice_date', key: 'invoice_date', width: 120,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '-' },
    { title: 'Due Date', dataIndex: 'due_date', key: 'due_date', width: 120,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '-' },
    { title: 'Total', dataIndex: 'total_amount', key: 'total_amount', width: 120,
      render: v => `${currency} ${formatAmount(v)}` },
    { title: 'Paid', dataIndex: 'paid_amount', key: 'paid_amount', width: 120,
      render: v => `${currency} ${formatAmount(v)}` },
    { title: 'Balance', dataIndex: 'balance_amount', key: 'balance_amount', width: 120,
      render: v => <span style={{ color: parseFloat(v) > 0 ? '#ff4d4f' : '#52c41a' }}>{currency} {formatAmount(v)}</span> },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 120,
      render: v => <Tag color={STATUS_COLORS[v] || 'default'}>{v?.replace('_', ' ').toUpperCase()}</Tag> },
    {
      title: 'Actions', key: 'actions', width: 100,
      render: (_, r) => (
        ['posted', 'partially_paid'].includes(r.status) && (
          <Button size="small" type="primary" onClick={() => openPayModal(r)}>
            Record Payment
          </Button>
        )
      )
    }
  ];

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 16, fontSize: '18px' }}>Payments Received</h2>
      <Table columns={columns} dataSource={invoices} rowKey="id"
        loading={loading} size="small" pagination={{ pageSize: 20, size: 'small' }}
        scroll={{ x: 'max-content' }} />
      <Modal title={`Record Payment — ${selected?.invoice_number}`} open={payModal}
        onCancel={() => { setPayModal(false); form.resetFields(); }}
        onOk={() => form.submit()} okText="Record Payment"
        width="min(480px, 96vw)" style={{ top: 16 }}>
        {selected && (
          <p style={{ marginBottom: 16 }}>
            Balance Due: <strong style={{ color: '#ff4d4f', fontSize: 16 }}>{currency} {formatAmount(selected.balance_amount)}</strong>
          </p>
        )}
        <Form form={form} layout="vertical" onFinish={handlePayment}>
          <Form.Item name="paymentDate" label="Payment Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="amount" label="Amount" rules={[
            { required: true, message: 'Amount is required' },
            {
              validator: (_, value) => {
                if (!value || value <= 0) return Promise.reject('Amount must be greater than 0');
                if (value > parseFloat(selected?.balance_amount || 0))
                  return Promise.reject(`Amount cannot exceed balance due (${currency} ${formatAmount(selected?.balance_amount)})`);
                return Promise.resolve();
              }
            }
          ]}>
            <InputNumber min={0.01} step={0.01} max={selected?.balance_amount} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="paymentMethod" label="Payment Method" rules={[{ required: true }]}>
            <Select>
              <Option value="bank_transfer">Bank Transfer</Option>
              <Option value="cash">Cash</Option>
              <Option value="cheque">Cheque</Option>
              <Option value="online">Online</Option>
            </Select>
          </Form.Item>
          <Form.Item name="reference" label="Reference">
            <Input placeholder="Transaction reference (optional)" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
