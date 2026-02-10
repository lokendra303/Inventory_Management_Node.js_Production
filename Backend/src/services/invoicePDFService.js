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
      const doc = new PDFDocument({ margin: 15, size: 'A4' });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        let y = 30;

        // Header with Logo and Company Info
        if (logoBuffer) {
          doc.image(logoBuffer, 50, y, { width: 80, height: 50 });
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

        y = 100;
        doc.moveTo(50, 100).lineTo(545, 100).stroke();
        y += 15;

        // Invoice Details and Vendor Info
        doc.fontSize(12).font('Helvetica-Bold').text('PURCHASE INVOICE', 50, y);
        y += 25;
        
        // Vendor Details - Left Side
        doc.fontSize(9).font('Helvetica-Bold').text('Vendor Details', 50, y);
        doc.font('Helvetica-Bold').text('Invoice #:', 350, y);
        doc.font('Helvetica').text(standardInvoice.details?.invoiceNumber || 'N/A', 420, y);
        y += 15;
        
        doc.font('Helvetica-Bold').text(standardInvoice.partyDetails?.name || 'N/A', 50, y);
        doc.font('Helvetica-Bold').text('Date:', 350, y);
        doc.font('Helvetica').text(new Date(standardInvoice.details?.invoiceDate).toLocaleDateString(), 420, y);
        y += 15;
        
        doc.fontSize(8).font('Helvetica').text(standardInvoice.partyDetails?.billingAddress?.line1 || '', 50, y);
        doc.fontSize(9).font('Helvetica-Bold').text('Due Date:', 350, y);
        doc.font('Helvetica').text(new Date(standardInvoice.details?.dueDate).toLocaleDateString(), 420, y);
        y += 12;
        
        doc.fontSize(8).text(`${standardInvoice.partyDetails?.billingAddress?.city || ''}, ${standardInvoice.partyDetails?.billingAddress?.state || ''}`, 50, y);
        y += 12;
        doc.text(standardInvoice.partyDetails?.contact?.phone || '', 50, y);
        y += 25;

        // Line Items Table with borders
        const col1 = 50;
        const col2 = 80;
        const col3 = 320;
        const col4 = 380;
        const col5 = 450;
        
        // Dynamic sizing based on number of items
        const itemCount = (standardInvoice.lineItems || []).length;
        const rowHeight = itemCount > 30 ? 14 : itemCount > 20 ? 16 : 18;
        const fontSize = itemCount > 30 ? 7 : itemCount > 20 ? 7.5 : 8;
        const headerFontSize = itemCount > 30 ? 8 : 9;
        
        // Helper function to draw table header
        const drawTableHeader = (yPos) => {
          doc.fontSize(headerFontSize).font('Helvetica-Bold');
          doc.rect(col1, yPos, 495, 20).fillAndStroke('#f0f0f0', '#000');
          doc.fillColor('#000').text('#', col1 + 5, yPos + 6);
          doc.text('Item', col2, yPos + 6);
          doc.text('Qty', col3, yPos + 6, { width: 50, align: 'right' });
          doc.text('Rate', col4, yPos + 6, { width: 60, align: 'right' });
          doc.text('Amount', col5, yPos + 6, { width: 90, align: 'right' });
          return yPos + 20;
        };
        
        // Table Header
        y = drawTableHeader(y);

        // Table Rows with borders and pagination
        doc.font('Helvetica').fontSize(fontSize);
        (standardInvoice.lineItems || []).forEach((item, index) => {
          // Check if we need a new page (leave 150px for totals and footer)
          if (y > 680) {
            doc.addPage();
            y = 50;
            y = drawTableHeader(y);
            doc.font('Helvetica').fontSize(fontSize);
          }
          
          const rowY = y;
          
          // Draw cell borders
          doc.rect(col1, rowY, 30, rowHeight).stroke();
          doc.rect(col2, rowY, 240, rowHeight).stroke();
          doc.rect(col3, rowY, 60, rowHeight).stroke();
          doc.rect(col4, rowY, 70, rowHeight).stroke();
          doc.rect(col5, rowY, 95, rowHeight).stroke();
          
          // Cell content with truncation for long names
          const itemName = (item.itemName || '').length > 45 
            ? (item.itemName || '').substring(0, 42) + '...' 
            : (item.itemName || '');
          
          doc.text(item.sno || '', col1 + 5, rowY + 4);
          doc.text(itemName, col2 + 5, rowY + 4, { width: 230 });
          doc.text(parseFloat(item.quantity || 0).toFixed(2), col3, rowY + 4, { width: 50, align: 'right' });
          doc.text(parseFloat(item.unitAmount || 0).toFixed(2), col4, rowY + 4, { width: 60, align: 'right' });
          doc.text(parseFloat(item.netAmount || 0).toFixed(2), col5, rowY + 4, { width: 90, align: 'right' });
          y += rowHeight;
        });

        y += 10;

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

        // Bank Details with shadow box
        if (standardInvoice.partyDetails?.bankDetails?.bankName || standardInvoice.partyDetails?.bankDetails?.accountNumber) {
          y += 10;
          
          // Shadow effect
          doc.rect(52, y + 2, 491, 95).fillAndStroke('#e0e0e0', '#e0e0e0');
          
          // Main box with border
          doc.rect(50, y, 491, 95).fillAndStroke('#f9f9f9', '#ddd');
          
          y += 15;
          doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text('Vendor Bank Details', 60, y);
          y += 18;
          
          doc.fontSize(8).font('Helvetica');
          const bank = standardInvoice.partyDetails.bankDetails;
          const leftCol = 60;
          const rightCol = 300;
          let leftY = y;
          let rightY = y;
          
          if (bank.bankName) {
            doc.font('Helvetica-Bold').text('Bank Name: ', leftCol, leftY, { continued: true });
            doc.font('Helvetica').text(bank.bankName);
            leftY += 13;
          }
          if (bank.branchName) {
            doc.font('Helvetica-Bold').text('Branch: ', leftCol, leftY, { continued: true });
            doc.font('Helvetica').text(bank.branchName);
            leftY += 13;
          }
          if (bank.accountNumber) {
            doc.font('Helvetica-Bold').text('Account Number: ', leftCol, leftY, { continued: true });
            doc.font('Helvetica').text(bank.accountNumber);
            leftY += 13;
          }
          
          if (bank.accountType) {
            doc.font('Helvetica-Bold').text('Account Type: ', rightCol, rightY, { continued: true });
            doc.font('Helvetica').text(bank.accountType);
            rightY += 13;
          }
          if (bank.ifscCode) {
            doc.font('Helvetica-Bold').text('IFSC Code: ', rightCol, rightY, { continued: true });
            doc.font('Helvetica').text(bank.ifscCode);
            rightY += 13;
          }
          if (bank.swiftCode) {
            doc.font('Helvetica-Bold').text('SWIFT Code: ', rightCol, rightY, { continued: true });
            doc.font('Helvetica').text(bank.swiftCode);
            rightY += 13;
          }
          
          y += 95;
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
