const PDFDocument = require('pdfkit');
const logger = require('../../utils/logger');
const db = require('../../database/connection');
const { renderOzonePurchaseOrder } = require('./purchaseOrderPdfOzone');
const invoicePDFService = require('./invoicePDF.service');

class PurchaseOrderPDFService {
  async _loadVendorDetails(institutionId, poData) {
    if (!poData.vendor_id) return null;
    try {
      const [vendor] = await db.query(
        'SELECT * FROM vendors WHERE institution_id = ? AND id = ?',
        [institutionId, poData.vendor_id]
      );
      if (!vendor) return null;

      const addresses = await db.query(
        'SELECT * FROM addresses WHERE entity_type = ? AND entity_id = ?',
        ['vendor', poData.vendor_id]
      );

      addresses.forEach((addr) => {
        const prefix = addr.address_type;
        vendor[`${prefix}_attention`] = addr.attention;
        vendor[`${prefix}_country`] = addr.country;
        vendor[`${prefix}_address1`] = addr.address1;
        vendor[`${prefix}_address2`] = addr.address2;
        vendor[`${prefix}_city`] = addr.city;
        vendor[`${prefix}_state`] = addr.state;
        vendor[`${prefix}_pin_code`] = addr.pin_code;
      });

      return vendor;
    } catch (err) {
      logger.warn('Could not load vendor details for PO PDF', { error: err.message });
      return null;
    }
  }

  async generatePDFBuffer(poData, institutionId = null) {
    let company = null;
    let vendorDetails = null;
    let logoBuffer = null;

    if (institutionId) {
      company = await invoicePDFService.loadCompanyProfileForPdf(institutionId);
      try {
        const [inst] = await db.query(
          'SELECT registration_number, tax_id FROM institutions WHERE id = ? LIMIT 1',
          [institutionId]
        );
        if (inst && company) {
          company.registration_number =
            inst.registration_number || company.registration_number || null;
          if (!company.tax_id && inst.tax_id) company.tax_id = inst.tax_id;
        }
      } catch (err) {
        logger.warn('Could not load institution registration for PO PDF');
      }

      if (company?.logo_path) {
        try {
          logoBuffer = await invoicePDFService.loadImageAsset(company.logo_path);
        } catch {
          logoBuffer = null;
        }
      }

      vendorDetails = await this._loadVendorDetails(institutionId, poData);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 18, size: 'A4', bufferPages: true });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        if (logoBuffer) {
          doc.image(logoBuffer, 18, 14, { width: 56, height: 40 });
        }

        renderOzonePurchaseOrder(doc, {
          poData,
          company: company || {},
          vendorDetails,
          logoBuffer,
          generalTerms: company?.po_general_terms || null,
        });

        doc.end();
      } catch (error) {
        logger.error('PO PDF generation error:', error);
        reject(error);
      }
    });
  }
}

module.exports = new PurchaseOrderPDFService();
