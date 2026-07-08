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
  countBankDataRows,
  drawTallyBankBlock,
  measureTallyBankBlockHeight,
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
const PROFORMA_FOOTER_PAD = 4;
const PROFORMA_SIGN_COL_MIN_H = 40;
const PROFORMA_FOOTER_COL_MIN = { decl: 108, bank: 92, sign: 86 };
const PROFORMA_FOOTER_COL_MAX = { decl: 300, bank: 260, sign: 150 };
const PROFORMA_DECLARATION_TEXT =
  'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.';

const PROFORMA_THIRD_PARTY_DISCLAIMER =
  'This is a Proforma Invoice and is not a Tax Invoice. It is issued for quotation/order confirmation/advance payment purposes only.';

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

function buildProformaFooterContext(isSales, companyName, bankRows, isProformaDoc = false) {
  return {
    declText: isProformaDoc ? PROFORMA_THIRD_PARTY_DISCLAIMER : PROFORMA_DECLARATION_TEXT,
    sealLabel: isSales ? "Customer's Seal and Signature" : "Vendor's Seal and Signature",
    bankTitle: isSales ? "Company's Bank Details:" : "Vendor's Bank Details:",
    bankRows: bankRows || [],
    companyName: companyName || 'Company',
  };
}

function measureFooterBankNaturalWidth(doc, ctx) {
  const { bankTitle, bankRows } = ctx;
  const titleSize = size.footerTitle;
  const bodySize = size.footerBody;
  doc.fontSize(titleSize).font(FONT_BOLD);
  let maxW = doc.widthOfString(bankTitle);
  (bankRows || []).forEach(([label, val]) => {
    if (val == null || String(val).trim() === '') return;
    doc.fontSize(bodySize).font(FONT_BOLD);
    const labelW = doc.widthOfString(`${label}: `);
    doc.font(FONT);
    const valW = doc.widthOfString(String(val));
    maxW = Math.max(maxW, labelW + valW);
  });
  return maxW + PROFORMA_FOOTER_PAD * 2;
}

function measureFooterSignNaturalWidth(doc, ctx) {
  const forText = `for ${ctx.companyName || 'Company'}`;
  doc.fontSize(size.footerBody).font(FONT_BOLD);
  const wFor = doc.widthOfString(forText);
  doc.font(FONT);
  const wAuth = doc.widthOfString('Authorised Signatory');
  return Math.max(wFor, wAuth, 62) + PROFORMA_FOOTER_PAD * 2;
}

function measureFooterDeclNaturalWidth(doc, ctx) {
  doc.fontSize(size.footerTitle).font(FONT_BOLD);
  let maxW = doc.widthOfString('Declaration');
  doc.fontSize(size.footerBody).font(FONT_BOLD);
  maxW = Math.max(maxW, doc.widthOfString(ctx.sealLabel));
  doc.font(FONT);
  const probeW = 128;
  const declH = doc.heightOfString(ctx.declText, { width: probeW, lineGap: 0.25 });
  const declLines = Math.max(1, Math.ceil(declH / (size.footerBody * 1.25)));
  const avgCharsPerLine = ctx.declText.length / declLines;
  const estLineW = Math.min(
    WIDTH * 0.48,
    Math.max(probeW, avgCharsPerLine * size.footerBody * 0.52)
  );
  return Math.max(maxW, estLineW) + PROFORMA_FOOTER_PAD * 2;
}

function distributeProformaFooterColWidths(naturals, mins, maxs, totalWidth) {
  const n = naturals.length;
  let widths = naturals.map((nat, i) => Math.min(maxs[i], Math.max(mins[i], nat)));
  let sum = widths.reduce((a, b) => a + b, 0);

  if (sum < totalWidth) {
    let extra = totalWidth - sum;
    const weightSum = naturals.reduce((a, b) => a + Math.max(b, 1), 0);
    for (let i = 0; i < n; i++) {
      const room = maxs[i] - widths[i];
      const add = Math.min(room, (extra * naturals[i]) / weightSum);
      widths[i] += add;
    }
    sum = widths.reduce((a, b) => a + b, 0);
    if (sum < totalWidth) widths[0] += totalWidth - sum;
  } else if (sum > totalWidth) {
    let excess = sum - totalWidth;
    const slack = widths.map((w, i) => w - mins[i]);
    for (let pass = 0; pass < 8 && excess > 0.5; pass++) {
      for (let i = 0; i < n; i++) {
        if (slack[i] <= 0) continue;
        const cut = Math.min(slack[i], excess / n);
        widths[i] -= cut;
        slack[i] -= cut;
        excess -= cut;
      }
    }
  }

  return widths;
}

