/**
 * Tally-style GST grid invoice — bordered cells, column dividers, aligned meta grid.
 */

const { formatDocumentAmount, formatNumber } = require('../../utils/currencyFormat');
const { normalizeInvoiceUnit } = require('../../utils/invoiceUnit');
const invoiceTemplateService = require('./invoiceTemplate.service');
const { buildTallyMetaGridRows, drawTallyMetaGrid, measureMetaRowHeight } = require('./invoicePdfMetaGrid');
const {
  buildCompanyBankRows,
  buildVendorBankRows,
  drawTallyBankBlock,
} = require('./invoicePdfDrawShared');

const PAGE_W = 595.28;
const MARGIN = 12;
const LEFT = MARGIN;
const RIGHT = PAGE_W - MARGIN;
const WIDTH = RIGHT - LEFT;
const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const LINE = 0.45;

const GST_STATE_NAMES = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman & Diu',
  '26': 'Dadra & Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
  '38': 'Ladakh',
};

function formatTallyDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${dt.getDate()}-${months[dt.getMonth()]}-${String(dt.getFullYear()).slice(-2)}`;
}

function gstStateFromGstin(gstin, fallbackState) {
  const g = String(gstin || '').trim().toUpperCase();
  const code = g.length >= 2 ? g.slice(0, 2) : '';
  const name = (code && GST_STATE_NAMES[code]) || fallbackState || '';
  return { code, name };
}

function hsnOf(item) {
  return item.hsnCode || item.hsn_code || '';
}

function normalizeUnit(raw) {
  return normalizeInvoiceUnit(raw, 'PCS');
}

function normalizeQuantity(raw) {
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function formatLineQty(quantity) {
  const q = normalizeQuantity(quantity);
  if (q === 0) return '0';
  return Number.isInteger(q) || Math.abs(q - Math.round(q)) < 0.001 ? String(Math.round(q * 100) / 100) : q.toFixed(2);
}

function formatQtyAmount(value, currency) {
  const code = String(currency || 'INR').toUpperCase();
  const num = Number(value);
  if (!Number.isFinite(num)) return '0.00';
  const grouped =
    code === 'INR'
      ? num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : formatNumber(num);
  return grouped;
}

function pdfAmount(amount, currencyCode) {
  const code = String(currencyCode || 'INR').toUpperCase();
  const grouped = formatQtyAmount(amount, code);
  if (code === 'INR') return `Rs.${grouped}`;
  return formatDocumentAmount(amount, currencyCode, { pdf: true });
}

function formatAddressLines(addr) {
  if (!addr) return [];
  const lines = [];
  const l1 = [addr.line1, addr.line2].filter(Boolean).join(', ');
  if (l1) lines.push(l1);
  const cityLine = [addr.city, addr.state, addr.postalCode || addr.postal_code].filter(Boolean).join(', ');
  if (cityLine) lines.push(cityLine);
  return lines;
}

/** Draw rectangle border. */
function box(doc, x, y, w, h) {
  doc.save();
  doc.lineWidth(LINE).strokeColor('#000000').rect(x, y, w, h).stroke();
  doc.restore();
}

/**
 * Table with column dividers; each row is array of cell objects { text, align, bold, fontSize, padTop }.
 * @returns {number} bottom Y
 */
function drawGridTable(doc, x, y, colWidths, rows, defaultRowH = 16) {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  let cy = y;

  rows.forEach((row) => {
    const rowH = row._height || defaultRowH;
    box(doc, x, cy, totalW, rowH);

    let cx = x;
    for (let i = 0; i < colWidths.length - 1; i++) {
      cx += colWidths[i];
      doc.save();
      doc.lineWidth(LINE).strokeColor('#000000');
      doc.moveTo(cx, cy).lineTo(cx, cy + rowH).stroke();
      doc.restore();
    }

    let cellX = x;
    row.cells.forEach((cell, i) => {
      const cw = colWidths[i] || colWidths[colWidths.length - 1];
      const pad = 3;
      const padTop = cell.padTop ?? 4;
      const textH = Math.max(8, rowH - padTop - 3);
      doc.fontSize(cell.fontSize ?? 7).font(cell.bold ? FONT_BOLD : FONT).fillColor('#000000');
      doc.text(String(cell.text ?? ''), cellX + pad, cy + padTop, {
        width: cw - pad * 2,
        height: textH,
        align: cell.align || 'left',
        lineGap: 0.5,
        ellipsis: true,
      });
      cellX += cw;
    });

    cy += rowH;
  });

  return cy;
}

function buildHsnTaxSummary(lineItems) {
  const map = new Map();
  (lineItems || []).forEach((item) => {
    const hsn = hsnOf(item) || '-';
    const taxable = Number(item.taxableAmount ?? item.lineTotal ?? 0) || 0;
    const taxAmt = Number(item.taxAmount ?? 0) || 0;
    const rate = Number(item.taxRate ?? 0) || 0;
    if (!map.has(hsn)) map.set(hsn, { hsn, taxable: 0, tax: 0, rate });
    const row = map.get(hsn);
    row.taxable += taxable;
    row.tax += taxAmt;
    if (!row.rate && rate) row.rate = rate;
  });
  return [...map.values()];
}

function sumQty(lineItems) {
  return (lineItems || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
}

function primaryUnit(lineItems) {
  for (const it of lineItems || []) {
    const u = normalizeUnit(it.unit);
    if (u) return u;
  }
  return 'PCS';
}

function measureItemRowHeight(doc, cells, colWidths, minH = 15) {
  let maxH = minH;
  cells.forEach((cell, i) => {
    const cw = colWidths[i] || colWidths[colWidths.length - 1];
    doc.fontSize(cell.fontSize ?? 7).font(cell.bold ? FONT_BOLD : FONT);
    const text = String(cell.text ?? '');
    if (!text) return;
    const h = doc.heightOfString(text, { width: cw - 6, lineGap: 0.5 });
    maxH = Math.max(maxH, Math.ceil(h) + 8);
  });
  return Math.min(maxH, 36);
}

function measurePartyBlockHeight(addr, gst, extraLines = []) {
  let h = 28;
  formatAddressLines(addr).forEach(() => {
    h += 9;
  });
  if (gst) h += 9;
  h += 9;
  h += extraLines.length * 9;
  return Math.max(h, 52);
}

/**
 * @param {import('pdfkit').PDFDocument} doc
 * @param {object} ctx
 */
function drawProformaInvoice(doc, ctx) {
  const { standardInvoice, companySettings, logoBuffer, signatureBuffer } = ctx;
  const isSales = (standardInvoice.details?.type || standardInvoice.metadata?.type) === 'sales';
  const currency = standardInvoice.details?.currency || 'INR';
  const cs = ctx.companyStrings || {};
  const party = standardInvoice.partyDetails || {};
  const lineItems = standardInvoice.lineItems || [];
  const totals = standardInvoice.totals || {};

  const docTitle = isSales ? 'TAX INVOICE' : 'PURCHASE INVOICE';
  const sellerGst = cs.taxId || standardInvoice.header?.taxInfo?.taxId || '';
  const sellerState = gstStateFromGstin(
    sellerGst,
    companySettings?.state || standardInvoice.header?.address?.state
  );
  const partyGst = party.taxInfo?.gstin || '';
  const partyState = gstStateFromGstin(partyGst, party.billingAddress?.state);

  let y = MARGIN + 4;

  doc.fontSize(12).font(FONT_BOLD).text(docTitle, LEFT, y, { width: WIDTH, align: 'center' });
  doc.fontSize(6.5).font(FONT).text('(ORIGINAL FOR RECIPIENT)', LEFT, y + 1, { width: WIDTH - 2, align: 'right' });
  y += 20;

  const metaW = Math.round(WIDTH * 0.44);
  const sellerW = WIDTH - metaW;
  const metaX = LEFT + sellerW;
  const halfMeta = metaW / 2;
  const metaColWidths = [halfMeta, halfMeta];
  const metaGridRows = buildTallyMetaGridRows(standardInvoice, party);

  metaGridRows.forEach((row) => {
    const cols =
      row.cells.length === 1 ? [metaW] : metaColWidths;
    row._height = measureMetaRowHeight(doc, row.cells, cols);
  });

  const topH = metaGridRows.reduce((sum, row) => sum + row._height, 0);

  box(doc, LEFT, y, sellerW, topH);
  box(doc, metaX, y, metaW, topH);

  const sx = LEFT + 6;
  const contentW = sellerW - 12;
  let sy = y + 6;
  const LOGO_W = 46;
  const LOGO_H = 34;

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, sx, sy, { fit: [LOGO_W, LOGO_H], align: 'left', valign: 'top' });
      sy += LOGO_H + 6;
    } catch {
      /* ignore bad image */
    }
  }

  doc.fontSize(9.5).font(FONT_BOLD).fillColor('#000000');
  const nameH = doc.heightOfString(cs.companyName || 'Company', { width: contentW });
  doc.text(cs.companyName || 'Company', sx, sy, { width: contentW });
  sy += nameH + 3;

  doc.fontSize(6.5).font(FONT);
  const sellerLines = [
    cs.address,
    cs.cityLine,
    sellerGst ? `GSTIN/UIN: ${sellerGst}` : '',
    sellerState.name || sellerState.code
      ? `State Name: ${sellerState.name || '—'}, Code: ${sellerState.code || '—'}`
      : '',
    cs.phone || '',
    cs.email ? `E-Mail: ${cs.email}` : '',
  ].filter(Boolean);
  sellerLines.forEach((line) => {
    const lh = doc.heightOfString(line, { width: contentW, lineGap: 0.3 });
    if (sy + lh > y + topH - 4) return;
    doc.text(line, sx, sy, { width: contentW, lineGap: 0.3 });
    sy += lh + 2;
  });

  drawTallyMetaGrid(doc, metaX, y, metaW, metaGridRows);
  y += topH;

  const drawPartySection = (title, addr, gst, stateInfo, extraLines = []) => {
    const blockH = measurePartyBlockHeight(addr, gst, extraLines);
    box(doc, LEFT, y, WIDTH, blockH);
    doc.fontSize(6.5).font(FONT_BOLD).text(title, LEFT + 4, y + 3);
    let py = y + 12;
    doc.fontSize(7.5).font(FONT_BOLD).text(party.name || '—', LEFT + 4, py, { width: WIDTH - 8 });
    py += 10;
    doc.fontSize(6.5).font(FONT);
    formatAddressLines(addr).forEach((line) => {
      doc.text(line, LEFT + 4, py, { width: WIDTH - 8 });
      py += 9;
    });
    if (gst) {
      doc.text(`GSTIN/UIN: ${gst}`, LEFT + 4, py);
      py += 9;
    }
    if (stateInfo.name || stateInfo.code) {
      doc.text(`State Name: ${stateInfo.name || '—'}, Code: ${stateInfo.code || '—'}`, LEFT + 4, py);
      py += 9;
    }
    extraLines.forEach((line) => {
      doc.text(line, LEFT + 4, py);
      py += 9;
    });
    y += blockH;
  };

  if (isSales) {
    drawPartySection(
      'Consignee (Ship to)',
      party.shippingAddress,
      partyGst,
      gstStateFromGstin(partyGst, party.shippingAddress?.state)
    );
    drawPartySection(
      'Buyer (Bill to)',
      party.billingAddress,
      partyGst,
      partyState,
      partyState.name ? [`Place of Supply: ${partyState.name}`] : []
    );
  } else {
    drawPartySection('Bill From (Vendor)', party.billingAddress, partyGst, partyState);
  }

  const itemCols = [24, 175, 50, 48, 58, 26, WIDTH - 24 - 175 - 50 - 48 - 58 - 26];
  const itemRowH = 15;
  const itemHeaders = [
    'SI\nNo.',
    'Description of\nGoods and Services',
    'HSN/SAC',
    'Quantity',
    'Rate',
    'per',
    'Amount',
  ];

  const itemTableRows = [
    {
      _height: 22,
      cells: itemHeaders.map((h, i) => ({
        text: h,
        bold: true,
        fontSize: 6,
        align: i >= 3 ? 'center' : 'left',
        padTop: 3,
      })),
    },
  ];

  lineItems.forEach((item, idx) => {
    const taxable = item.taxableAmount ?? item.lineTotal ?? 0;
    const unit = normalizeUnit(item.unit);
    const qty = normalizeQuantity(item.quantity);
    const cells = [
      { text: String(idx + 1), align: 'center' },
      { text: (item.itemName || '').trim(), fontSize: 7 },
      { text: hsnOf(item) || '-', align: 'center', fontSize: 6.5 },
      { text: `${formatLineQty(qty)} ${unit}`, align: 'right', fontSize: 6.5 },
      { text: formatQtyAmount(item.unitAmount, currency), align: 'right' },
      { text: unit, align: 'center', fontSize: 6.5 },
      { text: pdfAmount(taxable, currency), align: 'right' },
    ];
    itemTableRows.push({
      _height: measureItemRowHeight(doc, cells, itemCols, itemRowH),
      cells,
    });
  });

  const minBlankRows = Math.max(0, 4 - lineItems.length);
  for (let b = 0; b < minBlankRows; b++) {
    itemTableRows.push({
      _height: itemRowH,
      cells: itemCols.map(() => ({ text: '' })),
    });
  }

  const totalTax = Number(totals.totalTaxAmount) || 0;
  if (totalTax > 0) {
    itemTableRows.push({
      _height: itemRowH,
      cells: [
        { text: '' },
        { text: 'IGST', bold: true },
        { text: '' },
        { text: '' },
        { text: '' },
        { text: '' },
        { text: pdfAmount(totalTax, currency), align: 'right', bold: true },
      ],
    });
  }

  itemTableRows.push({
    _height: itemRowH,
    cells: [
      { text: '' },
      { text: 'Total', bold: true, align: 'right' },
      { text: '' },
      {
        text: `${formatLineQty(sumQty(lineItems))} ${primaryUnit(lineItems)}`,
        align: 'right',
        bold: true,
        fontSize: 6.5,
      },
      { text: '' },
      { text: '' },
      { text: pdfAmount(totals.grandTotal, currency), align: 'right', bold: true },
    ],
  });

  if (y + itemTableRows.reduce((s, r) => s + (r._height || itemRowH), 0) > 700) {
    doc.addPage();
    y = MARGIN + 20;
  }

  y = drawGridTable(doc, LEFT, y, itemCols, itemTableRows, itemRowH);

  const wordsH = 20;
  box(doc, LEFT, y, WIDTH, wordsH);
  const amountWords = (totals.amountInWords || '').trim();
  const ccyLabel = String(currency).toUpperCase() === 'INR' ? 'INR' : currency;
  doc.fontSize(6.5).font(FONT_BOLD).text('Amount Chargeable (in words)', LEFT + 4, y + 5);
  doc.font(FONT).text(`${ccyLabel} ${amountWords}`, LEFT + 118, y + 5, { width: WIDTH - 200 });
  doc.fontSize(6).text('E. & O.E', RIGHT - 42, y + 5, { width: 38, align: 'right' });
  y += wordsH;

  const taxSummary = buildHsnTaxSummary(lineItems);
  const taxColW = [62, 92, 38, 58, WIDTH - 62 - 92 - 38 - 58];
  const taxHeadH1 = 14;
  const taxHeadH2 = 14;
  const taxHeaderH = taxHeadH1 + taxHeadH2;
  const taxDataH = 14;
  const taxTableH = taxHeaderH + taxSummary.length * taxDataH + taxDataH;

  box(doc, LEFT, y, WIDTH, taxTableH);
  const tx1 = LEFT;
  const tx2 = tx1 + taxColW[0];
  const tx3 = tx2 + taxColW[1];
  const tx4 = tx3 + taxColW[2] + taxColW[3];
  const txRate = tx3 + taxColW[2];
  const igstW = taxColW[2] + taxColW[3];

  const strokeLine = (x1, y1, x2, y2) => {
    doc.save();
    doc.lineWidth(LINE).strokeColor('#000000');
    doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
    doc.restore();
  };

  strokeLine(tx2, y, tx2, y + taxTableH);
  strokeLine(tx3, y, tx3, y + taxTableH);
  strokeLine(tx4, y, tx4, y + taxTableH);
  strokeLine(txRate, y + taxHeadH1, txRate, y + taxTableH);
  strokeLine(tx3, y + taxHeadH1, tx4, y + taxHeadH1);
  strokeLine(tx1, y + taxHeaderH, LEFT + WIDTH, y + taxHeaderH);

  const pad = 4;
  const headerCenterY = y + (taxHeaderH - 7) / 2;
  doc.fontSize(6).font(FONT_BOLD).fillColor('#000000');
  doc.text('HSN/SAC', tx1 + pad, headerCenterY, { width: taxColW[0] - pad * 2, align: 'center' });
  doc.text('Taxable Value', tx2 + pad, headerCenterY, { width: taxColW[1] - pad * 2, align: 'right' });
  doc.text('Total Tax Amount', tx4 + pad, headerCenterY, {
    width: taxColW[4] - pad * 2,
    align: 'right',
  });

  doc.text('IGST', tx3 + pad, y + 3, { width: igstW - pad * 2, align: 'center' });
  const h2y = y + taxHeadH1;
  doc.text('Rate', tx3 + pad, h2y + 4, { width: taxColW[2] - pad * 2, align: 'center' });
  doc.text('Amount', txRate + pad, h2y + 4, { width: taxColW[3] - pad * 2, align: 'right' });

  let ty = y + taxHeaderH;
  doc.font(FONT).fontSize(6.5);
  let sumTaxable = 0;
  let sumTax = 0;
  taxSummary.forEach((row) => {
    strokeLine(tx1, ty, LEFT + WIDTH, ty);
    doc.text(row.hsn, tx1 + 2, ty + 3, { width: taxColW[0] - 4 });
    doc.text(pdfAmount(row.taxable, currency), tx2 + 2, ty + 3, { width: taxColW[1] - 4, align: 'right' });
    doc.text(row.rate ? `${row.rate}%` : '-', tx3 + 2, ty + 3, { width: taxColW[2] - 4, align: 'center' });
    doc.text(pdfAmount(row.tax, currency), tx3 + taxColW[2] + 2, ty + 3, {
      width: taxColW[3] - 4,
      align: 'right',
    });
    doc.text(pdfAmount(row.tax, currency), tx4 + 2, ty + 3, { width: taxColW[4] - 4, align: 'right' });
    sumTaxable += row.taxable;
    sumTax += row.tax;
    ty += taxDataH;
  });

  strokeLine(tx1, ty, LEFT + WIDTH, ty);
  doc.font(FONT_BOLD);
  doc.text('Total', tx1 + 2, ty + 3);
  doc.text(pdfAmount(sumTaxable, currency), tx2 + 2, ty + 3, { width: taxColW[1] - 4, align: 'right' });
  doc.text(pdfAmount(sumTax, currency), tx3 + taxColW[2] + 2, ty + 3, { width: taxColW[3] - 4, align: 'right' });
  doc.text(pdfAmount(sumTax, currency), tx4 + 2, ty + 3, { width: taxColW[4] - 4, align: 'right' });
  y += taxTableH;

  const taxWordsH = 18;
  box(doc, LEFT, y, WIDTH, taxWordsH);
  const taxWords = invoiceTemplateService.convertAmountToWords(sumTax, currency);
  doc.fontSize(6.5).font(FONT_BOLD).text('Tax Amount (in words):', LEFT + 4, y + 5);
  doc.font(FONT).text(`${ccyLabel} ${taxWords}`, LEFT + 108, y + 5, { width: WIDTH - 112 });
  y += taxWordsH;

  if (y > 680) {
    doc.addPage();
    y = MARGIN + 20;
  }

  const footerH = 88;
  box(doc, LEFT, y, WIDTH, footerH);
  const footMid = LEFT + Math.round(WIDTH * 0.52);
  strokeLine(footMid, y, footMid, y + footerH);

  doc.fontSize(6.5).font(FONT_BOLD).text('Declaration', LEFT + 4, y + 4);
  doc.font(FONT).fontSize(6).text(
    'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
    LEFT + 4,
    y + 13,
    { width: footMid - LEFT - 8, lineGap: 0.4 }
  );
  const sealLabel = isSales ? "Customer's Seal and Signature" : "Vendor's Seal and Signature";
  doc.font(FONT_BOLD).fontSize(6.5).text(sealLabel, LEFT + 4, y + footerH - 16);

  const bankTitle = isSales ? "Company's Bank Details:" : "Vendor's Bank Details:";
  const bankRows = isSales
    ? buildCompanyBankRows({
        ...companySettings,
        company_name: companySettings?.company_name || cs.companyName,
      })
    : buildVendorBankRows(party);

  drawTallyBankBlock(doc, footMid + 4, y + 4, bankTitle, bankRows, RIGHT - footMid - 8);

  const signY = y + footerH - 32;
  doc.fontSize(6.5).font(FONT_BOLD).text(`for ${cs.companyName || 'Company'}`, footMid + 4, signY, {
    width: RIGHT - footMid - 8,
    align: 'right',
  });
  if (signatureBuffer) {
    try {
      doc.image(signatureBuffer, RIGHT - 88, signY - 6, { width: 72, height: 26 });
    } catch {
      /* ignore */
    }
  }
  doc.fontSize(6.5).font(FONT).text('Authorised Signatory', footMid + 4, y + footerH - 12, {
    width: RIGHT - footMid - 8,
    align: 'right',
  });

  y += footerH + 5;
  doc.fontSize(6).fillColor('#333333').text('This is a Computer Generated Invoice', LEFT, y, {
    width: WIDTH,
    align: 'center',
  });
  doc.fillColor('#000000');
}

module.exports = {
  drawProformaInvoice,
  formatTallyDate,
  gstStateFromGstin,
};
