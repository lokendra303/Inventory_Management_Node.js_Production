/**
 * Typography & layout tokens for Tally-style GST invoice PDFs (readable, print-friendly).
 */

const PAGE_W = 595.28;
const MARGIN = 18;
const LEFT = MARGIN;
const RIGHT = PAGE_W - MARGIN;
const WIDTH = RIGHT - LEFT;

const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_OBLIQUE = 'Helvetica-Oblique';
const LINE = 0.55;

const size = {
  title: 15,
  titleSub: 7.5,
  companyName: 11,
  body: 8.5,
  bodySmall: 8,
  metaLabel: 7.5,
  metaValue: 8.5,
  partyTitle: 8,
  partyName: 9.5,
  partyBody: 8,
  tableHead: 7.5,
  tableBody: 8,
  tableAmount: 8,
  taxHead: 7.5,
  taxBody: 8,
  wordsLabel: 8,
  wordsBody: 8.5,
  footerTitle: 8,
  footerBody: 7.5,
  footerSmall: 7,
  disclaimer: 7,
};

const row = {
  metaMin: 20,
  itemDefault: 18,
  itemHeader: 28,
  taxData: 16,
  taxHead1: 16,
  taxHead2: 16,
  words: 22,
  taxWords: 20,
  footer: 96,
};

const pad = {
  cell: 4,
  metaLabelTop: 3,
  metaValueTop: 11,
  tableTop: 5,
};

module.exports = {
  PAGE_W,
  MARGIN,
  LEFT,
  RIGHT,
  WIDTH,
  FONT,
  FONT_BOLD,
  FONT_OBLIQUE,
  LINE,
  size,
  row,
  pad,
};