function computeProformaFooterColWidths(doc, ctx) {
  const mins = [
    PROFORMA_FOOTER_COL_MIN.decl,
    PROFORMA_FOOTER_COL_MIN.bank,
    PROFORMA_FOOTER_COL_MIN.sign,
  ];
  const maxs = [PROFORMA_FOOTER_COL_MAX.decl, PROFORMA_FOOTER_COL_MAX.bank, PROFORMA_FOOTER_COL_MAX.sign];
  const naturals = [
    measureFooterDeclNaturalWidth(doc, ctx),
    countBankDataRows(ctx.bankRows)
      ? measureFooterBankNaturalWidth(doc, ctx)
      : PROFORMA_FOOTER_COL_MIN.bank,
    measureFooterSignNaturalWidth(doc, ctx),
  ];
  return distributeProformaFooterColWidths(naturals, mins, maxs, WIDTH);
}

function measureProformaFooterBoxHeight(doc, ctx, colWidths) {
  const pad = PROFORMA_FOOTER_PAD;
  const declInnerW = colWidths[0] - pad * 2;
  const bankInnerW = colWidths[1] - pad * 2;

  doc.fontSize(size.footerTitle).font(FONT_BOLD);
  let declH = pad + doc.heightOfString('Declaration', { width: declInnerW }) + 3;
  doc.fontSize(size.footerBody).font(FONT);
  declH += doc.heightOfString(ctx.declText, { width: declInnerW, lineGap: 0.25 });
  declH += pad + 12;

  const bankBlockH = countBankDataRows(ctx.bankRows)
    ? measureTallyBankBlockHeight(ctx.bankRows)
    : 0;
  const bankH = pad + bankBlockH + (bankBlockH ? pad : 0);

  const signH = PROFORMA_SIGN_COL_MIN_H + pad * 2;

  return Math.max(PROFORMA_FOOTER_MIN_H, declH, bankH, signH);
}

function measureProformaFooterLayout(doc, isSales, companyName, bankRows, isProformaDoc = false) {
  const ctx = buildProformaFooterContext(isSales, companyName, bankRows, isProformaDoc);
  const colWidths = computeProformaFooterColWidths(doc, ctx);
  const footerH = measureProformaFooterBoxHeight(doc, ctx, colWidths);
  return { ctx, colWidths, footerH };
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
    measureProformaFooterLayout(doc, true, 'Company', bankRows).footerH +
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

/** Fixed horizontal padding inside each table column (left + right). */
const COL_INNER_PAD = pad.cell * 2;

const PROFORMA_COL_LIMITS = {
  si: { min: 20, max: 28 },
  desc: { min: 72 },
  hsn: { min: 40, max: 72 },
  qty: { min: 34, max: 58 },
  rate: { min: 44, max: 86 },
  disc: { min: 38, max: 52 },
  per: { min: 26, max: 40 },
  amount: { min: 58, max: 90 },
};

function proformaColRoles() {
  return ['si', 'desc', 'hsn', 'qty', 'rate', 'per', 'disc', 'amount'];
}

function proformaItemColAlign(role) {
  if (role === 'qty' || role === 'rate' || role === 'amount') return 'right';
  if (role === 'si' || role === 'hsn' || role === 'per' || role === 'disc') return 'center';
  return 'left';
}

function formatLineDiscountDisplay(item) {
  const discRate = parseFloat(item.discountRate ?? item.discount_rate);
  if (Number.isFinite(discRate) && discRate > 0) {
    const rounded = Math.round(discRate * 100) / 100;
    const text =
      Number.isInteger(rounded) || Math.abs(rounded - Math.round(rounded)) < 0.001
        ? String(Math.round(rounded))
        : rounded.toFixed(2).replace(/\.?0+$/, '');
    return `${text}%`;
  }
  return '-';
}

function measureCellContentWidth(doc, cell) {
  const fs = cell.fontSize ?? (cell.bold ? size.tableHead : size.tableBody);
  doc.fontSize(fs).font(cell.bold ? FONT_BOLD : FONT);
  const text = String(cell.text ?? '').trim();
  if (!text) return 0;
  return Math.max(...text.split('\n').map((line) => doc.widthOfString(line)));
}

/** Size numeric/unit columns from cell content; description absorbs remaining width. */
function computeProformaItemColWidths(doc, tableRows) {
  const roles = proformaColRoles();
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
    const measured = measureItemRowHeight(doc, rowDef.cells, colWidths, defaultRowH);
    rowDef._height = idx === 0 ? Math.max(row.itemHeader, measured) : measured;
  });
}

