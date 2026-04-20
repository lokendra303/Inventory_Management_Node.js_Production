const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');
const db = require('../../database/connection');
const axios = require('axios');
const { resolvePublicBaseUrl } = require('../../config');

class InvoicePDFService {
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

        // Invoice Title
        const invoiceType = standardInvoice.details?.type === 'sales' ? 'SALES INVOICE' : 'PURCHASE INVOICE';
        doc.fontSize(18).font('Helvetica-Bold').text(invoiceType, 50, y);
        y += 30;
        
        // Invoice Details on left, Vendor/Customer Details on right (same row)
        const detailsStartY = y;
        
        // Left side - Invoice Details
        doc.fontSize(10).font('Helvetica-Bold').text('Invoice #:', 50, y);
        doc.font('Helvetica').text(standardInvoice.details?.invoiceNumber || 'N/A', 150, y);
        y += 20;
        
        doc.font('Helvetica-Bold').text('Invoice Date:', 50, y);
        const invoiceDate = standardInvoice.details?.invoiceDate ? new Date(standardInvoice.details.invoiceDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
        doc.font('Helvetica').text(invoiceDate, 150, y);
        y += 20;
        
        doc.font('Helvetica-Bold').text('Due Date:', 50, y);
        const dueDate = standardInvoice.details?.dueDate ? new Date(standardInvoice.details.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
        doc.font('Helvetica').text(dueDate, 150, y);
        y += 20;
        
        doc.font('Helvetica-Bold').text('Currency:', 50, y);
        doc.font('Helvetica').text(standardInvoice.details?.currency || 'USD', 150, y);
        
        // Right side - Vendor/Customer Details (starting at same Y as Invoice Details)
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

        // Line Items Table with borders
        const col1 = 50;   // #
        const col2 = 80;   // Item
        const col3 = 270;  // HSN Code
        const col4 = 340;  // Qty
        const col5 = 410;  // Rate
        const col6 = 455;  // Amount
        
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
          doc.text('HSN Code', col3, yPos + 6);
          doc.text('Qty', col4, yPos + 6, { width: 60, align: 'right' });
          doc.text('Rate', col5, yPos + 6, { width: 40, align: 'right' });
          doc.text('Amount', col6, yPos + 6, { width: 85, align: 'right' });
          return yPos + 20;
        };
        
        // Table Header
        y = drawTableHeader(y);

        // Table Rows with borders and pagination
        doc.font('Helvetica').fontSize(fontSize);
        let pageNumber = 1;
        (standardInvoice.lineItems || []).forEach((item, index) => {
          // Check if we need a new page (leave 150px for totals and footer)
          if (y > 680) {
            // Add page number to current page
            doc.fontSize(9).font('Helvetica').text(`Page ${pageNumber}`, 500, 780);
            
            doc.addPage();
            pageNumber++;
            y = 50;
            
            // Add Invoice number header on new page
            doc.fontSize(12).font('Helvetica-Bold').text(`Invoice: ${standardInvoice.details?.invoiceNumber}`, 50, y);
            y += 25;
            
            y = drawTableHeader(y);
            doc.font('Helvetica').fontSize(fontSize);
          }
          
          const rowY = y;
          
          // Draw cell borders
          doc.rect(col1, rowY, 30, rowHeight).stroke();
          doc.rect(col2, rowY, 190, rowHeight).stroke();
          doc.rect(col3, rowY, 70, rowHeight).stroke();
          doc.rect(col4, rowY, 70, rowHeight).stroke();
          doc.rect(col5, rowY, 45, rowHeight).stroke();
          doc.rect(col6, rowY, 90, rowHeight).stroke();
          
          // Cell content with truncation for long names
          const itemName = (item.itemName || '').length > 35 
            ? (item.itemName || '').substring(0, 32) + '...' 
            : (item.itemName || '');
          
          doc.text(item.sno || '', col1 + 5, rowY + 4);
          doc.text(itemName, col2 + 5, rowY + 4, { width: 180 });
          doc.text(item.hsn_code || '-', col3 + 5, rowY + 4, { width: 60 });
          doc.text(parseFloat(item.quantity || 0).toFixed(2), col4, rowY + 4, { width: 60, align: 'right' });
          doc.text(parseFloat(item.unitAmount || 0).toFixed(2), col5, rowY + 4, { width: 40, align: 'right' });
          doc.text(parseFloat(item.netAmount || 0).toFixed(2), col6, rowY + 4, { width: 85, align: 'right' });
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
        
        // Add page number to last page
        doc.fontSize(9).font('Helvetica').text(`Page ${pageNumber}`, 500, 780);

        // Bank Details with shadow box
        if (standardInvoice.partyDetails?.bankDetails?.bankName || standardInvoice.partyDetails?.bankDetails?.accountNumber) {
          y += 10;
          
          // Shadow effect
          doc.rect(52, y + 2, 491, 95).fillAndStroke('#e0e0e0', '#e0e0e0');
          
          // Main box with border
          doc.rect(50, y, 491, 120).fillAndStroke('#f9f9f9', '#ddd');
          
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
            doc.font('Helvetica-Bold').text('Account Type: ', leftCol, leftY, { continued: true });
            doc.font('Helvetica').text(bank.accountType);
            leftY += 13;
          }
          if (bank.ifscCode) {
            doc.font('Helvetica-Bold').text('IFSC Code: ', leftCol, leftY, { continued: true });
            doc.font('Helvetica').text(bank.ifscCode);
            leftY += 13;
          }
          if (bank.swiftCode) {
            doc.font('Helvetica-Bold').text('SWIFT Code: ', leftCol, leftY, { continued: true });
            doc.font('Helvetica').text(bank.swiftCode);
            leftY += 13;
          }
          
          y += 95;
        }

        // Footer with Stamp and Signature - Dynamic position
        y += 20;
        const footerY = y;
        
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
