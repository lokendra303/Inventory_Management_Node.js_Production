/**
 * Invoice PDF layout keys stored on institution_profiles.invoice_pdf_template
 */
const INVOICE_PDF_TEMPLATES = [
  {
    id: 'branded',
    name: 'Branded professional',
    description: 'Blue & gray parallelogram INVOICE title, split table header, payment info footer.',
  },
  {
    id: 'classic',
    name: 'Classic bordered',
    description:
      'Logo and company header, Tally-style meta grid (e-Way Bill, delivery, dispatch), bill/ship, bordered line items.',
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
  {
    id: 'proforma',
    name: 'GST grid (Tally style)',
    description:
      'Dense bordered layout: seller & invoice meta grid, consignee/buyer, HSN line items, IGST summary, bank & signatures.',
  },
];

const ALLOWED = new Set(INVOICE_PDF_TEMPLATES.map((t) => t.id));
const DEFAULT_INVOICE_PDF_TEMPLATE = 'branded';

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
