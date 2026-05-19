/**
 * Normalize unit-of-measure for invoices/PDFs (reject UUIDs and long IDs mistaken as unit).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeInvoiceUnit(raw, fallback = 'PCS') {
  const s = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!s) return fallback;
  if (UUID_RE.test(s)) return fallback;
  if (s.length > 14 && /^[a-z0-9-]+$/i.test(s)) return fallback;
  if (/^[0-9a-f-]{20,}$/i.test(s)) return fallback;
  return s.length > 10 ? s.slice(0, 10).toUpperCase() : s.toUpperCase();
}

module.exports = { normalizeInvoiceUnit };
