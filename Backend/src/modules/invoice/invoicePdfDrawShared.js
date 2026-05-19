/**
 * Shared invoice PDF drawing: line item table with pagination (used by all templates).
 */

const { formatDocumentAmount, formatNumber, getRateColumnHeader } = require('../../utils/currencyFormat');

const pdfAmount = (amount, currencyCode) => formatDocumentAmount(amount, currencyCode, { pdf: true });

/** Upper-left logo slot (all templates). */
const INVOICE_LOGO_BOX = {
  x: 50,
  y: 26,
  width: 80,
  height: 59,
  gapAfter: 14,
};

/**
 * Draw company logo fixed at upper-left; return X where header text should start.
 * @returns {{ contentX: number, topY: number, bottomY: number, hasLogo: boolean }}
 */
function drawCompanyLogoTopLeft(doc, logoBuffer) {
  const { x, y, width, height, gapAfter } = INVOICE_LOGO_BOX;
  if (logoBuffer) {
    doc.image(logoBuffer, x, y, { width, height });
    return {
      contentX: x + width + gapAfter,
      topY: y,
      bottomY: y + height,
      hasLogo: true,
    };
  }
  return {
    contentX: x,
    topY: y,
    bottomY: y,
    hasLogo: false,
  };
}

function formatShortDate(d) {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** DD/MM/YYYY — matches on-screen sales invoice preview. */
function formatDisplayDate(d) {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-GB');
}

/**
 * @param {PDFKit.PDFDocument} doc
 * @param {number} startY
 * @param {object} standardInvoice
 * @param {object} opts
 * @param {'classic'|'classic-sales'|'minimal'|'modern'} opts.variant
 * @returns {{ y: number, pageNumber: number }}
 */
function drawInvoiceLineItems(doc, startY, standardInvoice, opts) {
  const { variant, invoiceNumber } = opts;

  if (variant === 'classic-sales') {
    return drawClassicSalesLineItems(doc, startY, standardInvoice, invoiceNumber);
  }

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
    const lineCcy = standardInvoice.details?.currency || 'USD';
    doc.text(pdfAmount(item.unitAmount, lineCcy), col5, rowY + 4, { width: 40, align: 'right' });
    doc.text(pdfAmount(item.netAmount, lineCcy), col6, rowY + 4, { width: 85, align: 'right' });
    y += rowHeight;
  });

  return { y: y + 10, pageNumber };
}

/** Column boundaries for classic sales invoice table (50–545 pt). */
const CLASSIC_SALES_TABLE = {
  bounds: [50, 76, 258, 312, 368, 414, 468, 545],
  pad: 6,
  baseHeaders: ['#', 'Item', 'Qty', null, 'Tax %', 'Tax Amt', 'Amount'],
};

function classicSalesCellInner(colIndex) {
  const left = CLASSIC_SALES_TABLE.bounds[colIndex];
  const right = CLASSIC_SALES_TABLE.bounds[colIndex + 1];
  const pad = CLASSIC_SALES_TABLE.pad;
  return {
    x: left + pad,
    width: right - left - pad * 2,
    align: colIndex <= 1 ? 'left' : 'right',
  };
}

