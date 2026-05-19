/**
 * Per-document PDF footer assets (stamp / signature) — company settings.
 * Keys: si, pi, so, po. Default: show both on all document types.
 */

const DOC_TYPES = ['si', 'pi', 'so', 'po'];

const DEFAULT_PDF_FOOTER_OPTIONS = Object.freeze({
  si: { stamp: true, signature: true },
  pi: { stamp: true, signature: true },
  so: { stamp: true, signature: true },
  po: { stamp: true, signature: true },
});

function normalizeDocType(docType) {
  const key = String(docType || 'si').toLowerCase().trim();
  if (key === 'sales' || key === 'sales_invoice') return 'si';
  if (key === 'purchase' || key === 'purchase_invoice') return 'pi';
  if (key === 'sales_order') return 'so';
  if (key === 'purchase_order') return 'po';
  return DOC_TYPES.includes(key) ? key : 'si';
}

function parsePdfFooterOptions(raw) {
  if (!raw) return { ...DEFAULT_PDF_FOOTER_OPTIONS };
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ...DEFAULT_PDF_FOOTER_OPTIONS };
    }
  }
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PDF_FOOTER_OPTIONS };

  const out = {};
  for (const doc of DOC_TYPES) {
    const row = parsed[doc] || {};
    out[doc] = {
      stamp: row.stamp !== false,
      signature: row.signature !== false,
    };
  }
  return out;
}

/** Merge API/form payload into stored shape. */
function normalizePdfFooterOptionsInput(input) {
  if (!input || typeof input !== 'object') return parsePdfFooterOptions(null);
  const out = {};
  for (const doc of DOC_TYPES) {
    const row = input[doc] || {};
    out[doc] = {
      stamp: row.stamp !== false,
      signature: row.signature !== false,
    };
  }
  return out;
}

function shouldShowPdfFooterAsset(companySettings, docType, asset) {
  const key = normalizeDocType(docType);
  const opts = parsePdfFooterOptions(companySettings?.pdf_footer_options);
  const row = opts[key] || DEFAULT_PDF_FOOTER_OPTIONS[key];
  if (asset === 'stamp') return row.stamp !== false;
  if (asset === 'signature') return row.signature !== false;
  return true;
}

module.exports = {
  DOC_TYPES,
  DEFAULT_PDF_FOOTER_OPTIONS,
  parsePdfFooterOptions,
  normalizePdfFooterOptionsInput,
  normalizeDocType,
  shouldShowPdfFooterAsset,
};
