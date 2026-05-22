/**
 * Optional document metadata — field keys shared with Backend/src/utils/documentMeta.js.
 * Each doc type shows only relevant fields with appropriate labels.
 */

const FIELD = {
  ewayBillNo: { key: 'ewayBillNo', span: 12 },
  deliveryNote: { key: 'deliveryNote', span: 12 },
  paymentTerms: { key: 'paymentTerms', span: 12 },
  referenceNo: { key: 'referenceNo', span: 8 },
  referenceDate: { key: 'referenceDate', span: 8, date: true },
  otherReferences: { key: 'otherReferences', span: 8 },
  buyersOrderNo: { key: 'buyersOrderNo', span: 12 },
  buyersOrderDate: { key: 'buyersOrderDate', span: 12, date: true },
  dispatchDocNo: { key: 'dispatchDocNo', span: 12 },
  deliveryNoteDate: { key: 'deliveryNoteDate', span: 12, date: true },
  dispatchMode: { key: 'dispatchMode', span: 12 },
  vehicleNumber: { key: 'vehicleNumber', span: 12 },
  destination: { key: 'destination', span: 12 },
  deliveryTerms: { key: 'deliveryTerms', span: 24, textarea: true },
};

/** @type {Record<string, { panelLabel: string, fields: Array<object> }>} */
export const DOCUMENT_META_PROFILES = {
  salesInvoice: {
    panelLabel: 'Invoice / dispatch details (optional)',
    fields: [
      { ...FIELD.ewayBillNo, label: 'e-Way Bill No.' },
      { ...FIELD.deliveryNote, label: 'Delivery Note' },
      { ...FIELD.paymentTerms, label: 'Mode/Terms of Payment' },
      { ...FIELD.referenceNo, label: 'Reference No.' },
      { ...FIELD.referenceDate, label: 'Reference Date' },
      { ...FIELD.otherReferences, label: 'Other References' },
      { ...FIELD.buyersOrderNo, label: "Buyer's Order No." },
      { ...FIELD.buyersOrderDate, label: "Buyer's Order Date" },
      { ...FIELD.dispatchDocNo, label: 'Dispatch Doc No.' },
      { ...FIELD.deliveryNoteDate, label: 'Delivery Note Date' },
      { ...FIELD.dispatchMode, label: 'Dispatched through' },
      { ...FIELD.vehicleNumber, label: 'Vehicle No.' },
      { ...FIELD.destination, label: 'Destination' },
      { ...FIELD.deliveryTerms, label: 'Terms of Delivery' },
    ],
  },
  purchaseInvoice: {
    panelLabel: 'Supplier / receipt details (optional)',
    fields: [
      { ...FIELD.paymentTerms, label: 'Mode/Terms of Payment' },
      { ...FIELD.referenceNo, label: 'Supplier invoice no.' },
      { ...FIELD.referenceDate, label: 'Supplier invoice date' },
      { ...FIELD.otherReferences, label: 'GRN / gate pass / other ref' },
      { ...FIELD.buyersOrderNo, label: 'Vendor order / quote ref' },
      { ...FIELD.buyersOrderDate, label: 'Vendor ref date' },
      { ...FIELD.deliveryNote, label: 'Delivery challan no.' },
      { ...FIELD.deliveryNoteDate, label: 'Challan date' },
      { ...FIELD.ewayBillNo, label: 'e-Way Bill No.' },
      { ...FIELD.vehicleNumber, label: 'Vehicle No.' },
      { ...FIELD.destination, label: 'Receipt / ship-to location' },
      { ...FIELD.deliveryTerms, label: 'Terms of delivery' },
    ],
  },
  salesOrder: {
    panelLabel: 'Order & delivery details (optional)',
    fields: [
      { ...FIELD.paymentTerms, label: 'Payment terms' },
      { ...FIELD.referenceNo, label: 'Your reference no.' },
      { ...FIELD.referenceDate, label: 'Reference date' },
      { ...FIELD.buyersOrderNo, label: 'Customer PO no.' },
      { ...FIELD.buyersOrderDate, label: 'Customer PO date' },
      { ...FIELD.otherReferences, label: 'Other references' },
      { ...FIELD.dispatchMode, label: 'Shipping / carrier' },
      { ...FIELD.destination, label: 'Ship-to / destination' },
      { ...FIELD.deliveryTerms, label: 'Delivery terms' },
    ],
  },
  purchaseOrder: {
    panelLabel: 'Purchase & delivery terms (optional)',
    fields: [
      { ...FIELD.paymentTerms, label: 'Payment terms' },
      { ...FIELD.referenceNo, label: 'Vendor quote no.' },
      { ...FIELD.referenceDate, label: 'Quote date' },
      { ...FIELD.buyersOrderNo, label: 'Vendor reference no.' },
      { ...FIELD.buyersOrderDate, label: 'Vendor ref date' },
      { ...FIELD.otherReferences, label: 'Other references' },
      { ...FIELD.destination, label: 'Ship-to / delivery location' },
      { ...FIELD.deliveryTerms, label: 'Delivery terms' },
    ],
  },
};

export const DOCUMENT_META_DOC_TYPES = Object.keys(DOCUMENT_META_PROFILES);

/** All keys used anywhere (for parsing stored JSON). */
export const ALL_DOCUMENT_META_KEYS = [
  ...new Set(
    Object.values(DOCUMENT_META_PROFILES).flatMap((p) => p.fields.map((f) => f.key))
  ),
];

export function getDocumentMetaProfile(docType) {
  return DOCUMENT_META_PROFILES[docType] || DOCUMENT_META_PROFILES.salesInvoice;
}

export function getProfileFieldKeys(docType) {
  return getDocumentMetaProfile(docType).fields.map((f) => f.key);
}

export const emptyDocumentMetaForm = (docType = 'salesInvoice') => {
  const keys = getProfileFieldKeys(docType);
  return keys.reduce((acc, k) => {
    acc[k] = '';
    return acc;
  }, {});
};

export function parseDocumentMetaFromApi(raw, docType) {
  const keys = ALL_DOCUMENT_META_KEYS;
  const base = keys.reduce((acc, k) => {
    acc[k] = '';
    return acc;
  }, {});
  if (!raw) return base;
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return base;
    }
  }
  if (typeof obj !== 'object') return base;
  keys.forEach((k) => {
    if (obj[k] != null) base[k] = obj[k];
  });
  return base;
}

export function documentMetaToFormValues(raw, dateLib, docType) {
  const parsed = parseDocumentMetaFromApi(raw, docType);
  const profile = getDocumentMetaProfile(docType);
  if (!dateLib) return parsed;
  profile.fields.forEach((f) => {
    if (f.date && parsed[f.key]) {
      parsed[f.key] = dateLib(parsed[f.key]);
    }
  });
  return parsed;
}

export function formatDocumentMetaForApi(documentMeta, dateLib, docType = 'salesInvoice') {
  if (!documentMeta || typeof documentMeta !== 'object') return undefined;
  const profile = getDocumentMetaProfile(docType);
  const out = {};
  profile.fields.forEach((f) => {
    const v = documentMeta[f.key];
    if (v == null || v === '') return;
    if (f.date && v?.format) {
      out[f.key] = v.format('YYYY-MM-DD');
    } else {
      out[f.key] = String(v).trim();
    }
  });
  return Object.keys(out).length ? out : undefined;
}
