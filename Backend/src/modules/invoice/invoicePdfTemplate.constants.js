/**
 * Invoice PDF layout keys stored on institution_profiles.invoice_pdf_template
 */
const INVOICE_PDF_TEMPLATES = [
  {
    id: 'classic',
    name: 'Classic bordered',
    description: 'Logo and company on opposite sides, full grid line items, traditional look.',
  },
  {
    id: 'minimal',
    name: 'Minimal clean',
    description: 'Single-column header, open table with light rules, more whitespace.',
  },
  {
    id: 'modern',
    name: 'Modern band',
    description: 'Colored title band, bold invoice type, structured two-column meta block.',
  },
];

const ALLOWED = new Set(INVOICE_PDF_TEMPLATES.map((t) => t.id));
const DEFAULT_INVOICE_PDF_TEMPLATE = 'classic';

function normalizeInvoicePdfTemplate(value) {
  const k = String(value || DEFAULT_INVOICE_PDF_TEMPLATE)
    .toLowerCase()
    .trim();
  return ALLOWED.has(k) ? k : DEFAULT_INVOICE_PDF_TEMPLATE;
}

module.exports = {
  INVOICE_PDF_TEMPLATES,
  DEFAULT_INVOICE_PDF_TEMPLATE,
  normalizeInvoicePdfTemplate,
};
