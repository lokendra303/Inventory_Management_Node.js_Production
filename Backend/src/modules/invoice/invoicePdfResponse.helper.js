const invoicePDFService = require('./invoicePDF.service');

function queryFlag(val) {
  return val === 'true' || val === true || val === '1';
}

/**
 * Generate and stream invoice PDF using institution company settings (invoice_pdf_template).
 * @param {import('express').Response} res
 * @param {{ standardInvoice: object, institutionId: string, invoiceNumber: string, type: 'sales'|'purchase', attachment: boolean }} opts
 */
async function sendInvoicePdfBuffer(res, opts) {
  const { standardInvoice, institutionId, invoiceNumber, type, attachment } = opts;
  const pdfBuffer = await invoicePDFService.generatePDFBuffer(standardInvoice, institutionId);

  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error('Generated PDF buffer is empty');
  }

  const filename = invoicePDFService.generateFilename(invoiceNumber, type);
  const disposition = attachment ? 'attachment' : 'inline';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  return res.send(pdfBuffer);
}

module.exports = {
  queryFlag,
  sendInvoicePdfBuffer,
};
