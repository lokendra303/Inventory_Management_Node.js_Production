/**
 * Optional document metadata (GST grid on invoices; lighter sets on orders).
 * Stored as JSON on sales_invoices, purchase_invoices, sales_orders, purchase_orders.
 */

const META_KEYS = [
  'ewayBillNo',
  'ewayBillDate',
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
  'billOfLadingLrRrNo',
  'destination',
  'deliveryTerms',
  'validityDays',
];

function computeValidUntil(invoiceDate, validityDays) {
  const days = parseInt(validityDays, 10);
  if (!days || days < 1 || !invoiceDate) return '';
  const dt = new Date(invoiceDate);
  if (Number.isNaN(dt.getTime())) return '';
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().split('T')[0];
}

/** Keys persisted per document type (others stripped on save). */
const PROFILE_KEYS = {
  salesInvoice: META_KEYS.filter((k) => k !== 'validityDays'),
  proformaInvoice: [
    'paymentTerms',
    'referenceNo',
    'referenceDate',
    'otherReferences',
    'buyersOrderNo',
    'buyersOrderDate',
    'destination',
    'deliveryTerms',
    'validityDays',
  ],
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
    'ewayBillDate',
    'vehicleNumber',
    'billOfLadingLrRrNo',
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
function resolveDocumentMetaProfile(context = {}) {
  const invoiceType = context.invoiceType || context.type || 'sales';
  if (invoiceType === 'purchase') return 'purchaseInvoice';
  if (invoiceType === 'proforma' || context.documentKind === 'proforma') return 'proformaInvoice';
  return 'salesInvoice';
}

function applyDocumentMetaToInvoiceDetails(details, meta, context = {}) {
  const profile = resolveDocumentMetaProfile(context);
  const m = normalizeDocumentMeta(meta, profile);
  const d = { ...(details || {}) };
  const validUntil = computeValidUntil(d.invoiceDate || context.invoiceDate, m.validityDays);

  return {
    ...d,
    validityDays: m.validityDays || '',
    validUntil,
    ewayBill: m.ewayBillNo || d.ewayBill || '',
    ewayBillDate: m.ewayBillDate || d.ewayBillDate || '',
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
    billOfLadingLrRrNo: m.billOfLadingLrRrNo || d.billOfLadingLrRrNo || '',
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
  resolveDocumentMetaProfile,
  computeValidUntil,
};
