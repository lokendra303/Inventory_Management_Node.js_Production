/**
 * Tally-style bordered invoice meta grid (shared by classic & proforma templates).
 */

const T = require('./invoicePdfTallyTypography');
const { FONT, FONT_BOLD, LINE, size, row, pad } = T;

function formatTallyDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${dt.getDate()}-${months[dt.getMonth()]}-${String(dt.getFullYear()).slice(-2)}`;
}

/** @deprecated Prefer metaValueText — kept for callers that still import clipMetaValue. */
function clipMetaValue(value, maxLen = 48) {
  const s = metaValueText(value);
  if (!maxLen || s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

function metaValueText(value) {
  return String(value ?? '').trim();
}

/** Per-cell body cap (pt) so one field cannot blow up the header band; content wraps until this height. */
const META_CELL_MAX_BODY_H = 72;

function box(doc, x, y, w, h) {
  doc.save();
  doc.lineWidth(LINE).strokeColor('#1a1a1a').rect(x, y, w, h).stroke();
  doc.restore();
}

function strokeVLine(doc, x, y1, y2) {
  doc.save();
  doc.lineWidth(LINE).strokeColor('#1a1a1a');
  doc.moveTo(x, y1).lineTo(x, y2).stroke();
  doc.restore();
}

const META_INLINE_MIN_H = 11;
const META_INLINE_TOP_PAD = 3;
const META_INLINE_BOTTOM_PAD = 3;

/**
 * Paragraph-style meta cell: value starts on the same line as "Label:" then wraps below (full width).
 */
function measureMetaParagraphCellHeight(doc, w, label, value) {
  const cellPad = pad.cell;
  const innerW = w - cellPad * 2;
  const labelText = String(label || '').trim();
  const valueText = metaValueText(value);
  const line = valueText ? `${labelText}: ${valueText}` : `${labelText}:`;
  doc.fontSize(size.metaValue).font(FONT);
  let textH = doc.heightOfString(line, { width: innerW, lineGap: 0.25 });
  textH = Math.min(textH, META_CELL_MAX_BODY_H);
  return Math.max(
    META_INLINE_MIN_H,
    META_INLINE_TOP_PAD + textH + META_INLINE_BOTTOM_PAD
  );
}

function drawMetaParagraphCell(doc, x, y, w, h, label, value) {
  const cellPad = pad.cell;
  const innerW = w - cellPad * 2;
  const ty = y + META_INLINE_TOP_PAD;
  const maxTextH = Math.max(4, h - META_INLINE_TOP_PAD - META_INLINE_BOTTOM_PAD);
  const labelText = String(label || '').trim();
  const valueText = metaValueText(value);
  doc.fontSize(size.metaLabel).font(FONT_BOLD).fillColor('#1a1a1a');
  if (valueText) {
    doc.text(`${labelText}: `, x + cellPad, ty, { continued: true, width: innerW, lineGap: 0.25 });
    doc.fontSize(size.metaValue).font(FONT).fillColor('#000000');
    doc.text(valueText, {
      width: innerW,
      lineGap: 0.25,
      height: maxTextH,
      ellipsis: true,
    });
  } else {
    doc.text(`${labelText}:`, x + cellPad, ty, { width: innerW, lineGap: 0.25, height: maxTextH });
  }
}

/** @deprecated alias */
function measureMetaInlineCellHeight(doc, w, label, value) {
  return measureMetaParagraphCellHeight(doc, w, label, value);
}

function drawMetaInlineCell(doc, x, y, w, h, label, value) {
  drawMetaParagraphCell(doc, x, y, w, h, label, value);
}

/** True when this row should use single-line "Label: value" cells. */
function metaRowUsesInlineLayout(options, cellCount) {
  if (options.inline) return true;
  if (options.inlineSingleColumn) return cellCount === 1;
  return false;
}

function metaRowLayoutOptions(options, cellCount) {
  return { ...options, inline: metaRowUsesInlineLayout(options, cellCount) };
}

function measureMetaStackedCellHeight(doc, w, label, value) {
  return measureMetaParagraphCellHeight(doc, w, label, value);
}

function measureMetaRowHeight(doc, cells, colWidths, options = {}) {
  if (metaRowUsesInlineLayout(options, cells.length)) {
    let maxH = META_INLINE_MIN_H;
    cells.forEach((cell, i) => {
      const cw = colWidths[i] || colWidths[0];
      const h = measureMetaInlineCellHeight(doc, cw, cell.label, cell.value);
      if (h > maxH) maxH = h;
    });
    return maxH;
  }

  let maxH = row.metaMin;
  cells.forEach((cell, i) => {
    const cw = colWidths[i] || colWidths[0];
    const h = measureMetaStackedCellHeight(doc, cw, cell.label, cell.value);
    if (h > maxH) maxH = h;
  });
  return maxH;
}

function drawMetaLabeledCell(doc, x, y, w, h, label, value, options = {}) {
  drawMetaParagraphCell(doc, x, y, w, h, label, value);
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
  const termsDelivery = metaValueText(details.deliveryTerms);

  return [
    {
      cells: [
        { label: 'Invoice No.', value: details.invoiceNumber },
        { label: 'Dated', value: invDate },
      ],
    },
    {
      cells: [
        { label: 'e-Way Bill No.', value: details.ewayBill || '' },
        { label: 'e-Way Bill Date', value: formatTallyDate(details.ewayBillDate) },
      ],
    },
    { cells: [{ label: 'Delivery Note', value: details.deliveryNote || '' }] },
    { cells: [{ label: 'Mode/Terms of Payment', value: details.paymentTerms || '' }] },
    { cells: [{ label: 'PO & Date', value: refLine }] },
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
    { cells: [{ label: 'Vehicle No.', value: details.vehicleNumber || '' }] },
    {
      cells: [
        {
          label: 'Bill of Landing/LR-RR No.',
          value: details.billOfLadingLrRrNo || '',
        },
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

function formatPartyPanLine(party) {
  const pan = String(party?.taxInfo?.pan || '').trim().toUpperCase();
  return pan ? `PAN: ${pan}` : '';
}

/** Measure meta grid height (sets row._height on each row). */
function measureMetaGridHeight(doc, rows, totalWidth, options = {}) {
  const halfMeta = totalWidth / 2;
  const colWidthsTwo = [halfMeta, halfMeta];
  let h = 0;
  rows.forEach((rowDef) => {
    const cols = rowDef.cells.length === 1 ? [totalWidth] : colWidthsTwo;
    const rowOpts = metaRowLayoutOptions(options, rowDef.cells.length);
    rowDef._height = measureMetaRowHeight(doc, rowDef.cells, cols, rowOpts);
    h += rowDef._height;
  });
  return h;
}

function strokeHLine(doc, x1, x2, y) {
  doc.save();
  doc.lineWidth(LINE).strokeColor('#1a1a1a');
  doc.moveTo(x1, y).lineTo(x2, y).stroke();
  doc.restore();
}

function measureTallyPartyColumnHeight(doc, party, addressKey, gst, stateInfo, extraLines, panelW, minPanelH = 56) {
  const innerW = panelW - 12;
  let h = 16;
  if (party?.name) {
    doc.fontSize(size.partyName).font(FONT_BOLD);
    h += doc.heightOfString(party.name, { width: innerW, lineGap: 0.2 }) + 3;
  }
  const addr = addressKey === 'shipping' ? party?.shippingAddress : party?.billingAddress;
  doc.fontSize(size.partyBody).font(FONT);
  formatAddressLines(addr).forEach((line) => {
    h += doc.heightOfString(line, { width: innerW, lineGap: 0.25 }) + 2;
  });
  if (gst) h += 11;
  if (formatPartyPanLine(party)) h += 11;
  if (stateInfo?.name || stateInfo?.code) h += 11;
  h += extraLines.filter(Boolean).length * 11;
  return Math.max(h, minPanelH);
}

/**
 * Draw party content inside a column (title + name + address + GST).
 */
function drawTallyPartyColumn(
  doc,
  x,
  y,
  w,
  h,
  title,
  party,
  addressKey,
  gst,
  stateInfo,
  extraLines = []
) {
  const cellPad = pad.cell + 2;
  const innerW = w - cellPad * 2;
  const addr = addressKey === 'shipping' ? party.shippingAddress || {} : party.billingAddress || {};

  doc.fontSize(size.partyTitle).font(FONT_BOLD).fillColor('#1a1a1a');
  doc.text(title, x + cellPad, y + 5, { width: innerW, lineGap: 0.2 });

  let py = y + 16;
  const maxY = y + h - 5;

  if (party.name && py < maxY) {
    doc.fontSize(size.partyName).font(FONT_BOLD).fillColor('#000000');
    const nameH = doc.heightOfString(party.name, { width: innerW, lineGap: 0.2 });
    if (py + nameH <= maxY) {
      doc.text(party.name, x + cellPad, py, { width: innerW, lineGap: 0.2 });
      py += nameH + 3;
    }
  }

  doc.fontSize(size.partyBody).font(FONT).fillColor('#000000');
  formatAddressLines(addr).forEach((line) => {
    if (py >= maxY) return;
    const lh = doc.heightOfString(line, { width: innerW, lineGap: 0.25 });
    if (py + lh > maxY) return;
    doc.text(line, x + cellPad, py, { width: innerW, lineGap: 0.25 });
    py += lh + 2;
  });

  if (gst && py < maxY) {
    const line = `GSTIN/UIN: ${gst}`;
    const lh = doc.heightOfString(line, { width: innerW });
    if (py + lh <= maxY) {
      doc.text(line, x + cellPad, py, { width: innerW });
      py += lh + 2;
    }
  }

  const panLine = formatPartyPanLine(party);
  if (panLine && py < maxY) {
    const lh = doc.heightOfString(panLine, { width: innerW });
    if (py + lh <= maxY) {
      doc.text(panLine, x + cellPad, py, { width: innerW });
      py += lh + 2;
    }
  }

  if ((stateInfo?.name || stateInfo?.code) && py < maxY) {
    const line = `State Name: ${stateInfo.name || '—'}, Code: ${stateInfo.code || '—'}`;
    const lh = doc.heightOfString(line, { width: innerW });
    if (py + lh <= maxY) {
      doc.text(line, x + cellPad, py, { width: innerW });
      py += lh + 2;
    }
  }

  extraLines.filter(Boolean).forEach((line) => {
    if (py >= maxY) return;
    const lh = doc.heightOfString(line, { width: innerW });
    if (py + lh > maxY) return;
    doc.text(line, x + cellPad, py, { width: innerW });
    py += lh + 2;
  });

  doc.fillColor('#000000');
}

/**
 * One row: Consignee (Ship to) left | Buyer (Bill to) right — Tally style.
 * @returns {number} bottom Y
 */
function drawTallyShipBillPartyRow(doc, y, party, options = {}) {
  const left = options.left ?? T.LEFT;
  const width = options.width ?? T.WIDTH;
  const halfW = Math.floor(width / 2);
  const partyGst = options.partyGst || party?.taxInfo?.gstin || '';
  const shipState = options.shipStateInfo || {};
  const billState = options.billStateInfo || {};
  const billExtra = options.billExtraLines || [];

  const shipH = measureTallyPartyColumnHeight(
    doc,
    party,
    'shipping',
    partyGst,
    shipState,
    [],
    halfW
  );
  const billH = measureTallyPartyColumnHeight(doc, party, 'billing', partyGst, billState, billExtra, halfW);
  const blockH = Math.max(shipH, billH, 58);

  box(doc, left, y, width, blockH);
  strokeVLine(doc, left + halfW, y, y + blockH);

  drawTallyPartyColumn(
    doc,
    left,
    y,
    halfW,
    blockH,
    'Consignee (Ship to)',
    party,
    'shipping',
    partyGst,
    shipState,
    []
  );
  drawTallyPartyColumn(
    doc,
    left + halfW,
    y,
    halfW,
    blockH,
    'Buyer (Bill to)',
    party,
    'billing',
    partyGst,
    billState,
    billExtra
  );

  return y + blockH;
}

/**
 * Draw one Tally-style party panel (Ship to / Bill to / Supplier) inside a fixed box.
 */
function drawClassicPartyPanel(doc, x, y, w, h, title, party, addressKey, extraLines = []) {
  const cellPad = pad.cell + 2;
  const innerW = w - cellPad * 2;
  const addr = addressKey === 'shipping' ? party.shippingAddress || {} : party.billingAddress || {};
  const gst = party.taxInfo?.gstin || '';

  doc.fontSize(size.partyTitle).font(FONT_BOLD).fillColor('#1a1a1a');
  doc.text(title, x + cellPad, y + 4, { width: innerW, lineGap: 0.2 });

  let py = y + 14;
  const maxY = y + h - 5;

  if (party.name && py < maxY) {
    doc.fontSize(size.partyName).font(FONT_BOLD).fillColor('#000000');
    const nameH = doc.heightOfString(party.name, { width: innerW, lineGap: 0.2 });
    if (py + nameH <= maxY) {
      doc.text(party.name, x + cellPad, py, { width: innerW, lineGap: 0.2 });
      py += nameH + 3;
    }
  }

  doc.fontSize(size.partyBody).font(FONT).fillColor('#000000');
  formatAddressLines(addr).forEach((line) => {
    if (py >= maxY) return;
    const lh = doc.heightOfString(line, { width: innerW, lineGap: 0.25 });
    if (py + lh > maxY) return;
    doc.text(line, x + cellPad, py, { width: innerW, lineGap: 0.25 });
    py += lh + 2;
  });

  if (gst && py < maxY) {
    const line = `GSTIN/UIN: ${gst}`;
    const lh = doc.heightOfString(line, { width: innerW });
    if (py + lh <= maxY) {
      doc.text(line, x + cellPad, py, { width: innerW });
      py += lh + 2;
    }
  }

  const panLine = formatPartyPanLine(party);
  if (panLine && py < maxY) {
    const lh = doc.heightOfString(panLine, { width: innerW });
    if (py + lh <= maxY) {
      doc.text(panLine, x + cellPad, py, { width: innerW });
      py += lh + 2;
    }
  }

  extraLines.filter(Boolean).forEach((line) => {
    if (py >= maxY) return;
    const lh = doc.heightOfString(line, { width: innerW });
    if (py + lh > maxY) return;
    doc.text(line, x + cellPad, py, { width: innerW });
    py += lh + 2;
  });

  doc.fillColor('#000000');
}

function measureClassicPartyPanelMinHeight(doc, party, addressKey, extraLines = [], panelW) {
  const innerW = panelW - 12;
  let h = 18;
  if (party?.name) {
    doc.fontSize(size.partyName).font(FONT_BOLD);
    h += doc.heightOfString(party.name, { width: innerW, lineGap: 0.2 }) + 3;
  }
  const addr = addressKey === 'shipping' ? party?.shippingAddress : party?.billingAddress;
  doc.fontSize(size.partyBody).font(FONT);
  formatAddressLines(addr).forEach((line) => {
    h += doc.heightOfString(line, { width: innerW, lineGap: 0.25 }) + 2;
  });
  if (party?.taxInfo?.gstin) h += 11;
  if (formatPartyPanLine(party)) h += 11;
  h += extraLines.filter(Boolean).length * 11;
  return Math.min(Math.max(h, 56), 130);
}

/**
 * Classic template: Bill to / Ship to (left) + meta grid (right), Tally-style bordered band.
 * @returns {number} bottom Y
 */
function drawClassicPartyMetaBand(doc, y, standardInvoice, party = {}, options = {}) {
  const LEFT = options.leftX ?? T.LEFT;
  const WIDTH = options.totalWidth ?? T.WIDTH;
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

  const blockH = Math.max(metaH, partyMinH, 112);

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
function drawTallyMetaGrid(doc, x, y, totalWidth, rows, options = {}) {
  const halfMeta = totalWidth / 2;
  const colWidthsTwo = [halfMeta, halfMeta];

  rows.forEach((rowDef) => {
    if (!rowDef._height) {
      const cols = rowDef.cells.length === 1 ? [totalWidth] : colWidthsTwo;
      const rowOpts = metaRowLayoutOptions(options, rowDef.cells.length);
      rowDef._height = measureMetaRowHeight(doc, rowDef.cells, cols, rowOpts);
    }
  });

  let metaY = y;
  rows.forEach((rowDef) => {
    const rowH = rowDef._height;
    const spanFull = rowDef.cells.length === 1;
    const rowOpts = metaRowLayoutOptions(options, rowDef.cells.length);
    box(doc, x, metaY, totalWidth, rowH);

    if (spanFull) {
      drawMetaLabeledCell(
        doc,
        x,
        metaY,
        totalWidth,
        rowH,
        rowDef.cells[0].label,
        rowDef.cells[0].value,
        rowOpts
      );
    } else {
      let mx = x;
      rowDef.cells.forEach((cell, i) => {
        const cw = colWidthsTwo[i];
        if (i > 0) strokeVLine(doc, mx, metaY, metaY + rowH);
        drawMetaLabeledCell(doc, mx, metaY, cw, rowH, cell.label, cell.value, rowOpts);
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
  drawTallyShipBillPartyRow,
  drawTallyPartyColumn,
  drawClassicPartyMetaBand,
  measureMetaGridHeight,
  measureTallyPartyColumnHeight,
  drawMetaLabeledCell,
  measureMetaRowHeight,
  metaRowLayoutOptions,
  box,
  strokeVLine,
  strokeHLine,
};