/** Sales invoice table: #, Item, Qty, Rate, Tax %, Tax Amt, Amount (matches UI preview). */
function drawClassicSalesLineItems(doc, startY, standardInvoice, invoiceNumber) {
  const { bounds, baseHeaders } = CLASSIC_SALES_TABLE;
  const tableLeft = bounds[0];
  const tableRight = bounds[bounds.length - 1];

  const itemCount = (standardInvoice.lineItems || []).length;
  const rowHeight = itemCount > 30 ? 14 : itemCount > 20 ? 16 : 18;
  const fontSize = itemCount > 30 ? 7 : itemCount > 20 ? 7.5 : 8;
  const headerFontSize = itemCount > 30 ? 8 : 9;
  const headerRowH = 20;
  const lineCcy = standardInvoice.details?.currency || 'USD';
  const headers = baseHeaders.map((label) => label ?? getRateColumnHeader(lineCcy));

  let y = startY;
  let pageNumber = 1;

  const drawTableHeader = (yPos) => {
    doc.fontSize(headerFontSize).font('Helvetica-Bold');
    doc.rect(tableLeft, yPos, tableRight - tableLeft, headerRowH).fillAndStroke('#000000', '#000000');
    doc.fillColor('#ffffff');
    headers.forEach((label, i) => {
      const cell = classicSalesCellInner(i);
      doc.text(label, cell.x, yPos + 6, { width: cell.width, align: cell.align });
    });
    doc.fillColor('#000000');
    return yPos + headerRowH;
  };

  const strokeRow = (rowY) => {
    doc.strokeColor('#000').lineWidth(0.5);
    for (let i = 0; i < bounds.length - 1; i++) {
      doc.rect(bounds[i], rowY, bounds[i + 1] - bounds[i], rowHeight).stroke();
    }
  };

  const drawDataCell = (colIndex, text, rowY) => {
    const cell = classicSalesCellInner(colIndex);
    doc.text(String(text ?? ''), cell.x, rowY + 4, { width: cell.width, align: cell.align });
  };

  y = drawTableHeader(y);
  doc.font('Helvetica').fontSize(fontSize);

  (standardInvoice.lineItems || []).forEach((item) => {
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
    strokeRow(rowY);

    const taxRate = parseFloat(item.taxRate || 0);
    const taxAmount = parseFloat(item.taxAmount || 0);
    const itemName =
      (item.itemName || '').length > 34 ? `${(item.itemName || '').substring(0, 31)}...` : item.itemName || '';

    doc.fillColor('#000');
    drawDataCell(0, item.sno || '', rowY);
    drawDataCell(1, itemName, rowY);
    drawDataCell(2, parseFloat(item.quantity || 0).toFixed(2), rowY);
    drawDataCell(3, formatNumber(item.unitAmount), rowY);
    drawDataCell(4, taxRate > 0 ? `${taxRate}%` : '-', rowY);
    drawDataCell(5, taxRate > 0 ? pdfAmount(taxAmount, lineCcy) : '-', rowY);
    drawDataCell(6, pdfAmount(item.netAmount, lineCcy), rowY);
    y += rowHeight;
  });

  return { y: y + 10, pageNumber };
}