function buildProformaItemHeaders(currency) {
  const cur = proformaTableCurrencyTag(currency);
  const rateH = `Rate/Unit\n(${cur})`;
  const amountH = `Amount\n(${cur})`;
  return [
    'SI\nNo.',
    'Description of\nGoods and Services',
    'HSN/SAC',
    'Quantity',
    rateH,
    'UOM',
    'Discount',
    amountH,
  ];
}

function buildProformaLineCells(item, idx, currency) {
  const gross = lineGrossAmount(item);
  const unit = normalizeUnit(item.unit);
  const qty = normalizeQuantity(item.quantity);
  const cells = [
    { text: String(idx + 1), align: proformaItemColAlign('si'), fontSize: size.tableBody },
    { text: (item.itemName || '').trim(), align: proformaItemColAlign('desc'), fontSize: size.tableBody },
    { text: hsnOf(item) || '-', align: proformaItemColAlign('hsn'), fontSize: size.tableBody },
    { text: formatLineQty(qty), align: proformaItemColAlign('qty'), fontSize: size.tableBody },
    {
      text: formatQtyAmount(item.unitAmount, currency),
      align: proformaItemColAlign('rate'),
      fontSize: size.tableAmount,
    },
    { text: unit, align: proformaItemColAlign('per'), fontSize: size.tableBody },
    {
      text: formatLineDiscountDisplay(item),
      align: proformaItemColAlign('disc'),
      fontSize: size.tableBody,
    },
  ];
  cells.push({
    text: formatQtyAmount(gross, currency),
    align: proformaItemColAlign('amount'),
    fontSize: size.tableAmount,
  });
  return cells;
}

