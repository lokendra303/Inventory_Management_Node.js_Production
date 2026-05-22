/**
 * Ozone Pharmaceuticals–style Purchase Order PDF (3 pages: order, summary, general T&C).
 */

const invoiceTemplateService = require('./invoiceTemplate.service');
const { DEFAULT_PO_GENERAL_TERMS } = require('./purchaseOrderPdfOzoneTerms');
const { normalizeInvoiceUnit } = require('../../utils/invoiceUnit');
const T = require('./invoicePdfTallyTypography');

const { LEFT, RIGHT, WIDTH, FONT, FONT_BOLD, LINE, pad } = T;
const PAGE_H = 842;
const FOOTER_TOP = 748;
const CONTENT_MAX = FOOTER_TOP - 8;

/** Readable PO typography (print-friendly, ~8pt body). */
const PO_FONT = {
  companyTitle: 15,
  docTitle: 13,
  sectionLabel: 9,
  body: 8,
  metaLabel: 7,
  metaValue: 8,
  tableHeader: 7,
  tableBody: 8,
  tableSmall: 7,
  summary: 8,
  termsTitle: 12,
  termsBody: 8,
  footer: 7,
  banner: 10,
};

const GST_STATE_NAMES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '27': 'Maharashtra', '29': 'Karnataka', '32': 'Kerala', '33': 'Tamil Nadu',
  '36': 'Telangana', '37': 'Andhra Pradesh (New)',
};

function box(doc, x, y, w, h, stroke = true) {
  if (stroke) doc.rect(x, y, w, h).stroke();
  else doc.rect(x, y, w, h);
}

function formatPoDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${dt.getFullYear()}`;
}

function formatQty(n) {
  const v = parseFloat(n);
  if (!Number.isFinite(v)) return '0.000';
  if (Math.abs(v - Math.round(v)) < 0.0001) return `${Math.round(v)}.0`;
  return v.toFixed(3);
}

function formatMoney(amount, currency = 'INR') {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '0.00';
  const code = String(currency || 'INR').toUpperCase();
  const grouped =
    code === 'INR'
      ? num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : num.toFixed(2);
  return grouped;
}

function gstStateFromGstin(gstin, fallbackState) {
  const g = String(gstin || '').trim().toUpperCase();
  const code = g.length >= 2 ? g.slice(0, 2) : '';
  const name = (code && GST_STATE_NAMES[code]) || fallbackState || '';
  return { code, name };
}

function splitLineTax(buyerGstin, vendorGstin, taxRate, lineBase) {
  const rate = parseFloat(taxRate) || 0;
  const base = parseFloat(lineBase) || 0;
  const taxAmt = Math.round(base * rate / 100 * 100) / 100;
  const discRate = 0;
  const discAmt = 0;
  const bCode = String(buyerGstin || '').slice(0, 2);
  const vCode = String(vendorGstin || '').slice(0, 2);
  if (bCode && vCode && bCode === vCode && rate > 0) {
    const half = rate / 2;
    const halfAmt = Math.round(taxAmt / 2 * 100) / 100;
    const other = Math.round((taxAmt - halfAmt) * 100) / 100;
    return {
      discRate, discAmt,
      cgstPct: half, cgstAmt: halfAmt,
      sgstPct: half, sgstAmt: other,
      igstPct: 0, igstAmt: 0,
      taxAmt,
    };
  }
  return {
    discRate, discAmt,
    cgstPct: 0, cgstAmt: 0,
    sgstPct: 0, sgstAmt: 0,
    igstPct: rate, igstAmt: taxAmt,
    taxAmt,
  };
}

function addressLines(addr) {
  if (!addr) return [];
  const out = [];
  const line1 = [addr.address || addr.address_line1, addr.address_line2].filter(Boolean).join(', ');
  if (line1) out.push(line1);
  const city = [addr.city, addr.state, addr.postal_code || addr.postalCode].filter(Boolean).join(', ');
  const pin = addr.postal_code || addr.postalCode;
  const cityPin = [city, pin].filter(Boolean).join('-');
  if (cityPin) out.push(cityPin);
  if (addr.country) out.push(addr.country);
  return out;
}

function pickRegisteredOffice(company) {
  const addrs = company?.addresses || [];
  const reg =
    addrs.find((a) => /registered/i.test(a.label || '')) ||
    addrs.find((a) => a.is_default) ||
    addrs[0];
  if (reg) {
    return [reg.address, reg.city, reg.state, reg.country, reg.postal_code].filter(Boolean).join(', ');
  }
  return [company?.address, company?.city, company?.state, company?.country, company?.postal_code]
    .filter(Boolean)
    .join(', ');
}

function buildLineRows(poData, buyerGstin, vendorGstin) {
  return (poData.lines || []).map((line, idx) => {
    const qty = parseFloat(line.quantity_ordered) || 0;
    const rate = parseFloat(line.unit_cost) || 0;
    const base = qty * rate;
    const discRate = parseFloat(line.discount_rate) || 0;
    const discAmt = parseFloat(line.discount_amount) || Math.round(base * discRate / 100 * 100) / 100;
    const taxable = base - discAmt;
    const tax = splitLineTax(buyerGstin, vendorGstin, line.tax_rate, taxable);
    const lineTotal = parseFloat(line.line_total) || taxable + tax.taxAmt;
    const sku = line.sku || line.item_code || '';
    const name = line.item_name || '';
    return {
      sno: idx + 1,
      materialCode: sku,
      materialDesc: name,
      hsn: line.hsn_code || '',
      uom: normalizeInvoiceUnit(line.unit, 'PCS'),
      deliveryDate: line.expected_date || poData.expected_date,
      qty,
      rate,
      discRate: discRate || tax.discRate,
      discAmt: discAmt || tax.discAmt,
      ...tax,
      lineTotal,
      taxable,
    };
  });
}

function sumLines(lines) {
  return lines.reduce(
    (acc, l) => {
      acc.qty += l.qty;
      acc.basic += l.taxable;
      acc.disc += l.discAmt;
      acc.cgst += l.cgstAmt;
      acc.sgst += l.sgstAmt;
      acc.igst += l.igstAmt;
      acc.total += l.lineTotal;
      return acc;
    },
    { qty: 0, basic: 0, disc: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
  );
}

/** @param {PDFKit.PDFDocument} doc */
function drawPageHeader(doc, companyName, y) {
  doc.font(FONT_BOLD).fontSize(PO_FONT.companyTitle).text(companyName || 'Company Name', LEFT, y, {
    width: WIDTH,
    align: 'center',
  });
  y += 20;
  doc.fontSize(PO_FONT.docTitle).text('Purchase Order', LEFT, y, { width: WIDTH, align: 'center', underline: true });
  return y + 24;
}

/** @param {PDFKit.PDFDocument} doc */
function drawReceiverDeliverBlocks(doc, y, company, buyerGstin, buyerState) {
  const half = WIDTH / 2;
  const blockH = 88;
  box(doc, LEFT, y, WIDTH, blockH);
  doc.moveTo(LEFT + half, y).lineTo(LEFT + half, y + blockH).stroke();

  const padX = LEFT + pad.cell + 2;
  const rightX = LEFT + half + pad.cell + 2;

  doc.font(FONT_BOLD).fontSize(PO_FONT.sectionLabel);
  doc.text('Detail of Receiver', padX, y + 4, { width: half - 8 });
  doc.text('Deliver to', rightX, y + 4, { width: half - 8 });

  doc.font(FONT).fontSize(PO_FONT.body);
  let ly = y + 18;
  const receiverLines = [
    company?.company_name || 'Company',
    ...addressLines(company),
    buyerState.code ? `State Code: ${buyerState.code}` : '',
    company?.phone ? `Telephone: ${company.phone}` : '',
    buyerGstin ? `GSTIN: ${buyerGstin}` : company?.tax_id ? `GSTIN: ${company.tax_id}` : '',
    company?.email ? `Email: ${company.email}` : '',
  ].filter(Boolean);

  receiverLines.forEach((line) => {
    doc.text(line, padX, ly, { width: half - 10 });
    doc.text(line, rightX, ly, { width: half - 10 });
    ly += 12;
  });

  return y + blockH + 6;
}

/** @param {PDFKit.PDFDocument} doc */
function drawPoMetaGrid(doc, y, poData, meta) {
  const rows = [
    [
      { label: 'PO No.', value: poData.po_number || '' },
      { label: 'PO Date', value: formatPoDate(poData.order_date) },
      { label: 'PO Type', value: poData.po_type || meta.poType || '' },
      { label: 'W.E.F.', value: formatPoDate(poData.order_date) },
    ],
    [
      { label: 'Valid Till', value: formatPoDate(poData.valid_till || poData.expected_date) },
      { label: 'Currency', value: poData.currency || 'INR' },
      {
        label: 'PR No. & Date',
        value: [meta.buyersOrderNo, meta.buyersOrderDate ? formatPoDate(meta.buyersOrderDate) : '']
          .filter(Boolean)
          .join(' || '),
      },
      {
        label: 'Auction No. & Date',
        value: [meta.referenceNo, meta.referenceDate ? formatPoDate(meta.referenceDate) : '']
          .filter(Boolean)
          .join(' / '),
      },
    ],
  ];

  const colW = WIDTH / 4;
  const rowH = 28;
  const gridH = rowH * rows.length;
  box(doc, LEFT, y, WIDTH, gridH);

  rows.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      const cx = LEFT + ci * colW;
      const cy = y + ri * rowH;
      if (ci > 0) doc.moveTo(cx, y).lineTo(cx, y + gridH).stroke();
      doc.font(FONT_BOLD).fontSize(PO_FONT.metaLabel).text(cell.label, cx + 4, cy + 4, { width: colW - 8 });
      doc.font(FONT).fontSize(PO_FONT.metaValue).text(cell.value || '—', cx + 4, cy + 14, { width: colW - 8 });
    });
  });
  if (rows.length > 1) {
    doc.moveTo(LEFT, y + rowH).lineTo(LEFT + WIDTH, y + rowH).stroke();
  }

  return y + gridH + 6;
}

/** @param {PDFKit.PDFDocument} doc */
function drawVendorBlock(doc, y, vendor, vendorDetails) {
  const vName = vendorDetails?.display_name || vendor?.vendor_name || vendor?.name || 'Vendor';
  const vAddr = [];
  if (vendorDetails?.billing_address1) {
    vAddr.push(vendorDetails.billing_address1);
    if (vendorDetails.billing_address2) vAddr.push(vendorDetails.billing_address2);
    vAddr.push(
      [vendorDetails.billing_city, vendorDetails.billing_state, vendorDetails.billing_pin_code]
        .filter(Boolean)
        .join(', ')
    );
  }
  const vGst = vendorDetails?.gstin || '';
  const vState = gstStateFromGstin(vGst, vendorDetails?.billing_state);
  const blockH = 72;
  box(doc, LEFT, y, WIDTH, blockH);

  doc.font(FONT_BOLD).fontSize(PO_FONT.sectionLabel).text('Vendor Name & Address', LEFT + 4, y + 4);
  doc.font(FONT).fontSize(PO_FONT.body);
  let vy = y + 16;
  doc.font(FONT_BOLD).fontSize(PO_FONT.body).text(vName, LEFT + 4, vy, { width: WIDTH - 8 });
  vy += 12;
  vAddr.forEach((l) => {
    doc.font(FONT).text(l, LEFT + 4, vy, { width: WIDTH * 0.55 });
    vy += 11;
  });

  const metaX = LEFT + WIDTH * 0.58;
  let my = y + 14;
  const metaLines = [
    vendorDetails?.vendor_code ? `Vendor Code: ${vendorDetails.vendor_code}` : '',
    vGst ? `GSTIN: ${vGst}` : '',
    vendorDetails?.pan ? `PAN: ${vendorDetails.pan}` : '',
    vState.code ? `State Code: ${vState.code}${vState.name ? ` (${vState.name})` : ''}` : '',
    vendorDetails?.work_phone || vendorDetails?.mobile_phone
      ? `Landline Number: ${vendorDetails.work_phone || vendorDetails.mobile_phone}`
      : '',
    vendorDetails?.email ? `Email Id: ${vendorDetails.email}` : '',
  ].filter(Boolean);
  metaLines.forEach((l) => {
    doc.text(l, metaX, my, { width: WIDTH * 0.4 });
    my += 11;
  });

  return y + blockH + 6;
}

const TABLE_FONT = PO_FONT.tableBody;
const TABLE_PAD = 6;
const TABLE_ROW_PAD = 10;
const TABLE_LINE = 0.4;
const COLOR_RED = '#C00000';
const COLOR_BLACK = '#000000';
const SUBTOTAL_MERGE_COLS = 5;
const HEADER_ROW_H = 28;
const HEADER_LINE_GAP = 11;
const HEADER_FONT = PO_FONT.tableHeader;
const TAX_LINE_GAP = 4;
const CELL_H_PAD = TABLE_PAD * 2 + 8;

/** @type {{ key: string, headerLines: string[], min: number, flex: number, align: string, taxStacked?: boolean, rateCell?: boolean, highlight?: boolean }[]} */
const TABLE_COLUMNS = [
  { key: 'sno', headerLines: ['S.', 'No'], min: 22, flex: 0.04, align: 'center' },
  { key: 'material', headerLines: ['Material Code', '& Description'], min: 72, flex: 0.28, align: 'left' },
  { key: 'hsn', headerLines: ['HSN/SAC', 'Code'], min: 36, flex: 0.07, align: 'center' },
  { key: 'uom', headerLines: ['UOM'], min: 28, flex: 0.05, align: 'center' },
  { key: 'del', headerLines: ['Delivery', 'Date'], min: 40, flex: 0.08, align: 'center' },
  { key: 'qty', headerLines: ['Qty'], min: 30, flex: 0.06, align: 'center', highlight: true },
  { key: 'rate', headerLines: ['Rate/Unit', '(In Rs)'], min: 38, flex: 0.07, align: 'center', rateCell: true },
  { key: 'disc', headerLines: ['Disc %', 'AMT'], min: 36, flex: 0.07, align: 'center', taxStacked: true },
  { key: 'cgst', headerLines: ['CGST %', 'AMT'], min: 38, flex: 0.07, align: 'center', taxStacked: true },
  { key: 'sgst', headerLines: ['SGST %', 'AMT'], min: 38, flex: 0.07, align: 'center', taxStacked: true },
  { key: 'igst', headerLines: ['IGST %', 'AMT'], min: 38, flex: 0.07, align: 'center', taxStacked: true },
  { key: 'total', headerLines: ['AMOUNT'], min: 44, flex: 0.08, align: 'center', highlight: true },
];

function formatTableNumber(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '0.00';
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTaxPct(pct) {
  return (parseFloat(pct) || 0).toFixed(2);
}

function isZeroAmount(n) {
  return Math.abs(parseFloat(n) || 0) < 0.005;
}

/** One or two lines for tax/disc cells — never duplicate "0.00" when % and AMT are both zero. */
function taxCellLines(pct, amt, amountOnly = false) {
  const p = parseFloat(pct) || 0;
  const a = parseFloat(amt) || 0;

  if (amountOnly) {
    return [formatTableNumber(a)];
  }

  const pctZero = isZeroAmount(p);
  const amtZero = isZeroAmount(a);

  if (pctZero && amtZero) {
    return ['0.00'];
  }
  if (pctZero && !amtZero) {
    return [formatTableNumber(a)];
  }
  if (!pctZero && amtZero) {
    return [formatTaxPct(p)];
  }
  return [formatTaxPct(p), formatTableNumber(a)];
}

function colOffsets(colWidths) {
  const offsets = [LEFT];
  colWidths.forEach((w) => offsets.push(offsets[offsets.length - 1] + w));
  return offsets;
}

function cellInnerWidth(colWidths, i) {
  return colWidths[i] - TABLE_PAD * 2;
}

function measureTaxCellHeight(doc, w, lines) {
  doc.font(FONT).fontSize(TABLE_FONT);
  return doc.heightOfString(lines.join('\n'), { width: w, align: 'center', lineGap: TAX_LINE_GAP });
}

function measureRateCellHeight(doc, line, w) {
  doc.font(FONT).fontSize(TABLE_FONT);
  const t = formatTableNumber(line.rate);
  return doc.heightOfString(t, { width: w, align: 'center' }) + 4;
}

function measureDataRowHeight(doc, line, colWidths) {
  let maxH = TABLE_FONT + 4;
  TABLE_COLUMNS.forEach((col, i) => {
    const inner = cellInnerWidth(colWidths, i);
    if (col.key === 'material') {
      maxH = Math.max(maxH, measureMaterialBlock(doc, line, inner));
    } else if (col.taxStacked) {
      const { pct, amt } = taxPair(line, col.key);
      maxH = Math.max(maxH, measureTaxCellHeight(doc, inner, taxCellLines(pct, amt)));
    } else if (col.rateCell) {
      maxH = Math.max(maxH, measureRateCellHeight(doc, line, inner));
    } else {
      doc.font(FONT).fontSize(TABLE_FONT);
      const text = cellTextForMeasure(line, col.key);
      maxH = Math.max(maxH, doc.heightOfString(text, { width: inner, align: col.align }));
    }
  });
  return maxH + TABLE_ROW_PAD;
}

function cellTextForMeasure(line, key) {
  switch (key) {
    case 'sno':
      return String(line.sno);
    case 'hsn':
      return line.hsn || '—';
    case 'uom':
      return line.uom || 'PCS';
    case 'del':
      return formatPoDate(line.deliveryDate) || '—';
    case 'qty':
      return formatQty(line.qty);
    case 'total':
      return formatTableNumber(line.lineTotal);
    default:
      return '—';
  }
}

function taxPair(line, key) {
  switch (key) {
    case 'disc':
      return { pct: line.discRate, amt: line.discAmt };
    case 'cgst':
      return { pct: line.cgstPct, amt: line.cgstAmt };
    case 'sgst':
      return { pct: line.sgstPct, amt: line.sgstAmt };
    case 'igst':
      return { pct: line.igstPct, amt: line.igstAmt };
    default:
      return { pct: 0, amt: 0 };
  }
}

function measureHeaderWidth(doc, col) {
  doc.font(FONT_BOLD).fontSize(HEADER_FONT);
  return Math.max(...col.headerLines.map((h) => doc.widthOfString(h)));
}

function measureBodyTextsForColumn(doc, col, line) {
  const texts = [];
  if (col.key === 'material') {
    if (line.materialCode) texts.push(line.materialCode);
    if (line.materialDesc) texts.push(line.materialDesc);
  } else if (col.taxStacked) {
    const { pct, amt } = taxPair(line, col.key);
    texts.push(...taxCellLines(pct, amt));
  } else if (col.rateCell) {
    texts.push(formatTableNumber(line.rate));
  } else {
    texts.push(cellTextForMeasure(line, col.key));
  }
  return texts;
}

function measureSubtotalTextsForColumn(doc, col, totals) {
  if (col.key === 'qty') return [formatQty(totals.qty)];
  if (col.key === 'total') return [formatTableNumber(totals.total)];
  if (col.taxStacked) {
    const amt =
      col.key === 'disc'
        ? totals.disc
        : col.key === 'cgst'
          ? totals.cgst
          : col.key === 'sgst'
            ? totals.sgst
            : totals.igst;
    return [formatTableNumber(amt)];
  }
  if (col.key === 'material') return ['Sub Total'];
  return [];
}

/** Natural width = widest header or body string + padding (no arbitrary max cap). */
function measureColumnNatural(doc, col, lines, totals) {
  let w = measureHeaderWidth(doc, col) + CELL_H_PAD;

  doc.font(FONT).fontSize(TABLE_FONT);
  lines.forEach((line) => {
    measureBodyTextsForColumn(doc, col, line).forEach((t) => {
      w = Math.max(w, doc.widthOfString(t) + CELL_H_PAD);
    });
  });

  if (totals) {
    measureSubtotalTextsForColumn(doc, col, totals).forEach((t) => {
      doc.font(FONT_BOLD).fontSize(TABLE_FONT);
      w = Math.max(w, doc.widthOfString(t) + CELL_H_PAD);
      doc.font(FONT).fontSize(TABLE_FONT);
    });
  }

  return Math.max(col.min, Math.ceil(w));
}

function distributeExtraWidth(widths, extra) {
  const result = [...widths];
  if (extra <= 0) return result;

  const matIdx = TABLE_COLUMNS.findIndex((c) => c.key === 'material');
  const flexSum = TABLE_COLUMNS.reduce((s, c) => s + c.flex, 0);

  let remaining = extra;
  const toMaterial = Math.floor(extra * 0.55);
  result[matIdx] += toMaterial;
  remaining -= toMaterial;

  TABLE_COLUMNS.forEach((col, i) => {
    if (i === matIdx || remaining <= 0) return;
    const add = Math.floor(remaining * (col.flex / (flexSum - TABLE_COLUMNS[matIdx].flex)));
    result[i] += add;
  });

  const diff = WIDTH - result.reduce((a, b) => a + b, 0);
  result[matIdx] += diff;
  return result;
}

function shrinkWidthsToTarget(widths, floors, target) {
  const result = [...widths];
  let sum = result.reduce((a, b) => a + b, 0);
  if (sum <= target) return result;

  const matIdx = TABLE_COLUMNS.findIndex((c) => c.key === 'material');
  let guard = 0;
  while (sum > target && guard < 5000) {
    guard += 1;
    const excess = sum - target;
    const shrinkable = result
      .map((w, i) => ({ i, slack: w - floors[i] }))
      .filter((x) => x.slack > 0.5)
      .sort((a, b) => (a.i === matIdx ? -1 : b.i === matIdx ? 1 : b.slack - a.slack));

    if (!shrinkable.length) break;

    const pick = shrinkable[0];
    const cut = Math.min(pick.slack, Math.max(1, Math.ceil(excess / shrinkable.length)));
    result[pick.i] -= cut;
    sum -= cut;
  }

  const diff = target - result.reduce((a, b) => a + b, 0);
  result[result.length - 1] += diff;
  return result;
}

/** Fit all columns to page width; never narrower than header + values require. */
function computeColumnWidths(doc, lines, totals) {
  const floors = TABLE_COLUMNS.map((col) => measureColumnNatural(doc, col, [], totals));
  let natural = TABLE_COLUMNS.map((col, i) =>
    Math.max(measureColumnNatural(doc, col, lines, totals), floors[i])
  );

  const matIdx = TABLE_COLUMNS.findIndex((c) => c.key === 'material');
  const matCap = Math.floor(WIDTH * 0.45);
  natural[matIdx] = Math.min(natural[matIdx], matCap);

  let sum = natural.reduce((a, b) => a + b, 0);

  if (sum < WIDTH) {
    return distributeExtraWidth(natural, WIDTH - sum);
  }
  if (sum > WIDTH) {
    return shrinkWidthsToTarget(natural, floors, WIDTH);
  }
  return natural;
}

function drawHeaderCell(doc, x, y, w, col) {
  doc.font(FONT_BOLD).fontSize(HEADER_FONT).fillColor(COLOR_BLACK);
  if (col.headerLines.length >= 2) {
    doc.text(col.headerLines[0], x, y + 4, { width: w, align: 'center', lineGap: 0 });
    doc.text(col.headerLines[1], x, y + 4 + HEADER_LINE_GAP, { width: w, align: 'center', lineGap: 0 });
    return;
  }
  const label = col.headerLines[0];
  const textH = doc.heightOfString(label, { width: w, align: 'center' });
  doc.text(label, x, y + (HEADER_ROW_H - textH) / 2, { width: w, align: 'center', lineGap: 0 });
}

function drawTaxCell(doc, x, y, w, pct, amt, align, color = COLOR_BLACK, rowH = null, amountOnly = false) {
  const lines = taxCellLines(pct, amt, amountOnly);
  doc.font(FONT).fontSize(TABLE_FONT);
  const blockH = measureTaxCellHeight(doc, w, lines);
  const cy = rowH != null ? y + (rowH - blockH) / 2 : y;
  doc.fillColor(color);
  let lineY = cy;
  lines.forEach((lineText) => {
    doc.text(lineText, x, lineY, { width: w, align, lineGap: 0 });
    lineY += TABLE_FONT + TAX_LINE_GAP;
  });
  doc.fillColor(COLOR_BLACK);
  return blockH;
}

function measureMaterialBlock(doc, line, w) {
  doc.font(FONT).fontSize(TABLE_FONT);
  let h = 0;
  if (line.materialCode) h += doc.heightOfString(line.materialCode, { width: w }) + 3;
  if (line.materialDesc) h += doc.heightOfString(line.materialDesc, { width: w });
  return h || TABLE_FONT + 2;
}

function drawMaterialCell(doc, x, y, w, line, rowH) {
  const blockH = measureMaterialBlock(doc, line, w);
  let cy = y + (rowH - blockH) / 2;
  doc.fillColor(COLOR_BLACK).font(FONT).fontSize(TABLE_FONT);
  if (line.materialCode) {
    doc.font(FONT_BOLD).text(line.materialCode, x, cy, { width: w, align: 'left', lineGap: 0 });
    cy += doc.heightOfString(line.materialCode, { width: w }) + 3;
    doc.font(FONT);
  }
  if (line.materialDesc) {
    doc.text(line.materialDesc, x, cy, { width: w, align: 'left', lineGap: 0 });
  }
}

function drawItemsTableHeader(doc, y, colWidths) {
  const offsets = colOffsets(colWidths);

  doc.lineWidth(TABLE_LINE).strokeColor(COLOR_BLACK);
  box(doc, LEFT, y, WIDTH, HEADER_ROW_H);
  for (let i = 1; i < offsets.length - 1; i++) {
    doc.moveTo(offsets[i], y).lineTo(offsets[i], y + HEADER_ROW_H).stroke();
  }

  TABLE_COLUMNS.forEach((col, i) => {
    drawHeaderCell(doc, offsets[i] + TABLE_PAD, y, cellInnerWidth(colWidths, i), col);
  });

  return y + HEADER_ROW_H;
}

function drawSimpleCell(doc, x, y, w, text, align, color, rowH, bold = false) {
  doc.font(bold ? FONT_BOLD : FONT).fontSize(TABLE_FONT);
  const textH = doc.heightOfString(text, { width: w, align });
  const cy = y + (rowH - textH) / 2;
  doc.fillColor(color).text(text, x, cy, { width: w, align, lineGap: 0 });
  doc.fillColor(COLOR_BLACK);
}

function drawItemRow(doc, y, line, colWidths) {
  const rh = measureDataRowHeight(doc, line, colWidths);
  const offsets = colOffsets(colWidths);

  TABLE_COLUMNS.forEach((col, i) => {
    const x = offsets[i] + TABLE_PAD;
    const w = cellInnerWidth(colWidths, i);

    if (col.key === 'material') {
      drawMaterialCell(doc, x, y, w, line, rh);
      return;
    }
    if (col.taxStacked) {
      const { pct, amt } = taxPair(line, col.key);
      drawTaxCell(doc, x, y, w, pct, amt, col.align, COLOR_BLACK, rh, false);
      return;
    }
    if (col.rateCell) {
      drawSimpleCell(doc, x, y, w, formatTableNumber(line.rate), col.align, COLOR_BLACK, rh);
      return;
    }

    const color = col.highlight ? COLOR_RED : COLOR_BLACK;
    let text = '—';
    if (col.key === 'sno') text = String(line.sno);
    else if (col.key === 'hsn') text = line.hsn || '—';
    else if (col.key === 'uom') text = line.uom || 'PCS';
    else if (col.key === 'del') text = formatPoDate(line.deliveryDate) || '—';
    else if (col.key === 'qty') text = formatQty(line.qty);
    else if (col.key === 'total') text = formatTableNumber(line.lineTotal);
    drawSimpleCell(doc, x, y, w, text, col.align, color, rh);
  });

  return y + rh;
}

function drawItemsSubtotalRow(doc, y, totals, colWidths) {
  const offsets = colOffsets(colWidths);
  const mergeW = offsets[SUBTOTAL_MERGE_COLS] - offsets[0];
  const rh =
    measureTaxCellHeight(doc, cellInnerWidth(colWidths, 7), ['0.00']) + TABLE_ROW_PAD;

  doc.lineWidth(TABLE_LINE).strokeColor(COLOR_BLACK);
  doc.moveTo(LEFT, y).lineTo(LEFT + WIDTH, y).stroke();

  const labelH = doc.font(FONT_BOLD).fontSize(TABLE_FONT).heightOfString('Sub Total', {
    width: mergeW - TABLE_PAD * 2,
  });
  doc.fillColor(COLOR_BLACK).text('Sub Total', offsets[0] + TABLE_PAD, y + (rh - labelH) / 2, {
    width: mergeW - TABLE_PAD * 2,
    align: 'left',
  });

  const qtyIdx = TABLE_COLUMNS.findIndex((c) => c.key === 'qty');
  drawSimpleCell(
    doc,
    offsets[qtyIdx] + TABLE_PAD,
    y,
    cellInnerWidth(colWidths, qtyIdx),
    formatQty(totals.qty),
    'center',
    COLOR_BLACK,
    rh,
    true
  );

  TABLE_COLUMNS.forEach((col, i) => {
    if (!col.taxStacked) return;
    const amtVal =
      col.key === 'disc'
        ? totals.disc
        : col.key === 'cgst'
          ? totals.cgst
          : col.key === 'sgst'
            ? totals.sgst
            : totals.igst;
    drawTaxCell(
      doc,
      offsets[i] + TABLE_PAD,
      y,
      cellInnerWidth(colWidths, i),
      0,
      amtVal,
      col.align,
      COLOR_BLACK,
      rh,
      true
    );
  });

  const totalIdx = TABLE_COLUMNS.findIndex((c) => c.key === 'total');
  drawSimpleCell(
    doc,
    offsets[totalIdx] + TABLE_PAD,
    y,
    cellInnerWidth(colWidths, totalIdx),
    formatTableNumber(totals.total),
    'center',
    COLOR_BLACK,
    rh,
    true
  );

  return y + rh;
}

/** Outer border only; vertical dividers in header (passed separately). */
function strokeTableOutline(doc, topY, bottomY) {
  doc.lineWidth(TABLE_LINE).strokeColor(COLOR_BLACK);
  box(doc, LEFT, topY, WIDTH, bottomY - topY);
}

/** @param {PDFKit.PDFDocument} doc */
function drawCompactPoBanner(doc, y, poData) {
  doc.font(FONT_BOLD).fontSize(PO_FONT.banner).text('Purchase Order', LEFT, y);
  doc.font(FONT).fontSize(PO_FONT.body);
  doc.text(`PO No.: ${poData.po_number || ''}`, RIGHT - 160, y, { width: 160, align: 'right' });
  doc.text(`PO Date: ${formatPoDate(poData.order_date)}`, RIGHT - 160, y + 11, { width: 160, align: 'right' });
  doc.moveTo(LEFT, y + 24).lineTo(RIGHT, y + 24).stroke();
  return y + 28;
}

/** @param {PDFKit.PDFDocument} doc */
function drawSummaryPage(doc, startY, poData, meta, totals, currency, companyName) {
  let y = drawCompactPoBanner(doc, startY, poData);

  const summaryW = 200;
  const summaryX = RIGHT - summaryW;
  const termsW = summaryX - LEFT - 12;

  const summaryRows = [
    ['Total Basic Amount', totals.basic],
    ['Packing Charges', 0],
    ['Freight', 0],
    ['Total GST Amount', totals.cgst + totals.sgst + totals.igst],
    ['TCS Value', 0],
    ['Other Charges', 0],
    ['Insurance Charges', 0],
    ['Tool Cost', 0],
    ['GRAND TOTAL', totals.total],
  ];

  const rowH = 14;
  const sumH = summaryRows.length * rowH + 4;
  box(doc, summaryX, y, summaryW, sumH);

  summaryRows.forEach(([label, val], i) => {
    const ry = y + 2 + i * rowH;
    doc.font(i === summaryRows.length - 1 ? FONT_BOLD : FONT).fontSize(PO_FONT.summary);
    doc.text(label, summaryX + 4, ry + 2, { width: summaryW * 0.55 });
    doc.text(formatMoney(val, currency), summaryX + summaryW * 0.55, ry + 2, {
      width: summaryW * 0.42,
      align: 'right',
    });
  });

  const amountWords = invoiceTemplateService.convertAmountToWords(totals.total, currency);
  y += sumH + 4;
  box(doc, summaryX, y, summaryW, 28);
  doc.font(FONT_BOLD).fontSize(PO_FONT.summary).text('Grand Total in Words', summaryX + 4, y + 3);
  doc.font(FONT).fontSize(PO_FONT.summary).text(amountWords, summaryX + 4, y + 12, { width: summaryW - 8 });

  const termsLabels = [
    'Payment Terms',
    'Mode of Dispatch',
    'Delivery Terms',
    'Test Certificate',
    'PDI',
    'Freight',
    'Insurance',
    'Warranty',
  ];
  let ty = startY + 28;
  doc.font(FONT_BOLD).fontSize(PO_FONT.summary);
  termsLabels.forEach((label) => {
    doc.text(`${label}:`, LEFT, ty, { width: termsW, continued: false });
    ty += 12;
  });

  ty += 4;
  doc.font(FONT_BOLD).fontSize(PO_FONT.summary).text('Remarks', LEFT, ty);
  ty += 11;
  const remarks = [
    meta.paymentTerms ? `Payment Terms: ${meta.paymentTerms}` : '',
    meta.deliveryTerms ? `Delivery Terms: ${meta.deliveryTerms}` : '',
    meta.destination ? `Destination: ${meta.destination}` : '',
    poData.notes ? String(poData.notes).trim() : '',
    meta.otherReferences ? meta.otherReferences : '',
  ].filter(Boolean);
  doc.font(FONT).fontSize(PO_FONT.body);
  remarks.forEach((r) => {
    doc.text(r, LEFT, ty, { width: termsW });
    ty += doc.heightOfString(r, { width: termsW }) + 4;
  });

  const authY = Math.max(ty + 10, y + 40);
  doc.font(FONT_BOLD).fontSize(PO_FONT.sectionLabel).text(`For ${companyName}`, LEFT, authY);
  doc.font(FONT).fontSize(PO_FONT.body).text(
    'This document is system generated and does not require the signature or the Company\'s stamp in order to be considered valid.',
    LEFT,
    authY + 12,
    { width: WIDTH }
  );

  const prepY = authY + 32;
  doc.fontSize(PO_FONT.body);
  doc.text('Prepared By:', LEFT, prepY);
  doc.text('Checked By:', LEFT + WIDTH / 3, prepY);
  doc.text('Approved By:', LEFT + (WIDTH * 2) / 3, prepY);

  return Math.max(ty, prepY) + 20;
}

/** @param {PDFKit.PDFDocument} doc */
function drawTermsPage(doc, startY, poData, companyName, termsList) {
  let y = drawCompactPoBanner(doc, startY, poData);
  doc.font(FONT_BOLD).fontSize(PO_FONT.termsTitle).text(companyName, LEFT, y, { width: WIDTH, align: 'center' });
  y += 18;
  doc.fontSize(PO_FONT.docTitle).text('General Terms and Conditions', LEFT, y, {
    width: WIDTH,
    align: 'center',
    underline: true,
  });
  y += 22;

  doc.font(FONT).fontSize(PO_FONT.termsBody);
  termsList.forEach((clause, i) => {
    const text = `${i + 1}. ${clause}`;
    doc.text(text, LEFT + 4, y, { width: WIDTH - 8 });
    y += doc.heightOfString(text, { width: WIDTH - 8 }) + 5;
  });
  return y;
}

/** @param {PDFKit.PDFDocument} doc */
function drawCorporateFooter(doc, company, pageNum, pageCount) {
  const regOffice = pickRegisteredOffice(company);
  const cin = company?.registration_number || company?.cin || '';
  const pan = company?.pan || '';
  const tan = company?.tan || '';

  doc.font(FONT).fontSize(PO_FONT.footer);
  let y = FOOTER_TOP;
  if (regOffice) {
    doc.text(`Registered Office: ${regOffice}`, LEFT, y, { width: WIDTH, align: 'center' });
    y += 9;
  }
  const ids = [
    cin ? `CIN: ${cin}` : '',
    pan ? `PAN: ${pan}` : '',
    tan ? `TAN NO: ${tan}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
  if (ids) {
    doc.text(ids, LEFT, y, { width: WIDTH, align: 'center' });
    y += 9;
  }
  const contact = [
    company?.email ? `EMAIL: ${company.email}` : '',
    company?.phone ? `Telephone: ${company.phone}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
  if (contact) {
    doc.text(contact, LEFT, y, { width: WIDTH, align: 'center' });
    y += 9;
  }
  doc.text(`Page ${pageNum} of ${pageCount}`, RIGHT - 80, PAGE_H - 28, { width: 80, align: 'right' });
}

/**
 * Render Ozone-style PO into an open PDFKit document (does not call doc.end).
 * @param {PDFKit.PDFDocument} doc
 * @param {object} ctx
 */
function renderOzonePurchaseOrder(doc, ctx) {
  const { poData, company, vendorDetails, generalTerms } = ctx;
  const meta = poData.documentMeta || {};
  const currency = poData.currency || 'INR';
  const companyName = company?.company_name || 'Company Name';
  const buyerGstin = company?.tax_id || '';
  const vendorGstin = vendorDetails?.gstin || '';
  const buyerState = gstStateFromGstin(buyerGstin, company?.state);
  const lineRows = buildLineRows(poData, buyerGstin, vendorGstin);
  const totals = sumLines(lineRows);
  totals.basic = lineRows.reduce((s, l) => s + l.taxable, 0);

  const terms =
    (generalTerms && generalTerms.length > 0 && generalTerms) || DEFAULT_PO_GENERAL_TERMS;

  let y = 36;
  y = drawPageHeader(doc, companyName, y);
  y = drawReceiverDeliverBlocks(doc, y, company, buyerGstin, buyerState);
  y = drawPoMetaGrid(doc, y, poData, meta);
  y = drawVendorBlock(doc, y, poData, vendorDetails);

  const colWidths = computeColumnWidths(doc, lineRows, totals);
  let segmentTopY = y;
  y = drawItemsTableHeader(doc, y, colWidths);

  const rowHeights = lineRows.map((line) => measureDataRowHeight(doc, line, colWidths));
  const subH = measureTaxCellHeight(doc, cellInnerWidth(colWidths, 7), ['0.00']) + TABLE_ROW_PAD + 2;

  const startTableContinued = () => {
    doc.addPage();
    let ny = 36;
    ny = drawCompactPoBanner(doc, ny, poData);
    segmentTopY = ny;
    return drawItemsTableHeader(doc, ny, colWidths);
  };

  const closeTableSegment = (bodyBottomY) => {
    strokeTableOutline(doc, segmentTopY, bodyBottomY);
  };

  lineRows.forEach((line, idx) => {
    const rh = rowHeights[idx];
    if (y + rh > CONTENT_MAX) {
      closeTableSegment(y);
      y = startTableContinued();
    }
    y = drawItemRow(doc, y, line, colWidths);
  });

  if (y + subH > CONTENT_MAX) {
    closeTableSegment(y);
    y = startTableContinued();
  }
  y = drawItemsSubtotalRow(doc, y, totals, colWidths);
  closeTableSegment(y);

  doc.addPage();
  y = 36;
  drawSummaryPage(doc, y, poData, meta, totals, currency, companyName);

  doc.addPage();
  y = 36;
  drawTermsPage(doc, y, poData, companyName, terms);

  const range = doc.bufferedPageRange();
  const pageCount = range.count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(range.start + i);
    drawCorporateFooter(doc, company, i + 1, pageCount);
  }
}

module.exports = {
  renderOzonePurchaseOrder,
  formatPoDate,
  formatMoney,
  buildLineRows,
  sumLines,
};
