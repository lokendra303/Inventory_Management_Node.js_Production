import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Space, message } from 'antd';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatAmount } from '../../utils/numberFormat';
import dayjs from 'dayjs';

export default function PurchasesPaymentMade() {
  const { currency } = useCurrency();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all purchase invoices that have payments
      const res = await apiService.get('/purchase-invoices', { params: { hasPayments: true } });
      const invoices = res.data?.invoices || res.data || [];
      // Flatten payments from all invoices
      const allPayments = [];
      for (const inv of invoices.filter(i => parseFloat(i.paid_amount) > 0)) {
        try {
          const detail = await apiService.get(`/purchase-invoices/${inv.id}`);
          const invData = detail.data?.invoice || detail.data;
          const pmts = detail.data?.payments || [];
          pmts.forEach(p => allPayments.push({
            ...p,
            invoice_number: invData?.invoice_number,
            vendor_name: invData?.vendor_name
          }));
        } catch {}
      }
      setPayments(allPayments.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date)));
    } catch { message.error('Failed to load payments'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const METHOD_COLORS = { bank_transfer: 'blue', cash: 'green', cheque: 'orange', online: 'purple' };

  const columns = [
    { title: 'Bill #', dataIndex: 'invoice_number', key: 'invoice_number', width: 150 },
    { title: 'Vendor', dataIndex: 'vendor_name', key: 'vendor_name' },
    { title: 'Payment Date', dataIndex: 'payment_date', key: 'payment_date', width: 130,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '-' },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 130,
      render: v => `${currency} ${formatAmount(v)}` },
    { title: 'Method', dataIndex: 'payment_method', key: 'payment_method', width: 130,
      render: v => <Tag color={METHOD_COLORS[v] || 'default'}>{v?.replace('_', ' ').toUpperCase()}</Tag> },
    { title: 'Reference', dataIndex: 'reference', key: 'reference',
      render: v => v || '-' },
    { title: 'Notes', dataIndex: 'notes', key: 'notes',
      render: v => v || '-' }
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>Payments Made</h2>
      <Table columns={columns} dataSource={payments} rowKey="id"
        loading={loading} size="small" pagination={{ pageSize: 20 }} />
    </div>
  );
}
