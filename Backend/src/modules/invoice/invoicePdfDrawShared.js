/**
 * Shared invoice PDF drawing: line item table with pagination (used by all templates).
 */

function formatShortDate(d) {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * @param {PDFKit.PDFDocument} doc
 * @param {number} startY
 * @param {object} standardInvoice
 * @param {object} opts
 * @param {'classic'|'minimal'|'modern'} opts.variant
 * @returns {{ y: number, pageNumber: number }}
 */
function drawInvoiceLineItems(doc, startY, standardInvoice, opts) {
  const { variant, invoiceNumber } = opts;
  const col1 = 50;
  const col2 = 80;
  const col3 = 270;
  const col4 = 340;
  const col5 = 410;
  const col6 = 455;
  const right = 545;

  const itemCount = (standardInvoice.lineItems || []).length;
  const rowHeight = itemCount > 30 ? 14 : itemCount > 20 ? 16 : 18;
  const fontSize = itemCount > 30 ? 7 : itemCount > 20 ? 7.5 : 8;
  const headerFontSize = itemCount > 30 ? 8 : 9;

  let y = startY;
  let pageNumber = 1;

  const drawTableHeader = (yPos) => {
    doc.fontSize(headerFontSize).font('Helvetica-Bold');
    if (variant === 'minimal') {
      doc.rect(col1, yPos, right - col1, 20).fillAndStroke('#ececec', '#999');
    } else if (variant === 'modern') {
      doc.rect(col1, yPos, right - col1, 20).fillAndStroke('#e2e8f0', '#94a3b8');
    } else {
      doc.rect(col1, yPos, right - col1, 20).fillAndStroke('#f0f0f0', '#000');
    }
    doc.fillColor('#000').text('#', col1 + 5, yPos + 6);
    doc.text('Item', col2, yPos + 6);
    doc.text('HSN Code', col3, yPos + 6);
    doc.text('Qty', col4, yPos + 6, { width: 60, align: 'right' });
    doc.text('Rate', col5, yPos + 6, { width: 40, align: 'right' });
    doc.text('Amount', col6, yPos + 6, { width: 85, align: 'right' });
    return yPos + 20;
  };

  y = drawTableHeader(y);
  doc.font('Helvetica').fontSize(fontSize);

  (standardInvoice.lineItems || []).forEach((item, index) => {
    if (y > 680) {
      doc.fontSize(9).font('Helvetica').text(`Page ${pageNumber}`, 500, 780);
      doc.addPage();
      pageNumber++;
      y = 50;
      doc.fontSize(12).font('Helvetica-Bold').text(`Invoice: ${invoiceNumber}`, 50, y);
      y += 25;
      y = drawTableHeader(y);
      doc.font('Helvetica').fontSize(fontSize);
    }

    const rowY = y;

    if (variant === 'minimal') {
      doc.strokeColor('#bbbbbb').lineWidth(0.35);
      doc.rect(col1, rowY, 30, rowHeight).stroke();
      doc.rect(col2, rowY, 190, rowHeight).stroke();
      doc.rect(col3, rowY, 70, rowHeight).stroke();
      doc.rect(col4, rowY, 70, rowHeight).stroke();
      doc.rect(col5, rowY, 45, rowHeight).stroke();
      doc.rect(col6, rowY, 90, rowHeight).stroke();
    } else if (variant === 'modern') {
      if (index % 2 === 1) {
        doc.rect(col1, rowY, right - col1, rowHeight).fill('#f8fafc');
      }
      doc.strokeColor('#cbd5e1').lineWidth(0.45);
      doc.rect(col1, rowY, 30, rowHeight).stroke();
      doc.rect(col2, rowY, 190, rowHeight).stroke();
      doc.rect(col3, rowY, 70, rowHeight).stroke();
      doc.rect(col4, rowY, 70, rowHeight).stroke();
      doc.rect(col5, rowY, 45, rowHeight).stroke();
      doc.rect(col6, rowY, 90, rowHeight).stroke();
    } else {
      doc.strokeColor('#000').lineWidth(0.5);
      doc.rect(col1, rowY, 30, rowHeight).stroke();
      doc.rect(col2, rowY, 190, rowHeight).stroke();
      doc.rect(col3, rowY, 70, rowHeight).stroke();
      doc.rect(col4, rowY, 70, rowHeight).stroke();
      doc.rect(col5, rowY, 45, rowHeight).stroke();
      doc.rect(col6, rowY, 90, rowHeight).stroke();
    }

    const itemName =
      (item.itemName || '').length > 35 ? `${(item.itemName || '').substring(0, 32)}...` : item.itemName || '';

    doc.fillColor('#000');
    doc.text(item.sno || '', col1 + 5, rowY + 4);
    doc.text(itemName, col2 + 5, rowY + 4, { width: 180 });
    doc.text(item.hsn_code || '-', col3 + 5, rowY + 4, { width: 60 });
    doc.text(parseFloat(item.quantity || 0).toFixed(2), col4, rowY + 4, { width: 60, align: 'right' });
    doc.text(parseFloat(item.unitAmount || 0).toFixed(2), col5, rowY + 4, { width: 40, align: 'right' });
    doc.text(parseFloat(item.netAmount || 0).toFixed(2), col6, rowY + 4, { width: 85, align: 'right' });
    y += rowHeight;
  });

  return { y: y + 10, pageNumber };
}

function drawTotalsBlock(doc, y, standardInvoice) {
  const currency = standardInvoice.details?.currency || 'USD';
  const pageRight = 545;
  const valueColWidth = 95;
  const valueX = pageRight - valueColWidth;
  const labelWidth = 110;
  const labelX = valueX - labelWidth - 8;

  const moneyRow = (label, amountStr, yPos, options = {}) => {
    const { size = 9, valueBold = false } = options;
    doc.fontSize(size).font('Helvetica-Bold').fillColor('#000').text(`${label}:`, labelX, yPos, { width: labelWidth, align: 'right' });
    doc.font(valueBold ? 'Helvetica-Bold' : 'Helvetica').text(amountStr, valueX, yPos, { width: valueColWidth, align: 'right' });
  };

  let yy = y;
  moneyRow('Subtotal', `${currency} ${parseFloat(standardInvoice.totals?.subtotal || 0).toFixed(2)}`, yy);
  yy += 15;
  moneyRow('Tax', `${currency} ${parseFloat(standardInvoice.totals?.totalTaxAmount || 0).toFixed(2)}`, yy);
  yy += 15;
  moneyRow('Discount', `${currency} ${parseFloat(standardInvoice.totals?.totalDiscountAmount || 0).toFixed(2)}`, yy);
  yy += 15;
  moneyRow(
    'Grand Total',
    `${currency} ${parseFloat(standardInvoice.totals?.grandTotal || 0).toFixed(2)}`,
    yy,
    { size: 11, valueBold: true }
  );
  yy += 22;

  const wordsLeft = 50;
  const wordsWidth = pageRight - wordsLeft;
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#000');
  const titleH = doc.heightOfString('Amount in words', { width: wordsWidth });
  doc.text('Amount in words', wordsLeft, yy, { width: wordsWidth });
  yy += titleH + 3;

  const wordsBody = (standardInvoice.totals?.amountInWords || '').trim() || '—';
  doc.font('Helvetica-Oblique');
  const hWords = doc.heightOfString(wordsBody, { width: wordsWidth, lineGap: 1 });
  doc.text(wordsBody, wordsLeft, yy, { width: wordsWidth, align: 'left', lineGap: 1 });
  yy += hWords + 8;

  doc.font('Helvetica').fontSize(9).fillColor('#000');
  return yy;
}

function drawPartyBankBox(doc, startY, standardInvoice) {
  if (
    !standardInvoice.partyDetails?.bankDetails?.bankName &&
    !standardInvoice.partyDetails?.bankDetails?.accountNumber
  ) {
    return startY;
  }

  const y0 = startY + 10;
  doc.rect(52, y0 + 2, 491, 95).fillAndStroke('#e0e0e0', '#e0e0e0');
  doc.rect(50, y0, 491, 120).fillAndStroke('#f9f9f9', '#ddd');

  let ty = y0 + 15;
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text('Vendor Bank Details', 60, ty);
  ty += 18;

  doc.fontSize(8).font('Helvetica');
  const bank = standardInvoice.partyDetails.bankDetails;
  const leftCol = 60;
  let leftY = ty;

  const row = (label, val) => {
    if (!val) return;
    doc.font('Helvetica-Bold').text(`${label}: `, leftCol, leftY, { continued: true });
    doc.font('Helvetica').text(val);
    leftY += 13;
  };

  row('Bank Name', bank.bankName);
  row('Branch', bank.branchName);
  row('Account Number', bank.accountNumber);
  row('Account Type', bank.accountType);
  row('IFSC Code', bank.ifscCode);
  row('SWIFT Code', bank.swiftCode);

  return startY + 10 + 120 + 15;
}

function drawStampSignature(doc, y, companySettings, stampBuffer, signatureBuffer) {
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
}

module.exports = {
  formatShortDate,
  drawInvoiceLineItems,
  drawTotalsBlock,
  drawPartyBankBox,
  drawStampSignature,
};
