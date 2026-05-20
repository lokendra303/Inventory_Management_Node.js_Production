import React, { useState, useEffect } from 'react';
import { Modal, Descriptions, Table, Tag, Spin, message, Button, Divider } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatCommercialDocAmount } from '../../utils/currency';
import InvoicePdfViewModal from '../business/InvoicePdfViewModal';
import {
  fetchEntityTransactionDetail,
  TRANSACTION_TYPE_LABELS,
} from './entityTransactionDetail';

const STATUS_COLORS = {
  draft: 'default',
  posted: 'processing',
  confirmed: 'processing',
  sent: 'processing',
  approved: 'processing',
  partially_paid: 'warning',
  partially_received: 'warning',
  partially_shipped: 'warning',
  paid: 'success',
  received: 'success',
  delivered: 'success',
  shipped: 'success',
  dispatched: 'processing',
  invoiced: 'success',
  recorded: 'success',
  cancelled: 'error',
};

function fmtDate(v) {
  return v ? new Date(v).toLocaleDateString() : '—';
}

function money(amount, currency, formatCurrency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  if (currency) return formatCommercialDocAmount(n, { currency });
  return formatCurrency(n);
}

function lineColumns(formatCurrency, currency) {
  return [
    { title: 'Item', dataIndex: 'item_name', key: 'item_name', ellipsis: true },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 100, render: (v) => v || '—' },
    {
      title: 'Qty',
      key: 'qty',
      width: 80,
      align: 'right',
      render: (_, r) => {
        const q = r.quantity ?? r.quantity_ordered ?? r.quantity_received;
        return q != null ? Number(q) : '—';
      },
    },
    {
      title: 'Rate',
      key: 'rate',
      width: 100,
      align: 'right',
      render: (_, r) => money(r.unit_price ?? r.unitPrice ?? r.unit_cost ?? r.unitCost, currency, formatCurrency),
    },
    {
      title: 'Line total',
      dataIndex: 'line_total',
      key: 'line_total',
      width: 110,
      align: 'right',
      render: (v, r) => money(v ?? r.lineTotal, currency, formatCurrency),
    },
  ];
}

function HeaderFields({ detail, formatCurrency }) {
  const h = detail.header || {};
  const ccy = h.currency;
  const status = (h.status || 'recorded').replace(/_/g, ' ');

  if (detail.kind === 'payment') {
    const parent = detail.parent || {};
    const p = detail.header || {};
    return (
      <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
        <Descriptions.Item label="Payment date">{fmtDate(p.payment_date)}</Descriptions.Item>
        <Descriptions.Item label="Amount">{money(p.amount, parent.currency || ccy, formatCurrency)}</Descriptions.Item>
        <Descriptions.Item label="Method">{p.payment_method || '—'}</Descriptions.Item>
        <Descriptions.Item label="Reference">{p.reference || '—'}</Descriptions.Item>
        <Descriptions.Item label="Linked invoice" span={2}>
          {parent.invoice_number || '—'}
        </Descriptions.Item>
        {p.notes && (
          <Descriptions.Item label="Notes" span={2}>{p.notes}</Descriptions.Item>
        )}
      </Descriptions>
    );
  }

  const items = [];

  const push = (label, value) => {
    if (value != null && value !== '') items.push({ label, value });
  };

  switch (detail.kind) {
    case 'sales_order':
      push('SO number', h.so_number);
      push('Customer', h.customer_name);
      push('Order date', fmtDate(h.order_date));
      push('Expected ship', fmtDate(h.expected_ship_date));
      push('Warehouse', h.warehouse_name);
      push('Total', money(h.total_amount, ccy, formatCurrency));
      break;
    case 'sales_invoice':
      push('Invoice #', h.invoice_number);
      push('Customer', h.customer_name || h.customer_full_name);
      push('Invoice date', fmtDate(h.invoice_date));
      push('Due date', fmtDate(h.due_date));
      push('SO ref', h.so_number);
      push('Subtotal', money(h.subtotal, ccy, formatCurrency));
      push('Tax', money(h.tax_amount, ccy, formatCurrency));
      push('Discount', money(h.discount_amount, ccy, formatCurrency));
      push('Total', money(h.total_amount, ccy, formatCurrency));
      push('Paid', money(h.paid_amount, ccy, formatCurrency));
      push('Balance', money(h.balance_amount, ccy, formatCurrency));
      break;
    case 'delivery_challan':
      push('Challan #', h.challan_number);
      push('Customer', h.customer_display_name || h.customer_name);
      push('Date', fmtDate(h.challan_date));
      push('Warehouse', h.warehouse_name);
      push('Vehicle', h.vehicle_number);
      push('Driver', h.driver_name);
      break;
    case 'purchase_order':
      push('PO number', h.po_number);
      push('Vendor', h.vendor_name);
      push('Order date', fmtDate(h.order_date));
      push('Expected', fmtDate(h.expected_date));
      push('Total', money(h.total_amount, ccy, formatCurrency));
      break;
    case 'purchase_invoice':
      push('Invoice #', h.invoice_number);
      push('Vendor', h.vendor_name);
      push('Invoice date', fmtDate(h.invoice_date));
      push('Due date', fmtDate(h.due_date));
      push('PO ref', h.po_number);
      push('Total', money(h.total_amount, ccy, formatCurrency));
      push('Paid', money(h.paid_amount, ccy, formatCurrency));
      push('Balance', money(h.balance_amount, ccy, formatCurrency));
      break;
    case 'grn':
      push('GRN #', h.grn_number);
      push('PO ref', h.po_number);
      push('Receipt date', fmtDate(h.receipt_date));
      push('Notes', h.notes);
      break;
    case 'purchase_return':
      push('Return #', h.return_number);
      push('Vendor', h.vendor_display_name || h.vendor_name);
      push('Return date', fmtDate(h.return_date));
      push('Debit note', h.debit_note_number);
      push('Total', money(h.total_amount, ccy, formatCurrency));
      push('Reason', h.reason);
      break;
    default:
      break;
  }

  return (
    <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
      {items.map(({ label, value }) => (
        <Descriptions.Item key={label} label={label}>
          {value}
        </Descriptions.Item>
      ))}
      <Descriptions.Item label="Status">
        <Tag color={STATUS_COLORS[h.status] || 'default'} style={{ textTransform: 'capitalize' }}>
          {status}
        </Tag>
      </Descriptions.Item>
      {h.notes && detail.kind !== 'grn' && (
        <Descriptions.Item label="Notes" span={2}>{h.notes}</Descriptions.Item>
      )}
    </Descriptions>
  );
}

