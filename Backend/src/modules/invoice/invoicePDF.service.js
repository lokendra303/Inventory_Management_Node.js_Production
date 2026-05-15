const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');
const db = require('../../database/connection');
const axios = require('axios');
const { resolvePublicBaseUrl } = require('../../config');
const { normalizeInvoicePdfTemplate } = require('./invoicePdfTemplate.constants');
const {
  formatShortDate,
  drawInvoiceLineItems,
  drawTotalsBlock,
  drawPartyBankBox,
  drawStampSignature,
} = require('./invoicePdfDrawShared');

class InvoicePDFService {
  /** Sample payload for template preview (company branding still loaded from DB). */
  getSampleStandardInvoice() {
    const today = new Date().toISOString().split('T')[0];
    const due = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    return {
      header: {},
      details: {
        type: 'sales',
        invoiceNumber: 'PREVIEW-001',
        invoiceDate: today,
        dueDate: due,
        currency: 'USD',
      },
      partyDetails: {
        name: 'Sample Customer Ltd.',
        billingAddress: {
          line1: '221B Sample Street, Business Park',
          city: 'Mumbai',
          state: 'MH',
        },
        contact: { phone: '+91 90000 00000' },
        bankDetails: {
          bankName: 'Sample National Bank',
          branchName: 'Main Branch',
          accountNumber: '0123456789',
          ifscCode: 'SAMP0001234',
        },
      },
      lineItems: [
        { sno: 1, itemName: 'Demo Product A', hsn_code: '8471', quantity: 2, unitAmount: 150, netAmount: 300 },
        { sno: 2, itemName: 'Demo Service B', hsn_code: '9983', quantity: 1, unitAmount: 50, netAmount: 50 },
      ],
      totals: {
        subtotal: 350,
        totalTaxAmount: 63,
        totalDiscountAmount: 0,
        grandTotal: 413,
        amountInWords: 'Four hundred thirteen only',
      },
    };
  }

