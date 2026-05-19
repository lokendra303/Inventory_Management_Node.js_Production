const PDFDocument = require('pdfkit');
const logger = require('../../utils/logger');
const db = require('../../database/connection');
const { formatDocumentAmount } = require('../../utils/currencyFormat');
const { drawStampSignature } = require('./invoicePdfDrawShared');
const { loadPdfFooterAssets } = require('../../utils/pdfFooterAssets');
const invoicePDFService = require('./invoicePDF.service');

class SalesOrderPDFService {
  async generatePDFBuffer(soData, institutionId = null) {
    let companySettings = null;
    let customerDetails = null;
    
    if (institutionId) {
      try {
        const [settings] = await db.query(
          `SELECT ip.*, i.city, i.state
             FROM institution_profiles ip
             LEFT JOIN institutions i
               ON i.id COLLATE utf8mb4_unicode_ci = ip.institution_id COLLATE utf8mb4_unicode_ci
            WHERE ip.institution_id COLLATE utf8mb4_unicode_ci = ?
            LIMIT 1`,
          [institutionId]
        );
        companySettings = settings;
        
        // Fetch company bank details
        if (companySettings) {
          const [bankDetails] = await db.query(
            'SELECT * FROM bank_details WHERE entity_type = ? AND entity_id = ?',
            ['company', institutionId]
          );
          if (bankDetails) {
            companySettings.bankDetails = bankDetails;
          }
        }
      } catch (err) {
        logger.warn('Could not load company settings');
      }
      
      if (soData.customer_id) {
        try {
          const [customer] = await db.query(
            'SELECT * FROM customers WHERE institution_id = ? AND id = ?',
            [institutionId, soData.customer_id]
          );
          if (customer) {
            customerDetails = customer;
            
            const addresses = await db.query(
              'SELECT * FROM addresses WHERE entity_type = ? AND entity_id = ?',
              ['customer', soData.customer_id]
            );
            
            addresses.forEach(addr => {
              const prefix = addr.address_type;
              customerDetails[`${prefix}_attention`] = addr.attention;
              customerDetails[`${prefix}_country`] = addr.country;
              customerDetails[`${prefix}_address1`] = addr.address1;
              customerDetails[`${prefix}_address2`] = addr.address2;
              customerDetails[`${prefix}_city`] = addr.city;
              customerDetails[`${prefix}_state`] = addr.state;
              customerDetails[`${prefix}_pin_code`] = addr.pin_code;
            });
          }
        } catch (err) {
          logger.warn('Could not load customer details');
        }
      }
    }

    let footerProfile = companySettings;
    let stampBuffer = null;
    let signatureBuffer = null;
    if (institutionId) {
      footerProfile = (await invoicePDFService.loadCompanyProfileForPdf(institutionId)) || companySettings;
      ({ stampBuffer, signatureBuffer } = await loadPdfFooterAssets(invoicePDFService, footerProfile, 'so'));
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        let y = 50;

        const companyName = companySettings?.company_name || 'Company Name';
        doc.fontSize(20).font('Helvetica-Bold').text(companyName, 50, y);
        y += 30;
        
        if (companySettings?.address) {
          doc.fontSize(9).font('Helvetica').text(companySettings.address, 50, y);
          y += 12;
        }
        if (companySettings?.city || companySettings?.state) {
          doc.text(`${companySettings.city || ''}, ${companySettings.state || ''}`, 50, y);
          y += 12;
        }
        if (companySettings?.phone) {
          doc.text(`Phone: ${companySettings.phone}`, 50, y);
          y += 12;
        }
        if (companySettings?.email) {
          doc.text(`Email: ${companySettings.email}`, 50, y);
          y += 20;
        }

        doc.moveTo(50, y).lineTo(545, y).stroke();
        y += 20;

        doc.fontSize(18).font('Helvetica-Bold').text('SALES ORDER', 50, y);
        y += 30;

        // SO Details on left, Customer Details on right (same row)
        const detailsStartY = y;
        
        // Left side - SO Details
        doc.fontSize(10).font('Helvetica-Bold').text('SO Number:', 50, y);
        doc.font('Helvetica').text(soData.so_number || 'N/A', 150, y);
        y += 20;

        doc.font('Helvetica-Bold').text('Order Date:', 50, y);
        const orderDate = soData.order_date ? new Date(soData.order_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
        doc.font('Helvetica').text(orderDate, 150, y);
        y += 20;
        
        if (soData.expected_ship_date) {
          doc.font('Helvetica-Bold').text('Expected Ship:', 50, y);
          const shipDate = new Date(soData.expected_ship_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
          doc.font('Helvetica').text(shipDate, 150, y);
          y += 20;
        }

        doc.font('Helvetica-Bold').text('Currency:', 50, y);
        doc.font('Helvetica').text(soData.currency || 'USD', 150, y);
        y += 20;
        
        if (soData.channel) {
          doc.font('Helvetica-Bold').text('Channel:', 50, y);
          doc.font('Helvetica').text(soData.channel.toUpperCase(), 150, y);
          y += 20;
        }
        
        doc.font('Helvetica-Bold').text('Status:', 50, y);
        doc.font('Helvetica').text((soData.status || 'N/A').toUpperCase(), 150, y);

        // Right side - Customer Details (starting at same Y as SO Details)
        let customerY = detailsStartY;
        doc.fontSize(12).font('Helvetica-Bold').text('Customer Details', 320, customerY);
        customerY += 20;
        
        const customerName = customerDetails?.display_name || soData.customer_name || 'N/A';
        doc.fontSize(10).font('Helvetica-Bold').text(customerName, 320, customerY, { width: 225 });
        customerY += doc.heightOfString(customerName, { width: 225 }) + 3;
        
        if (customerDetails?.company_name) {
          doc.fontSize(9).font('Helvetica').text(customerDetails.company_name, 320, customerY, { width: 225 });
          customerY += doc.heightOfString(customerDetails.company_name, { width: 225 }) + 3;
        }
        
        if (customerDetails?.billing_address1) {
          doc.fontSize(9).font('Helvetica').text(customerDetails.billing_address1, 320, customerY, { width: 225 });
          customerY += doc.heightOfString(customerDetails.billing_address1, { width: 225 }) + 3;
          
          if (customerDetails.billing_address2) {
            doc.text(customerDetails.billing_address2, 320, customerY, { width: 225 });
            customerY += doc.heightOfString(customerDetails.billing_address2, { width: 225 }) + 3;
          }
          
          const cityStateZip = `${customerDetails.billing_city || ''}, ${customerDetails.billing_state || ''} ${customerDetails.billing_pin_code || ''}`;
          doc.text(cityStateZip, 320, customerY, { width: 225 });
          customerY += doc.heightOfString(cityStateZip, { width: 225 }) + 3;
        }
        
        if (customerDetails?.email) {
          const emailText = `Email: ${customerDetails.email}`;
          doc.text(emailText, 320, customerY, { width: 225 });
          customerY += doc.heightOfString(emailText, { width: 225 }) + 3;
        }
        
        if (customerDetails?.work_phone || customerDetails?.mobile_phone) {
          const phoneText = `Phone: ${customerDetails.work_phone || customerDetails.mobile_phone}`;
          doc.text(phoneText, 320, customerY, { width: 225 });
          customerY += doc.heightOfString(phoneText, { width: 225 }) + 3;
        }
        
        y = Math.max(y + 20, customerY) + 10;

        // Company Bank Details
        if (companySettings?.bankDetails?.bank_name || companySettings?.bankDetails?.account_number) {
          y += 10;
          
          // Shadow effect
          doc.rect(52, y + 2, 491, 95).fillAndStroke('#e0e0e0', '#e0e0e0');
          
          // Main box with border
          doc.rect(50, y, 491, 95).fillAndStroke('#f9f9f9', '#ddd');
          
          y += 15;
          doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text('Payment Details', 60, y);
          y += 18;
          
          doc.fontSize(8).font('Helvetica');
          const bank = companySettings.bankDetails;
          const leftCol = 60;
          const rightCol = 300;
          let leftY = y;
          let rightY = y;
          
          if (bank.bank_name) {
            doc.font('Helvetica-Bold').text('Bank Name: ', leftCol, leftY, { continued: true });
            doc.font('Helvetica').text(bank.bank_name);
            leftY += 13;
          }
          if (bank.branch_name) {
            doc.font('Helvetica-Bold').text('Branch: ', leftCol, leftY, { continued: true });
            doc.font('Helvetica').text(bank.branch_name);
            leftY += 13;
          }
          if (bank.account_number) {
            doc.font('Helvetica-Bold').text('Account Number: ', leftCol, leftY, { continued: true });
            doc.font('Helvetica').text(bank.account_number);
            leftY += 13;
          }
          if (bank.account_type) {
            doc.font('Helvetica-Bold').text('Account Type: ', leftCol, leftY, { continued: true });
            doc.font('Helvetica').text(bank.account_type);
            leftY += 13;
          }
          if (bank.ifsc_code) {
            doc.font('Helvetica-Bold').text('IFSC Code: ', leftCol, leftY, { continued: true });
            doc.font('Helvetica').text(bank.ifsc_code);
            leftY += 13;
          }
          
          if (bank.swift_code) {
            doc.font('Helvetica-Bold').text('SWIFT Code: ', rightCol, rightY, { continued: true });
            doc.font('Helvetica').text(bank.swift_code);
            rightY += 13;
          }
          
          y += 80;
        }

        doc.fontSize(11).font('Helvetica-Bold').text('Line Items:', 50, y);
        y += 20;

        const col1 = 50;   // Item
        const col2 = 185;  // HSN
        const col3 = 265;  // Qty
        const col4 = 320;  // Unit Price
        const col5 = 385;  // Tax %
        const col6 = 440;  // Tax Amt
        const col7 = 495;  // Line Total

        const drawTableHeader = (yPos) => {
          doc.fontSize(8).font('Helvetica-Bold');
          doc.rect(col1, yPos, 495, 20).fillAndStroke('#f0f0f0', '#000');
          doc.fillColor('#000').text('Item',       col1 + 4, yPos + 6, { width: 130 });
          doc.text('HSN',        col2 + 4, yPos + 6);
          doc.text('Qty',        col3 + 4, yPos + 6);
          doc.text('Unit Price', col4 + 4, yPos + 6);
          doc.text('Tax %',      col5 + 4, yPos + 6);
          doc.text('Tax Amt',    col6 + 4, yPos + 6);
          doc.text('Total',      col7 + 4, yPos + 6);
          return yPos + 20;
        };

        y = drawTableHeader(y);

        doc.font('Helvetica').fontSize(8);
        let pageNumber = 1;
        (soData.lines || []).forEach((line) => {
          if (y > 680) {
            doc.fontSize(9).font('Helvetica').text(`Page ${pageNumber}`, 500, 780);
            doc.addPage();
            pageNumber++;
            y = 50;
            doc.fontSize(12).font('Helvetica-Bold').text(`SO: ${soData.so_number}`, 50, y);
            y += 25;
            y = drawTableHeader(y);
            doc.font('Helvetica').fontSize(8);
          }

          const taxRate   = parseFloat(line.tax_rate   || 0);
          const unitPrice = parseFloat(line.unit_price || 0);
          const qty       = parseFloat(line.quantity_ordered || 0);
          const lineBase  = qty * unitPrice;
          const taxAmt    = Math.round(lineBase * taxRate / 100 * 100) / 100;
          const lineTotal = parseFloat(line.line_total || lineBase + taxAmt);

          const rowY = y;
          doc.rect(col1, rowY, 135, 18).stroke();
          doc.rect(col2, rowY, 80,  18).stroke();
          doc.rect(col3, rowY, 55,  18).stroke();
          doc.rect(col4, rowY, 65,  18).stroke();
          doc.rect(col5, rowY, 55,  18).stroke();
          doc.rect(col6, rowY, 55,  18).stroke();
          doc.rect(col7, rowY, 50,  18).stroke();

          doc.text(line.item_name || '',          col1 + 4, rowY + 5, { width: 128 });
          doc.text(line.hsn_code  || '-',         col2 + 4, rowY + 5);
          doc.text(String(qty),                   col3 + 4, rowY + 5);
          doc.text(unitPrice.toFixed(2),          col4 + 4, rowY + 5);
          doc.text(taxRate > 0 ? `${taxRate}%` : '-', col5 + 4, rowY + 5);
          doc.text(taxRate > 0 ? taxAmt.toFixed(2) : '-', col6 + 4, rowY + 5);
          doc.text(lineTotal.toFixed(2),          col7 + 4, rowY + 5);
          y += 18;
        });

        y += 20;

        // Totals block
        const totalLines = soData.lines || [];
        const subtotal  = totalLines.reduce((s, l) => s + parseFloat(l.unit_price || 0) * parseFloat(l.quantity_ordered || 0), 0);
        const totalTax  = totalLines.reduce((s, l) => {
          const base = parseFloat(l.unit_price || 0) * parseFloat(l.quantity_ordered || 0);
          return s + Math.round(base * parseFloat(l.tax_rate || 0) / 100 * 100) / 100;
        }, 0);
        const grandTotal = parseFloat(soData.total_amount || subtotal + totalTax);

        const totX = 350;
        const soCcy = soData.currency || 'USD';
        doc.fontSize(9).font('Helvetica');
        doc.text('Subtotal:', totX, y);
        doc.text(formatDocumentAmount(subtotal, soCcy), 480, y);
        y += 16;
        if (totalTax > 0) {
          doc.text('Tax:', totX, y);
          doc.text(formatDocumentAmount(totalTax, soCcy), 480, y);
          y += 16;
        }
        doc.moveTo(totX, y).lineTo(545, y).stroke();
        y += 6;
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text('Grand Total:', totX, y);
        doc.text(formatDocumentAmount(grandTotal, soCcy), 480, y);

        if (stampBuffer || signatureBuffer) {
          drawStampSignature(doc, y + 28, footerProfile, stampBuffer, signatureBuffer);
        }

        doc.end();
      } catch (error) {
        logger.error('PDF generation error:', error);
        reject(error);
      }
    });
  }
}

module.exports = new SalesOrderPDFService();
