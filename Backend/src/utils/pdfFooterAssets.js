const { shouldShowPdfFooterAsset } = require('./pdfFooterOptions');

/**
 * Load stamp/signature buffers respecting per-document company settings.
 * @param {object} invoicePDFService - InvoicePDFService instance
 * @param {object|null} companySettings
 * @param {string} docType - si | pi | so | po
 */
async function loadPdfFooterAssets(invoicePDFService, companySettings, docType) {
  if (!companySettings || !invoicePDFService) {
    return { stampBuffer: null, signatureBuffer: null };
  }

  const stampUrl = companySettings.stamp_path || null;
  const signatureUrl = companySettings.signature_path || null;

  const [stampBuffer, signatureBuffer] = await Promise.all([
    shouldShowPdfFooterAsset(companySettings, docType, 'stamp') && stampUrl
      ? invoicePDFService.loadImageAsset(stampUrl)
      : null,
    shouldShowPdfFooterAsset(companySettings, docType, 'signature') && signatureUrl
      ? invoicePDFService.loadImageAsset(signatureUrl)
      : null,
  ]);

  return { stampBuffer, signatureBuffer };
}

module.exports = { loadPdfFooterAssets };
