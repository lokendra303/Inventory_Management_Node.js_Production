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
  metaRowLayoutOptions,
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

/** Pre-discount line value (qty × rate before line discount). Sums to `totals.subtotal` / Sub Total. */
function lineGrossAmount(item) {
  const lt = Number(item.lineTotal ?? item.line_total);
  if (Number.isFinite(lt) && lt >= 0) return lt;
  const taxable = Number(item.taxableAmount ?? item.taxable_amount ?? 0) || 0;
  const disc = Number(item.discountAmount ?? item.discount_amount ?? 0) || 0;
  if (taxable || disc) return taxable + disc;
  const qty = normalizeQuantity(item.quantity);
  const unit = Number(item.unitAmount ?? item.unit_amount ?? item.unitCost ?? item.unit_cost ?? 0) || 0;
  return qty * unit;
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

/** Short tag for column headers: INR, $, or ISO code. */
function proformaTableCurrencyTag(currency) {
  const code = String(currency || 'INR').toUpperCase();
  if (code === 'INR') return 'INR';
  if (code === 'USD') return '$';
  return code;
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

function strokeProformaTableVerticals(doc, x, y, colWidths, h) {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const strokeV = (x1, y1, y2) => {
    doc.save();
    doc.lineWidth(LINE).strokeColor('#1a1a1a');
    doc.moveTo(x1, y1).lineTo(x1, y2).stroke();
    doc.restore();
  };
  strokeV(x, y, y + h);
  strokeV(x + totalW, y, y + h);
  let cx = x;
  for (let i = 0; i < colWidths.length - 1; i++) {
    cx += colWidths[i];
    strokeV(cx, y, y + h);
  }
}

/** Draw one table row's cell text (no borders). */
function drawGridTableRowCells(doc, x, cy, colWidths, rowDef, defaultRowH) {
  const rowH = rowDef._height || defaultRowH;
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
    });
    cellX += cw;
  });
  return rowH;
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

    drawGridTableRowCells(doc, x, cy, colWidths, rowDef, defaultRowH);
    cy += rowH;
  });

  return cy;
}

/** Item line rows: vertical column guides only (no horizontal lines between rows). */
function drawGridTableBodyPlain(doc, x, y, colWidths, rows, defaultRowH = row.itemDefault) {
  if (!rows.length) return y;
  const bodyH = rows.reduce((s, r) => s + (r._height || defaultRowH), 0);
  strokeProformaTableVerticals(doc, x, y, colWidths, bodyH);
  let cy = y;
  rows.forEach((rowDef) => {
    cy += drawGridTableRowCells(doc, x, cy, colWidths, rowDef, defaultRowH);
  });
  return y + bodyH;
}

/** Max row height for a single line item (description wrap). */
const PROFORMA_ITEM_ROW_MAX_H = 64;


/** Compact blocks below item table (proforma-only; smaller than shared `row.*`). */
const PROFORMA_WORDS_MIN_H = 18;
const PROFORMA_TAX_WORDS_MIN_H = 15;
const PROFORMA_WORDS_PAD_H = 4;
const PROFORMA_WORDS_GAP = 2;
const PROFORMA_WORDS_EOE_W = 46;
const PROFORMA_FOOTER_MIN_H = 50;

/** A4 page height (pt). */
const PAGE_H = 841.89;
const PAGE_BOTTOM = PAGE_H - T.MARGIN - 8;

/** Proforma title sits closer to the top edge than the generic page margin. */
const PROFORMA_TOP_Y = 10;
const PROFORMA_TITLE_BAND_H = 20;

/** Blank rows below line items: vertical guides only (no horizontal row lines). */
function drawProformaBlankBody(doc, x, y, colWidths, h) {
  if (h <= 0.5) return y;
  strokeProformaTableVerticals(doc, x, y, colWidths, h);
  return y + h;
}

/**
 * Item grid: header box, line rows (verticals only), blank body, Total row box.
 * @returns {number} bottom Y
 */
function measureProformaTotalsSummaryHeight(totals) {
  let rows = 2;
  if (Number(totals?.totalDiscountAmount) > 0.005) rows += 2;
  if (Number(totals?.totalTaxAmount) > 0.005) rows += 1;
  return rows * 12 + 3 + 3 + 2;
}