/** Right-aligned subtotal / discount / tax summary before amount in words. */
function drawProformaTotalsSummary(doc, y, totals, currency, isProformaDoc = false) {
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
    summaryRows.push([isProformaDoc ? 'Add: IGST (Estimated)' : 'Add: IGST', tax]);
  }
  summaryRows.push([isProformaDoc ? 'Estimated Total' : 'Grand Total', grand]);

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
    const isGrand = label === 'Grand Total' || label === 'Estimated Total';
    doc.fontSize(isGrand ? size.body : size.tableBody).font(isGrand ? FONT_BOLD : FONT).fillColor('#000000');
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
      ? `State Name: ${sellerState.name || '—'}, State Code: ${sellerState.code || '—'}`
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
  const docKind = standardInvoice.details?.documentKind || standardInvoice.metadata?.documentKind;
  const isProforma = docKind === 'proforma';
  const isSales = isProforma || (standardInvoice.details?.type || standardInvoice.metadata?.type) === 'sales';
  const currency = standardInvoice.details?.currency || 'INR';
  const cs = ctx.companyStrings || {};
  const party = standardInvoice.partyDetails || {};
  const purchaseCompanyParty = ctx.purchaseCompanyParty || standardInvoice.purchaseCompanyParty || null;
  const purchaseShipParty = purchaseCompanyParty || party;
  const lineItems = standardInvoice.lineItems || [];
  const totals = standardInvoice.totals || {};

  const docTitle = isProforma ? 'PROFORMA INVOICE' : (isSales ? 'TAX INVOICE' : 'PURCHASE INVOICE');
  const docSubtitle = isProforma ? '' : '(ORIGINAL FOR RECIPIENT)';
  const sellerGst = cs.taxId || standardInvoice.header?.taxInfo?.taxId || '';
  const sellerState = gstStateFromGstin(
    sellerGst,
    companySettings?.state || standardInvoice.header?.address?.state
  );
  const partyGst = party.taxInfo?.gstin || '';
  const partyState = gstStateFromGstin(partyGst, party.billingAddress?.state);
  const shipStateForParty = gstStateFromGstin(partyGst, party.shippingAddress?.state);

  let y = PROFORMA_TOP_Y;

  const titleRowY = y;
  doc.fontSize(size.title).font(FONT_BOLD).fillColor('#1a1a1a').text(docTitle, LEFT, titleRowY, {
    width: WIDTH,
    align: 'center',
  });
  if (docSubtitle) {
    doc.fontSize(size.titleSub).font(FONT).fillColor('#444444').text(docSubtitle, LEFT, titleRowY + 2, {
      width: WIDTH - 4,
      align: 'right',
    });
  }
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
    billH = measureTallyPartyColumnHeight(
      doc,
      purchaseCompanyParty || party,
      'billing',
      purchaseCompanyParty?.taxInfo?.gstin || '',
      gstStateFromGstin(
        purchaseCompanyParty?.taxInfo?.gstin || '',
        purchaseCompanyParty?.billingAddress?.state
      ),
      [],
      sellerW,
      partyMinH
    );
    shipH = measureTallyPartyColumnHeight(
      doc,
      purchaseShipParty,
      'shipping',
      purchaseShipParty?.taxInfo?.gstin || '',
      gstStateFromGstin(
        purchaseShipParty?.taxInfo?.gstin || '',
        purchaseShipParty?.shippingAddress?.state
      ),
      [],
      metaW,
      partyMinH
    );
    sellerStackMinH += sectionGap + vendorFromH + sectionGap + billH;
  }

  const topH = isSales
    ? Math.max(metaGridH, sellerStackMinH + 4)
    : Math.max(metaGridH + (shipH > 0 ? shipH + 4 : 0), sellerStackMinH + 4);

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
        'Buyer (Billed to)',
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
      sy += vendorFromH;
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
        'Bill To',
        purchaseCompanyParty || party,
        'billing',
        purchaseCompanyParty?.taxInfo?.gstin || '',
        gstStateFromGstin(
          purchaseCompanyParty?.taxInfo?.gstin || '',
          purchaseCompanyParty?.billingAddress?.state
        ),
        []
      );
      sy += billH;
    }
    // Ship To is rendered in the right panel under meta rows for PI.
  }

  drawTallyMetaGrid(doc, metaX, y, metaW, metaGridRows, metaGridOptions);
  if (!isSales && shipH > 0 && metaGridH + 4 < topH) {
    const shipStartY = y + metaGridH + 4;
    strokeHLine(doc, metaX, metaX + metaW, shipStartY);
    drawTallyPartyColumn(
      doc,
      metaX,
      shipStartY,
      metaW,
      Math.max(24, topH - (shipStartY - y)),
      'Ship To',
      purchaseShipParty,
      'shipping',
      purchaseShipParty?.taxInfo?.gstin || '',
      gstStateFromGstin(
        purchaseShipParty?.taxInfo?.gstin || '',
        purchaseShipParty?.shippingAddress?.state
      ),
      []
    );
  }
  y += topH;

  const itemColRoles = proformaColRoles();
  const itemColCount = itemColRoles.length;
  const amountColIdx = itemColRoles.indexOf('amount');
  const discColIdx = itemColRoles.indexOf('disc');
  const qtyColIdx = itemColRoles.indexOf('qty');
  const itemRowH = row.itemDefault;
  const itemHeaders = buildProformaItemHeaders(currency);

  const itemTableRows = [
    {
      _height: row.itemHeader,
      cells: itemHeaders.map((h, i) => ({
        text: h,
        bold: true,
        fontSize: size.tableHead,
        align: proformaItemColAlign(itemColRoles[i]),
        padTop: pad.tableTop,
      })),
    },
  ];

  lineItems.forEach((item, idx) => {
    itemTableRows.push({
      cells: buildProformaLineCells(item, idx, currency),
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
      cells[qtyColIdx] = {
        text: formatLineQty(sumQty(lineItems)),
        align: 'right',
        bold: true,
        fontSize: size.tableBody,
      };
      cells[discColIdx] = {
        text: '-',
        align: 'center',
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

  const itemCols = computeProformaItemColWidths(doc, itemTableRows);
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

  y = drawProformaTotalsSummary(doc, y, totals, currency, isProforma);

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
  doc.text(isProforma ? 'Estimated Tax Amount (in words)' : 'Tax Amount (in words)', LEFT + 5, taxTy, { width: labelW, lineGap: 0.15 });
  taxTy += taxLabelH + PROFORMA_WORDS_GAP;
  doc.fontSize(size.wordsBody).font(FONT).fillColor('#000000');
  doc.text(taxValueText, LEFT + 5, taxTy, {
    width: innerW,
    lineGap: 0.25,
    height: Math.max(6, y + taxWordsH - PROFORMA_WORDS_PAD_H - taxTy),
    ellipsis: true,
  });
  y += taxWordsH;

  const bankRows = bankRowsForMeasure;
  const { ctx: footerCtx, colWidths: footerColW, footerH } = measureProformaFooterLayout(
    doc,
    isSales,
    cs.companyName,
    bankRows,
    isProforma
  );
  const footPad = PROFORMA_FOOTER_PAD;

  box(doc, LEFT, y, WIDTH, footerH);
  strokeProformaTableVerticals(doc, LEFT, y, footerColW, footerH);

  let colX = LEFT;

  doc.fontSize(size.footerTitle).font(FONT_BOLD).fillColor('#1a1a1a');
  doc.text('Declaration', colX + footPad, y + footPad, { width: footerColW[0] - footPad * 2 });
  doc.font(FONT).fontSize(size.footerBody).fillColor('#000000');
  doc.text(footerCtx.declText, colX + footPad, y + footPad + 11, {
    width: footerColW[0] - footPad * 2,
    lineGap: 0.25,
  });
  doc.font(FONT_BOLD).fontSize(size.footerBody).text(footerCtx.sealLabel, colX + footPad, y + footerH - 12, {
    width: footerColW[0] - footPad * 2,
  });

  colX += footerColW[0];
  drawTallyBankBlock(doc, colX + footPad, y + footPad, footerCtx.bankTitle, footerCtx.bankRows, footerColW[1] - footPad * 2, {
    titleSize: size.footerTitle,
    bodySize: size.footerBody,
  });

  colX += footerColW[1];
  const signInnerW = footerColW[2] - footPad * 2;
  doc
    .fontSize(size.footerBody)
    .font(FONT_BOLD)
    .fillColor('#1a1a1a')
    .text(`for ${footerCtx.companyName}`, colX + footPad, y + footPad, {
      width: signInnerW,
      align: 'right',
    });

  if (signatureBuffer) {
    try {
      doc.image(signatureBuffer, colX + footerColW[2] - footPad - 60, y + footPad + 14, {
        width: 56,
        height: 18,
      });
    } catch {
      /* ignore */
    }
  }

  doc
    .fontSize(size.footerBody)
    .font(FONT)
    .fillColor('#000000')
    .text('Authorised Signatory', colX + footPad, y + footerH - footPad - 10, {
      width: signInnerW,
      align: 'right',
    });

  y += footerH + 4;
  doc.fillColor('#000000');
}

module.exports = {
  drawProformaInvoice,
  formatTallyDate,
  gstStateFromGstin,
};
