/**
 * Branded invoice PDF layout (logo + parallelogram company banner, split table header, payment footer).
 */

const BRAND_BLUE = '#0099DD';
const BRAND_GRAY = '#4A4A4A';
const BRAND_LIGHT = '#E8E8E8';

function formatInvoiceDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd} / ${mm} / ${yyyy}`;
}

const { formatDocumentAmount, formatNumber, getRateColumnHeader } = require('../../utils/currencyFormat');
const formatMoney = (amount, currencyCode) => formatDocumentAmount(amount, currencyCode, { pdf: true });

/** Filled quadrilateral with horizontal skew (parallelogram). */
function fillSkewRect(doc, x, y, w, h, skew, color) {
  doc.save();
  doc.moveTo(x + skew, y);
  doc.lineTo(x + w + skew, y);
  doc.lineTo(x + w, y + h);
  doc.lineTo(x, y + h);
  doc.closePath();
  doc.fill(color);
  doc.restore();
}

/** Draw wrapped lines; returns new Y. */
function drawLines(doc, lines, x, y, width, lineGap = 11) {
  let ty = y;
  (lines || []).filter(Boolean).forEach((line) => {
    doc.text(String(line), x, ty, { width });
    ty += lineGap;
  });
  return ty;
}

/**
 * Top-right parallelogram banner with company name and contact (replaces "INVOICE" title).
 * @returns {number} bottom Y
 */
function drawParallelogramCompanyBanner(doc, x, y, companyStrings) {
  const w = 210;
  const skew = 12;
  const padX = 16;
  const padY = 10;
  const textW = w - padX * 2;

  const contentLines = [];
  if (companyStrings?.companyName) {
    contentLines.push({ text: companyStrings.companyName, bold: true, size: 13 });
  }
  if (companyStrings?.address) {
    contentLines.push({ text: companyStrings.address, bold: false, size: 7.5 });
  }
  if (companyStrings?.cityLine) {
    contentLines.push({ text: companyStrings.cityLine, bold: false, size: 7.5 });
  }
  if (companyStrings?.phone) {
    contentLines.push({ text: `Phone: ${companyStrings.phone}`, bold: false, size: 7.5 });
  }
  if (companyStrings?.email) {
    contentLines.push({ text: `Email: ${companyStrings.email}`, bold: false, size: 7.5 });
  }
  if (companyStrings?.taxId) {
    contentLines.push({ text: `GSTIN: ${companyStrings.taxId}`, bold: false, size: 7 });
  }
  if (companyStrings?.pan) {
    contentLines.push({ text: `PAN: ${companyStrings.pan}`, bold: false, size: 7 });
  }

  const lineH = 11;
  const h = Math.max(52, padY * 2 + contentLines.length * lineH + 4);

  fillSkewRect(doc, x, y, w, h, skew, BRAND_GRAY);
  fillSkewRect(doc, x - 14, y + 6, 18, h - 12, 6, BRAND_BLUE);
  fillSkewRect(doc, x + w + skew + 4, y + 6, 18, h - 12, 6, BRAND_BLUE);

  let ty = y + padY;
  contentLines.forEach((line) => {
    doc
      .fontSize(line.size)
      .font(line.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor('#ffffff');
    doc.text(line.text, x + padX, ty, { width: textW, align: 'left' });
    ty += line.bold ? 15 : lineH;
  });

  doc.fillColor('#000000');
  return y + h;
}

/**
 * @returns {{ y: number, pageNumber: number }}
 */
function drawBrandedLineItems(doc, startY, standardInvoice, opts) {
  const { invoiceNumber } = opts;
  const currency = standardInvoice.details?.currency || 'USD';
  const left = 50;
  const right = 545;
  const tableW = right - left;

  const colSl = 36;
  const colDesc = 248;
  const colPrice = 72;
  const colQty = 52;
  const colTotal = tableW - colSl - colDesc - colPrice - colQty;

  const xSl = left;
  const xDesc = left + colSl;
  const xPrice = xDesc + colDesc;
  const xQty = xPrice + colPrice;
  const xTotal = xQty + colQty;

  const items = standardInvoice.lineItems || [];
  const rowHeight = items.length > 25 ? 14 : 18;
  const fontSize = items.length > 25 ? 7.5 : 8.5;
  const headerH = 22;

  let y = startY;
  let pageNumber = 1;

  const drawHeader = (yPos) => {
    fillSkewRect(doc, left, yPos, colSl + colDesc, headerH, 0, BRAND_BLUE);
    fillSkewRect(doc, xPrice, yPos, colPrice + colQty + colTotal, headerH, 0, BRAND_GRAY);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('SL.', xSl + 4, yPos + 6, { width: colSl - 8 });
    doc.text('Item Description', xDesc + 6, yPos + 6, { width: colDesc - 12 });
    const priceHeader = getRateColumnHeader(currency);
    const priceHeaderFont = priceHeader.length > 14 ? 7.5 : 9;
    doc.fontSize(priceHeaderFont).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text(priceHeader, xPrice, yPos + 6, { width: colPrice, align: 'center' });
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('Qty.', xQty, yPos + 6, { width: colQty, align: 'center' });
    doc.text('Total', xTotal, yPos + 6, { width: colTotal - 4, align: 'right' });
    doc.fillColor('#000000');
    return yPos + headerH;
  };

  y = drawHeader(y);
  doc.font('Helvetica').fontSize(fontSize);

  items.forEach((item, index) => {
    if (y > 620) {
      doc.fontSize(8).font('Helvetica').fillColor('#888').text(`Page ${pageNumber}`, right - 60, 780);
      doc.addPage();
      pageNumber += 1;
      y = 40;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text(`Invoice: ${invoiceNumber}`, left, y);
      y += 22;
      y = drawHeader(y);
      doc.font('Helvetica').fontSize(fontSize);
    }

    const rowY = y;
    doc.strokeColor(BRAND_LIGHT).lineWidth(0.6);
    doc.rect(left, rowY, tableW, rowHeight).stroke();
    doc.moveTo(xDesc, rowY).lineTo(xDesc, rowY + rowHeight).stroke();
    doc.moveTo(xPrice, rowY).lineTo(xPrice, rowY + rowHeight).stroke();
    doc.moveTo(xQty, rowY).lineTo(xQty, rowY + rowHeight).stroke();
    doc.moveTo(xTotal, rowY).lineTo(xTotal, rowY + rowHeight).stroke();

    const name =
      (item.itemName || '').length > 42
        ? `${(item.itemName || '').substring(0, 39)}...`
        : item.itemName || '';

    doc.fillColor('#333333');
    doc.text(String(item.sno || index + 1), xSl + 4, rowY + 5, { width: colSl - 8 });
    doc.text(name, xDesc + 6, rowY + 5, { width: colDesc - 12 });
    doc.text(formatNumber(item.unitAmount), xPrice, rowY + 5, { width: colPrice, align: 'center' });
    const qtyN = parseFloat(item.quantity || 0);
    doc.text(qtyN.toFixed(qtyN % 1 === 0 ? 0 : 2), xQty, rowY + 5, {
      width: colQty,
      align: 'center',
    });
    doc.text(formatMoney(item.netAmount, currency), xTotal, rowY + 5, { width: colTotal - 6, align: 'right' });
    y += rowHeight;
  });

  return { y: y + 12, pageNumber };
}

function drawBrandedTotals(doc, y, standardInvoice) {
  const currency = standardInvoice.details?.currency || 'USD';
  const left = 50;
  const right = 545;
  const subtotal = parseFloat(standardInvoice.totals?.subtotal || 0);
  const tax = parseFloat(standardInvoice.totals?.totalTaxAmount || 0);
  const discount = parseFloat(standardInvoice.totals?.totalDiscountAmount || 0);
  const grand = parseFloat(standardInvoice.totals?.grandTotal || 0);
  const taxPct = subtotal > 0 ? ((tax / (subtotal - discount)) * 100).toFixed(2) : '0.00';

  doc.fontSize(10).font('Helvetica').fillColor('#333').text('Thank you for your business', left, y + 8);

  const boxLeft = 320;
  const labelW = 100;
  const valW = 90;
  let ty = y;

  const row = (label, value, bold = false) => {
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#000').text(label, boxLeft, ty, { width: labelW, align: 'right' });
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(value, boxLeft + labelW + 10, ty, { width: valW, align: 'right' });
    ty += 16;
  };

  row('Sub Total:', formatMoney(subtotal, currency));
  row('Tax:', `${formatMoney(tax, currency)} (${taxPct}%)`);
  if (discount > 0.005) {
    row('Discount:', formatMoney(discount, currency));
  }

  const barH = 26;
  const barW = labelW + valW + 10;
  const barX = boxLeft;
  const barY = ty + 4;
  fillSkewRect(doc, barX, barY, barW, barH, 10, BRAND_GRAY);
  fillSkewRect(doc, barX - 8, barY + 4, 10, barH - 8, 4, BRAND_BLUE);
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#ffffff');
  doc.text('Total:', barX + 8, barY + 7, { width: 55, align: 'left' });
  doc.text(formatMoney(grand, currency), barX + 65, barY + 7, { width: barW - 70, align: 'right' });
  doc.fillColor('#000000');

  const words = (standardInvoice.totals?.amountInWords || '').trim();
  if (words) {
    const wordsY = barY + barH + 10;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#333').text('Amount in words:', left, wordsY);
    doc.font('Helvetica-Oblique').text(words, left, wordsY + 11, { width: right - left });
  }

  return barY + barH + (words ? 36 : 20);
}

function paymentRow(doc, label, value, x, y, width = 280) {
  const v = value != null && String(value).trim() !== '' ? String(value).trim() : '—';
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#333').text(`${label}:`, x, y, { width: 82 });
  doc.font('Helvetica').text(v, x + 84, y, { width: width - 84 });
  return y + 12;
}

function drawBrandedFooter(doc, y, standardInvoice, companySettings, signatureBuffer) {
  const left = 50;
  const footerTop = y + 8;
  const pageBottom = 780;
  let ty = footerTop;

  doc.fontSize(10).font('Helvetica-Bold').fillColor(BRAND_BLUE).text('Payment Info:', left, ty);
  ty += 16;

  const acName = companySettings?.company_name || standardInvoice.header?.companyName;
  ty = paymentRow(doc, 'Account #', companySettings?.account_number, left, ty);
  ty = paymentRow(doc, 'A/C Name', acName, left, ty);
  ty = paymentRow(doc, 'Bank Name', companySettings?.bank_name, left, ty);
  ty = paymentRow(doc, 'IFSC Code', companySettings?.ifsc_code, left, ty);
  ty = paymentRow(doc, 'SWIFT / BIC', companySettings?.swift_code, left, ty);
  ty = paymentRow(doc, 'Email', companySettings?.email, left, ty);
  ty = paymentRow(doc, 'Phone', companySettings?.phone, left, ty);

  const termsY = ty + 8;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(BRAND_BLUE).text('Terms & Conditions', left, termsY);
  const termsText =
    (standardInvoice.footer?.terms || '').trim() ||
    (standardInvoice.footer?.notes || '').trim() ||
    (standardInvoice.details?.paymentTerms
      ? `Payment terms: ${standardInvoice.details.paymentTerms}.`
      : 'Payment is due within the agreed period. Late payments may incur charges.');
  doc.fontSize(7).font('Helvetica').fillColor('#555').text(termsText, left, termsY + 14, { width: 300, lineGap: 2 });

  const signX = 380;
  const signY = footerTop;
  if (signatureBuffer) {
    doc.image(signatureBuffer, signX, signY, { width: 110, height: 52 });
  }
  const titleY = signY + (signatureBuffer ? 56 : 2);
  const lineY = titleY + 12;
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#333').text('Authorized signatory', signX, titleY, {
    width: 130,
    align: 'center',
  });
  doc.moveTo(signX, lineY).lineTo(signX + 130, lineY).strokeColor('#999').lineWidth(0.8).stroke();
  const sigName = companySettings?.authorized_signatory_name;
  const sigRole = companySettings?.authorized_signatory_designation;
  if (sigName) {
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#333').text(sigName, signX, lineY + 8, { width: 130, align: 'center' });
  }
  if (sigRole) {
    doc.font('Helvetica').fontSize(7).text(sigRole, signX, lineY + 22, { width: 130, align: 'center' });
  }

  return Math.max(ty, lineY + 38);
}

function hasAddress(addr) {
  if (!addr) return false;
  return !!(
    addr.attention ||
    addr.line1 ||
    addr.line2 ||
    addr.city ||
    addr.state ||
    addr.country ||
    addr.postalCode
  );
}

/** Bill to / Ship to columns + right meta slot (A4 content width 50–545). */
function getSalesPartyColumnLayout(options = {}) {
  const pageRight = 545;
  const metaWidth = options.metaWidth != null ? options.metaWidth : 128;
  const metaGutter = options.metaGutter != null ? options.metaGutter : 12;
  const metaX = pageRight - metaWidth;
  const blocksRight = metaX - metaGutter;
  const billStart = options.billStartX != null ? options.billStartX : 50;
  const billColWidth = options.billColWidth != null ? options.billColWidth : 165;
  const billShipGap = options.billShipGap != null ? options.billShipGap : 28;
  const shipX = billStart + billColWidth + billShipGap;
  const shipColWidth = Math.max(70, blocksRight - shipX);
  return {
    pageLeft: billStart,
    billX: billStart,
    shipX,
    billColWidth,
    shipColWidth,
    colWidth: billColWidth,
    metaX,
    metaWidth,
    labelRowH: 16,
    nameRowH: 14,
    lineH: 12,
  };
}

/** Draw wrapped text and return the next Y (prevents stacked-line overlap). */
function drawWrappedText(doc, text, x, y, width, options = {}) {
  if (text == null || text === '') return y;
  const { fontSize = 9, font = 'Helvetica', color = '#444', lineGap = 2, gapAfter = 4 } = options;
  const value = String(text);
  doc.font(font).fontSize(fontSize).fillColor(color);
  const blockHeight = doc.heightOfString(value, { width, lineGap });
  doc.text(value, x, y, { width, lineGap });
  return y + blockHeight + gapAfter;
}

/**
 * Party address body (no section label). Used for aligned Bill to / Ship to columns.
 * @returns {number} bottom Y
 */
function drawBrandedPartyContent(doc, x, startY, width, party, options = {}) {
  const {
    addressKey = 'billing',
    showName = false,
    nameText = '',
    reserveNameLine = false,
    showContact = false,
    showGst = false,
    skipAttention = false,
  } = options;
  const addr =
    addressKey === 'shipping' ? party.shippingAddress || {} : party.billingAddress || {};

  let y = startY;

  if (showName && nameText) {
    y = drawWrappedText(doc, nameText, x, y, width, {
      fontSize: 11,
      font: 'Helvetica-Bold',
      color: '#000',
      gapAfter: 6,
    });
  } else if (reserveNameLine) {
    y += 14;
  }

  if (addr.attention && !skipAttention) {
    y = drawWrappedText(doc, addr.attention, x, y, width);
  }
  if (addr.line1) {
    y = drawWrappedText(doc, addr.line1, x, y, width);
  }
  if (addr.line2) {
    y = drawWrappedText(doc, addr.line2, x, y, width);
  }
  const cityLine = [addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ');
  if (cityLine) {
    y = drawWrappedText(doc, cityLine, x, y, width);
  }
  if (addr.country) {
    y = drawWrappedText(doc, addr.country, x, y, width);
  }

  if (!hasAddress(addr)) {
    y = drawWrappedText(doc, addressKey === 'shipping' ? 'No shipping address on file' : 'No billing address on file', x, y, width, {
      fontSize: 8,
      font: 'Helvetica-Oblique',
      color: '#888',
      gapAfter: 6,
    });
  }

  if (showContact) {
    const phone = party.contact?.phone || party.contact?.mobile;
    if (phone) {
      y = drawWrappedText(doc, `Phone: ${phone}`, x, y, width);
    }
    if (party.contact?.email) {
      y = drawWrappedText(doc, `Email: ${party.contact.email}`, x, y, width);
    }
  }
  if (showGst && party.taxInfo?.gstin) {
    y = drawWrappedText(doc, `GSTIN: ${party.taxInfo.gstin}`, x, y, width);
  }

  doc.fillColor('#000000');
  return y;
}

/**
 * Bill to + Ship to with aligned headers and matching name-row height.
 * @returns {{ bottomY: number, layout: object }}
 */
function drawSalesBillShipColumns(doc, startY, party, options = {}) {
  const {
    showGst = false,
    billLabel = 'Bill to',
    shipLabel = 'Ship to',
    shipShowName = false,
    columnLayout = {},
  } = options;
  const layout = getSalesPartyColumnLayout(columnLayout);
  const { billX, shipX, billColWidth, shipColWidth } = layout;

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#000');
  doc.text(billLabel, billX, startY, { width: billColWidth });
  doc.text(shipLabel, shipX, startY, { width: shipColWidth });

  const contentY = startY + layout.labelRowH;
  const billHasName = Boolean(party?.name);
  const shipAttention = party?.shippingAddress?.attention;

  const billY = drawBrandedPartyContent(doc, billX, contentY, billColWidth, party, {
    addressKey: 'billing',
    showName: billHasName,
    nameText: party.name,
    showContact: true,
    showGst,
  });

  const shipY = drawBrandedPartyContent(doc, shipX, contentY, shipColWidth, party, {
    addressKey: 'shipping',
    showName: shipShowName && Boolean(shipAttention),
    nameText: shipAttention || '',
    reserveNameLine: false,
    skipAttention: Boolean(shipAttention),
  });

  return { bottomY: Math.max(billY, shipY), layout };
}

/**
 * Bill to / Ship to column for branded layout (single column with label).
 * @returns {number} bottom Y
 */
function drawBrandedPartyColumn(doc, x, startY, width, label, party, options = {}) {
  const { addressKey = 'billing', showName = true, showContact = false, showGst = false } = options;

  let y = startY;
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text(label, x, y, { width });
  y += 16;

  return drawBrandedPartyContent(doc, x, y, width, party, {
    addressKey,
    showName: showName && Boolean(party?.name),
    nameText: party?.name || '',
    showContact,
    showGst,
  });
}

/**
 * Company block under logo (address, phone, email, tax id).
 * @returns {number} bottom Y
 */
function drawBrandedCompanyBlock(doc, x, startY, companyStrings, width = 260) {
  let y = startY;
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#000').text(companyStrings.companyName || 'Company Name', x, y, {
    width,
  });
  y += 20;
  doc.fontSize(8).font('Helvetica').fillColor('#555');
  if (companyStrings.address) {
    y = drawLines(doc, [companyStrings.address], x, y, width, 10);
  }
  if (companyStrings.cityLine) {
    y = drawLines(doc, [companyStrings.cityLine], x, y, width, 10);
  }
  if (companyStrings.phone) {
    y = drawLines(doc, [`Phone: ${companyStrings.phone}`], x, y, width, 10);
  }
  if (companyStrings.email) {
    y = drawLines(doc, [`Email: ${companyStrings.email}`], x, y, width, 10);
  }
  if (companyStrings.taxId) {
    y = drawLines(doc, [`GSTIN: ${companyStrings.taxId}`], x, y, width, 10);
  }
  if (companyStrings.pan) {
    y = drawLines(doc, [`PAN: ${companyStrings.pan}`], x, y, width, 10);
  }
  doc.fillColor('#000');
  return y;
}

module.exports = {
  BRAND_BLUE,
  BRAND_GRAY,
  formatInvoiceDate,
  formatMoney,
  fillSkewRect,
  drawParallelogramCompanyBanner,
  hasAddress,
  getSalesPartyColumnLayout,
  drawSalesBillShipColumns,
  drawBrandedPartyContent,
  drawBrandedPartyColumn,
  drawBrandedCompanyBlock,
  drawBrandedLineItems,
  drawBrandedTotals,
  drawBrandedFooter,
};
