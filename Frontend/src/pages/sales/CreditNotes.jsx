import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, Space, Modal, Form, Select, DatePicker, InputNumber, Input, message, Tooltip } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import dayjs from 'dayjs';

const { Option } = Select;
const STATUS_COLORS = { draft: 'default', posted: 'blue', applied: 'success', cancelled: 'error' };

export default function CreditNotes() {
  const [notes, setNotes] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nRes, iRes] = await Promise.all([
        apiService.get('/sales-invoices', { params: { type: 'credit_note' } }),
        apiService.get('/sales-invoices')
      ]);
      // Filter credit notes from sales invoices (type = credit_note) or show all with negative amounts
      const allInvoices = iRes.data?.invoices || iRes.data || [];
      setNotes((nRes.data?.invoices || nRes.data || []).filter(i => i.invoice_type === 'credit_note'));
      setInvoices(allInvoices.filter(i => i.invoice_type !== 'credit_note'));
    } catch { message.error('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (values) => {
    try {
      await apiService.post('/sales-invoices', {
        invoiceType: 'credit_note',
        originalInvoiceId: values.originalInvoiceId,
        creditDate: values.creditDate?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
        creditAmount: values.creditAmount,
        reason: values.reason,
        notes: values.notes
      });
      message.success('Credit note created');
      setCreateModal(false);
      form.resetFields();
      load();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to create credit note');
    }
  };

  const columns = [
    { title: 'Credit Note #', dataIndex: 'invoice_number', key: 'invoice_number', width: 150 },
    { title: 'Customer', dataIndex: 'customer_name', key: 'customer_name' },
    { title: 'Date', dataIndex: 'invoice_date', key: 'invoice_date', width: 120,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '-' },
    { title: 'Amount', dataIndex: 'total_amount', key: 'total_amount', width: 110,
      render: v => `$${parseFloat(v || 0).toFixed(2)}` },
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
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>Credit Notes</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>New Credit Note</Button>
      </div>
      <Table columns={columns} dataSource={notes} rowKey="id"
        loading={loading} size="small" pagination={{ pageSize: 20, size: 'small' }} scroll={{ x: 'max-content' }} />
      <Modal title="New Credit Note" open={createModal}
        onCancel={() => { setCreateModal(false); form.resetFields(); }}
        onOk={() => form.submit()} okText="Create"
        width="min(480px, 96vw)" style={{ top: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="originalInvoiceId" label="Original Invoice">
            <Select showSearch optionFilterProp="children" placeholder="Select invoice (optional)" allowClear>
              {invoices.map(i => <Option key={i.id} value={i.id}>{i.invoice_number} — {i.customer_name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="creditDate" label="Credit Date" initialValue={dayjs()} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="creditAmount" label="Credit Amount" rules={[{ required: true }]}>
            <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} prefix="$" />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
      <Modal title={`Credit Note: ${selected?.invoice_number}`} open={detailModal}
        onCancel={() => setDetailModal(false)} footer={null}
        width="min(480px, 96vw)" style={{ top: 16 }}>
        {selected && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space wrap>
              <Tag>Customer: {selected.customer_name}</Tag>
              <Tag color={STATUS_COLORS[selected.status] || 'default'}>{selected.status?.toUpperCase()}</Tag>
            </Space>
            <p><strong>Date:</strong> {selected.invoice_date ? dayjs(selected.invoice_date).format('DD MMM YYYY') : '-'}</p>
            <p><strong>Amount:</strong> ${parseFloat(selected.total_amount || 0).toFixed(2)}</p>
            {selected.notes && <p><strong>Notes:</strong> {selected.notes}</p>}
          </Space>
        )}
      </Modal>
    </div>
  );
}
