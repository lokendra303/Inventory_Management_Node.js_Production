import apiService from '../../services/apiService';

/** @param {{ type: string, id: string, relatedId?: string, relatedType?: string }} record */
export async function fetchEntityTransactionDetail(record) {
  const { type, id, relatedId, relatedType } = record;

  if (type === 'payment') {
    const invoiceId = relatedId;
    if (!invoiceId) throw new Error('Linked invoice not found for this payment');
    if (relatedType === 'purchase_invoice') {
      const res = await apiService.get(`/purchase-invoices/${invoiceId}`);
      if (!res.success) throw new Error(res.error || 'Failed to load payment details');
      const payment = (res.data?.payments || []).find((p) => p.id === id);
      return {
        kind: 'payment',
        header: payment || { id, amount: record.amount, payment_date: record.date },
        parent: res.data?.invoice,
        lines: [],
        payments: res.data?.payments || [],
        highlightPaymentId: id,
        pdf: { apiBase: '/purchase-invoices', invoiceId },
      };
    }
    const res = await apiService.get(`/sales-invoices/${invoiceId}`);
    if (!res.success) throw new Error(res.error || 'Failed to load payment details');
    const payment = (res.data?.payments || []).find((p) => p.id === id);
    return {
      kind: 'payment',
      header: payment || { id, amount: record.amount, payment_date: record.date },
      parent: res.data?.invoice,
      lines: [],
      payments: res.data?.payments || [],
      highlightPaymentId: id,
      pdf: { apiBase: '/sales-invoices', invoiceId },
    };
  }

  switch (type) {
    case 'sales_order': {
      const res = await apiService.get(`/sales-orders/${id}`);
      if (!res.success) throw new Error(res.error || 'Failed to load sales order');
      return { kind: type, header: res.data, lines: res.data?.lines || [] };
    }
    case 'sales_invoice': {
      const res = await apiService.get(`/sales-invoices/${id}`);
      if (!res.success) throw new Error(res.error || 'Failed to load sales invoice');
      return {
        kind: type,
        header: res.data?.invoice,
        lines: res.data?.lines || [],
        payments: res.data?.payments || [],
        pdf: { apiBase: '/sales-invoices', invoiceId: id },
      };
    }
    case 'delivery_challan': {
      const res = await apiService.get(`/delivery-challans/${id}`);
      if (!res.success) throw new Error(res.error || 'Failed to load delivery challan');
      return { kind: type, header: res.data, lines: res.data?.lines || [] };
    }
    case 'purchase_order': {
      const res = await apiService.get(`/purchase-orders/${id}`);
      if (!res.success) throw new Error(res.error || 'Failed to load purchase order');
      return { kind: type, header: res.data, lines: res.data?.lines || [], grns: res.data?.grns || [] };
    }
    case 'purchase_invoice': {
      const res = await apiService.get(`/purchase-invoices/${id}`);
      if (!res.success) throw new Error(res.error || 'Failed to load purchase invoice');
      return {
        kind: type,
        header: res.data?.invoice,
        lines: res.data?.lines || [],
        payments: res.data?.payments || [],
        pdf: { apiBase: '/purchase-invoices', invoiceId: id },
      };
    }
    case 'grn': {
      const res = await apiService.get(`/grn/${id}`);
      if (!res.success) throw new Error(res.error || 'Failed to load GRN');
      return { kind: type, header: res.data, lines: res.data?.lines || [] };
    }
    case 'purchase_return': {
      const res = await apiService.get(`/purchase-returns/${id}`);
      if (!res.success) throw new Error(res.error || 'Failed to load purchase return');
      return { kind: type, header: res.data, lines: res.data?.lines || [] };
    }
    default:
      throw new Error('Unknown transaction type');
  }
}

export const TRANSACTION_TYPE_LABELS = {
  sales_order: 'Sales Order',
  sales_invoice: 'Sales Invoice',
  delivery_challan: 'Delivery Challan',
  purchase_order: 'Purchase Order',
  purchase_invoice: 'Purchase Invoice',
  grn: 'Goods Receipt (GRN)',
  purchase_return: 'Purchase Return',
  payment: 'Payment',
};
