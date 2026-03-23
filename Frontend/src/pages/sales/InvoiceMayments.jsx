import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Tabs, message } from 'antd';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatAmount } from '../../utils/numberFormat';
import dayjs from 'dayjs';

const { TabPane } = Tabs;

const METHOD_COLORS = { bank_transfer: 'blue', cash: 'green', cheque: 'orange', online: 'purple' };

const paymentColumns = (currency) => [
  { title: 'Invoice #', dataIndex: 'invoice_number', key: 'invoice_number', width: 130, ellipsis: true },
  { title: 'Party', dataIndex: 'party_name', key: 'party_name', width: 140, ellipsis: true },
  { title: 'Date', dataIndex: 'payment_date', key: 'payment_date', width: 110,
    render: v => v ? dayjs(v).format('DD MMM YYYY') : '-' },
  { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 120,
    render: v => `${currency} ${formatAmount(v)}` },
  { title: 'Method', dataIndex: 'payment_method', key: 'payment_method', width: 120,
    render: v => <Tag color={METHOD_COLORS[v] || 'default'}>{v?.replace('_', ' ').toUpperCase()}</Tag> },
  { title: 'Reference', dataIndex: 'reference', key: 'reference', width: 120, ellipsis: true, render: v => v || '-' }
];

export default function InvoicePayments() {
  const { currency } = useCurrency();
  const [salesPayments, setSalesPayments] = useState([]);
  const [purchasePayments, setPurchasePayments] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, pRes] = await Promise.all([
        apiService.get('/sales-invoices'),
        apiService.get('/purchase-invoices')
      ]);

      const salesInvs = sRes.data?.invoices || sRes.data || [];
      const purchaseInvs = pRes.data?.invoices || pRes.data || [];

      const sPmts = [];
      const pPmts = [];

      await Promise.all([
        ...salesInvs.filter(i => parseFloat(i.paid_amount) > 0).map(async inv => {
          try {
            const d = await apiService.get(`/sales-invoices/${inv.id}`);
            (d.data?.payments || []).forEach(p => sPmts.push({
              ...p, invoice_number: d.data?.invoice?.invoice_number || inv.invoice_number,
              party_name: d.data?.invoice?.customer_name || inv.customer_name
            }));
          } catch {}
        }),
        ...purchaseInvs.filter(i => parseFloat(i.paid_amount) > 0).map(async inv => {
          try {
            const d = await apiService.get(`/purchase-invoices/${inv.id}`);
            (d.data?.payments || []).forEach(p => pPmts.push({
              ...p, invoice_number: d.data?.invoice?.invoice_number || inv.invoice_number,
              party_name: d.data?.invoice?.vendor_name || inv.vendor_name
            }));
          } catch {}
        })
      ]);

      setSalesPayments(sPmts.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date)));
      setPurchasePayments(pPmts.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date)));
    } catch { message.error('Failed to load payment history'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 16, fontSize: '18px' }}>Invoice Payments</h2>
      <Tabs defaultActiveKey="sales">
        <TabPane tab={`Sales Payments (${salesPayments.length})`} key="sales">
          <Table columns={paymentColumns(currency)} dataSource={salesPayments} rowKey="id"
            loading={loading} size="small" pagination={{ pageSize: 20, size: 'small' }}
            scroll={{ x: 'max-content' }} />
        </TabPane>
        <TabPane tab={`Purchase Payments (${purchasePayments.length})`} key="purchase">
          <Table columns={paymentColumns(currency)} dataSource={purchasePayments} rowKey="id"
            loading={loading} size="small" pagination={{ pageSize: 20, size: 'small' }}
            scroll={{ x: 'max-content' }} />
        </TabPane>
      </Tabs>
    </div>
  );
}
