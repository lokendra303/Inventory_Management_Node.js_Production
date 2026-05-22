/**
 * Optional document metadata (GST grid on invoices; lighter sets on orders).
 * Stored as JSON on sales_invoices, purchase_invoices, sales_orders, purchase_orders.
 */

const META_KEYS = [
  'ewayBillNo',
  'deliveryNote',
  'paymentTerms',
  'referenceNo',
  'referenceDate',
  'otherReferences',
  'buyersOrderNo',
  'buyersOrderDate',
  'dispatchDocNo',
  'deliveryNoteDate',
  'dispatchMode',
  'vehicleNumber',
  'destination',
  'deliveryTerms',
];

/** Keys persisted per document type (others stripped on save). */
const PROFILE_KEYS = {
  salesInvoice: META_KEYS,
  purchaseInvoice: [
    'paymentTerms',
    'referenceNo',
    'referenceDate',
    'otherReferences',
    'buyersOrderNo',
    'buyersOrderDate',
    'deliveryNote',
    'deliveryNoteDate',
    'ewayBillNo',
    'vehicleNumber',
    'destination',
    'deliveryTerms',
  ],
  salesOrder: [
    'paymentTerms',
    'referenceNo',
    'referenceDate',
    'otherReferences',
    'buyersOrderNo',
    'buyersOrderDate',
    'dispatchMode',
    'destination',
    'deliveryTerms',
  ],
  purchaseOrder: [
    'paymentTerms',
    'referenceNo',
    'referenceDate',
    'otherReferences',
    'buyersOrderNo',
    'buyersOrderDate',
    'destination',
    'deliveryTerms',
  ],
};

function keysForDocType(docType) {
  return PROFILE_KEYS[docType] || META_KEYS;
}

function emptyDocumentMeta() {
  return META_KEYS.reduce((acc, k) => {
    acc[k] = '';
    return acc;
  }, {});
}

function normalizeDocumentMeta(input, docType) {
  const base = emptyDocumentMeta();
  if (!input || typeof input !== 'object') return base;
  const allowed = keysForDocType(docType);
  for (const key of allowed) {
    if (input[key] != null && String(input[key]).trim() !== '') {
      base[key] = String(input[key]).trim();
    }
  }
  return base;
}

function parseDocumentMeta(raw) {
  if (raw == null || raw === '') return emptyDocumentMeta();
  if (typeof raw === 'object') return normalizeDocumentMeta(raw);
  try {
    return normalizeDocumentMeta(JSON.parse(raw));
  } catch {
    return emptyDocumentMeta();
  }
}

function serializeDocumentMeta(input, docType) {
  const m = normalizeDocumentMeta(input, docType);
  const allowed = keysForDocType(docType);
  const hasAny = allowed.some((k) => m[k]);
  if (!hasAny) return null;
  const payload = {};
  for (const k of allowed) {
    if (m[k]) payload[k] = m[k];
  }
  return JSON.stringify(payload);
}

/**
 * Map stored meta + invoice details into standardInvoice.details for PDF templates.
 */
function applyDocumentMetaToInvoiceDetails(details, meta, context = {}) {
  const invoiceType = context.invoiceType || context.type || 'sales';
  const m = normalizeDocumentMeta(meta, invoiceType === 'purchase' ? 'purchaseInvoice' : 'salesInvoice');
  const d = { ...(details || {}) };

  return {
    ...d,
    ewayBill: m.ewayBillNo || d.ewayBill || '',
    deliveryNote: m.deliveryNote || d.deliveryNote || '',
    paymentTerms: m.paymentTerms || d.paymentTerms || '',
    reference: m.referenceNo || d.reference || '',
    referenceDate: m.referenceDate || '',
    otherReferences: m.otherReferences || d.otherReferences || d.grnNumber || '',
    grnNumber: d.grnNumber || m.otherReferences || '',
    buyersOrderNo:
      m.buyersOrderNo ||
      d.buyersOrderNo ||
      context.soNumber ||
      context.poNumber ||
      d.soNumber ||
      d.poNumber ||
      '',
    buyersOrderDate: m.buyersOrderDate || d.buyersOrderDate || '',
    dispatchDocNo: m.dispatchDocNo || d.dispatchDocNo || '',
    deliveryNoteDate: m.deliveryNoteDate || d.deliveryNoteDate || '',
    dispatchMode: m.dispatchMode || d.dispatchMode || '',
    vehicleNumber: m.vehicleNumber || d.vehicleNumber || '',
    destination: m.destination || d.destination || context.destination || '',
    deliveryTerms: m.deliveryTerms || d.deliveryTerms || '',
    soNumber: context.soNumber || d.soNumber || '',
    poNumber: context.poNumber || d.poNumber || '',
  };
}

module.exports = {
  META_KEYS,
  PROFILE_KEYS,
  emptyDocumentMeta,
  normalizeDocumentMeta,
  parseDocumentMeta,
  serializeDocumentMeta,
  applyDocumentMetaToInvoiceDetails,
};