const EntityTransactionDetailModal = ({ open, record, onClose }) => {
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [pdfOpen, setPdfOpen] = useState(false);

  useEffect(() => {
    if (!open || !record) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchEntityTransactionDetail(record);
        if (!cancelled) setDetail(data);
      } catch (e) {
        if (!cancelled) {
          message.error(e.message || 'Failed to load transaction details');
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, record, onClose]);

  const title = record
    ? `${TRANSACTION_TYPE_LABELS[record.type] || record.type} — ${record.documentNumber || ''}`
    : 'Transaction details';

  const currency = detail?.header?.currency || detail?.parent?.currency;
  const cols = lineColumns(formatCurrency, currency);

  const paymentColumns = [
    { title: 'Date', dataIndex: 'payment_date', render: fmtDate, width: 110 },
    { title: 'Amount', dataIndex: 'amount', align: 'right', render: (v) => money(v, currency, formatCurrency) },
    { title: 'Method', dataIndex: 'payment_method', render: (v) => v || '—' },
    { title: 'Reference', dataIndex: 'reference', render: (v) => v || '—' },
  ];

  return (
    <>
      <Modal
        title={title}
        open={open}
        onCancel={onClose}
        width="min(900px, 96vw)"
        style={{ top: 24 }}
        footer={[
          detail?.pdf ? (
            <Button key="pdf" icon={<FilePdfOutlined />} onClick={() => setPdfOpen(true)}>
              View PDF
            </Button>
          ) : null,
          <Button key="close" type="primary" onClick={onClose}>Close</Button>,
        ].filter(Boolean)}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
        ) : detail ? (
          <>
            <HeaderFields detail={detail} formatCurrency={formatCurrency} />

            {detail.lines?.length > 0 && (
              <>
                <Divider orientation="left" style={{ marginTop: 20 }}>Line items</Divider>
                <Table
                  columns={cols}
                  dataSource={detail.lines}
                  rowKey={(r) => r.id || `${r.item_id}-${r.line_number}`}
                  size="small"
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                />
              </>
            )}

            {detail.grns?.length > 0 && (
              <>
                <Divider orientation="left">Goods receipts</Divider>
                <Table
                  size="small"
                  pagination={false}
                  rowKey="id"
                  dataSource={detail.grns}
                  columns={[
                    { title: 'GRN #', dataIndex: 'grn_number' },
                    { title: 'Date', dataIndex: 'receipt_date', render: fmtDate },
                    { title: 'Status', dataIndex: 'status', render: (s) => <Tag>{s}</Tag> },
                    { title: 'Lines', dataIndex: 'line_count', width: 70 },
                  ]}
                />
              </>
            )}

            {detail.payments?.length > 0 && detail.kind !== 'payment' && (
              <>
                <Divider orientation="left">Payments</Divider>
                <Table
                  columns={paymentColumns}
                  dataSource={detail.payments}
                  rowKey="id"
                  size="small"
                  pagination={false}
                />
              </>
            )}

            {detail.kind === 'payment' && detail.payments?.length > 1 && (
              <>
                <Divider orientation="left">All payments on invoice</Divider>
                <Table
                  columns={paymentColumns}
                  dataSource={detail.payments}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  rowClassName={(r) =>
                    r.id === detail.highlightPaymentId ? 'table-row-light' : ''
                  }
                />
              </>
            )}
          </>
        ) : null}
      </Modal>

      {detail?.pdf && (
        <InvoicePdfViewModal
          open={pdfOpen}
          onClose={() => setPdfOpen(false)}
          invoiceId={detail.pdf.invoiceId}
          apiBase={detail.pdf.apiBase}
          title={detail.parent?.invoice_number || detail.header?.invoice_number || 'Invoice'}
        />
      )}
    </>
  );
};

export default EntityTransactionDetailModal;