  async downloadImage(url) {
    try {
      if (!url) return null;
      const fullUrl = url.startsWith('http') ? url : `${resolvePublicBaseUrl()}${url}`;
      const response = await axios.get(fullUrl, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    } catch (err) {
      logger.warn('Could not download image:', url);
      return null;
    }
  }

  _resolveCompanyStrings(standardInvoice, companySettings) {
    return {
      companyName: companySettings?.company_name || standardInvoice.header?.companyName || 'Company Name',
      address: companySettings?.address || standardInvoice.header?.address?.line1 || '',
      city: companySettings?.city || standardInvoice.header?.address?.city || '',
      state: companySettings?.state || standardInvoice.header?.address?.state || '',
      phone: companySettings?.phone || standardInvoice.header?.contact?.phone || '',
      email: companySettings?.email || standardInvoice.header?.contact?.email || '',
      taxId: companySettings?.tax_id || standardInvoice.header?.taxInfo?.taxId || '',
    };
  }

  _tailSection(doc, y, standardInvoice, companySettings, stampBuffer, signatureBuffer, pageNumber) {
    let yn = drawTotalsBlock(doc, y, standardInvoice);
    doc.fontSize(9).font('Helvetica').text(`Page ${pageNumber}`, 500, 780);
    yn = drawPartyBankBox(doc, yn, standardInvoice);
    drawStampSignature(doc, yn + 20, companySettings, stampBuffer, signatureBuffer);
  }

  _renderClassic(doc, ctx) {
    const { standardInvoice, companySettings, logoBuffer, stampBuffer, signatureBuffer } = ctx;
    const cs = this._resolveCompanyStrings(standardInvoice, companySettings);
    let y = 30;

    if (logoBuffer) {
      doc.image(logoBuffer, 50, y, { width: 80, height: 50 });
    }

    doc.fontSize(18).font('Helvetica-Bold').text(cs.companyName, 350, y, { align: 'right' });
    doc.fontSize(9).font('Helvetica').text(cs.address, 350, y + 25, { align: 'right' });
    doc.text(`${cs.city}, ${cs.state}`, 350, y + 38, { align: 'right' });
    doc.text(`${cs.phone} | ${cs.email}`, 350, y + 51, { align: 'right' });
    if (cs.taxId) doc.fontSize(8).text(`Tax ID: ${cs.taxId}`, 350, y + 64, { align: 'right' });

    y = 100;
    doc.moveTo(50, 100).lineTo(545, 100).stroke();
    y += 15;

    const invoiceType = standardInvoice.details?.type === 'sales' ? 'SALES INVOICE' : 'PURCHASE INVOICE';
    doc.fontSize(18).font('Helvetica-Bold').text(invoiceType, 50, y);
    y += 30;

    const detailsStartY = y;
    doc.fontSize(10).font('Helvetica-Bold').text('Invoice #:', 50, y);
    doc.font('Helvetica').text(standardInvoice.details?.invoiceNumber || 'N/A', 150, y);
    y += 20;

    doc.font('Helvetica-Bold').text('Invoice Date:', 50, y);
    doc.font('Helvetica').text(formatShortDate(standardInvoice.details?.invoiceDate), 150, y);
    y += 20;

    doc.font('Helvetica-Bold').text('Due Date:', 50, y);
    doc.font('Helvetica').text(formatShortDate(standardInvoice.details?.dueDate), 150, y);
    y += 20;

    doc.font('Helvetica-Bold').text('Currency:', 50, y);
    doc.font('Helvetica').text(standardInvoice.details?.currency || 'USD', 150, y);

    let partyY = detailsStartY;
    const partyLabel = standardInvoice.details?.type === 'sales' ? 'Customer Details' : 'Vendor Details';
    doc.fontSize(12).font('Helvetica-Bold').text(partyLabel, 320, partyY);
    partyY += 20;

    const partyName = standardInvoice.partyDetails?.name || 'N/A';
    doc.fontSize(10).font('Helvetica-Bold').text(partyName, 320, partyY, { width: 225 });
    partyY += doc.heightOfString(partyName, { width: 225 }) + 3;

    if (standardInvoice.partyDetails?.billingAddress?.line1) {
      doc.fontSize(9).font('Helvetica').text(standardInvoice.partyDetails.billingAddress.line1, 320, partyY, { width: 225 });
      partyY += doc.heightOfString(standardInvoice.partyDetails.billingAddress.line1, { width: 225 }) + 3;

      const cityState = `${standardInvoice.partyDetails.billingAddress.city || ''}, ${standardInvoice.partyDetails.billingAddress.state || ''}`;
      doc.text(cityState, 320, partyY, { width: 225 });
      partyY += doc.heightOfString(cityState, { width: 225 }) + 3;
    }

    if (standardInvoice.partyDetails?.contact?.phone) {
      const phoneText = `Phone: ${standardInvoice.partyDetails.contact.phone}`;
      doc.text(phoneText, 320, partyY, { width: 225 });
      partyY += doc.heightOfString(phoneText, { width: 225 }) + 3;
    }

    y = Math.max(y + 20, partyY) + 10;

    const { y: y2, pageNumber } = drawInvoiceLineItems(doc, y, standardInvoice, {
      variant: 'classic',
      invoiceNumber: standardInvoice.details?.invoiceNumber || 'N/A',
    });
    this._tailSection(doc, y2, standardInvoice, companySettings, stampBuffer, signatureBuffer, pageNumber);
  }

  _renderMinimal(doc, ctx) {
    const { standardInvoice, companySettings, logoBuffer, stampBuffer, signatureBuffer } = ctx;
    const cs = this._resolveCompanyStrings(standardInvoice, companySettings);
    let y = 36;

    if (logoBuffer) {
      doc.image(logoBuffer, 50, y, { width: 72, height: 46 });
    }

    const textLeft = logoBuffer ? 135 : 50;
    doc.fontSize(17).font('Helvetica-Bold').text(cs.companyName, textLeft, y, { width: 400 });
    y += 22;
    doc.fontSize(9).font('Helvetica').text(cs.address, textLeft, y, { width: 400 });
    y += 12;
    doc.text(`${cs.city}, ${cs.state}  |  ${cs.phone}  |  ${cs.email}`, textLeft, y, { width: 400 });
    if (cs.taxId) {
      y += 12;
      doc.fontSize(8).text(`Tax ID: ${cs.taxId}`, textLeft, y);
    }

    y = Math.max(y + 14, 90);
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#cccccc').lineWidth(0.8).stroke();
    y += 18;

    const invoiceType = standardInvoice.details?.type === 'sales' ? 'Sales invoice' : 'Purchase invoice';
    doc.fontSize(15).font('Helvetica-Bold').fillColor('#333').text(invoiceType, 50, y);
    y += 28;

    doc.fontSize(9).font('Helvetica-Bold').text('Invoice #', 50, y);
    doc.font('Helvetica').text(standardInvoice.details?.invoiceNumber || 'N/A', 120, y);
    doc.font('Helvetica-Bold').text('Date', 280, y);
    doc.font('Helvetica').text(formatShortDate(standardInvoice.details?.invoiceDate), 320, y);
    doc.font('Helvetica-Bold').text('Due', 420, y);
    doc.font('Helvetica').text(formatShortDate(standardInvoice.details?.dueDate), 455, y);
    y += 22;
    doc.font('Helvetica-Bold').text('Currency', 50, y);
    doc.font('Helvetica').text(standardInvoice.details?.currency || 'USD', 120, y);

    y += 28;
    doc.fontSize(10).font('Helvetica-Bold').text('Bill to', 50, y);
    y += 14;
    doc.font('Helvetica-Bold').text(standardInvoice.partyDetails?.name || 'N/A', 50, y, { width: 480 });
    y += 14;
    if (standardInvoice.partyDetails?.billingAddress?.line1) {
      doc.font('Helvetica').text(standardInvoice.partyDetails.billingAddress.line1, 50, y, { width: 480 });
      y += 12;
      const cityState = `${standardInvoice.partyDetails.billingAddress.city || ''}, ${standardInvoice.partyDetails.billingAddress.state || ''}`;
      doc.text(cityState, 50, y, { width: 480 });
      y += 12;
    }
    if (standardInvoice.partyDetails?.contact?.phone) {
      doc.text(`Phone: ${standardInvoice.partyDetails.contact.phone}`, 50, y, { width: 480 });
      y += 14;
    }
    y += 8;

    const { y: y2, pageNumber } = drawInvoiceLineItems(doc, y, standardInvoice, {
      variant: 'minimal',
      invoiceNumber: standardInvoice.details?.invoiceNumber || 'N/A',
    });
    this._tailSection(doc, y2, standardInvoice, companySettings, stampBuffer, signatureBuffer, pageNumber);
  }

  _renderModern(doc, ctx) {
    const { standardInvoice, companySettings, logoBuffer, stampBuffer, signatureBuffer } = ctx;
    const cs = this._resolveCompanyStrings(standardInvoice, companySettings);
    const invoiceType = standardInvoice.details?.type === 'sales' ? 'SALES INVOICE' : 'PURCHASE INVOICE';

    doc.rect(0, 0, 596, 78).fill('#1e3a5f');
    doc.fillColor('#ffffff');
    if (logoBuffer) {
      doc.image(logoBuffer, 50, 18, { width: 64, height: 42 });
    }
    doc.fontSize(11).font('Helvetica-Bold').text(cs.companyName, logoBuffer ? 130 : 50, 22, { width: 320 });
    doc.fontSize(8).font('Helvetica').text(`${cs.phone}  ·  ${cs.email}`, logoBuffer ? 130 : 50, 44, { width: 320 });
    doc.fontSize(14).font('Helvetica-Bold').text(invoiceType, 350, 28, { width: 195, align: 'right' });
    doc.fillColor('#000000');

    let y = 95;
    doc.rect(48, y, 449, 72).stroke('#cbd5e1');
    doc.fontSize(9).font('Helvetica-Bold').text('Invoice #', 58, y + 12);
    doc.font('Helvetica').text(standardInvoice.details?.invoiceNumber || 'N/A', 130, y + 12);
    doc.font('Helvetica-Bold').text('Invoice date', 58, y + 32);
    doc.font('Helvetica').text(formatShortDate(standardInvoice.details?.invoiceDate), 130, y + 32);
    doc.font('Helvetica-Bold').text('Due date', 58, y + 52);
    doc.font('Helvetica').text(formatShortDate(standardInvoice.details?.dueDate), 130, y + 52);

    doc.font('Helvetica-Bold').text('Currency', 300, y + 12);
    doc.font('Helvetica').text(standardInvoice.details?.currency || 'USD', 370, y + 12);
    const partyLabel = standardInvoice.details?.type === 'sales' ? 'Customer' : 'Vendor';
    doc.font('Helvetica-Bold').text(partyLabel, 300, y + 32);
    doc.font('Helvetica').text(standardInvoice.partyDetails?.name || 'N/A', 300, y + 46, { width: 190 });

    y += 88;
    const { y: y2, pageNumber } = drawInvoiceLineItems(doc, y, standardInvoice, {
      variant: 'modern',
      invoiceNumber: standardInvoice.details?.invoiceNumber || 'N/A',
    });
    this._tailSection(doc, y2, standardInvoice, companySettings, stampBuffer, signatureBuffer, pageNumber);
  }

  async generatePDFBuffer(standardInvoice, institutionId = null, options = {}) {
    let companySettings = null;
    if (institutionId) {
      try {
        const [settings] = await db.query(
          `SELECT ip.*,
                  i.city,
                  i.state,
                  i.tax_id
             FROM institution_profiles ip
             LEFT JOIN institutions i ON i.id = ip.institution_id
            WHERE ip.institution_id = ?
            LIMIT 1`,
          [institutionId]
        );
        companySettings = settings;
      } catch (err) {
        logger.warn('Could not load company settings');
      }
    }

    const templateKey =
      options.template != null
        ? normalizeInvoicePdfTemplate(options.template)
        : normalizeInvoicePdfTemplate(companySettings?.invoice_pdf_template);

    const logoUrl = companySettings?.logo_path || standardInvoice.header?.branding?.logoUrl;
    const stampUrl = companySettings?.stamp_path || standardInvoice.header?.branding?.stampUrl;
    const signatureUrl = companySettings?.signature_path || standardInvoice.header?.branding?.signatureUrl;

    const [logoBuffer, stampBuffer, signatureBuffer] = await Promise.all([
      this.downloadImage(logoUrl),
      this.downloadImage(stampUrl),
      this.downloadImage(signatureUrl),
    ]);

    const ctx = {
      standardInvoice,
      companySettings,
      logoBuffer,
      stampBuffer,
      signatureBuffer,
    };

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 15, size: 'A4' });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        if (templateKey === 'minimal') {
          this._renderMinimal(doc, ctx);
        } else if (templateKey === 'modern') {
          this._renderModern(doc, ctx);
        } else {
          this._renderClassic(doc, ctx);
        }
        doc.end();
      } catch (error) {
        logger.error('PDF generation error:', error);
        reject(error);
      }
    });
  }

  generateFilename(invoiceNumber, type = 'purchase') {
    const prefix = type === 'purchase' ? 'PI' : 'SI';
    const timestamp = new Date().toISOString().split('T')[0];
    return prefix + '_' + invoiceNumber + '_' + timestamp + '.pdf';
  }

  async saveInvoicePDF(standardInvoice, invoiceNumber, type = 'purchase', institutionId = null) {
    try {
      const filename = this.generateFilename(invoiceNumber, type);
      const outputDir = path.join(__dirname, '../../temp/invoices');

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const buffer = await this.generatePDFBuffer(standardInvoice, institutionId);
      const outputPath = path.join(outputDir, filename);
      fs.writeFileSync(outputPath, buffer);

      return {
        filename,
        path: outputPath,
        url: '/temp/invoices/' + filename,
      };
    } catch (error) {
      logger.error('Error saving invoice PDF:', error);
      throw error;
    }
  }
}

module.exports = new InvoicePDFService();
