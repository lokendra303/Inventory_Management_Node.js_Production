const PDFDocument = require('pdfkit');
const logger = require('../../utils/logger');
const db = require('../../database/connection');

class PurchaseOrderPDFService {
  async generatePDFBuffer(poData, institutionId = null) {
    let companySettings = null;
    let vendorDetails = null;
    
    if (institutionId) {
      try {
        const [settings] = await db.query(
          `SELECT ip.*, i.city, i.state
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
      
      // Fetch vendor details
      if (poData.vendor_id) {
        try {
          const [vendor] = await db.query(
            'SELECT * FROM vendors WHERE institution_id = ? AND id = ?',
            [institutionId, poData.vendor_id]
          );
          if (vendor) {
            vendorDetails = vendor;
            
            // Fetch vendor addresses
            const addresses = await db.query(
              'SELECT * FROM addresses WHERE entity_type = ? AND entity_id = ?',
              ['vendor', poData.vendor_id]
            );
            
            addresses.forEach(addr => {
              const prefix = addr.address_type;
              vendorDetails[`${prefix}_attention`] = addr.attention;
              vendorDetails[`${prefix}_country`] = addr.country;
              vendorDetails[`${prefix}_address1`] = addr.address1;
              vendorDetails[`${prefix}_address2`] = addr.address2;
              vendorDetails[`${prefix}_city`] = addr.city;
              vendorDetails[`${prefix}_state`] = addr.state;
              vendorDetails[`${prefix}_pin_code`] = addr.pin_code;
            });
            
            // Fetch vendor bank details
            const [bankDetails] = await db.query(
              'SELECT * FROM bank_details WHERE entity_type = ? AND entity_id = ?',
              ['vendor', poData.vendor_id]
            );
            if (bankDetails) {
              vendorDetails.bankDetails = bankDetails;
            }
          }
        } catch (err) {
          logger.warn('Could not load vendor details');
        }
      }
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        let y = 50;

        // Header
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

        // Title
        doc.fontSize(18).font('Helvetica-Bold').text('PURCHASE ORDER', 50, y);
        y += 30;

        // PO Details on left, Vendor Details on right (same row)
        const detailsStartY = y;
        
        // Left side - PO Details
        doc.fontSize(10).font('Helvetica-Bold').text('PO Number:', 50, y);
        doc.font('Helvetica').text(poData.po_number || 'N/A', 150, y);
        y += 20;

        doc.font('Helvetica-Bold').text('Order Date:', 50, y);
        const orderDate = poData.order_date ? new Date(poData.order_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
        doc.font('Helvetica').text(orderDate, 150, y);
        y += 20;
        
        if (poData.expected_date) {
          doc.font('Helvetica-Bold').text('Expected Date:', 50, y);
          const expectedDate = new Date(poData.expected_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
          doc.font('Helvetica').text(expectedDate, 150, y);
          y += 20;
        }

        doc.font('Helvetica-Bold').text('Currency:', 50, y);
        doc.font('Helvetica').text(poData.currency || 'USD', 150, y);
        y += 20;
        
        doc.font('Helvetica-Bold').text('Status:', 50, y);
        doc.font('Helvetica').text((poData.status || 'N/A').toUpperCase(), 150, y);

        // Right side - Vendor Details (starting at same Y as PO Details)
        let vendorY = detailsStartY;
        doc.fontSize(12).font('Helvetica-Bold').text('Vendor Details', 320, vendorY);
        vendorY += 20;
        
        const vendorName = vendorDetails?.display_name || poData.vendor_name || 'N/A';
        doc.fontSize(10).font('Helvetica-Bold').text(vendorName, 320, vendorY, { width: 225 });
        vendorY += doc.heightOfString(vendorName, { width: 225 }) + 3;
        
        if (vendorDetails?.company_name) {
          doc.fontSize(9).font('Helvetica').text(vendorDetails.company_name, 320, vendorY, { width: 225 });
          vendorY += doc.heightOfString(vendorDetails.company_name, { width: 225 }) + 3;
        }
        
        if (vendorDetails?.billing_address1) {
          doc.fontSize(9).font('Helvetica').text(vendorDetails.billing_address1, 320, vendorY, { width: 225 });
          vendorY += doc.heightOfString(vendorDetails.billing_address1, { width: 225 }) + 3;
          
          if (vendorDetails.billing_address2) {
            doc.text(vendorDetails.billing_address2, 320, vendorY, { width: 225 });
            vendorY += doc.heightOfString(vendorDetails.billing_address2, { width: 225 }) + 3;
          }
          
          const cityStateZip = `${vendorDetails.billing_city || ''}, ${vendorDetails.billing_state || ''} ${vendorDetails.billing_pin_code || ''}`;
          doc.text(cityStateZip, 320, vendorY, { width: 225 });
          vendorY += doc.heightOfString(cityStateZip, { width: 225 }) + 3;
        }
        
        if (vendorDetails?.email) {
          const emailText = `Email: ${vendorDetails.email}`;
          doc.text(emailText, 320, vendorY, { width: 225 });
          vendorY += doc.heightOfString(emailText, { width: 225 }) + 3;
        }
        
        if (vendorDetails?.work_phone || vendorDetails?.mobile_phone) {
          const phoneText = `Phone: ${vendorDetails.work_phone || vendorDetails.mobile_phone}`;
          doc.text(phoneText, 320, vendorY, { width: 225 });
          vendorY += doc.heightOfString(phoneText, { width: 225 }) + 3;
        }
        
        if (vendorDetails?.gstin) {
          const gstinText = `GSTIN: ${vendorDetails.gstin}`;
          doc.text(gstinText, 320, vendorY, { width: 225 });
          vendorY += doc.heightOfString(gstinText, { width: 225 }) + 3;
        }
        
        y = Math.max(y + 20, vendorY) + 10;

        // Vendor Bank Details
        if (vendorDetails?.bankDetails?.bank_name || vendorDetails?.bankDetails?.account_number) {
          y += 10;
          
          // Shadow effect
          doc.rect(52, y + 2, 491, 95).fillAndStroke('#e0e0e0', '#e0e0e0');
          
          // Main box with border
          doc.rect(50, y, 491, 95).fillAndStroke('#f9f9f9', '#ddd');
          
          y += 15;
          doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text('Vendor Bank Details', 60, y);
          y += 18;
          
          doc.fontSize(8).font('Helvetica');
          const bank = vendorDetails.bankDetails;
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

        // Line Items Table
        doc.fontSize(11).font('Helvetica-Bold').text('Line Items:', 50, y);
        y += 20;

        const col1 = 50;   // Item
        const col2 = 185;  // HSN
        const col3 = 265;  // Qty
        const col4 = 320;  // Unit Cost
        const col5 = 385;  // Tax %
        const col6 = 440;  // Tax Amt
        const col7 = 495;  // Line Total

        const drawTableHeader = (yPos) => {
          doc.fontSize(8).font('Helvetica-Bold');
          doc.rect(col1, yPos, 495, 20).fillAndStroke('#f0f0f0', '#000');
          doc.fillColor('#000').text('Item',       col1 + 4, yPos + 6, { width: 130 });
          doc.text('HSN',        col2 + 4, yPos + 6);
          doc.text('Qty',        col3 + 4, yPos + 6);
          doc.text('Unit Cost',  col4 + 4, yPos + 6);
          doc.text('Tax %',      col5 + 4, yPos + 6);
          doc.text('Tax Amt',    col6 + 4, yPos + 6);
          doc.text('Total',      col7 + 4, yPos + 6);
          return yPos + 20;
        };

        y = drawTableHeader(y);

        doc.font('Helvetica').fontSize(8);
        let pageNumber = 1;
        (poData.lines || []).forEach((line) => {
          if (y > 680) {
            doc.fontSize(9).font('Helvetica').text(`Page ${pageNumber}`, 500, 780);
            doc.addPage();
            pageNumber++;
            y = 50;
            doc.fontSize(12).font('Helvetica-Bold').text(`PO: ${poData.po_number}`, 50, y);
            y += 25;
            y = drawTableHeader(y);
            doc.font('Helvetica').fontSize(8);
          }

          const taxRate   = parseFloat(line.tax_rate   || 0);
          const unitCost  = parseFloat(line.unit_cost  || 0);
          const qty       = parseFloat(line.quantity_ordered || 0);
          const lineBase  = qty * unitCost;
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

          doc.text(line.item_name || '',               col1 + 4, rowY + 5, { width: 128 });
          doc.text(line.hsn_code  || '-',              col2 + 4, rowY + 5);
          doc.text(String(qty),                        col3 + 4, rowY + 5);
          doc.text(unitCost.toFixed(2),                col4 + 4, rowY + 5);
          doc.text(taxRate > 0 ? `${taxRate}%` : '-',  col5 + 4, rowY + 5);
          doc.text(taxRate > 0 ? taxAmt.toFixed(2) : '-', col6 + 4, rowY + 5);
          doc.text(lineTotal.toFixed(2),               col7 + 4, rowY + 5);
          y += 18;
        });

        y += 20;

        // Totals block
        const totalLines  = poData.lines || [];
        const subtotal    = totalLines.reduce((s, l) => s + parseFloat(l.unit_cost || 0) * parseFloat(l.quantity_ordered || 0), 0);
        const totalTax    = totalLines.reduce((s, l) => {
          const base = parseFloat(l.unit_cost || 0) * parseFloat(l.quantity_ordered || 0);
          return s + Math.round(base * parseFloat(l.tax_rate || 0) / 100 * 100) / 100;
        }, 0);
        const grandTotal  = parseFloat(poData.total_amount || subtotal + totalTax);

        const totX = 350;
        doc.fontSize(9).font('Helvetica');
        doc.text('Subtotal:',  totX, y); doc.text(`${poData.currency || ''} ${subtotal.toFixed(2)}`,  480, y); y += 16;
        if (totalTax > 0) {
          doc.text('Tax:',     totX, y); doc.text(`${poData.currency || ''} ${totalTax.toFixed(2)}`,   480, y); y += 16;
        }
        doc.moveTo(totX, y).lineTo(545, y).stroke(); y += 6;
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text('Grand Total:', totX, y); doc.text(`${poData.currency || ''} ${grandTotal.toFixed(2)}`, 480, y);

        doc.fontSize(9).font('Helvetica').text(`Page ${pageNumber}`, 500, 780);

        doc.end();
      } catch (error) {
        logger.error('PDF generation error:', error);
        reject(error);
      }
    });
  }
}

module.exports = new PurchaseOrderPDFService();
