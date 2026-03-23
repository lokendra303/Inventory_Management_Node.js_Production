import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, Space, Modal, Form, Select, DatePicker, InputNumber, Input, message, Tooltip } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatAmount } from '../../utils/numberFormat';
import dayjs from 'dayjs';

const { Option } = Select;
const STATUS_COLORS = { draft: 'default', posted: 'blue', applied: 'success', cancelled: 'error' };

export default function VendorCredits() {
  const { currency } = useCurrency();
  const [credits, setCredits] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, iRes] = await Promise.all([
        apiService.get('/purchase-invoices', { params: { type: 'credit_note' } }),
        apiService.get('/purchase-invoices')
      ]);
      const allInvoices = iRes.data?.invoices || iRes.data || [];
      setCredits((cRes.data?.invoices || cRes.data || []).filter(i => i.invoice_type === 'credit_note'));
      setInvoices(allInvoices.filter(i => i.invoice_type !== 'credit_note'));
    } catch { message.error('Failed to load vendor credits'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (values) => {
    try {
      await apiService.post('/purchase-invoices', {
        invoiceType: 'credit_note',
        originalInvoiceId: values.originalInvoiceId,
        creditDate: values.creditDate?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
        creditAmount: values.creditAmount,
        reason: values.reason,
        notes: values.notes
      });
      message.success('Vendor credit created');
      setCreateModal(false);
      form.resetFields();
      load();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to create vendor credit');
    }
  };

  const columns = [
    { title: 'Credit Note #', dataIndex: 'invoice_number', key: 'invoice_number', width: 150 },
    { title: 'Vendor', dataIndex: 'vendor_name', key: 'vendor_name' },
    { title: 'Date', dataIndex: 'invoice_date', key: 'invoice_date', width: 120,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '-' },
    { title: 'Amount', dataIndex: 'total_amount', key: 'total_amount', width: 120,
      render: v => `${currency} ${formatAmount(v)}` },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: v => <Tag color={STATUS_COLORS[v] || 'default'}>{v?.toUpperCase()}</Tag> },
    {
      title: 'Actions', key: 'actions', width: 80,
      render: (_, r) => (
        <Tooltip title="View">
          <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelected(r); setDetailModal(true); }} />
        </Tooltip>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Vendor Credits</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
          New Vendor Credit
        </Button>
      </div>

      <Table columns={columns} dataSource={credits} rowKey="id"
        loading={loading} size="small" pagination={{ pageSize: 20 }} />

      {/* Create Modal */}
      <Modal title="New Vendor Credit" open={createModal}
        onCancel={() => { setCreateModal(false); form.resetFields(); }}
        onOk={() => form.submit()} okText="Create">
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="originalInvoiceId" label="Original Bill">
            <Select showSearch optionFilterProp="children" placeholder="Select bill (optional)" allowClear>
              {invoices.map(i => <Option key={i.id} value={i.id}>{i.invoice_number} — {i.vendor_name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="creditDate" label="Credit Date" initialValue={dayjs()} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="creditAmount" label="Credit Amount" rules={[{ required: true }]}>
            <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal title={`Vendor Credit: ${selected?.invoice_number}`} open={detailModal}
        onCancel={() => setDetailModal(false)} footer={null}>
        {selected && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <Tag>Vendor: {selected.vendor_name}</Tag>
              <Tag color={STATUS_COLORS[selected.status] || 'default'}>{selected.status?.toUpperCase()}</Tag>
            </Space>
            <p><strong>Date:</strong> {selected.invoice_date ? dayjs(selected.invoice_date).format('DD MMM YYYY') : '-'}</p>
            <p><strong>Amount:</strong> {currency} {formatAmount(selected.total_amount)}</p>
            {selected.notes && <p><strong>Notes:</strong> {selected.notes}</p>}
          </Space>
        )}
      </Modal>
    </div>
  );
}