function drawTotalsBlock(doc, y, standardInvoice, options = {}) {
  const currency = standardInvoice.details?.currency || 'USD';

  let labelX;
  let labelWidth;
  let valueX;
  let valueWidth;

  if (options.classicSalesTable) {
    const amountCell = classicSalesCellInner(6);
    const labelGap = 10;
    labelWidth = 88;
    valueX = amountCell.x;
    valueWidth = amountCell.width;
    labelX = valueX - labelGap - labelWidth;
  } else {
    const pageRight = 545;
    valueWidth = 95;
    valueX = pageRight - valueWidth;
    labelWidth = 110;
    labelX = valueX - labelWidth - 8;
  }

  const moneyRow = (label, amountStr, yPos, rowOptions = {}) => {
    const { size = 9, valueBold = false } = rowOptions;
    doc.fontSize(size).font('Helvetica-Bold').fillColor('#000').text(`${label}:`, labelX, yPos, {
      width: labelWidth,
      align: 'right',
    });
    doc.font(valueBold ? 'Helvetica-Bold' : 'Helvetica').text(amountStr, valueX, yPos, {
      width: valueWidth,
      align: 'right',
    });
  };

  let yy = y;
  moneyRow('Subtotal', pdfAmount(standardInvoice.totals?.subtotal, currency), yy);
  yy += 15;
  moneyRow('Tax', pdfAmount(standardInvoice.totals?.totalTaxAmount, currency), yy);
  yy += 15;
  moneyRow('Discount', pdfAmount(standardInvoice.totals?.totalDiscountAmount, currency), yy);
  yy += 15;
  moneyRow('Grand Total', pdfAmount(standardInvoice.totals?.grandTotal, currency), yy, {
    size: 11,
    valueBold: true,
  });
  yy += 22;

  const wordsLeft = 50;
  const wordsWidth = 545 - wordsLeft;
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
  const bankTitle =
    standardInvoice?.details?.type === 'sales' || standardInvoice?.metadata?.type === 'sales'
      ? 'Customer Bank Details'
      : 'Vendor Bank Details';
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text(bankTitle, 60, ty);
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

function isSalesStandardInvoice(standardInvoice) {
  if (!standardInvoice) return true;
  const t = standardInvoice.details?.type || standardInvoice.metadata?.type;
  return t !== 'purchase';
}

function buildCompanyBankRows(companySettings) {
  return [
    ["A/c Holder's Name", companySettings?.company_name],
    ['Bank Name', companySettings?.bank_name],
    ['A/c No.', companySettings?.account_number],
    [
      'Branch & IFSC Code',
      [companySettings?.branch_name, companySettings?.ifsc_code].filter(Boolean).join(' / ') ||
        companySettings?.ifsc_code,
    ],
    ['SWIFT Code', companySettings?.swift_code],
  ];
}

function buildVendorBankRows(party) {
  const b = party?.bankDetails || {};
  const holder =
    b.accountHolder ||
    b.account_holder ||
    b.account_holder_name ||
    party?.name ||
    party?.companyName;
  return [
    ["A/c Holder's Name", holder],
    ['Bank Name', b.bankName || b.bank_name],
    ['A/c No.', b.accountNumber || b.account_number],
    [
      'Branch & IFSC Code',
      [b.branchName || b.branch_name, b.ifscCode || b.ifsc_code].filter(Boolean).join(' / ') ||
        b.ifscCode ||
        b.ifsc_code,
    ],
    ['SWIFT Code', b.swiftCode || b.swift_code],
  ];
}

function hasBankRows(rows) {
  return rows.some(([, val]) => val != null && String(val).trim() !== '');
}

/**
 * Draw label/value bank rows (classic footer — 8pt).
 * @returns {number} bottom Y
 */
function drawBankDetailsFooter(doc, footerY, title, rows, options = {}) {
  const leftX = options.leftX ?? 50;
  const width = options.width ?? 310;
  if (!hasBankRows(rows)) return footerY;

  let ty = footerY;
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#000').text(title, leftX, ty, { width });
  ty += 14;
  doc.fontSize(8).font('Helvetica');

  rows.forEach(([label, val]) => {
    if (val == null || String(val).trim() === '') return;
    doc.font('Helvetica-Bold').text(`${label}: `, leftX, ty, { continued: true, width });
    doc.font('Helvetica').text(String(val), { width: width - 10 });
    ty += 12;
  });

  doc.fillColor('#000');
  return ty;
}

/** Tally/proforma compact bank block (6.5pt). @returns {number} bottom Y */
function drawTallyBankBlock(doc, x, startY, title, rows, maxWidth) {
  if (!hasBankRows(rows)) return startY;
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#000').text(title, x, startY);
  let by = startY + 9;
  doc.fontSize(6.5).font('Helvetica');
  rows.forEach(([label, val]) => {
    if (val == null || String(val).trim() === '') return;
    doc.font('Helvetica-Bold').text(`${label}: `, x, by, { continued: true });
    doc.font('Helvetica').text(String(val), { width: maxWidth });
    by += 10;
  });
  doc.fillColor('#000');
  return by;
}

/**
 * Company bank details (left footer) — from Company Settings / institution_profiles.
 */
function drawCompanyBankFooter(doc, footerY, companySettings, options = {}) {
  return drawBankDetailsFooter(
    doc,
    footerY,
    "Company's Bank Details",
    buildCompanyBankRows(companySettings),
    options
  );
}

/** Vendor bank details (purchase invoices). */
function drawVendorBankFooter(doc, footerY, partyDetails, options = {}) {
  return drawBankDetailsFooter(
    doc,
    footerY,
    "Vendor's Bank Details",
    buildVendorBankRows(partyDetails),
    options
  );
}

function drawStampSignature(doc, y, companySettings, stampBuffer, signatureBuffer, standardInvoice = null) {
  const footerY = y;
  const signColX = 380;
  const isSales = isSalesStandardInvoice(standardInvoice);

  if (isSales) {
    drawCompanyBankFooter(doc, footerY, companySettings);
  } else {
    drawVendorBankFooter(doc, footerY, standardInvoice?.partyDetails);
  }

  const hasLeftBank = isSales
    ? Boolean(companySettings?.bank_name) || Boolean(companySettings?.account_number)
    : hasBankRows(buildVendorBankRows(standardInvoice?.partyDetails));

  if (stampBuffer && !hasLeftBank) {
    doc.image(stampBuffer, 50, footerY, { width: 80, height: 80 });
  }

  if (signatureBuffer) {
    doc.image(signatureBuffer, signColX, footerY, { width: 100, height: 60 });
  }

  const titleY = footerY + (signatureBuffer ? 62 : 0);
  const lineY = footerY + (signatureBuffer ? 76 : 14);
  const nameY = lineY + 10;
  const roleY = nameY + 12;

  doc.fontSize(8).font('Helvetica-Bold').fillColor('#000').text('Authorized signatory', signColX, titleY, {
    width: 155,
  });
  doc.fontSize(8).font('Helvetica').fillColor('#000').text('_____________________', signColX, lineY);
  doc.text(companySettings?.authorized_signatory_name || 'Authorized Signatory', signColX, nameY, {
    width: 155,
  });
  doc.text(companySettings?.authorized_signatory_designation || '', signColX, roleY, { width: 155 });
}

module.exports = {
  INVOICE_LOGO_BOX,
  drawCompanyLogoTopLeft,
  formatShortDate,
  formatDisplayDate,
  drawInvoiceLineItems,
  drawTotalsBlock,
  drawPartyBankBox,
  isSalesStandardInvoice,
  buildCompanyBankRows,
  buildVendorBankRows,
  drawBankDetailsFooter,
  drawTallyBankBlock,
  drawCompanyBankFooter,
  drawVendorBankFooter,
  drawStampSignature,
};
