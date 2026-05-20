/**
 * Tally-style GST grid invoice — bordered cells, column dividers, aligned meta grid.
 */

const { formatDocumentAmount, formatNumber } = require('../../utils/currencyFormat');
const { normalizeInvoiceUnit } = require('../../utils/invoiceUnit');
const invoiceTemplateService = require('./invoiceTemplate.service');
const {
  buildTallyMetaGridRows,
  drawTallyMetaGrid,
  drawTallyPartyColumn,
  measureMetaRowHeight,
  measureTallyPartyColumnHeight,
  strokeHLine,
} = require('./invoicePdfMetaGrid');
const {
  buildCompanyBankRows,
  buildVendorBankRows,
  drawTallyBankBlock,
} = require('./invoicePdfDrawShared');
const T = require('./invoicePdfTallyTypography');
const { LEFT, RIGHT, WIDTH, FONT, FONT_BOLD, LINE, size, row, pad } = T;

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
  doc.lineWidth(LINE).strokeColor('#1a1a1a').rect(x, y, w, h).stroke();
  doc.restore();
}

/**
 * Table with column dividers; each row is array of cell objects { text, align, bold, fontSize, padTop }.
 * @returns {number} bottom Y
 */
function drawGridTable(doc, x, y, colWidths, rows, defaultRowH = row.itemDefault) {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  let cy = y;

  rows.forEach((rowDef) => {
    const rowH = rowDef._height || defaultRowH;
    box(doc, x, cy, totalW, rowH);

    let cx = x;
    for (let i = 0; i < colWidths.length - 1; i++) {
      cx += colWidths[i];
      doc.save();
      doc.lineWidth(LINE).strokeColor('#1a1a1a');
      doc.moveTo(cx, cy).lineTo(cx, cy + rowH).stroke();
      doc.restore();
    }

    let cellX = x;
    rowDef.cells.forEach((cell, i) => {
      const cw = colWidths[i] || colWidths[colWidths.length - 1];
      const cellPad = pad.cell;
      const padTop = cell.padTop ?? pad.tableTop;
      const textH = Math.max(10, rowH - padTop - 4);
      const fs = cell.fontSize ?? (cell.bold ? size.tableHead : size.tableBody);
      doc.fontSize(fs).font(cell.bold ? FONT_BOLD : FONT).fillColor('#000000');
      doc.text(String(cell.text ?? ''), cellX + cellPad, cy + padTop, {
        width: cw - cellPad * 2,
        height: textH,
        align: cell.align || 'left',
        lineGap: 0.35,
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

function measureItemRowHeight(doc, cells, colWidths, minH = row.itemDefault) {
  let maxH = minH;
  cells.forEach((cell, i) => {
    const cw = colWidths[i] || colWidths[colWidths.length - 1];
    const fs = cell.fontSize ?? (cell.bold ? size.tableHead : size.tableBody);
    doc.fontSize(fs).font(cell.bold ? FONT_BOLD : FONT);
    const text = String(cell.text ?? '');
    if (!text) return;
    const h = doc.heightOfString(text, { width: cw - pad.cell * 2, lineGap: 0.35 });
    maxH = Math.max(maxH, Math.ceil(h) + 10);
  });
  return Math.min(maxH, 40);
}

function invoiceHasDiscount(lineItems, totals) {
  const totalDisc = Number(totals?.totalDiscountAmount) || 0;
  if (totalDisc > 0.005) return true;
  return (lineItems || []).some((item) => Number(item.discountRate || item.discount_rate || 0) > 0);
}

/** Fixed horizontal padding inside each table column (left + right). */
const COL_INNER_PAD = pad.cell * 2;

const PROFORMA_COL_LIMITS = {
  si: { min: 20, max: 28 },
  desc: { min: 72 },
  hsn: { min: 40, max: 72 },
  qty: { min: 34, max: 58 },
  rate: { min: 44, max: 86 },
  disc: { min: 30, max: 42 },
  per: { min: 26, max: 40 },
  amount: { min: 58, max: 90 },
};

function proformaColRoles(hasDiscount) {
  return hasDiscount
    ? ['si', 'desc', 'hsn', 'qty', 'rate', 'disc', 'per', 'amount']
    : ['si', 'desc', 'hsn', 'qty', 'rate', 'per', 'amount'];
}

function measureCellContentWidth(doc, cell) {
  const fs = cell.fontSize ?? (cell.bold ? size.tableHead : size.tableBody);
  doc.fontSize(fs).font(cell.bold ? FONT_BOLD : FONT);
  const text = String(cell.text ?? '').trim();
  if (!text) return 0;
  return Math.max(...text.split('\n').map((line) => doc.widthOfString(line)));
}

/** Size numeric/unit columns from cell content; description absorbs remaining width. */
function computeProformaItemColWidths(doc, tableRows, hasDiscount) {
  const roles = proformaColRoles(hasDiscount);
  const descIdx = roles.indexOf('desc');
  const natural = roles.map(() => 0);

  tableRows.forEach((rowDef) => {
    (rowDef.cells || []).forEach((cell, i) => {
      if (i >= roles.length) return;
      natural[i] = Math.max(natural[i], measureCellContentWidth(doc, cell));
    });
  });

  const widths = roles.map((role, i) => {
    if (role === 'desc') return 0;
    const lim = PROFORMA_COL_LIMITS[role];
    const need = Math.ceil(natural[i] + COL_INNER_PAD);
    return Math.min(lim.max, Math.max(lim.min, need));
  });

  const setDescriptionWidth = () => {
    const fixed = widths.reduce((s, w, i) => (i === descIdx ? s : s + w), 0);
    widths[descIdx] = Math.max(PROFORMA_COL_LIMITS.desc.min, WIDTH - fixed);
  };

  setDescriptionWidth();

  let total = widths.reduce((a, b) => a + b, 0);
  if (total > WIDTH) {
    let excess = total - WIDTH;
    const shrinkOrder = roles
      .map((role, i) => ({ i, role, slack: role === 'desc' ? 0 : widths[i] - PROFORMA_COL_LIMITS[role].min }))
      .filter(({ slack }) => slack > 0.5)
      .sort((a, b) => b.slack - a.slack);

    shrinkOrder.forEach(({ i, role }) => {
      if (excess <= 0) return;
      const cut = Math.min(widths[i] - PROFORMA_COL_LIMITS[role].min, excess);
      widths[i] -= cut;
      excess -= cut;
    });

    setDescriptionWidth();
    if (widths.reduce((a, b) => a + b, 0) > WIDTH) {
      widths[descIdx] = Math.max(48, WIDTH - widths.reduce((s, w, i) => (i === descIdx ? s : s + w), 0));
    }
  }

  return widths;
}

function remeasureProformaTableRows(doc, tableRows, colWidths, defaultRowH) {
  tableRows.forEach((rowDef, idx) => {
    if (idx === 0) {
      rowDef._height = row.itemHeader;
      return;
    }
    rowDef._height = measureItemRowHeight(doc, rowDef.cells, colWidths, defaultRowH);
  });
}

function buildProformaItemHeaders(hasDiscount) {
  if (!hasDiscount) {
    return ['SI\nNo.', 'Description of\nGoods and Services', 'HSN/SAC', 'Quantity', 'Rate', 'per', 'Amount'];
  }
  return [
    'SI\nNo.',
    'Description of\nGoods and Services',
    'HSN/SAC',
    'Quantity',
    'Rate',
    'Disc.\n%',
    'per',
    'Amount',
  ];
}

function buildProformaLineCells(item, idx, currency, hasDiscount) {
  const taxable = item.taxableAmount ?? item.lineTotal ?? 0;
  const unit = normalizeUnit(item.unit);
  const qty = normalizeQuantity(item.quantity);
  const discRate = Number(item.discountRate || item.discount_rate || 0);
  const base = [
    { text: String(idx + 1), align: 'center', fontSize: size.tableBody },
    { text: (item.itemName || '').trim(), fontSize: size.tableBody },
    { text: hsnOf(item) || '-', align: 'center', fontSize: size.tableBody },
    { text: formatLineQty(qty), align: 'right', fontSize: size.tableBody },
    { text: formatQtyAmount(item.unitAmount, currency), align: 'right', fontSize: size.tableAmount },
  ];
  if (hasDiscount) {
    base.push({
      text: discRate > 0 ? `${discRate}%` : '-',
      align: 'center',
      fontSize: size.tableBody,
    });
  }
  base.push(
    { text: unit, align: 'center', fontSize: size.tableBody },
    { text: pdfAmount(taxable, currency), align: 'right', fontSize: size.tableAmount }
  );
  return base;
}

/** Right-aligned subtotal / discount / tax summary before amount in words. */
function drawProformaTotalsSummary(doc, y, totals, currency) {
  const subtotal = Number(totals.subtotal) || 0;
  const discount = Number(totals.totalDiscountAmount) || 0;
  const taxable = Number(totals.totalTaxableAmount) || Math.max(0, subtotal - discount);
  const tax = Number(totals.totalTaxAmount) || 0;
  const grand = Number(totals.grandTotal) || 0;

  const summaryRows = [['Sub Total', subtotal]];
  if (discount > 0.005) {
    summaryRows.push(['Less: Discount', discount]);
    summaryRows.push(['Taxable Amount', taxable]);
  }
  if (tax > 0.005) {
    summaryRows.push(['Add: IGST', tax]);
  }
  summaryRows.push(['Grand Total', grand]);

  const valueW = 130;
  const labelX = LEFT + WIDTH - valueW - 118;
  const blockH = summaryRows.length * 15 + 10;
  box(doc, LEFT, y, WIDTH, blockH);

  let ry = y + 6;
  summaryRows.forEach(([label, amount]) => {
    const isGrand = label === 'Grand Total';
    doc.fontSize(isGrand ? size.tableHead : size.tableBody).font(isGrand ? FONT_BOLD : FONT).fillColor('#000000');
    doc.text(label, labelX, ry, { width: 110, align: 'right' });
    doc.text(pdfAmount(amount, currency), LEFT + WIDTH - valueW - 6, ry, { width: valueW, align: 'right' });
    ry += 15;
  });

  return y + blockH + 4;
}

function measurePartyBlockHeight(doc, addr, gst, extraLines = []) {
  let h = 20;
  doc.fontSize(size.partyName).font(FONT_BOLD);
  h += 12;
  doc.fontSize(size.partyBody).font(FONT);
  formatAddressLines(addr).forEach((line) => {
    h += doc.heightOfString(line, { width: WIDTH - 12, lineGap: 0.25 }) + 2;
  });
  if (gst) h += 11;
  h += extraLines.length * 11;
  return Math.max(h, 58);
}

/** Height of company name + address block in proforma left column (matches drawing). */
function measureProformaSellerCompanyBlock(doc, logoBuffer, cs, sellerGst, sellerState, contentW) {
  let h = 8;
  if (logoBuffer) h += 38 + 6;
  doc.fontSize(size.companyName).font(FONT_BOLD);
  h += doc.heightOfString(cs.companyName || 'Company', { width: contentW, lineGap: 0.2 }) + 4;
  doc.fontSize(size.body).font(FONT);
  const lines = [
    cs.address,
    cs.cityLine,
    sellerGst ? `GSTIN/UIN: ${sellerGst}` : '',
    sellerState.name || sellerState.code
      ? `State Name: ${sellerState.name || '—'}, Code: ${sellerState.code || '—'}`
      : '',
    cs.phone || '',
    cs.email ? `E-Mail: ${cs.email}` : '',
  ].filter(Boolean);
  lines.forEach((line) => {
    h += doc.heightOfString(line, { width: contentW, lineGap: 0.3 }) + 2;
  });
  return h;
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

  const docTitle = isSales ? 'INVOICE' : 'PURCHASE INVOICE';
  const sellerGst = cs.taxId || standardInvoice.header?.taxInfo?.taxId || '';
  const sellerState = gstStateFromGstin(
    sellerGst,
    companySettings?.state || standardInvoice.header?.address?.state
  );
  const partyGst = party.taxInfo?.gstin || '';
  const partyState = gstStateFromGstin(partyGst, party.billingAddress?.state);

  let y = T.MARGIN + 6;

  doc.fontSize(size.title).font(FONT_BOLD).fillColor('#1a1a1a').text(docTitle, LEFT, y, {
    width: WIDTH,
    align: 'center',
  });
  doc.fontSize(size.titleSub).font(FONT).fillColor('#444444').text('(ORIGINAL FOR RECIPIENT)', LEFT, y + 2, {
    width: WIDTH - 4,
    align: 'right',
  });
  y += 24;

  const metaW = Math.round(WIDTH * 0.44);
  const sellerW = WIDTH - metaW;
  const metaX = LEFT + sellerW;
  const halfMeta = metaW / 2;
  const metaColWidths = [halfMeta, halfMeta];
  const metaGridRows = buildTallyMetaGridRows(standardInvoice, party);

  metaGridRows.forEach((row) => {
    const cols = row.cells.length === 1 ? [metaW] : metaColWidths;
    row._height = measureMetaRowHeight(doc, row.cells, cols);
  });

  const metaGridH = metaGridRows.reduce((sum, row) => sum + row._height, 0);
  const sx = LEFT + 8;
  const contentW = sellerW - 16;
  const LOGO_W = 52;
  const LOGO_H = 38;

  const shipStateForParty = isSales ? gstStateFromGstin(partyGst, party.shippingAddress?.state) : {};
  const billExtraForParty = isSales && partyState.name ? [`Place of Supply: ${partyState.name}`] : [];

  let sellerStackMinH = measureProformaSellerCompanyBlock(doc, logoBuffer, cs, sellerGst, sellerState, contentW);
  if (isSales) {
    const sectionGap = 10;
    const shipH = measureTallyPartyColumnHeight(doc, party, 'shipping', partyGst, shipStateForParty, [], sellerW);
    const billH = measureTallyPartyColumnHeight(doc, party, 'billing', partyGst, partyState, billExtraForParty, sellerW);
    sellerStackMinH += sectionGap + shipH + sectionGap + billH;
  }

  const topH = Math.max(metaGridH, sellerStackMinH + 8);

  box(doc, LEFT, y, sellerW, topH);
  box(doc, metaX, y, metaW, topH);

  let sy = y + 8;

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, sx, sy, { fit: [LOGO_W, LOGO_H], align: 'left', valign: 'top' });
      sy += LOGO_H + 6;
    } catch {
      /* ignore bad image */
    }
  }

  doc.fontSize(size.companyName).font(FONT_BOLD).fillColor('#000000');
  const nameH = doc.heightOfString(cs.companyName || 'Company', { width: contentW, lineGap: 0.2 });
  doc.text(cs.companyName || 'Company', sx, sy, { width: contentW, lineGap: 0.2 });
  sy += nameH + 4;

  doc.fontSize(size.body).font(FONT).fillColor('#000000');
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

  if (isSales) {
    const sectionGap = 10;
    const shipH = measureTallyPartyColumnHeight(doc, party, 'shipping', partyGst, shipStateForParty, [], sellerW);
    const billH = measureTallyPartyColumnHeight(doc, party, 'billing', partyGst, partyState, billExtraForParty, sellerW);
    if (sy + sectionGap <= y + topH) {
      sy += 4;
      strokeHLine(doc, LEFT, LEFT + sellerW, sy);
      sy += sectionGap - 4;
    }
    if (sy + shipH <= y + topH) {
      drawTallyPartyColumn(
        doc,
        LEFT,
        sy,
        sellerW,
        Math.min(shipH, y + topH - sy),
        'Consignee (Ship to)',
        party,
        'shipping',
        partyGst,
        shipStateForParty,
        []
      );
      sy += shipH;
    }
    if (sy + 6 <= y + topH) {
      strokeHLine(doc, LEFT, LEFT + sellerW, sy);
      sy += 6;
    }
    if (sy + billH <= y + topH) {
      drawTallyPartyColumn(
        doc,
        LEFT,
        sy,
        sellerW,
        Math.min(billH, y + topH - sy),
        'Buyer (Bill to)',
        party,
        'billing',
        partyGst,
        partyState,
        billExtraForParty
      );
    }
  }

  drawTallyMetaGrid(doc, metaX, y, metaW, metaGridRows);
  y += topH;

  const drawPartySection = (title, addr, gst, stateInfo, extraLines = []) => {
    const blockH = measurePartyBlockHeight(doc, addr, gst, extraLines);
    box(doc, LEFT, y, WIDTH, blockH);
    doc.fontSize(size.partyTitle).font(FONT_BOLD).fillColor('#1a1a1a').text(title, LEFT + 6, y + 5);
    let py = y + 16;
    doc.fontSize(size.partyName).font(FONT_BOLD).fillColor('#000000').text(party.name || '—', LEFT + 6, py, {
      width: WIDTH - 12,
      lineGap: 0.2,
    });
    py += 12;
    doc.fontSize(size.partyBody).font(FONT);
    formatAddressLines(addr).forEach((line) => {
      doc.text(line, LEFT + 6, py, { width: WIDTH - 12, lineGap: 0.25 });
      py += doc.heightOfString(line, { width: WIDTH - 12, lineGap: 0.25 }) + 2;
    });
    if (gst) {
      doc.text(`GSTIN/UIN: ${gst}`, LEFT + 6, py, { width: WIDTH - 12 });
      py += 11;
    }
    if (stateInfo.name || stateInfo.code) {
      doc.text(`State Name: ${stateInfo.name || '—'}, Code: ${stateInfo.code || '—'}`, LEFT + 6, py, {
        width: WIDTH - 12,
      });
      py += 11;
    }
    extraLines.forEach((line) => {
      doc.text(line, LEFT + 6, py, { width: WIDTH - 12 });
      py += 11;
    });
    y += blockH;
  };

  if (!isSales) {
    drawPartySection('Bill From (Vendor)', party.billingAddress, partyGst, partyState);
  }

  const hasDiscount = invoiceHasDiscount(lineItems, totals);
  const itemColCount = proformaColRoles(hasDiscount).length;
  const amountColIdx = itemColCount - 1;
  const itemRowH = row.itemDefault;
  const itemHeaders = buildProformaItemHeaders(hasDiscount);

  const itemTableRows = [
    {
      _height: row.itemHeader,
      cells: itemHeaders.map((h, i) => ({
        text: h,
        bold: true,
        fontSize: size.tableHead,
        align: i >= 3 ? 'center' : 'left',
        padTop: pad.tableTop,
      })),
    },
  ];

  lineItems.forEach((item, idx) => {
    itemTableRows.push({
      cells: buildProformaLineCells(item, idx, currency, hasDiscount),
    });
  });

  const minBlankRows = Math.max(0, 4 - lineItems.length);
  for (let b = 0; b < minBlankRows; b++) {
    itemTableRows.push({
      cells: Array(itemColCount).fill(null).map(() => ({ text: '' })),
    });
  }

  const footerRow = (label, amountText, extraCells = {}) => {
    const cells = Array(itemColCount)
      .fill(null)
      .map(() => ({ text: '' }));
    cells[1] = { text: label, bold: true, align: 'left', ...extraCells };
    cells[amountColIdx] = {
      text: amountText,
      align: 'right',
      bold: true,
      fontSize: size.tableAmount,
    };
    return cells;
  };

  const totalTax = Number(totals.totalTaxAmount) || 0;
  if (totalTax > 0 && !hasDiscount) {
    itemTableRows.push({
      _height: itemRowH,
      cells: footerRow('IGST', pdfAmount(totalTax, currency)),
    });
  }

  itemTableRows.push({
    _height: itemRowH,
    cells: (() => {
      const cells = footerRow('Total', pdfAmount(totals.grandTotal, currency));
      cells[3] = {
        text: formatLineQty(sumQty(lineItems)),
        align: 'right',
        bold: true,
        fontSize: size.tableBody,
      };
      return cells;
    })(),
  });

  const itemCols = computeProformaItemColWidths(doc, itemTableRows, hasDiscount);
  remeasureProformaTableRows(doc, itemTableRows, itemCols, itemRowH);

  if (y + itemTableRows.reduce((s, r) => s + (r._height || itemRowH), 0) > 700) {
    doc.addPage();
    y = T.MARGIN + 20;
  }

  y = drawGridTable(doc, LEFT, y, itemCols, itemTableRows, itemRowH);

  if (hasDiscount) {
    y = drawProformaTotalsSummary(doc, y, totals, currency);
  }

  const wordsH = row.words;
  box(doc, LEFT, y, WIDTH, wordsH);
  const amountWords = (totals.amountInWords || '').trim();
  const ccyLabel = String(currency).toUpperCase() === 'INR' ? 'INR' : currency;
  doc.fontSize(size.wordsLabel).font(FONT_BOLD).fillColor('#1a1a1a').text('Amount Chargeable (in words)', LEFT + 6, y + 6);
  doc.fontSize(size.wordsBody).font(FONT).fillColor('#000000').text(`${ccyLabel} ${amountWords}`, LEFT + 128, y + 6, {
    width: WIDTH - 210,
    lineGap: 0.3,
  });
  doc.fontSize(size.footerSmall).text('E. & O.E', RIGHT - 48, y + 6, { width: 42, align: 'right' });
  y += wordsH;

  const taxSummary = buildHsnTaxSummary(lineItems);
  /** HSN | Taxable | IGST (Rate | Amount) — no separate Total Tax column (same as IGST when single tax). */
  const taxColW = [62, 92, 38, WIDTH - 62 - 92 - 38];
  const taxHeadH1 = row.taxHead1;
  const taxHeadH2 = row.taxHead2;
  const taxHeaderH = taxHeadH1 + taxHeadH2;
  const taxDataH = row.taxData;
  const taxTableH = taxHeaderH + taxSummary.length * taxDataH + taxDataH;

  box(doc, LEFT, y, WIDTH, taxTableH);
  const tx1 = LEFT;
  const tx2 = tx1 + taxColW[0];
  const tx3 = tx2 + taxColW[1];
  const txRate = tx3 + taxColW[2];
  const igstW = taxColW[2] + taxColW[3];

  const strokeLine = (x1, y1, x2, y2) => {
    doc.save();
    doc.lineWidth(LINE).strokeColor('#1a1a1a');
    doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
    doc.restore();
  };

  strokeLine(tx2, y, tx2, y + taxTableH);
  strokeLine(tx3, y, tx3, y + taxTableH);
  strokeLine(txRate, y + taxHeadH1, txRate, y + taxTableH);
  strokeLine(tx3, y + taxHeadH1, LEFT + WIDTH, y + taxHeadH1);
  strokeLine(tx1, y + taxHeaderH, LEFT + WIDTH, y + taxHeaderH);

  const taxPad = pad.cell;
  const headerCenterY = y + (taxHeaderH - 8) / 2;
  doc.fontSize(size.taxHead).font(FONT_BOLD).fillColor('#1a1a1a');
  doc.text('HSN/SAC', tx1 + taxPad, headerCenterY, { width: taxColW[0] - taxPad * 2, align: 'center' });
  doc.text('Taxable Value', tx2 + taxPad, headerCenterY, { width: taxColW[1] - taxPad * 2, align: 'right' });

  doc.text('IGST', tx3 + taxPad, y + 4, { width: igstW - taxPad * 2, align: 'center' });
  const h2y = y + taxHeadH1;
  doc.text('Rate', tx3 + taxPad, h2y + 4, { width: taxColW[2] - taxPad * 2, align: 'center' });
  doc.text('Amount', txRate + taxPad, h2y + 4, { width: taxColW[3] - taxPad * 2, align: 'right' });

  let ty = y + taxHeaderH;
  doc.font(FONT).fontSize(size.taxBody).fillColor('#000000');
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
    sumTaxable += row.taxable;
    sumTax += row.tax;
    ty += taxDataH;
  });

  strokeLine(tx1, ty, LEFT + WIDTH, ty);
  doc.font(FONT_BOLD);
  doc.text('Total', tx1 + 2, ty + 3);
  doc.text(pdfAmount(sumTaxable, currency), tx2 + 2, ty + 3, { width: taxColW[1] - 4, align: 'right' });
  doc.text(pdfAmount(sumTax, currency), tx3 + taxColW[2] + 2, ty + 3, { width: taxColW[3] - 4, align: 'right' });
  y += taxTableH;

  const taxWordsH = row.taxWords;
  box(doc, LEFT, y, WIDTH, taxWordsH);
  const taxWords = invoiceTemplateService.convertAmountToWords(sumTax, currency);
  doc.fontSize(size.wordsLabel).font(FONT_BOLD).fillColor('#1a1a1a').text('Tax Amount (in words):', LEFT + 6, y + 5);
  doc.fontSize(size.wordsBody).font(FONT).text(`${ccyLabel} ${taxWords}`, LEFT + 118, y + 5, { width: WIDTH - 124 });
  y += taxWordsH;

  if (y > 680) {
    doc.addPage();
    y = T.MARGIN + 20;
  }

  const footerH = row.footer;
  box(doc, LEFT, y, WIDTH, footerH);
  const footMid = LEFT + Math.round(WIDTH * 0.52);
  strokeLine(footMid, y, footMid, y + footerH);

  doc.fontSize(size.footerTitle).font(FONT_BOLD).fillColor('#1a1a1a').text('Declaration', LEFT + 6, y + 6);
  doc.font(FONT).fontSize(size.footerBody).fillColor('#000000').text(
    'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
    LEFT + 6,
    y + 16,
    { width: footMid - LEFT - 10, lineGap: 0.45 }
  );
  const sealLabel = isSales ? "Customer's Seal and Signature" : "Vendor's Seal and Signature";
  doc.font(FONT_BOLD).fontSize(size.footerBody).text(sealLabel, LEFT + 6, y + footerH - 18);

  const bankTitle = isSales ? "Company's Bank Details:" : "Vendor's Bank Details:";
  const bankRows = isSales
    ? buildCompanyBankRows({
        ...companySettings,
        company_name: companySettings?.company_name || cs.companyName,
      })
    : buildVendorBankRows(party);

  drawTallyBankBlock(doc, footMid + 6, y + 6, bankTitle, bankRows, RIGHT - footMid - 10, {
    titleSize: size.footerTitle,
    bodySize: size.footerBody,
  });

  const signY = y + footerH - 36;
  doc.fontSize(size.footerBody).font(FONT_BOLD).fillColor('#1a1a1a').text(`for ${cs.companyName || 'Company'}`, footMid + 6, signY, {
    width: RIGHT - footMid - 10,
    align: 'right',
  });
  if (signatureBuffer) {
    try {
      doc.image(signatureBuffer, RIGHT - 92, signY - 8, { width: 76, height: 28 });
    } catch {
      /* ignore */
    }
  }
  doc.fontSize(size.footerBody).font(FONT).fillColor('#000000').text('Authorised Signatory', footMid + 6, y + footerH - 14, {
    width: RIGHT - footMid - 10,
    align: 'right',
  });

  y += footerH + 6;
  doc.fontSize(size.disclaimer).fillColor('#555555').text('This is a Computer Generated Invoice', LEFT, y, {
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
