/**
 * Tally-style bordered invoice meta grid (shared by classic & proforma templates).
 */

const LINE = 0.45;
const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const META_LABEL_SIZE = 6;
const META_VALUE_SIZE = 7;
const META_VALUE_PAD_TOP = 9;
const META_CELL_PAD = 4;

function formatTallyDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${dt.getDate()}-${months[dt.getMonth()]}-${String(dt.getFullYear()).slice(-2)}`;
}

function clipMetaValue(value, maxLen = 42) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

function box(doc, x, y, w, h) {
  doc.save();
  doc.lineWidth(LINE).strokeColor('#000000').rect(x, y, w, h).stroke();
  doc.restore();
}

function strokeVLine(doc, x, y1, y2) {
  doc.save();
  doc.lineWidth(LINE).strokeColor('#000000');
  doc.moveTo(x, y1).lineTo(x, y2).stroke();
  doc.restore();
}

function measureMetaRowHeight(doc, cells, colWidths) {
  const pad = META_CELL_PAD;
  let maxH = 18;
  cells.forEach((cell, i) => {
    const cw = colWidths[i] || colWidths[0];
    const value = cell.value || '';
    doc.fontSize(META_VALUE_SIZE).font(FONT);
    const valueH = value ? doc.heightOfString(value, { width: cw - pad * 2, lineGap: 0 }) : 0;
    const h = META_VALUE_PAD_TOP + Math.max(valueH, 7) + 4;
    if (h > maxH) maxH = h;
  });
  return Math.min(maxH, 36);
}

function drawMetaLabeledCell(doc, x, y, w, h, label, value) {
  const pad = META_CELL_PAD;
  doc.fontSize(META_LABEL_SIZE).font(FONT_BOLD).fillColor('#000000');
  doc.text(label, x + pad, y + 2, { width: w - pad * 2, lineGap: 0 });

  const valueText = clipMetaValue(value, w < 140 ? 28 : 48);
  if (valueText) {
    doc.fontSize(META_VALUE_SIZE).font(FONT);
    const maxValueH = Math.max(7, h - META_VALUE_PAD_TOP - 3);
    doc.text(valueText, x + pad, y + META_VALUE_PAD_TOP, {
      width: w - pad * 2,
      height: maxValueH,
      lineGap: 0,
      ellipsis: true,
    });
  }
}

/**
 * Build Tally-style meta rows from standardInvoice (after documentMeta applied to details).
 */
function buildTallyMetaGridRows(standardInvoice, party = {}) {
  const details = standardInvoice?.details || {};
  const invDate = formatTallyDate(details.invoiceDate);
  const refDate = formatTallyDate(details.referenceDate);
  const refLine = [details.reference, refDate].filter(Boolean).join(' / ');
  const buyersOrder =
    details.buyersOrderNo || details.soNumber || details.poNumber || '';
  const buyersOrderDate = formatTallyDate(details.buyersOrderDate) || invDate;
  const destination =
    details.destination ||
    party.shippingAddress?.city ||
    party.billingAddress?.city ||
    '';
  const termsDelivery = clipMetaValue(details.deliveryTerms || '', 55);

  return [
    {
      cells: [
        { label: 'Invoice No.', value: details.invoiceNumber },
        { label: 'Dated', value: invDate },
      ],
    },
    { cells: [{ label: 'e-Way Bill No.', value: details.ewayBill || '' }] },
    { cells: [{ label: 'Delivery Note', value: details.deliveryNote || '' }] },
    { cells: [{ label: 'Mode/Terms of Payment', value: details.paymentTerms || '' }] },
    { cells: [{ label: 'Reference No. & Date.', value: refLine }] },
    { cells: [{ label: 'Other References', value: details.otherReferences || details.grnNumber || '' }] },
    {
      cells: [
        { label: "Buyer's Order No.", value: buyersOrder },
        { label: 'Dated', value: buyersOrderDate },
      ],
    },
    {
      cells: [
        { label: 'Dispatch Doc No.', value: details.dispatchDocNo || '' },
        { label: 'Delivery Note Date', value: formatTallyDate(details.deliveryNoteDate) },
      ],
    },
    {
      cells: [
        { label: 'Dispatched through', value: details.dispatchMode || '' },
        { label: 'Destination', value: destination },
      ],
    },
    { cells: [{ label: 'Terms of Delivery', value: termsDelivery }] },
  ];
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

/** Measure meta grid height (sets row._height on each row). */
function measureMetaGridHeight(doc, rows, totalWidth) {
  const halfMeta = totalWidth / 2;
  const colWidthsTwo = [halfMeta, halfMeta];
  let h = 0;
  rows.forEach((row) => {
    const cols = row.cells.length === 1 ? [totalWidth] : colWidthsTwo;
    row._height = measureMetaRowHeight(doc, row.cells, cols);
    h += row._height;
  });
  return h;
}

function strokeHLine(doc, x1, x2, y) {
  doc.save();
  doc.lineWidth(LINE).strokeColor('#000000');
  doc.moveTo(x1, y).lineTo(x2, y).stroke();
  doc.restore();
}

/**
 * Draw one Tally-style party panel (Consignee / Buyer / Supplier) inside a fixed box.
 */
function drawClassicPartyPanel(doc, x, y, w, h, title, party, addressKey, extraLines = []) {
  const pad = 4;
  const innerW = w - pad * 2;
  const addr = addressKey === 'shipping' ? party.shippingAddress || {} : party.billingAddress || {};
  const gst = party.taxInfo?.gstin || '';

  doc.fontSize(6.5).font(FONT_BOLD).fillColor('#000000');
  doc.text(title, x + pad, y + 3, { width: innerW, lineGap: 0 });

  let py = y + 12;
  const maxY = y + h - 4;

  if (party.name && py < maxY) {
    doc.fontSize(7.5).font(FONT_BOLD);
    const nameH = doc.heightOfString(party.name, { width: innerW, lineGap: 0 });
    if (py + nameH <= maxY) {
      doc.text(party.name, x + pad, py, { width: innerW, lineGap: 0 });
      py += nameH + 2;
    }
  }

  doc.fontSize(6.5).font(FONT);
  formatAddressLines(addr).forEach((line) => {
    if (py >= maxY) return;
    const lh = doc.heightOfString(line, { width: innerW, lineGap: 0.2 });
    if (py + lh > maxY) return;
    doc.text(line, x + pad, py, { width: innerW, lineGap: 0.2 });
    py += lh + 1;
  });

  if (gst && py < maxY) {
    const line = `GSTIN/UIN: ${gst}`;
    const lh = doc.heightOfString(line, { width: innerW });
    if (py + lh <= maxY) {
      doc.text(line, x + pad, py, { width: innerW });
      py += lh + 1;
    }
  }

  extraLines.filter(Boolean).forEach((line) => {
    if (py >= maxY) return;
    const lh = doc.heightOfString(line, { width: innerW });
    if (py + lh > maxY) return;
    doc.text(line, x + pad, py, { width: innerW });
    py += lh + 1;
  });

  doc.fillColor('#000000');
}

function measureClassicPartyPanelMinHeight(doc, party, addressKey, extraLines = [], panelW) {
  const innerW = panelW - 8;
  let h = 14;
  if (party?.name) {
    doc.fontSize(7.5).font(FONT_BOLD);
    h += doc.heightOfString(party.name, { width: innerW }) + 2;
  }
  const addr = addressKey === 'shipping' ? party?.shippingAddress : party?.billingAddress;
  doc.fontSize(6.5).font(FONT);
  formatAddressLines(addr).forEach((line) => {
    h += doc.heightOfString(line, { width: innerW, lineGap: 0.2 }) + 1;
  });
  if (party?.taxInfo?.gstin) h += 10;
  h += extraLines.filter(Boolean).length * 10;
  return Math.min(Math.max(h, 48), 120);
}

/**
 * Classic template: Bill to / Ship to (left) + meta grid (right), Tally-style bordered band.
 * @returns {number} bottom Y
 */
function drawClassicPartyMetaBand(doc, y, standardInvoice, party = {}, options = {}) {
  const LEFT = options.leftX ?? 50;
  const WIDTH = options.totalWidth ?? 495;
  const META_RATIO = options.metaRatio ?? 0.44;
  const metaW = Math.round(WIDTH * META_RATIO);
  const partyW = WIDTH - metaW;
  const metaX = LEFT + partyW;
  const isSales = options.isSales !== false && (standardInvoice.details?.type || standardInvoice.metadata?.type) !== 'purchase';

  const rows = buildTallyMetaGridRows(standardInvoice, party);
  const metaH = measureMetaGridHeight(doc, rows, metaW);

  let partyMinH;
  if (isSales) {
    const shipH = measureClassicPartyPanelMinHeight(doc, party, 'shipping', [], partyW);
    const billH = measureClassicPartyPanelMinHeight(doc, party, 'billing', [], partyW);
    partyMinH = shipH + billH;
  } else {
    partyMinH = measureClassicPartyPanelMinHeight(doc, party, 'billing', [], partyW);
  }

  const blockH = Math.max(metaH, partyMinH, 108);

  box(doc, LEFT, y, WIDTH, blockH);
  strokeVLine(doc, metaX, y, y + blockH);

  if (isSales) {
    const shipH = Math.floor(blockH / 2);
    const billH = blockH - shipH;
    strokeHLine(doc, LEFT, LEFT + partyW, y + shipH);
    drawClassicPartyPanel(doc, LEFT, y, partyW, shipH, 'Ship to', party, 'shipping');
    drawClassicPartyPanel(
      doc,
      LEFT,
      y + shipH,
      partyW,
      billH,
      'Bill to',
      party,
      'billing',
      party.billingAddress?.state ? [`Place of Supply: ${party.billingAddress.state}`] : []
    );
  } else {
    drawClassicPartyPanel(doc, LEFT, y, partyW, blockH, 'Supplier (Bill from)', party, 'billing');
  }

  drawTallyMetaGrid(doc, metaX, y, metaW, rows);

  return y + blockH;
}

/**
 * Draw bordered meta grid; returns bottom Y.
 */
function drawTallyMetaGrid(doc, x, y, totalWidth, rows) {
  const halfMeta = totalWidth / 2;
  const colWidthsTwo = [halfMeta, halfMeta];

  rows.forEach((row) => {
    if (row._height) return;
    const cols = row.cells.length === 1 ? [totalWidth] : colWidthsTwo;
    row._height = measureMetaRowHeight(doc, row.cells, cols);
  });

  let metaY = y;
  rows.forEach((row) => {
    const rowH = row._height;
    const spanFull = row.cells.length === 1;
    box(doc, x, metaY, totalWidth, rowH);

    if (spanFull) {
      drawMetaLabeledCell(doc, x, metaY, totalWidth, rowH, row.cells[0].label, row.cells[0].value);
    } else {
      let mx = x;
      row.cells.forEach((cell, i) => {
        const cw = colWidthsTwo[i];
        if (i > 0) strokeVLine(doc, mx, metaY, metaY + rowH);
        drawMetaLabeledCell(doc, mx, metaY, cw, rowH, cell.label, cell.value);
        mx += cw;
      });
    }
    metaY += rowH;
  });

  return metaY;
}

module.exports = {
  formatTallyDate,
  clipMetaValue,
  buildTallyMetaGridRows,
  drawTallyMetaGrid,
  drawClassicPartyMetaBand,
  measureMetaGridHeight,
  drawMetaLabeledCell,
  measureMetaRowHeight,
  box,
  strokeVLine,
};