function measureProformaFooterBoxHeight(bankRows) {
  const bankLines = (bankRows || []).filter(([, val]) => val != null && String(val).trim() !== '').length;
  return Math.min(58, Math.max(PROFORMA_FOOTER_MIN_H, 44 + bankLines * 8));
}

function proformaCurrencyLabel(currency) {
  return String(currency || 'INR').toUpperCase() === 'INR' ? 'INR' : currency;
}

function proformaWordsInnerWidth() {
  return WIDTH - 10;
}

function proformaWordsLabelWidth() {
  return WIDTH - PROFORMA_WORDS_EOE_W - 14;
}

/** Stacked: label row (full width) + wrapped amount text row — avoids breaking "(in words)". */
function measureProformaAmountWordsRowHeight(doc, amountWords, currency) {
  const innerW = proformaWordsInnerWidth();
  const labelW = proformaWordsLabelWidth();
  const labelText = 'Amount Chargeable (in words)';
  const valueBody = String(amountWords || '').trim();
  const ccyLabel = proformaCurrencyLabel(currency);
  const valueText = valueBody ? `${ccyLabel} ${valueBody}` : '';

  doc.fontSize(size.wordsLabel).font(FONT_BOLD);
  const labelH = doc.heightOfString(labelText, { width: labelW, lineGap: 0.15 });
  let valueH = 0;
  if (valueText) {
    doc.fontSize(size.wordsBody).font(FONT);
    valueH = doc.heightOfString(valueText, { width: innerW, lineGap: 0.25 });
  }
  const bodyH = labelH + (valueText ? PROFORMA_WORDS_GAP + valueH : 0);
  return Math.max(PROFORMA_WORDS_MIN_H, PROFORMA_WORDS_PAD_H * 2 + bodyH);
}

/** Stacked label + tax amount in words (same layout as chargeable row). */
function measureProformaTaxWordsRowHeight(doc, taxAmount, currency) {
  const innerW = proformaWordsInnerWidth();
  const labelW = proformaWordsLabelWidth();
  const labelText = 'Tax Amount (in words)';
  const taxWords = invoiceTemplateService.convertAmountToWords(Number(taxAmount) || 0, currency);
  const valueText = `${proformaCurrencyLabel(currency)} ${taxWords}`;

  doc.fontSize(size.wordsLabel).font(FONT_BOLD);
  const labelH = doc.heightOfString(labelText, { width: labelW, lineGap: 0.15 });
  doc.fontSize(size.wordsBody).font(FONT);
  const valueH = doc.heightOfString(valueText, { width: innerW, lineGap: 0.25 });
  return Math.max(PROFORMA_TAX_WORDS_MIN_H, PROFORMA_WORDS_PAD_H * 2 + labelH + PROFORMA_WORDS_GAP + valueH);
}

function sumTaxFromLineItems(lineItems) {
  return buildHsnTaxSummary(lineItems).reduce((sum, row) => sum + (Number(row.tax) || 0), 0);
}

/** Height of all blocks drawn after the item table (summary, words, HSN grid, footer). */
function measureProformaBelowItemTableHeight(doc, totals, lineItems, bankRows, currency) {
  const taxRows = buildHsnTaxSummary(lineItems).length;
  const taxTableH = row.taxHead1 + row.taxHead2 + taxRows * row.taxData + row.taxData;
  const amountWords = (totals?.amountInWords || '').trim();
  return (
    measureProformaTotalsSummaryHeight(totals) +
    measureProformaAmountWordsRowHeight(doc, amountWords, currency) +
    taxTableH +
    measureProformaTaxWordsRowHeight(doc, sumTaxFromLineItems(lineItems), currency) +
    measureProformaFooterBoxHeight(bankRows) +
    8
  );
}

/**
 * Use spare page space to grow rows that need taller cells (long descriptions) first.
 * Remaining slack is returned as item-table blank filler (see computeProformaItemBlankHeight).
 */
