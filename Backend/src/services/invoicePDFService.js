const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const db = require('../database/connection');
const axios = require('axios');

class InvoicePDFService {
  async downloadImage(url) {
    try {
      if (!url) return null;
      const fullUrl = url.startsWith('http') ? url : `http://localhost:5000${url}`;
      const response = await axios.get(fullUrl, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    } catch (err) {
      logger.warn('Could not download image:', url);
      return null;
    }
  }

  async generatePDFBuffer(standardInvoice, institutionId = null) {
    let companySettings = null;
    if (institutionId) {
      try {
        const [settings] = await db.query(
          'SELECT * FROM company_settings WHERE institution_id = ?',
          [institutionId]
        );
        companySettings = settings;
      } catch (err) {
        logger.warn('Could not load company settings');
      }
    }

    // Download images
    const logoUrl = companySettings?.logo_path || standardInvoice.header?.branding?.logoUrl;
    const stampUrl = companySettings?.stamp_path || standardInvoice.header?.branding?.stampUrl;
    const signatureUrl = companySettings?.signature_path || standardInvoice.header?.branding?.signatureUrl;
    
    const [logoBuffer, stampBuffer, signatureBuffer] = await Promise.all([
      this.downloadImage(logoUrl),
      this.downloadImage(stampUrl),
      this.downloadImage(signatureUrl)
    ]);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        let y = 50;

        // Header with Logo and Company Info
        if (logoBuffer) {
          doc.image(logoBuffer, 50, y, { width: 80, height: 60 });
        }
        
        const companyName = companySettings?.company_name || standardInvoice.header?.companyName || 'Company Name';
        const address = companySettings?.address || standardInvoice.header?.address?.line1 || '';
        const city = companySettings?.city || standardInvoice.header?.address?.city || '';
        const state = companySettings?.state || standardInvoice.header?.address?.state || '';
        const phone = companySettings?.phone || standardInvoice.header?.contact?.phone || '';
        const email = companySettings?.email || standardInvoice.header?.contact?.email || '';
        const taxId = companySettings?.tax_id || standardInvoice.header?.taxInfo?.taxId || '';

        doc.fontSize(18).font('Helvetica-Bold').text(companyName, 350, y, { align: 'right' });
        doc.fontSize(9).font('Helvetica').text(address, 350, y + 25, { align: 'right' });
        doc.text(`${city}, ${state}`, 350, y + 38, { align: 'right' });
        doc.text(`${phone} | ${email}`, 350, y + 51, { align: 'right' });
        if (taxId) doc.fontSize(8).text(`Tax ID: ${taxId}`, 350, y + 64, { align: 'right' });

        y = 120;
        doc.moveTo(50, y).lineTo(545, y).stroke();
        y += 15;

        // Invoice Details and Vendor Info
        doc.fontSize(14).font('Helvetica-Bold').text('PURCHASE INVOICE', 50, y);
        y += 25;
        
        doc.fontSize(9).font('Helvetica-Bold').text('Invoice #:', 50, y);
        doc.font('Helvetica').text(standardInvoice.details?.invoiceNumber || 'N/A', 120, y);
        doc.font('Helvetica-Bold').text('Vendor Details', 350, y, { align: 'right' });
        y += 15;
        
        doc.font('Helvetica-Bold').text('Date:', 50, y);
        doc.font('Helvetica').text(new Date(standardInvoice.details?.invoiceDate).toLocaleDateString(), 120, y);
        doc.font('Helvetica-Bold').text(standardInvoice.partyDetails?.name || 'N/A', 350, y, { align: 'right' });
        y += 15;
        
        doc.font('Helvetica-Bold').text('Due Date:', 50, y);
        doc.font('Helvetica').text(new Date(standardInvoice.details?.dueDate).toLocaleDateString(), 120, y);
        doc.fontSize(8).font('Helvetica').text(standardInvoice.partyDetails?.billingAddress?.line1 || '', 350, y, { align: 'right' });
        y += 12;
        doc.text(`${standardInvoice.partyDetails?.billingAddress?.city || ''}, ${standardInvoice.partyDetails?.billingAddress?.state || ''}`, 350, y, { align: 'right' });
        y += 12;
        doc.text(standardInvoice.partyDetails?.contact?.phone || '', 350, y, { align: 'right' });
        y += 25;

        // Line Items Table
        doc.fontSize(9).font('Helvetica-Bold');
        doc.rect(50, y, 495, 20).fillAndStroke('#f0f0f0', '#000');
        doc.fillColor('#000').text('#', 55, y + 6);
        doc.text('Item', 80, y + 6);
        doc.text('Qty', 320, y + 6, { width: 50, align: 'right' });
        doc.text('Rate', 380, y + 6, { width: 60, align: 'right' });
        doc.text('Amount', 450, y + 6, { width: 90, align: 'right' });
        y += 20;

        doc.font('Helvetica').fontSize(8);
        (standardInvoice.lineItems || []).forEach((item) => {
          doc.text(item.sno || '', 55, y + 4);
          doc.text(item.itemName || '', 80, y + 4, { width: 230 });
          doc.text(parseFloat(item.quantity || 0).toFixed(2), 320, y + 4, { width: 50, align: 'right' });
          doc.text(parseFloat(item.unitAmount || 0).toFixed(2), 380, y + 4, { width: 60, align: 'right' });
          doc.text(parseFloat(item.netAmount || 0).toFixed(2), 450, y + 4, { width: 90, align: 'right' });
          y += 18;
        });

        doc.moveTo(50, y).lineTo(545, y).stroke();
        y += 15;

        // Totals
        const currency = standardInvoice.details?.currency || 'USD';
        doc.fontSize(9).font('Helvetica-Bold').text('Subtotal:', 380, y, { width: 60, align: 'right' });
        doc.font('Helvetica').text(`${currency} ${parseFloat(standardInvoice.totals?.subtotal || 0).toFixed(2)}`, 450, y, { width: 90, align: 'right' });
        y += 15;
        
        doc.font('Helvetica-Bold').text('Tax:', 380, y, { width: 60, align: 'right' });
        doc.font('Helvetica').text(`${currency} ${parseFloat(standardInvoice.totals?.totalTaxAmount || 0).toFixed(2)}`, 450, y, { width: 90, align: 'right' });
        y += 15;
        
        doc.font('Helvetica-Bold').text('Discount:', 380, y, { width: 60, align: 'right' });
        doc.font('Helvetica').text(`${currency} ${parseFloat(standardInvoice.totals?.totalDiscountAmount || 0).toFixed(2)}`, 450, y, { width: 90, align: 'right' });
        y += 15;
        
        doc.fontSize(11).font('Helvetica-Bold').text('Grand Total:', 380, y, { width: 60, align: 'right' });
        doc.text(`${currency} ${parseFloat(standardInvoice.totals?.grandTotal || 0).toFixed(2)}`, 450, y, { width: 90, align: 'right' });
        y += 20;
        
        doc.fontSize(8).font('Helvetica-Oblique').text(`Amount in words: ${standardInvoice.totals?.amountInWords || ''}`, 350, y, { align: 'right' });
        y += 30;

        // Bank Details
        if (standardInvoice.partyDetails?.bankDetails?.bankName) {
          doc.fontSize(9).font('Helvetica-Bold').text('Vendor Bank Details', 50, y);
          y += 15;
          doc.fontSize(8).font('Helvetica');
          const bank = standardInvoice.partyDetails.bankDetails;
          if (bank.bankName) doc.text(`Bank: ${bank.bankName}`, 50, y), y += 12;
          if (bank.accountNumber) doc.text(`Account: ${bank.accountNumber}`, 50, y), y += 12;
          if (bank.ifscCode) doc.text(`IFSC: ${bank.ifscCode}`, 50, y), y += 12;
          y += 10;
        }

        // Footer with Stamp and Signature
        const footerY = 700;
        if (stampBuffer) {
          doc.image(stampBuffer, 50, footerY, { width: 80, height: 80 });
        }
        
        if (signatureBuffer) {
          doc.image(signatureBuffer, 400, footerY, { width: 100, height: 60 });
        }
        
        doc.fontSize(8).font('Helvetica').text('_____________________', 400, footerY + 65);
        doc.text(companySettings?.authorized_signatory_name || 'Authorized Signatory', 400, footerY + 75);
        doc.text(companySettings?.authorized_signatory_designation || '', 400, footerY + 85);

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
        url: '/temp/invoices/' + filename
      };
    } catch (error) {
      logger.error('Error saving invoice PDF:', error);
      throw error;
    }
  }
}

module.exports = new InvoicePDFService();
