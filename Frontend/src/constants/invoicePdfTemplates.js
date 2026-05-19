/** Keep in sync with Backend/src/modules/invoice/invoicePdfTemplate.constants.js */
export const INVOICE_PDF_TEMPLATES = [
  {
    id: 'branded',
    name: 'Branded professional',
    description: 'Blue/gray INVOICE banner, split table header, payment info footer.',
  },
  {
    id: 'classic',
    name: 'Classic bordered',
    description: 'Logo and company on opposite sides, full grid line items.',
  },
  {
    id: 'minimal',
    name: 'Minimal clean',
    description: 'Stacked header, light table borders, more whitespace.',
  },
  {
    id: 'modern',
    name: 'Modern band',
    description: 'Colored top band, boxed metadata, softer table styling.',
  },
];
