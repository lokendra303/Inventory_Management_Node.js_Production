const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');
const db = require('../database/connection');

class SalesOrderPDFService {
  async generatePDFBuffer(soData, institutionId = null) {
    let companySettings = null;
    let customerDetails = null;
    
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

        doc.fontSize(11).font('Helvetica-Bold').text('Line Items:', 50, y);
        y += 20;

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
          doc.text('Shipped', col5, yPos + 6);
          doc.text('Unit Price', col6, yPos + 6);
          return yPos + 20;
        };

        y = drawTableHeader(y);

        doc.font('Helvetica').fontSize(8);
        let pageNumber = 1;
        (soData.lines || []).forEach((line) => {
          if (y > 680) {
            // Add page number to current page
            doc.fontSize(9).font('Helvetica').text(`Page ${pageNumber}`, 500, 780);
            
            doc.addPage();
            pageNumber++;
            y = 50;
            
            // Add SO number header on new page
            doc.fontSize(12).font('Helvetica-Bold').text(`SO: ${soData.so_number}`, 50, y);
            y += 25;
            
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
          doc.text(line.quantity_shipped || '0', col5 + 5, rowY + 5);
          doc.text(parseFloat(line.unit_price || 0).toFixed(2), col6 + 5, rowY + 5);
          y += 18;
        });

        y += 20;

        doc.fontSize(11).font('Helvetica-Bold').text('Total Amount:', 380, y);
        doc.text(`${soData.currency || 'USD'} ${parseFloat(soData.total_amount || 0).toFixed(2)}`, 480, y);
        
        // Add page number to last page
        doc.fontSize(9).font('Helvetica').text(`Page ${pageNumber}`, 500, 780);

        doc.end();
      } catch (error) {
        logger.error('PDF generation error:', error);
        reject(error);
      }
    });
  }
}

module.exports = new SalesOrderPDFService();
