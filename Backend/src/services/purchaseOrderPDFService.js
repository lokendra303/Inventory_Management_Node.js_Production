const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');
const db = require('../database/connection');

class PurchaseOrderPDFService {
  async generatePDFBuffer(poData, institutionId = null) {
    let companySettings = null;
    let vendorDetails = null;
    
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

        // Line Items Table
        doc.fontSize(11).font('Helvetica-Bold').text('Line Items:', 50, y);
        y += 20;

        // Table Header
        const col1 = 50;
        const col2 = 150;
        const col3 = 280;
        const col4 = 360;
        const col5 = 430;
        const col6 = 490;

        const drawTableHeader = (yPos) => {
          doc.fontSize(9).font('Helvetica-Bold');
          doc.rect(col1, yPos, 495, 20).fillAndStroke('#f0f0f0', '#000');
          doc.fillColor('#000').text('Item', col1 + 5, yPos + 6);
          doc.text('SKU', col2, yPos + 6);
          doc.text('Warehouse', col3, yPos + 6);
          doc.text('Ordered', col4, yPos + 6);
          doc.text('Received', col5, yPos + 6);
          doc.text('Unit Cost', col6, yPos + 6);
          return yPos + 20;
        };

        y = drawTableHeader(y);

        // Table Rows with auto-pagination
        doc.font('Helvetica').fontSize(8);
        (poData.lines || []).forEach((line) => {
          // Check if we need a new page (leave 100px for totals)
          if (y > 680) {
            doc.addPage();
            y = 50;
            y = drawTableHeader(y);
            doc.font('Helvetica').fontSize(8);
          }

          const rowY = y;
          doc.rect(col1, rowY, 100, 18).stroke();
          doc.rect(col2, rowY, 130, 18).stroke();
          doc.rect(col3, rowY, 80, 18).stroke();
          doc.rect(col4, rowY, 70, 18).stroke();
          doc.rect(col5, rowY, 60, 18).stroke();
          doc.rect(col6, rowY, 55, 18).stroke();

          doc.text(line.item_name || '', col1 + 5, rowY + 5, { width: 90 });
          doc.text(line.sku || '', col2 + 5, rowY + 5);
          doc.text(line.warehouse_name || '', col3 + 5, rowY + 5);
          doc.text(line.quantity_ordered || '0', col4 + 5, rowY + 5);
          doc.text(line.quantity_received || '0', col5 + 5, rowY + 5);
          doc.text(parseFloat(line.unit_cost || 0).toFixed(2), col6 + 5, rowY + 5);
          y += 18;
        });

        y += 20;

        // Total
        doc.fontSize(11).font('Helvetica-Bold').text('Total Amount:', 380, y);
        doc.text(`${poData.currency || 'USD'} ${parseFloat(poData.total_amount || 0).toFixed(2)}`, 480, y);

        doc.end();
      } catch (error) {
        logger.error('PDF generation error:', error);
        reject(error);
      }
    });
  }
}

module.exports = new PurchaseOrderPDFService();