function expandProformaItemRowsWithAvailableSpace(doc, tableRows, colWidths, defaultRowH, ctx) {
  if (!tableRows || tableRows.length < 3) return;
  const footerIdx = tableRows.length - 1;
  const headerH = tableRows[0]._height || row.itemHeader;
  const footerH = tableRows[footerIdx]._height || defaultRowH;
  let bodyH = 0;
  for (let i = 1; i < footerIdx; i++) {
    bodyH += tableRows[i]._height || defaultRowH;
  }
  const belowH = measureProformaBelowItemTableHeight(
    doc,
    ctx.totals,
    ctx.lineItems,
    ctx.bankRows,
    ctx.currency
  );
  const slack = PAGE_BOTTOM - belowH - ctx.itemStartY - headerH - bodyH - footerH;
  if (slack <= 1) return;

  const extras = [];
  let totalWant = 0;
  for (let i = 1; i < footerIdx; i++) {
    const wantH = measureItemRowHeight(doc, tableRows[i].cells, colWidths, defaultRowH);
    const cur = tableRows[i]._height || defaultRowH;
    const extra = Math.max(0, wantH - cur);
    extras.push(extra);
    totalWant += extra;
  }
  if (totalWant <= 0) return;

  let budget = Math.min(slack, totalWant);
  for (let i = 1; i < footerIdx; i++) {
    const extra = extras[i - 1];
    if (extra <= 0 || budget <= 0) continue;
    const add = Math.min(extra, Math.ceil((extra / totalWant) * budget));
    tableRows[i]._height = (tableRows[i]._height || defaultRowH) + add;
    budget -= add;
  }
  for (let i = 1; i < footerIdx && budget > 0; i++) {
    if (extras[i - 1] <= 0) continue;
    const cur = tableRows[i]._height || defaultRowH;
    const cap = measureItemRowHeight(doc, tableRows[i].cells, colWidths, defaultRowH);
    const room = Math.max(0, cap - cur);
    const add = Math.min(room, budget);
    if (add > 0) {
      tableRows[i]._height = cur + add;
      budget -= add;
    }
  }
}

/**
 * Blank area between last line item and Total row — fills remaining page 1 space
 * after rows are sized for content (single-page layout when items fit).
 */
function computeProformaItemBlankHeight(
  itemStartY,
  headerH,
  bodyContentH,
  itemFooterRowH,
  totals,
  lineItems,
  bankRows,
  doc,
  currency
) {
  const belowH = measureProformaBelowItemTableHeight(doc, totals, lineItems, bankRows, currency);
  const fixedH = headerH + bodyContentH + itemFooterRowH;
  const slack = PAGE_BOTTOM - belowH - itemStartY - fixedH;
  return Math.max(0, slack);
}

