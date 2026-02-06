const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class InvoicePDFService {
  async generateInvoicePDF(standardInvoice, outputPath = null) {
    try {
      const doc = new PDFDocument({ margin: 50 });
      
      let buffers = [];
      if (!outputPath) {
        doc.on('data', buffers.push.bind(buffers));
      } else {
        doc.pipe(fs.createWriteStream(outputPath));
      }

      this.generateHeader(doc, standardInvoice.header);
      this.generateInvoiceInfo(doc, standardInvoice.details, standardInvoice.partyDetails);
      this.generateTable(doc, standardInvoice.lineItems);
      this.generateTotals(doc, standardInvoice.totals);
      this.generateFooter(doc, standardInvoice.footer);

      doc.end();

      if (!outputPath) {
        return new Promise((resolve) => {
          doc.on('end', () => {
            const pdfBuffer = Buffer.concat(buffers);
            resolve(pdfBuffer);
          });
        });
      }

      return outputPath;
    } catch (error) {
      logger.error('Error generating invoice PDF:', error);
      throw error;
    }
  }

  generateHeader(doc, header) {
    doc
      .fontSize(20)
      .text(header.companyName, 50, 45, { align: 'center' })
      .fontSize(10)
      .text(header.address.line1, 50, 70, { align: 'center' })
      .text(`${header.address.city}, ${header.address.state} ${header.address.postalCode}`, 50, 85, { align: 'center' })
      .text(`Phone: ${header.contact.phone} | Email: ${header.contact.email}`, 50, 100, { align: 'center' })
      .moveDown();

    doc
      .strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(50, 125)
      .lineTo(550, 125)
      .stroke();
  }

  generateInvoiceInfo(doc, details, partyDetails) {
    const startY = 150;
    
    doc
      .fontSize(14)
      .text('INVOICE', 50, startY, { underline: true })
      .fontSize(10)
      .text(`Invoice Number: ${details.invoiceNumber}`, 50, startY + 25)
      .text(`Invoice Date: ${details.invoiceDate}`, 50, startY + 40)
      .text(`Due Date: ${details.dueDate}`, 50, startY + 55)
      .text(`Currency: ${details.currency}`, 50, startY + 70)
      .text(`Reference: ${details.reference || 'N/A'}`, 50, startY + 85);

    const partyType = partyDetails.type === 'vendor' ? 'VENDOR DETAILS' : 'CUSTOMER DETAILS';
    doc
      .fontSize(14)
      .text(partyType, 300, startY, { underline: true })
      .fontSize(10)
      .text(partyDetails.name, 300, startY + 25)
      .text(partyDetails.companyName || '', 300, startY + 40)
      .text(partyDetails.billingAddress.line1 || '', 300, startY + 55)
      .text(`${partyDetails.billingAddress.city || ''}, ${partyDetails.billingAddress.state || ''}`, 300, startY + 70)
      .text(`${partyDetails.billingAddress.country || ''} - ${partyDetails.billingAddress.postalCode || ''}`, 300, startY + 85)
      .text(`Email: ${partyDetails.contact.email || 'N/A'}`, 300, startY + 100)
      .text(`Phone: ${partyDetails.contact.phone || 'N/A'}`, 300, startY + 115);
  }

  generateTable(doc, lineItems) {
    const tableTop = 300;
    const itemCodeX = 50;
    const descriptionX = 120;
    const quantityX = 280;
    const unitPriceX = 330;
    const totalX = 480;

    doc
      .fontSize(10)
      .text('S.No', itemCodeX, tableTop, { width: 60, align: 'center' })
      .text('Description', descriptionX, tableTop, { width: 150 })
      .text('Qty', quantityX, tableTop, { width: 40, align: 'center' })
      .text('Unit Price', unitPriceX, tableTop, { width: 45, align: 'right' })
      .text('Total', totalX, tableTop, { width: 60, align: 'right' });

    doc
      .strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(itemCodeX, tableTop + 15)
      .lineTo(totalX + 60, tableTop + 15)
      .stroke();

    let currentY = tableTop + 25;
    lineItems.forEach((item, index) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      doc
        .fontSize(9)
        .text(item.sno, itemCodeX, currentY, { width: 60, align: 'center' })
        .text(`${item.itemName}${item.sku ? ` (${item.sku})` : ''}`, descriptionX, currentY, { width: 150 })
        .text(item.quantity.toString(), quantityX, currentY, { width: 40, align: 'center' })
        .text(`$${item.unitAmount.toFixed(2)}`, unitPriceX, currentY, { width: 45, align: 'right' })
        .text(`$${item.netAmount.toFixed(2)}`, totalX, currentY, { width: 60, align: 'right' });

      currentY += 20;
    });

    doc
      .strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(itemCodeX, currentY)
      .lineTo(totalX + 60, currentY)
      .stroke();

    return currentY + 10;
  }

  generateTotals(doc, totals) {
    const totalsStartY = doc.y + 20;
    const labelX = 400;
    const valueX = 500;

    doc
      .fontSize(10)
      .text('Subtotal:', labelX, totalsStartY)
      .text(`$${totals.subtotal.toFixed(2)}`, valueX, totalsStartY, { align: 'right' })
      .text('Total Discount:', labelX, totalsStartY + 15)
      .text(`-$${totals.totalDiscountAmount.toFixed(2)}`, valueX, totalsStartY + 15, { align: 'right' })
      .text('Total Tax:', labelX, totalsStartY + 30)
      .text(`$${totals.totalTaxAmount.toFixed(2)}`, valueX, totalsStartY + 30, { align: 'right' });

    doc
      .strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(labelX, totalsStartY + 45)
      .lineTo(valueX + 50, totalsStartY + 45)
      .stroke();

    doc
      .fontSize(12)
      .text('Grand Total:', labelX, totalsStartY + 55, { underline: true })
      .text(`$${totals.grandTotal.toFixed(2)}`, valueX, totalsStartY + 55, { align: 'right', underline: true });

    doc
      .fontSize(9)
      .text(`Amount in Words: ${totals.amountInWords}`, 50, totalsStartY + 80, { width: 500 });
  }

  generateFooter(doc, footer) {
    const footerY = doc.y + 40;

    if (footer.notes) {
      doc
        .fontSize(10)
        .text('Notes:', 50, footerY, { underline: true })
        .fontSize(9)
        .text(footer.notes, 50, footerY + 15, { width: 500 });
    }

    if (footer.terms) {
      doc
        .fontSize(10)
        .text('Terms & Conditions:', 50, footerY + 60, { underline: true })
        .fontSize(9)
        .text(footer.terms, 50, footerY + 75, { width: 500 });
    }

    if (footer.authorizedSignatory) {
      doc
        .fontSize(10)
        .text('Authorized Signatory', 400, footerY + 100)
        .text(footer.authorizedSignatory.name || '', 400, footerY + 130)
        .text(footer.authorizedSignatory.designation || '', 400, footerY + 145)
        .text(`Date: ${footer.authorizedSignatory.date}`, 400, footerY + 160);
    }
  }

  generateFilename(invoiceNumber, type = 'purchase') {
    const prefix = type === 'purchase' ? 'PI' : 'SI';
    const timestamp = new Date().toISOString().split('T')[0];
    return `${prefix}_${invoiceNumber}_${timestamp}.pdf`;
  }

  async saveInvoicePDF(standardInvoice, invoiceNumber, type = 'purchase') {
    try {
      const filename = this.generateFilename(invoiceNumber, type);
      const outputDir = path.join(__dirname, '../../temp/invoices');
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const outputPath = path.join(outputDir, filename);
      await this.generateInvoicePDF(standardInvoice, outputPath);
      
      return {
        filename,
        path: outputPath,
        url: `/temp/invoices/${filename}`
      };
    } catch (error) {
      logger.error('Error saving invoice PDF:', error);
      throw error;
    }
  }

  async generatePDFBuffer(standardInvoice) {
    try {
      return await this.generateInvoicePDF(standardInvoice);
    } catch (error) {
      logger.error('Error generating PDF buffer:', error);
      throw error;
    }
  }
}

module.exports = new InvoicePDFService();