function drawProformaItemTable(doc, x, y, colWidths, headerRows, bodyRows, footerRows, defaultRowH, blankH) {
  let cy = y;
  if (headerRows.length) {
    cy = drawGridTable(doc, x, cy, colWidths, headerRows, defaultRowH);
  }
  if (bodyRows.length) {
    cy = drawGridTableBodyPlain(doc, x, cy, colWidths, bodyRows, defaultRowH);
  }
  if (blankH > 0.5) {
    cy = drawProformaBlankBody(doc, x, cy, colWidths, blankH);
  }
  if (footerRows.length) {
    cy = drawGridTable(doc, x, cy, colWidths, footerRows, defaultRowH);
  }
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

function measureItemRowHeight(doc, cells, colWidths, minH = row.itemDefault, maxH = PROFORMA_ITEM_ROW_MAX_H) {
  let rowH = minH;
  cells.forEach((cell, i) => {
    const cw = colWidths[i] || colWidths[colWidths.length - 1];
    const fs = cell.fontSize ?? (cell.bold ? size.tableHead : size.tableBody);
    doc.fontSize(fs).font(cell.bold ? FONT_BOLD : FONT);
    const text = String(cell.text ?? '');
    if (!text) return;
    const h = doc.heightOfString(text, { width: cw - pad.cell * 2, lineGap: 0.35 });
    rowH = Math.max(rowH, Math.ceil(h) + pad.tableTop + 6);
  });
  return Math.min(rowH, maxH);
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
    ? ['si', 'desc', 'hsn', 'qty', 'rate', 'per', 'disc', 'amount']
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

function buildProformaItemHeaders(hasDiscount, currency) {
  const cur = proformaTableCurrencyTag(currency);
  const rateH = `Rate\n(${cur})`;
  const amountH = `Amount\n(${cur})`;
  if (!hasDiscount) {
    return ['SI\nNo.', 'Description of\nGoods and Services', 'HSN/SAC', 'Quantity', rateH, 'per', amountH];
  }
  return [
    'SI\nNo.',
    'Description of\nGoods and Services',
    'HSN/SAC',
    'Quantity',
    rateH,
    'per',
    'Disc.\n%',
    amountH,
  ];
}

function buildProformaLineCells(item, idx, currency, hasDiscount) {
  const gross = lineGrossAmount(item);
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
  base.push({ text: unit, align: 'center', fontSize: size.tableBody });
  if (hasDiscount) {
    base.push({
      text: discRate > 0 ? `${discRate}%` : '-',
      align: 'center',
      fontSize: size.tableBody,
    });
  }
  base.push({ text: formatQtyAmount(gross, currency), align: 'right', fontSize: size.tableAmount });
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

  const rightPad = 8;
  const colGap = 5;
  const valueW = 100;
  const labelW = 86;
  const valueX = LEFT + WIDTH - rightPad - valueW;
  const labelX = valueX - colGap - labelW;

  const rowH = 12;
  const padTop = 3;
  const padBottom = 3;
  const blockH = summaryRows.length * rowH + padTop + padBottom;
  box(doc, LEFT, y, WIDTH, blockH);

  let ry = y + padTop;
  summaryRows.forEach(([label, amount]) => {
    const isGrand = label === 'Grand Total';
    doc.fontSize(isGrand ? size.tableHead : size.tableBody).font(isGrand ? FONT_BOLD : FONT).fillColor('#000000');
    doc.text(label, labelX, ry, { width: labelW, align: 'right' });
    doc.text(pdfAmount(amount, currency), valueX, ry, { width: valueW, align: 'right' });
    ry += rowH;
  });

  return y + blockH + 2;
}

const PROFORMA_HEADER_LOGO_W = 72;
const PROFORMA_HEADER_LOGO_H = 52;
const PROFORMA_SELLER_LOGO_PAD = 6;
const PROFORMA_SELLER_LOGO_GAP = 30;

function proformaSellerDetailLines(cs, sellerGst, sellerState) {
  return [
    cs.address,
    cs.cityLine,
    sellerGst ? `GSTIN/UIN: ${sellerGst}` : '',
    cs.pan ? `PAN: ${cs.pan}` : '',
    sellerState.name || sellerState.code
      ? `State Name: ${sellerState.name || '—'}, Code: ${sellerState.code || '—'}`
      : '',
    cs.phone || '',
    cs.email ? `E-Mail: ${cs.email}` : '',
    cs.website ? `Website: ${cs.website}` : '',
  ].filter(Boolean);
}

/** Height of company name + address in proforma seller box (logo sits left of this text). */
function measureProformaSellerCompanyBlock(doc, cs, sellerGst, sellerState, detailsW, hasLogo) {
  let h = 4;
  doc.fontSize(size.companyName).font(FONT_BOLD);
  h += doc.heightOfString(cs.companyName || 'Company', { width: detailsW, lineGap: 0.2 }) + 3;
  doc.fontSize(size.body).font(FONT);
  proformaSellerDetailLines(cs, sellerGst, sellerState).forEach((line) => {
    h += doc.heightOfString(line, { width: detailsW, lineGap: 0.3 }) + 2;
  });
  if (hasLogo) {
    h = Math.max(h, PROFORMA_HEADER_LOGO_H + PROFORMA_SELLER_LOGO_PAD + 4);
  }
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

  let y = PROFORMA_TOP_Y;

  const titleRowY = y;
  doc.fontSize(size.title).font(FONT_BOLD).fillColor('#1a1a1a').text(docTitle, LEFT, titleRowY, {
    width: WIDTH,
    align: 'center',
  });
  doc.fontSize(size.titleSub).font(FONT).fillColor('#444444').text('(ORIGINAL FOR RECIPIENT)', LEFT, titleRowY + 2, {
    width: WIDTH - 4,
    align: 'right',
  });
  y = titleRowY + PROFORMA_TITLE_BAND_H;

  const metaW = Math.round(WIDTH * 0.44);
  const sellerW = WIDTH - metaW;
  const metaX = LEFT + sellerW;
  const halfMeta = metaW / 2;
  const metaColWidths = [halfMeta, halfMeta];
  const metaGridRows = buildTallyMetaGridRows(standardInvoice, party);

  /** Stacked label + wrapped value so long references/terms expand row height dynamically. */
  const metaGridOptions = {};
  metaGridRows.forEach((row) => {
    const cols = row.cells.length === 1 ? [metaW] : metaColWidths;
    const rowOpts = metaRowLayoutOptions(metaGridOptions, row.cells.length);
    row._height = measureMetaRowHeight(doc, row.cells, cols, rowOpts);
  });

  const metaGridH = metaGridRows.reduce((sum, row) => sum + row._height, 0);
  const sellerLogoColW = logoBuffer
    ? PROFORMA_SELLER_LOGO_PAD + PROFORMA_HEADER_LOGO_W + PROFORMA_SELLER_LOGO_GAP
    : 0;
  const sellerDetailsLeft = LEFT + (logoBuffer ? sellerLogoColW : 8);
  const sellerDetailsW = LEFT + sellerW - 8 - sellerDetailsLeft;

  const shipStateForParty = isSales ? gstStateFromGstin(partyGst, party.shippingAddress?.state) : {};
  const billExtraForParty = isSales && partyState.name ? [`Place of Supply: ${partyState.name}`] : [];

  /** Proforma: short party blocks — no 56pt floor (see measureTallyPartyColumnHeight minPanelH). */
  const partyMinH = 26;
  const sectionGap = 6;
  let shipH = 0;
  let billH = 0;
  let vendorFromH = 0;
  let sellerStackMinH = measureProformaSellerCompanyBlock(
    doc,
    cs,
    sellerGst,
    sellerState,
    sellerDetailsW,
    !!logoBuffer
  );
  if (isSales) {
    shipH = measureTallyPartyColumnHeight(
      doc,
      party,
      'shipping',
      partyGst,
      shipStateForParty,
      [],
      sellerW,
      partyMinH
    );
    billH = measureTallyPartyColumnHeight(
      doc,
      party,
      'billing',
      partyGst,
      partyState,
      billExtraForParty,
      sellerW,
      partyMinH
    );
    sellerStackMinH += sectionGap + shipH + sectionGap + billH;
  } else {
    vendorFromH = measureTallyPartyColumnHeight(
      doc,
      party,
      'billing',
      partyGst,
      partyState,
      [],
      sellerW,
      partyMinH
    );
    sellerStackMinH += sectionGap + vendorFromH;
  }

  const topH = Math.max(metaGridH, sellerStackMinH + 4);

  box(doc, LEFT, y, sellerW, topH);
  box(doc, metaX, y, metaW, topH);

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, LEFT + PROFORMA_SELLER_LOGO_PAD, y + 4, {
        fit: [PROFORMA_HEADER_LOGO_W, PROFORMA_HEADER_LOGO_H],
        align: 'left',
        valign: 'top',
      });
    } catch {
      /* ignore bad image */
    }
  }

  let sy = y + 4;

  doc.fontSize(size.companyName).font(FONT_BOLD).fillColor('#000000');
  const nameH = doc.heightOfString(cs.companyName || 'Company', { width: sellerDetailsW, lineGap: 0.2 });
  doc.text(cs.companyName || 'Company', sellerDetailsLeft, sy, { width: sellerDetailsW, lineGap: 0.2 });
  sy += nameH + 3;

  doc.fontSize(size.body).font(FONT).fillColor('#000000');
  proformaSellerDetailLines(cs, sellerGst, sellerState).forEach((line) => {
    const lh = doc.heightOfString(line, { width: sellerDetailsW, lineGap: 0.3 });
    if (sy + lh > y + topH - 4) return;
    doc.text(line, sellerDetailsLeft, sy, { width: sellerDetailsW, lineGap: 0.3 });
    sy += lh + 2;
  });

  if (isSales) {
    if (sy + sectionGap <= y + topH) {
      sy += 3;
      strokeHLine(doc, LEFT, LEFT + sellerW, sy);
      sy += sectionGap - 3;
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
    if (sy + 4 <= y + topH) {
      strokeHLine(doc, LEFT, LEFT + sellerW, sy);
      sy += 4;
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
  } else {
    if (sy + sectionGap <= y + topH) {
      sy += 3;
      strokeHLine(doc, LEFT, LEFT + sellerW, sy);
      sy += sectionGap - 3;
    }
    if (sy + vendorFromH <= y + topH) {
      drawTallyPartyColumn(
        doc,
        LEFT,
        sy,
        sellerW,
        Math.min(vendorFromH, y + topH - sy),
        'Bill From (Vendor)',
        party,
        'billing',
        partyGst,
        partyState,
        []
      );
    }
  }

  drawTallyMetaGrid(doc, metaX, y, metaW, metaGridRows, metaGridOptions);
  y += topH;

  const hasDiscount = invoiceHasDiscount(lineItems, totals);
  const itemColCount = proformaColRoles(hasDiscount).length;
  const amountColIdx = itemColCount - 1;
  const itemRowH = row.itemDefault;
  const itemHeaders = buildProformaItemHeaders(hasDiscount, currency);

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

  const tableAmountTotal =
    Number(totals.subtotal) || lineItems.reduce((s, it) => s + lineGrossAmount(it), 0);

  /** Table footer: quantity + line gross total only — tax and grand total go in the summary block below. */
  itemTableRows.push({
    _height: itemRowH,
    cells: (() => {
      const cells = footerRow('Total', formatQtyAmount(tableAmountTotal, currency));
      cells[3] = {
        text: formatLineQty(sumQty(lineItems)),
        align: 'right',
        bold: true,
        fontSize: size.tableBody,
      };
      return cells;
    })(),
  });

  const bankRowsForMeasure = isSales
    ? buildCompanyBankRows({
        ...companySettings,
        company_name: companySettings?.company_name || cs.companyName,
      })
    : buildVendorBankRows(party);

  const itemCols = computeProformaItemColWidths(doc, itemTableRows, hasDiscount);
  remeasureProformaTableRows(doc, itemTableRows, itemCols, itemRowH);
  expandProformaItemRowsWithAvailableSpace(doc, itemTableRows, itemCols, itemRowH, {
    itemStartY: y,
    totals,
    lineItems,
    bankRows: bankRowsForMeasure,
    currency,
  });

  const headerRows = itemTableRows.slice(0, 1);
  const footerRows = itemTableRows.slice(-1);
  const bodyRows = itemTableRows.slice(1, -1);
  const headerH = headerRows.reduce((s, r) => s + (r._height || itemRowH), 0);
  const itemFooterRowH = footerRows.reduce((s, r) => s + (r._height || itemRowH), 0);
  let bodyContentHAdj = bodyRows.reduce((s, r) => s + (r._height || itemRowH), 0);
  let blankH = computeProformaItemBlankHeight(
    y,
    headerH,
    bodyContentHAdj,
    itemFooterRowH,
    totals,
    lineItems,
    bankRowsForMeasure,
    doc,
    currency
  );
  let itemTableH = headerH + bodyContentHAdj + blankH + itemFooterRowH;

  if (
    y + itemTableH >
    PAGE_BOTTOM - measureProformaBelowItemTableHeight(doc, totals, lineItems, bankRowsForMeasure, currency)
  ) {
    doc.addPage();
    y = PROFORMA_TOP_Y + 8;
    expandProformaItemRowsWithAvailableSpace(doc, itemTableRows, itemCols, itemRowH, {
      itemStartY: y,
      totals,
      lineItems,
      bankRows: bankRowsForMeasure,
      currency,
    });
    bodyContentHAdj = bodyRows.reduce((s, r) => s + (r._height || itemRowH), 0);
    blankH = computeProformaItemBlankHeight(
      y,
      headerH,
      bodyContentHAdj,
      itemFooterRowH,
      totals,
      lineItems,
      bankRowsForMeasure,
      doc,
      currency
    );
    itemTableH = headerH + bodyContentHAdj + blankH + itemFooterRowH;
  }

  const blankHFinal = blankH;
  bodyContentHAdj = bodyRows.reduce((s, r) => s + (r._height || itemRowH), 0);
  y = drawProformaItemTable(doc, LEFT, y, itemCols, headerRows, bodyRows, footerRows, itemRowH, blankHFinal);

  y = drawProformaTotalsSummary(doc, y, totals, currency);

  const amountWords = (totals.amountInWords || '').trim();
  const amountWordsH = measureProformaAmountWordsRowHeight(doc, amountWords, currency);
  const innerW = proformaWordsInnerWidth();
  const labelW = proformaWordsLabelWidth();
  const ccyLabel = proformaCurrencyLabel(currency);
  const amountValueText = amountWords ? `${ccyLabel} ${amountWords}` : '';

  box(doc, LEFT, y, WIDTH, amountWordsH);
  let amountTy = y + PROFORMA_WORDS_PAD_H;
  doc.fontSize(size.wordsLabel).font(FONT_BOLD).fillColor('#1a1a1a');
  const labelLineH = doc.heightOfString('Amount Chargeable (in words)', { width: labelW, lineGap: 0.15 });
  doc.text('Amount Chargeable (in words)', LEFT + 5, amountTy, { width: labelW, lineGap: 0.15 });
  doc.fontSize(size.footerSmall).fillColor('#000000').text('E. & O.E', RIGHT - PROFORMA_WORDS_EOE_W, amountTy, {
    width: PROFORMA_WORDS_EOE_W - 6,
    align: 'right',
  });
  amountTy += labelLineH + PROFORMA_WORDS_GAP;
  if (amountValueText) {
    doc.fontSize(size.wordsBody).font(FONT).fillColor('#000000');
    doc.text(amountValueText, LEFT + 5, amountTy, {
      width: innerW,
      lineGap: 0.25,
      height: Math.max(6, y + amountWordsH - PROFORMA_WORDS_PAD_H - amountTy),
      ellipsis: true,
    });
  }
  y += amountWordsH;

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

  const taxWordsH = measureProformaTaxWordsRowHeight(doc, sumTax, currency);
  const taxWords = invoiceTemplateService.convertAmountToWords(sumTax, currency);
  const taxValueText = `${ccyLabel} ${taxWords}`;

  box(doc, LEFT, y, WIDTH, taxWordsH);
  let taxTy = y + PROFORMA_WORDS_PAD_H;
  doc.fontSize(size.wordsLabel).font(FONT_BOLD).fillColor('#1a1a1a');
  const taxLabelH = doc.heightOfString('Tax Amount (in words)', { width: labelW, lineGap: 0.15 });
  doc.text('Tax Amount (in words)', LEFT + 5, taxTy, { width: labelW, lineGap: 0.15 });
  taxTy += taxLabelH + PROFORMA_WORDS_GAP;
  doc.fontSize(size.wordsBody).font(FONT).fillColor('#000000');
  doc.text(taxValueText, LEFT + 5, taxTy, {
    width: innerW,
    lineGap: 0.25,
    height: Math.max(6, y + taxWordsH - PROFORMA_WORDS_PAD_H - taxTy),
    ellipsis: true,
  });
  y += taxWordsH;

  const bankTitle = isSales ? "Company's Bank Details:" : "Vendor's Bank Details:";
  const bankRows = bankRowsForMeasure;
  const footerH = measureProformaFooterBoxHeight(bankRows);
  const footMid = LEFT + Math.round(WIDTH * 0.52);
  const footRightW = RIGHT - footMid - 6;
  const declW = footMid - LEFT - 8;

  box(doc, LEFT, y, WIDTH, footerH);
  strokeLine(footMid, y, footMid, y + footerH);

  const declText =
    'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.';
  doc.fontSize(size.footerTitle).font(FONT_BOLD).fillColor('#1a1a1a').text('Declaration', LEFT + 4, y + 3);
  doc.font(FONT).fontSize(size.footerBody).fillColor('#000000').text(declText, LEFT + 4, y + 11, {
    width: declW,
    lineGap: 0.25,
  });

  const sealLabel = isSales ? "Customer's Seal and Signature" : "Vendor's Seal and Signature";
  doc.font(FONT_BOLD).fontSize(size.footerBody).text(sealLabel, LEFT + 4, y + footerH - 11);

  drawTallyBankBlock(doc, footMid + 4, y + 3, bankTitle, bankRows, footRightW, {
    titleSize: size.footerTitle,
    bodySize: size.footerBody,
  });

  const signBlockTop = y + footerH - 24;
  doc.fontSize(size.footerBody).font(FONT_BOLD).fillColor('#1a1a1a').text(`for ${cs.companyName || 'Company'}`, footMid + 4, signBlockTop, {
    width: footRightW,
    align: 'right',
  });
  if (signatureBuffer) {
    try {
      doc.image(signatureBuffer, RIGHT - 82, signBlockTop - 4, { width: 60, height: 18 });
    } catch {
      /* ignore */
    }
  }
  doc.fontSize(size.footerBody).font(FONT).fillColor('#000000').text('Authorised Signatory', footMid + 4, y + footerH - 10, {
    width: footRightW,
    align: 'right',
  });

  y += footerH + 4;
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
