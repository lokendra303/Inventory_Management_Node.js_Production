import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, Table, Button, Space, Modal, message, Form, Input, Select, InputNumber, Row, Col, Upload, Timeline, Tag, Spin, Empty, Tabs, Badge, Statistic, Divider, Tooltip, Popconfirm, Dropdown, Alert, Typography, Checkbox, Radio, DatePicker } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, UploadOutlined, HistoryOutlined, SearchOutlined, DollarOutlined, BarcodeOutlined, AppstoreOutlined, UnorderedListOutlined, InboxOutlined, ShopOutlined, TagsOutlined, WarningOutlined, CloseOutlined, DeleteOutlined, CopyOutlined, MoreOutlined, StopOutlined, CheckCircleOutlined, CheckOutlined, ThunderboltOutlined, SettingOutlined, ImportOutlined, DownloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { lookupProductByBarcode } from '../../utils/openFoodFacts';
import BarcodeScannerModal from '../../components/common/BarcodeScannerModal';
import apiService from '../../services/apiService';
import skuGeneratorService from '../../services/skuGeneratorService';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatPrice, convertPrice, getCurrencies } from '../../utils/currency';
import { isOpeningStockReceipt, getInventoryLogReferenceDisplay } from '../../utils/inventoryReceipt';
import CustomizableDropdown from '../../components/common/CustomizableDropdown';
import ViewModeToggle from '../../components/common/ViewModeToggle';
import ItemCatalogGrid from '../../components/inventory/ItemCatalogGrid';
import CompositeBomSection from '../../components/inventory/CompositeBomSection';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import { useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { filterSelectOption } from '../../utils/selectFilter';
import { ImportDefaultsPanel } from './ImportDefaultsPanel.jsx';
import { ImportUpdateFieldsPanel } from './ImportUpdateFieldsPanel.jsx';
import { ImportDuplicateGroupsPanel } from './ImportDuplicateGroupsPanel.jsx';
import { ImportSheetMatchGroupsPanel } from './ImportSheetMatchGroupsPanel.jsx';
import {
  assessImportRowIssues,
  buildExistingItemsMatchIndex,
  buildImportDuplicateGroups,
  buildImportBatchImportDescription,
  buildImportBatchLine,
  buildImportBatchLinesFromRowIndexes,
  analyzeImportDuplicateGroupBatches,
  validateImportBatchLines,
  createImportBatchesForItem,
  resolveImportBatchLinesForSave,
  buildConsolidatedImportBatchLinesFromRowIndexes,
  appendMergedImportWarehouseBatchNote,
  buildMergedImportDescription,
  buildMergedImportQuantities,
  checkSkuAvailableForImport,
  countImportDefaultsSet,
  CSV_IMPORT_SKU_AUTO_RULE,
  CSV_IMPORT_SKU_FROM_FILE,
  CSV_IMPORT_PURPOSE_CREATE,
  CSV_IMPORT_PURPOSE_UPDATE,
  CSV_IMPORT_MATCH_FIELDS,
  CSV_IMPORT_DEFAULT_MATCH_FIELD,
  ensureCategoryForImport,
  ensureImportDropdownOption,
  ensureItemGroupForImport,
  ensureUnitForImport,
  isImportRowInPendingDuplicateGroup,
  isImportRowReady,
  isImportUpdateRowReady,
  isSkuRequiredForImport,
  matchImportRowToCatalog,
  resolveCatalogMatchForRow,
  buildImportDuplicateGroupsForUpdate,
  buildImportSheetMatchGroupsForUpdate,
  isImportRowInPendingSheetMatchGroup,
  getSheetMatchGroupSelectedRowIndexes,
  getImportGroupSelectedRowIndexes,
  suggestUpdateImportMatchField,
  isImportRowFoundInCatalog,
  getImportRowSheetMatchLabel,
  hasImportMatchColumnMapped,
  IMPORT_PREVIEW_CELL_MISMATCH_STYLE,
  IMPORT_PREVIEW_ROW_STYLE,
  pickImportValue,
  prepareDirectImportUpdatePayload,
  createUpdateImportFieldAccessors,
  buildMergedImportQuantitiesForUpdate,
  countUpdateImportFieldSources,
  resolveImportCustomFields,
  resolveImportCustomFieldsForUpdate,
  hasMappedImportCellValue,
  willUpdateImportField,
  validateImportRowBeforeOpen,
  parseImportNumeric,
  parseImportDateValue,
} from './importItemHelpers';

const VARIANT_MATRIX_GRID_TEMPLATE = 'minmax(0, 2.2fr) minmax(0, 1.5fr) minmax(0, 1.35fr) minmax(0, 0.95fr) minmax(0, 0.95fr) minmax(0, 1.5fr) minmax(64px, 0.6fr)';
const VARIANT_MATRIX_MIN_WIDTH = '100%';
const VARIANT_MATRIX_LABEL_STYLE = {
  marginBottom: 6,
  fontSize: 11,
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: 0.4
};
const VARIANT_MATRIX_ACTION_STYLE = {
  padding: 0,
  height: 'auto',
  fontSize: 11,
  fontWeight: 600
};
const extractSkuTemplateTokens = (template = '') =>
  (String(template || '').match(/\{([^}]+)\}/g) || [])
    .map((wrap) => String(wrap).slice(1, -1).split('|')[0]?.trim()?.toUpperCase())
    .filter(Boolean);
const toSkuCode = (value, len = 3) => {
  const parts = String(value || '')
    .trim()
    .split(/[^A-Za-z0-9]+/g)
    .filter(Boolean);
  const compact = parts.length >= 2
    ? parts.map((part) => part[0].toUpperCase()).join('')
    : parts.join('').toUpperCase();
  return compact.replace(/[^A-Z0-9]+/g, '').slice(0, len);
};
const isBlankVariantMatrixValue = (value) => (
  value === undefined ||
  value === null ||
  (typeof value === 'string' && !value.trim())
);

const { Text: AntText } = Typography;

/** CSV → { headers, rows }. `headerLineNumber` is 1-based line in the file (per Excel). */
function parseCsvToRows(text, options = {}) {
  const headerLineNumber = Math.max(1, Math.floor(Number(options.headerLineNumber) || 1));
  const rows = [];
  let lines = String(text || '').replace(/\r/g, '').split('\n');
  while (lines.length && lines[lines.length - 1] === '') {
    lines.pop();
  }
  if (lines.length === 0) return { headers: [], rows: [] };

  const splitLine = (line) => {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };

  const headerIndex = headerLineNumber - 1;
  if (headerIndex >= lines.length) {
    return { headers: [], rows: [] };
  }

  const headers = splitLine(lines[headerIndex]).map((h) => h.replace(/^\uFEFF/, ''));
  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const rawLine = lines[i];
    if (!String(rawLine).trim()) continue;
    const cols = splitLine(rawLine);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? '';
    });
    obj.__sourceLine = i + 1;
    rows.push(obj);
  }
  return { headers, rows };
}

function countCsvTextLines(text) {
  let lines = String(text || '').replace(/\r/g, '').split('\n');
  while (lines.length && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.length;
}

function isExcelImportFileName(name = '') {
  const lower = String(name).toLowerCase();
  return lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.xlsm');
}

/** First worksheet only. `headerLineNumber` is 1-based sheet row. */
function parseExcelBufferToRows(buffer, options = {}) {
  const headerLineNumber = Math.max(1, Math.floor(Number(options.headerLineNumber) || 1));
  if (!buffer || !(buffer instanceof ArrayBuffer)) {
    return { headers: [], rows: [], sheetRowCount: 0 };
  }
  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  } catch {
    return { headers: [], rows: [], sheetRowCount: 0 };
  }
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) return { headers: [], rows: [], sheetRowCount: 0 };
  const ws = workbook.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
  if (!aoa.length) return { headers: [], rows: [], sheetRowCount: 0 };

  const rowIsBlank = (row) => {
    if (!row || !row.length) return true;
    return !row.some((c) => String(c ?? '').trim() !== '');
  };
  while (aoa.length > 0 && rowIsBlank(aoa[aoa.length - 1])) {
    aoa.pop();
  }
  const sheetRowCount = aoa.length;
  const headerIdx = headerLineNumber - 1;
  if (headerIdx >= aoa.length) {
    return { headers: [], rows: [], sheetRowCount };
  }

  const headerRow = aoa[headerIdx] || [];
  let colCount = headerRow.length;
  for (let r = headerIdx + 1; r < aoa.length; r += 1) {
    colCount = Math.max(colCount, (aoa[r] || []).length);
  }

  const headerCells = [];
  for (let c = 0; c < colCount; c += 1) {
    const v = headerRow[c];
    const s = v != null && String(v).trim() !== '' ? String(v).trim().replace(/^\uFEFF/, '') : '';
    headerCells.push(s);
  }
  const baseHeaders = headerCells.map((h, i) => h || `Column_${i + 1}`);
  const usedNames = new Set();
  const headers = baseHeaders.map((h) => {
    let name = h;
    if (usedNames.has(name)) {
      let n = 2;
      while (usedNames.has(`${h} (${n})`)) n += 1;
      name = `${h} (${n})`;
    }
    usedNames.add(name);
    return name;
  });

  const rows = [];
  for (let r = headerIdx + 1; r < aoa.length; r += 1) {
    const cells = aoa[r] || [];
    if (rowIsBlank(cells)) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      const cell = cells[idx];
      if (cell instanceof Date) {
        obj[h] = Number.isNaN(cell.getTime()) ? '' : cell.toISOString().slice(0, 10);
      } else if (cell != null && cell !== '') {
        obj[h] = String(cell).trim();
      } else {
        obj[h] = '';
      }
    });
    obj.__sourceLine = r + 1;
    rows.push(obj);
  }
  return { headers, rows, sheetRowCount };
}

const CSV_IMPORT_CORE_TARGETS = [
  { id: 'sku', label: 'SKU', group: 'Core', required: false },
  { id: 'name', label: 'Name', group: 'Core', required: true },
  { id: 'description', label: 'Description', group: 'Core' },
  { id: 'barcode', label: 'Barcode', group: 'Core' },
  { id: 'category', label: 'Category', group: 'Core' },
  { id: 'unit', label: 'Unit', group: 'Core' },
  { id: 'itemGroupName', label: 'Item group (name)', group: 'Core' },
  { id: 'brand', label: 'Brand', group: 'Attributes' },
  { id: 'manufacturer', label: 'Manufacturer', group: 'Attributes' },
  { id: 'supplierCode', label: 'Supplier code', group: 'Attributes' },
  { id: 'costPrice', label: 'Cost price', group: 'Pricing' },
  { id: 'sellingPrice', label: 'Selling price', group: 'Pricing' },
  { id: 'mrp', label: 'MRP', group: 'Pricing' },
  { id: 'taxRate', label: 'Tax rate (%)', group: 'Pricing' },
  { id: 'weight', label: 'Weight', group: 'Physical' },
  { id: 'hsnCode', label: 'HSN code', group: 'Physical' },
  { id: 'batchNumber', label: 'Batch number', group: 'Batch tracking' },
  { id: 'batchExpiryDate', label: 'Batch expiry date', group: 'Batch tracking' },
  { id: 'batchManufactureDate', label: 'Batch manufacture date', group: 'Batch tracking' },
  { id: 'minStockLevel', label: 'Min stock level', group: 'Stock' },
  { id: 'maxStockLevel', label: 'Max stock level', group: 'Stock' },
  { id: 'openingStock', label: 'Opening stock', group: 'Stock' },
  { id: 'openingValue', label: 'Opening value', group: 'Stock' },
  { id: 'dimLength', label: 'Length', group: 'Dimensions' },
  { id: 'dimWidth', label: 'Width', group: 'Dimensions' },
  { id: 'dimHeight', label: 'Height', group: 'Dimensions' },
  { id: 'upc', label: 'UPC', group: 'Identifiers' },
  { id: 'ean', label: 'EAN', group: 'Identifiers' },
  { id: 'isbn', label: 'ISBN', group: 'Identifiers' },
  { id: 'mpn', label: 'MPN', group: 'Identifiers' },
];

/** CSV import creates plain items (no BOM / variant matrix). */
const CSV_IMPORT_SUPPORTED_ITEM_TYPES = ['simple', 'service'];

/** Built-in types — must match backend itemType.service PROTECTED_ITEM_TYPES */
const PROTECTED_ITEM_TYPES = new Set(['simple', 'variant', 'composite']);
const CSV_IMPORT_MODAL_Z_INDEX = 1000;
/** Above import modal and app header (see Warehouses.jsx). */
const ITEM_FORM_MODAL_OVER_IMPORT_Z_INDEX = 10050;

const CSV_IMPORT_HEADER_ALIASES = {
  sku: ['sku', 'item sku', 'item code', 'product code', 'code', 'article', 'serial number', 'serial no', 'serial', 'serial #'],
  name: ['name', 'title', 'product name', 'item name', 'description name'],
  description: ['description', 'desc', 'details', 'remarks'],
  barcode: ['barcode', 'bar code'],
  category: ['category', 'class', 'type name'],
  unit: ['unit', 'uom', 'measure'],
  itemGroupName: ['item group', 'group', 'product group'],
  brand: ['brand'],
  manufacturer: ['manufacturer', 'mfg', 'maker'],
  supplierCode: ['supplier code', 'supplier sku', 'vendor code'],
  costPrice: ['cost', 'cost price', 'unit cost', 'purchase price', 'buy price'],
  sellingPrice: ['selling price', 'sale price', 'price', 'sell'],
  mrp: ['mrp', 'list price', 'rrp'],
  taxRate: ['tax', 'tax rate', 'gst', 'vat'],
  weight: ['weight', 'wt', 'mass'],
  hsnCode: ['hsn', 'hsn code', 'tariff'],
  batchNumber: ['batch', 'batch number', 'lot'],
  batchExpiryDate: ['expiry', 'expiry date', 'exp date', 'best before', 'use by'],
  batchManufactureDate: ['manufacture date', 'mfg date', 'production date', 'made on'],
  minStockLevel: ['min stock', 'minimum stock', 'reorder'],
  maxStockLevel: ['max stock', 'maximum stock'],
  openingStock: ['opening stock', 'qty', 'quantity', 'order qty', 'order quantity', 'stock', 'on hand'],
  openingValue: ['opening value', 'stock value'],
  dimLength: ['length', 'l mm', 'l cm'],
  dimWidth: ['width', 'w mm', 'w cm'],
  dimHeight: ['height', 'h mm', 'h cm'],
  upc: ['upc'],
  ean: ['ean'],
  isbn: ['isbn'],
  mpn: ['mpn', 'part number'],
};

function slugifyCsvHeader(h) {
  return String(h || '')
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function guessCsvColumnForTarget(targetId, headers) {
  const aliases = CSV_IMPORT_HEADER_ALIASES[targetId] || [targetId.replace(/([A-Z])/g, ' $1').trim().toLowerCase()];
  const normAliases = aliases.map((a) => slugifyCsvHeader(a)).filter(Boolean);
  let best = '';
  let bestScore = 0;
  for (const header of headers) {
    const sh = slugifyCsvHeader(header);
    if (!sh) continue;
    for (const a of normAliases) {
      let score = 0;
      if (sh === a) score = 100;
      else if (sh.includes(a) || a.includes(sh)) score = 70;
      else {
        const tokens = a.split(/\s+/).filter((t) => t.length > 1);
        if (tokens.length && tokens.every((t) => sh.includes(t))) score = 50;
      }
      if (score > bestScore) {
        bestScore = score;
        best = header;
      }
    }
  }
  return bestScore >= 50 ? best : '';
}

function dedupeItemFieldConfigs(configs) {
  const list = Array.isArray(configs) ? configs : [];
  const sorted = [...list].sort((a, b) => {
    const ai = a.institution_id || a.institutionId || '';
    const bi = b.institution_id || b.institutionId || '';
    const aCustom = ai && ai !== 'default';
    const bCustom = bi && bi !== 'default';
    if (aCustom && !bCustom) return -1;
    if (!aCustom && bCustom) return 1;
    return 0;
  });
  const seen = new Set();
  const out = [];
  for (const c of sorted) {
    const fn = c.field_name || c.fieldName;
    if (!fn || seen.has(fn)) continue;
    seen.add(fn);
    out.push(c);
  }
  return out;
}

function guessMatchFileColumn(headers, matchField = CSV_IMPORT_DEFAULT_MATCH_FIELD) {
  const cfg = CSV_IMPORT_MATCH_FIELDS.find((f) => f.id === matchField) || CSV_IMPORT_MATCH_FIELDS[0];
  let col = guessCsvColumnForTarget(cfg.mappingKey, headers);
  if (!col && matchField === 'name') {
    col = guessCsvColumnForTarget('description', headers);
  }
  return col || '';
}

function buildInitialCsvMapping(headers, fieldConfigs, options = {}) {
  const { importPurpose = CSV_IMPORT_PURPOSE_CREATE, matchField = CSV_IMPORT_DEFAULT_MATCH_FIELD } = options;
  if (importPurpose === CSV_IMPORT_PURPOSE_UPDATE) {
    return {};
  }
  const mapping = {};
  for (const t of CSV_IMPORT_CORE_TARGETS) {
    mapping[t.id] = guessCsvColumnForTarget(t.id, headers);
  }
  for (const c of fieldConfigs) {
    const fn = c.field_name || c.fieldName;
    if (!fn) continue;
    const label = c.field_label || c.fieldLabel || fn;
    const guessed =
      headers.find((h) => slugifyCsvHeader(h) === slugifyCsvHeader(fn)) ||
      headers.find((h) => slugifyCsvHeader(h) === slugifyCsvHeader(label)) ||
      guessCsvColumnForTarget(fn, headers) ||
      '';
    mapping[`cf:${fn}`] = guessed;
  }
  if (importPurpose === CSV_IMPORT_PURPOSE_UPDATE && matchField === 'name' && !mapping.name && mapping.description) {
    mapping.name = mapping.description;
  }
  return mapping;
}

function parseNumericImport(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

/** Row has a non-empty value in the mapped file column for this core field key (e.g. sku, name). */
function csvImportRowHasMappedValue(row, mapping, fieldKey) {
  const col = mapping[fieldKey];
  if (!col) return false;
  const v = row[col];
  return v !== undefined && v !== null && String(v).trim() !== '';
}

function buildItemsCsvTemplate() {
  const cols = ['sku', 'name', 'description', 'unit', 'costPrice', 'sellingPrice', 'weight', 'barcode', 'category'];
  return `${cols.join(',')}\nDEMO-001,Sample item,Notes here,pcs,10,12,0.5,1234567890,General\n`;
}

const Items = () => {
  const location = useLocation();
  const { user, sessionSecondsLeft } = useAuth();
  const { currency } = useCurrency();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [itemTypes, setItemTypes] = useState([]);
  const [itemGroups, setItemGroups] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [priceCurrency, setPriceCurrency] = useState('USD');
  const [currencies] = useState(getCurrencies());
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [itemFormOpenedFromImport, setItemFormOpenedFromImport] = useState(false);
  const [importCustomFieldsPreview, setImportCustomFieldsPreview] = useState([]);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [form] = Form.useForm();
  const [categoryForm] = Form.useForm();
  const [unitOptions, setUnitOptions] = useState([]);
  const [manufacturerOptions, setManufacturerOptions] = useState([]);
  const [brandOptions, setBrandOptions] = useState([]);
  const [vendorOptions, setVendorOptions] = useState([]);
  const [taxRateOptions, setTaxRateOptions] = useState([]);
  const [itemHistory, setItemHistory] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [viewingItemBatches, setViewingItemBatches] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [itemGroupFilter, setItemGroupFilter] = useState('all');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [warehouseModalVisible, setWarehouseModalVisible] = useState(false);
  const [warehouseForm] = Form.useForm();
  const [warehouseTypes, setWarehouseTypes] = useState([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [editingTypeId, setEditingTypeId] = useState(null);
  const [editingTypeName, setEditingTypeName] = useState('');
  const [draftBanner, setDraftBanner] = useState(null);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [duplicateBanner, setDuplicateBanner] = useState(null); // { sourceName }
  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [editingWarehouseId, setEditingWarehouseId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name_asc');
  const [itemsViewMode, setItemsViewMode] = usePersistedViewMode('ims-items-view-mode', 'list');
  const [catalogGridPage, setCatalogGridPage] = useState(1);
  const [catalogGridPageSize, setCatalogGridPageSize] = useState(12);
  const [binsForWarehouse, setBinsForWarehouse] = useState([]);
  const [binsLoading, setBinsLoading] = useState(false);
  const [editingWarehouseSummaries, setEditingWarehouseSummaries] = useState([]);
  const [duplicateSourcePayload, setDuplicateSourcePayload] = useState(null);
  const [variantLibrary, setVariantLibrary] = useState([]);
  const [existingCustomFields, setExistingCustomFields] = useState({});
  const [variantMatrixEdits, setVariantMatrixEdits] = useState([]);
  const [compositeComponents, setCompositeComponents] = useState([]);
  const [kitFulfillmentMode, setKitFulfillmentMode] = useState('prebuilt');
  const autoDraftSavingRef = useRef(false);
  const autoDraftSavedRef = useRef(false);
  const variantBuilderSeededRef = useRef(false);
  const fetchItemsRef = useRef(async () => {});
  const csvImportExcelBufferRef = useRef(null);
  const activeImportRowIndexRef = useRef(null);
  const activeImportGroupRef = useRef(null);

  // ---- SKU auto-generator (Zoho-style rules) ------------------------------
  const [skuRulesOpen, setSkuRulesOpen] = useState(false);
  const [skuRules, setSkuRules] = useState([]);
  const [skuRulesLoading, setSkuRulesLoading] = useState(false);
  const [skuRuleForm] = Form.useForm();
  const [editingSkuRule, setEditingSkuRule] = useState(null);
  const [skuGenerating, setSkuGenerating] = useState(false);
  const [selectedSkuRuleId, setSelectedSkuRuleId] = useState(null);
  const [lastAppliedSkuRule, setLastAppliedSkuRule] = useState(null);

  const [csvImportModal, setCsvImportModal] = useState({
    open: false,
    busy: false,
    csvImportSourceFormat: 'csv',
    csvImportRawText: '',
    csvImportFileLineCount: 0,
    headerLineNumber: 1,
    headers: [],
    rows: [],
    csvImportPreviewFilters: {
      hideMissingSku: false,
      hideMissingName: false,
      onlyReady: false,
      onlyIssues: false,
      onlyMatched: false,
    },
    importPurpose: CSV_IMPORT_PURPOSE_CREATE,
    matchField: CSV_IMPORT_DEFAULT_MATCH_FIELD,
    itemType: 'simple',
    fieldConfigs: [],
    mapping: {},
    defaultWarehouseId: undefined,
    result: null,
    addedRowIndexes: {},
    supersededRowIndexes: {},
    duplicateGroupPlans: {},
    skuSource: CSV_IMPORT_SKU_FROM_FILE,
    importSkuRuleId: undefined,
    importDefaults: {},
    catalogItemPicks: {},
    matchFileColumn: '',
  });

  const normalizeOptionalText = (value) => {
    if (value == null) return undefined;
    const text = String(value).trim();
    if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') return undefined;
    return text;
  };
  const normalizeDuplicateLookup = (value) => (
    String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase()
  );
  const normalizeOptionalTextArray = (value) => {
    if (Array.isArray(value)) {
      return Array.from(new Set(value.map((v) => normalizeOptionalText(v)).filter(Boolean)));
    }
    const one = normalizeOptionalText(value);
    return one ? [one] : [];
  };
  const formScalarMeta = (value) => normalizeOptionalTextArray(value)[0];
  const formatStockQty = (value) => {
    const numeric = Number(value) || 0;
    return Number.isInteger(numeric)
      ? numeric.toLocaleString()
      : numeric.toLocaleString(undefined, { maximumFractionDigits: 3 });
  };
  const deriveTrackInventoryValue = (item = {}, warehouseId = null) => (
    Boolean(
      warehouseId ||
      item?.default_bin_id ||
      Number(item?.opening_stock) > 0 ||
      Number(item?.opening_value) > 0 ||
      Number(item?.min_stock_level) > 0 ||
      Number(item?.max_stock_level) > 0
    )
  );
  const buildVariantAttributeSeedRows = ({
    variant,
    colorCode,
    sizeCode,
    packType
  } = {}) => (
    [
      { name: 'Variant', values: normalizeOptionalTextArray(variant) },
      { name: 'Colour', values: normalizeOptionalTextArray(colorCode) },
      { name: 'Size', values: normalizeOptionalTextArray(sizeCode) },
      { name: 'Pack Type', values: normalizeOptionalTextArray(packType) }
    ].filter((row) => row.values.length > 0)
  );
  const normalizeComparableValue = (value) => {
    if (value === undefined || value === null || value === '') return null;
    if (Array.isArray(value)) {
      return value.map((entry) => normalizeComparableValue(entry));
    }
    if (typeof value === 'object') {
      return Object.keys(value).sort().reduce((acc, key) => {
        acc[key] = normalizeComparableValue(value[key]);
        return acc;
      }, {});
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed || null;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? Number(value) : null;
    }
    return value;
  };
  const buildComparableItemPayload = (payload = {}) => normalizeComparableValue({
    sku: payload.sku,
    name: payload.name,
    description: payload.description,
    image: payload.image,
    type: payload.type,
    category: payload.category,
    customFields: payload.customFields || {},
    unit: payload.unit,
    warehouseId: payload.warehouseId,
    costPrice: payload.costPrice,
    sellingPrice: payload.sellingPrice,
    mrp: payload.mrp,
    taxRate: payload.taxRate,
    brand: payload.brand,
    manufacturer: payload.manufacturer,
    itemGroup: payload.itemGroup,
    itemGroupId: payload.itemGroupId,
    minStockLevel: payload.minStockLevel,
    maxStockLevel: payload.maxStockLevel,
    barcode: payload.barcode,
    batchNumber: payload.batchNumber,
    openingStock: payload.openingStock,
    openingValue: payload.openingValue,
    defaultBinId: payload.defaultBinId,
    valuationMethod: payload.valuationMethod,
    weight: payload.weight,
    dimensions: payload.dimensions,
    hsnCode: payload.hsnCode,
    upc: payload.upc,
    ean: payload.ean,
    isbn: payload.isbn,
    mpn: payload.mpn,
    components: payload.components || []
  });

  const loadSkuRules = async () => {
    setSkuRulesLoading(true);
    try {
      const rules = await skuGeneratorService.listRules();
      const list = Array.isArray(rules) ? rules : [];
      setSkuRules(list);
      if (!selectedSkuRuleId) {
        const defaultRule = list.find((r) => !!r.is_default);
        if (defaultRule?.id) setSelectedSkuRuleId(defaultRule.id);
      }
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to load SKU rules');
    } finally {
      setSkuRulesLoading(false);
    }
  };

  const showSkuGenerationError = (error) => {
    const err = error?.response?.data?.error || error?.message || 'Failed to generate SKU';
    const normalizedErr = String(err || '').toLowerCase();
    if (normalizedErr.includes('failed to allocate unique sku after multiple attempts')) {
      Modal.warning({
        title: 'SKU generation needs attention',
        width: 560,
        content: (
          <div style={{ marginTop: 8 }}>
            <p style={{ marginBottom: 8 }}>
              Could not generate a unique SKU with the current rule after several retries.
            </p>
            <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
              <li>Try selecting another SKU rule from the dropdown.</li>
              <li>Increase counter padding or change prefix tokens in Manage SKU Rules.</li>
              <li>If urgent, enter SKU manually and save.</li>
            </ul>
          </div>
        ),
        okText: 'Got it'
      });
      return;
    }

    Modal.error({
      title: 'SKU generation failed',
      content: err,
      okText: 'Close'
    });
  };

  const getVariantRowAttributeValue = (row = {}, aliases = []) => {
    const aliasSet = new Set((aliases || []).map((alias) => String(alias || '').trim().toLowerCase()).filter(Boolean));
    const attrs = row?.attributes && typeof row.attributes === 'object' ? row.attributes : {};
    const match = Object.entries(attrs).find(([key, value]) => (
      aliasSet.has(String(key || '').trim().toLowerCase()) &&
      String(value || '').trim()
    ));
    return match ? String(match[1]).trim() : '';
  };

  const buildSkuGenerationContext = (variantRow = null) => {
    const brandValue = form.getFieldValue('brand');
    const brandRow = brandOptions.find((b) => b.id === brandValue || b.name === brandValue);
    const brandName = brandRow?.name || brandValue || '';
    const itemName = form.getFieldValue('name') || '';
    const categoryName = form.getFieldValue('category') || '';
    const variantValue = getVariantRowAttributeValue(variantRow, ['variant', 'variant / packing', 'packing'])
      || formScalarMeta(form.getFieldValue('variant'))
      || '';
    const colorValue = getVariantRowAttributeValue(variantRow, ['colour', 'color', 'color code'])
      || formScalarMeta(form.getFieldValue('colorCode'))
      || '';
    const typeName = form.getFieldValue('type') || '';
    const sizeValue = getVariantRowAttributeValue(variantRow, ['size'])
      || formScalarMeta(form.getFieldValue('sizeCode'))
      || '';
    const packTypeValue = getVariantRowAttributeValue(variantRow, ['pack type', 'type'])
      || formScalarMeta(form.getFieldValue('packType'))
      || '';
    const manufacturerValue = form.getFieldValue('manufacturer');
    const manufacturerRow = manufacturerOptions.find((m) => m.id === manufacturerValue || m.name === manufacturerValue);
    const manufacturerName = manufacturerRow?.name || manufacturerValue || '';
    const unitValue = form.getFieldValue('unit');
    const unitRow = unitOptions.find((u) => u.id === unitValue || u.name === unitValue || u.symbol === unitValue);
    const unitLabel = unitRow?.symbol || unitRow?.name || unitValue || '';
    const warehouseId = variantRow?.warehouseId ?? form.getFieldValue('warehouseId');
    const warehouseRow = warehouses.find((w) => String(w.id) === String(warehouseId));
    const warehouseLabel = warehouseRow?.code || warehouseRow?.name || warehouseId || '';
    const hsnCode = form.getFieldValue('hsnCode') || '';
    const mpn = form.getFieldValue('mpn') || '';
    const barcode = variantRow?.barcode || form.getFieldValue('barcode') || form.getFieldValue('ean') || '';

    return {
      ruleId: selectedSkuRuleId || undefined,
      category: categoryName,
      brand: brandName,
      manufacturer: manufacturerName,
      name: itemName,
      item: itemName,
      variant: variantValue,
      color: colorValue,
      type: packTypeValue || typeName,
      unit: unitLabel,
      warehouse: warehouseLabel,
      hsnCode,
      mpn,
      barcode,
      brandCode: toSkuCode(brandName, 3),
      itemCode: toSkuCode(itemName, 4),
      variantCode: toSkuCode(variantValue, 4),
      colorCode: toSkuCode(colorValue, 4),
      categoryCode: toSkuCode(categoryName, 3),
      manufacturerCode: toSkuCode(manufacturerName, 3),
      typeCode: toSkuCode(packTypeValue || typeName, 3),
      unitCode: toSkuCode(unitLabel, 4),
      warehouseCode: toSkuCode(warehouseLabel, 4),
      size: toSkuCode(sizeValue || unitLabel, 8),
      typeValue: packTypeValue || typeName
    };
  };

  const ensureSkuRuleRequirements = (selectedRule, ctx, actionLabel = 'Generate SKU') => {
    if (!(selectedRule?.prefix_mode === 'static' && String(selectedRule?.prefix_static || '').includes('{'))) {
      return true;
    }

    const tokenRequirements = {
      BRAND: { label: 'Brand', value: ctx.brand },
      ITEM: { label: 'Item Name', value: ctx.name || ctx.item },
      NAME: { label: 'Item Name', value: ctx.name || ctx.item },
      VARIANT: { label: 'Variant / Packing', value: ctx.variant },
      COLOR: { label: 'Colour', value: ctx.color },
      SIZE: { label: 'Size (or Unit)', value: ctx.size || ctx.unit },
      TYPE: { label: 'Pack Type', value: ctx.typeValue || ctx.type },
      CATEGORY: { label: 'Category', value: ctx.category },
      MANUFACTURER: { label: 'Manufacturer', value: ctx.manufacturer },
      UNIT: { label: 'Unit', value: ctx.unit },
      WAREHOUSE: { label: 'Warehouse', value: ctx.warehouse },
      HSN: { label: 'HSN Code', value: ctx.hsnCode },
      MPN: { label: 'MPN', value: ctx.mpn },
      BARCODE: { label: 'Barcode / EAN', value: ctx.barcode }
    };

    const missingFields = extractSkuTemplateTokens(selectedRule.prefix_static)
      .map((token) => tokenRequirements[token])
      .filter((requirement) => requirement && !String(requirement.value || '').trim())
      .map((requirement) => requirement.label);

    const uniqueMissing = Array.from(new Set(missingFields));
    if (uniqueMissing.length === 0) return true;

    Modal.warning({
      title: 'Required fields missing for selected SKU rule',
      content: (
        <div style={{ marginTop: 8 }}>
          <p style={{ marginBottom: 8 }}>
            Fill these fields first, then click {actionLabel}:
          </p>
          <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
            {uniqueMissing.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </div>
      ),
      okText: 'Understood'
    });
    return false;
  };

  // Handler for the "Generate" button next to the SKU field. Pulls the
  // current category/brand/name off the form so the resolver can pick the
  // correct category-scoped rule if one exists.
  const handleGenerateSku = async () => {
    setSkuGenerating(true);
    try {
      const selectedRule = selectedSkuRuleId
        ? skuRules.find((r) => r.id === selectedSkuRuleId) || null
        : null;
      const ctx = buildSkuGenerationContext();

      if (!ensureSkuRuleRequirements(selectedRule, ctx, 'Generate SKU')) return;

      const generated = await skuGeneratorService.generateSku(ctx);
      const sku = generated?.sku || '';
      if (sku) {
        form.setFieldsValue({ sku });
        form.validateFields(['sku']).catch(() => {});
        const appliedRule = generated?.ruleId
          ? skuRules.find((r) => r.id === generated.ruleId)
          : null;
        setLastAppliedSkuRule(
          appliedRule
            ? { id: appliedRule.id, name: appliedRule.name, scope: appliedRule.scope, scopeValue: appliedRule.scope_value }
            : null
        );
        message.success(`Generated SKU: ${sku}${generated?.ruleName ? ` (Rule: ${generated.ruleName})` : ''}`);
      }
    } catch (e) {
      showSkuGenerationError(e);
    } finally {
      setSkuGenerating(false);
    }
  };

  const autoGenerateSkuForImport = async (ruleIdOverride) => {
    const ruleId = ruleIdOverride || selectedSkuRuleId;
    const selectedRule = (ruleId ? skuRules.find((r) => r.id === ruleId) : null)
      || skuRules.find((r) => !!r.is_default)
      || skuRules[0]
      || null;
    if (!selectedRule) {
      message.warning('No SKU rule available. Map SKU from file or create a rule under SKU settings.');
      return false;
    }
    setSelectedSkuRuleId(selectedRule.id);
    const ctx = { ...buildSkuGenerationContext(), ruleId: selectedRule.id };
    if (!ensureSkuRuleRequirements(selectedRule, ctx, 'Auto-generate SKU')) return false;
    setSkuGenerating(true);
    try {
      const generated = await skuGeneratorService.generateSku(ctx);
      const sku = generated?.sku || '';
      if (!sku) {
        message.warning('SKU rule did not return a SKU. Generate manually or check the rule.');
        return false;
      }
      form.setFieldsValue({ sku });
      form.validateFields(['sku']).catch(() => {});
      setLastAppliedSkuRule({
        id: selectedRule.id,
        name: selectedRule.name,
        scope: selectedRule.scope,
        scopeValue: selectedRule.scope_value,
      });
      message.success(`Auto-generated SKU: ${sku} (Rule: ${selectedRule.name})`);
      return true;
    } catch (e) {
      showSkuGenerationError(e);
      return false;
    } finally {
      setSkuGenerating(false);
    }
  };

  const validateSkuAvailability = async (_, value) => {
    const sku = String(value || '').trim();
    if (!sku) return Promise.reject(new Error('Please input SKU!'));
    try {
      const res = await apiService.get('/items/check-sku', {
        params: {
          sku,
          excludeItemId: editingItem?.id || undefined
        }
      });
      const available = !!res?.data?.available;
      if (!available) {
        return Promise.reject(new Error('SKU already exists. Please use a unique SKU.'));
      }
      return Promise.resolve();
    } catch (e) {
      const msg = e?.response?.data?.error || 'Failed to validate SKU';
      return Promise.reject(new Error(msg));
    }
  };

  const insertSkuToken = (token) => {
    const current = skuRuleForm.getFieldValue('prefixStatic') || '';
    const next = current ? `${current}-${token}` : token;
    skuRuleForm.setFieldsValue({ prefixStatic: next });
  };

  const openSkuRulesModal = async () => {
    setEditingSkuRule(null);
    skuRuleForm.resetFields();
    setSkuRulesOpen(true);
    await loadSkuRules();
  };

  const DERIVED_TOKEN_BY_SOURCE = {
    category: 'CATEGORY',
    brand: 'BRAND',
    name: 'ITEM',
    variant: 'VARIANT',
    color: 'COLOR',
    size: 'SIZE',
    type: 'TYPE',
    manufacturer: 'MANUFACTURER',
    unit: 'UNIT',
    warehouse: 'WAREHOUSE',
    hsn: 'HSN',
    mpn: 'MPN',
    barcode: 'BARCODE'
  };
  const SOURCE_BY_DERIVED_TOKEN = Object.fromEntries(
    Object.entries(DERIVED_TOKEN_BY_SOURCE).map(([source, token]) => [token, source])
  );
  const DERIVED_SOURCE_LABELS = {
    category: 'Category',
    brand: 'Brand',
    name: 'Item name',
    variant: 'Variant',
    color: 'Colour',
    size: 'Size',
    type: 'Pack Type',
    manufacturer: 'Manufacturer',
    unit: 'Unit',
    warehouse: 'Warehouse',
    hsn: 'HSN',
    mpn: 'MPN',
    barcode: 'Barcode'
  };
  const DERIVED_SOURCE_OPTIONS = Object.keys(DERIVED_TOKEN_BY_SOURCE).map((key) => ({
    value: key,
    label: DERIVED_SOURCE_LABELS[key] || key
  }));
  const DEFAULT_DERIVED_CFG = { len: 3, mode: 'abbr' };
  const buildDefaultDerivedConfig = () => Object.fromEntries(
    Object.keys(DERIVED_TOKEN_BY_SOURCE).map((src) => [src, { ...DEFAULT_DERIVED_CFG }])
  );
  const preserveSelectionOrder = (previous = [], current = []) => {
    const prev = Array.isArray(previous) ? previous : [];
    const cur = Array.isArray(current) ? current : [];
    const inBoth = prev.filter((x) => cur.includes(x));
    const appended = cur.filter((x) => !inBoth.includes(x));
    return [...inBoth, ...appended];
  };

  const parseDerivedTemplateConfig = (prefixStatic = '') => {
    const matches = String(prefixStatic || '').match(/\{[^}]+\}/g) || [];
    if (!matches.length) return null;
    const sources = [];
    const config = {};
    for (const tokenWrap of matches) {
      const inside = tokenWrap.slice(1, -1);
      const [tokenRaw, lenRaw, modeRaw] = inside.split('|').map((p) => String(p || '').trim());
      const token = String(tokenRaw || '').toUpperCase();
      const src = SOURCE_BY_DERIVED_TOKEN[token];
      if (!src) return null;
      sources.push(src);
      config[src] = {
        len: Math.max(1, Number(lenRaw) || 3),
        mode: ['abbr', 'slice'].includes(String(modeRaw || '').toLowerCase()) ? String(modeRaw).toLowerCase() : 'abbr'
      };
    }
    return { sources, config };
  };

  const startEditSkuRule = (rule) => {
    const parsedDerived = rule.prefix_mode === 'static'
      ? parseDerivedTemplateConfig(rule.prefix_static)
      : null;
    const effectivePrefixMode = parsedDerived ? 'derived' : rule.prefix_mode;
    const effectiveSources = parsedDerived
      ? parsedDerived.sources
      : (rule.prefix_source ? [rule.prefix_source] : []);
    setEditingSkuRule(rule);
    skuRuleForm.setFieldsValue({
      name: rule.name,
      scope: rule.scope,
      scopeValue: rule.scope_value,
      prefixMode: effectivePrefixMode,
      prefixStatic: rule.prefix_static,
      prefixSources: effectiveSources,
      prefixSourceConfig: { ...buildDefaultDerivedConfig(), ...(parsedDerived?.config || {}) },
      prefixLength: rule.prefix_length,
      separator: rule.separator,
      useDate: !!rule.use_date,
      dateFormat: rule.date_format,
      useCounter: !!rule.use_counter,
      counterStart: rule.counter_start,
      counterPadding: rule.counter_padding,
      isDefault: !!rule.is_default
    });
  };

  const startNewSkuRule = () => {
    setEditingSkuRule(null);
    skuRuleForm.resetFields();
    skuRuleForm.setFieldsValue({
      scope: 'default',
      prefixMode: 'static',
      prefixSources: ['name'],
      prefixSourceConfig: buildDefaultDerivedConfig(),
      prefixLength: 3,
      separator: '-',
      useDate: false,
      dateFormat: 'YYMM',
      useCounter: true,
      counterStart: 1,
      counterPadding: 4,
      isDefault: skuRules.length === 0
    });
  };

  const submitSkuRule = async () => {
    try {
      const values = await skuRuleForm.validateFields();
      const sourceList = Array.isArray(values.prefixSources) ? values.prefixSources.filter(Boolean) : [];
      const cfg = values.prefixSourceConfig || {};
      const payload = {
        ...values,
        // Category rules cannot be marked as default.
        isDefault: values.scope === 'default' ? !!values.isDefault : false,
        // Keep counter start aligned with backend validation.
        counterStart: Math.max(1, Number(values.counterStart || 1)),
      };
      if (values.prefixMode === 'derived') {
        // Persist derived customization as static template tokens with modifiers:
        // e.g. {BRAND|3|abbr}-{ITEM|4|slice}
        payload.prefixMode = 'static';
        payload.prefixSource = null;
        payload.prefixStatic = sourceList
          .map((s) => {
            const token = DERIVED_TOKEN_BY_SOURCE[s];
            if (!token) return null;
            const c = cfg[s] || DEFAULT_DERIVED_CFG;
            const len = Math.max(1, Number(c?.len) || 3);
            const mode = String(c?.mode || 'abbr').toLowerCase() === 'slice' ? 'slice' : 'abbr';
            return `{${token}|${len}|${mode}}`;
          })
          .filter(Boolean)
          .join('-');
      } else {
        payload.prefixSource = null;
      }
      delete payload.prefixSources;
      delete payload.prefixSourceConfig;
      if (editingSkuRule) {
        await skuGeneratorService.updateRule(editingSkuRule.id, payload);
        message.success('SKU rule updated');
      } else {
        await skuGeneratorService.createRule(payload);
        message.success('SKU rule created');
      }
      setEditingSkuRule(null);
      skuRuleForm.resetFields();
      await loadSkuRules();
    } catch (e) {
      if (e?.errorFields) return; // validation
      message.error(e?.response?.data?.error || 'Failed to save rule');
    }
  };

  const removeSkuRule = async (id) => {
    try {
      await skuGeneratorService.deleteRule(id);
      message.success('Rule removed');
      await loadSkuRules();
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to remove rule');
    }
  };

  // Check if user can manage items
  const canManageCategories = user?.permissions?.category_management || user?.permissions?.all;
  const canViewCategories = user?.permissions?.category_view || user?.permissions?.all;
  const canViewItems = user?.permissions?.item_view || user?.permissions?.all;
  const canManageItems = user?.permissions?.item_management || user?.permissions?.all;

  /** Add category from the item modal: persists when user has category_management, else local pick list only */
  const handleInlineAddCategory = async () => {
    const raw = prompt('Enter new category:');
    if (!raw?.trim()) return;
    const name = raw.trim();
    if (categories.some(c => c.name === name)) {
      message.info('Category already in the list');
      form.setFieldsValue({ category: name });
      return;
    }
    if (canManageCategories) {
      try {
        const response = await apiService.post('/categories', { name });
        if (response?.success && response.data?.categoryId) {
          setCategories(prev => [...prev, { id: response.data.categoryId, name }]);
          form.setFieldsValue({ category: name });
          message.success('Category added');
        }
      } catch (e) {
        message.error(e?.response?.data?.error || 'Failed to add category');
      }
    } else {
      setCategories(prev => [...prev, { id: `local-${Date.now()}`, name }]);
      form.setFieldsValue({ category: name });
      message.success(`Using "${name}" for this item`);
    }
  };

  const handleInlineAddItemType = async () => {
    const raw = prompt('Enter new item type:');
    if (!raw?.trim()) return;
    const name = raw.trim().toLowerCase();
    if (itemTypes.some(t => t.name === name)) {
      message.info('Item type already in the list');
      form.setFieldsValue({ type: name });
      return;
    }
    try {
      const response = await apiService.post('/item-types', { name });
      if (response?.success && response.data?.typeId) {
        setItemTypes(prev => [...prev, { id: response.data.typeId, name, is_active: true }]);
        form.setFieldsValue({ type: name });
        message.success('Item type added');
      }
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to add item type');
    }
  };

  const handleDeleteItemType = async (typeId, typeName) => {
    if (!canManageItems) return;
    if (PROTECTED_ITEM_TYPES.has(String(typeName || '').toLowerCase())) {
      message.warning('Simple, variant, and composite types cannot be deleted.');
      return;
    }
    try {
      await apiService.delete(`/item-types/${typeId}`);
      setItemTypes(prev => prev.filter(t => t.id !== typeId));
      if (form.getFieldValue('type') === typeName) {
        form.setFieldsValue({ type: 'simple' });
      }
      message.success(`Item type '${typeName}' deleted`);
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to delete item type');
    }
  };

  const handleDeleteCategory = async (categoryId, categoryName) => {
    if (!canManageCategories) return;
    try {
      await apiService.delete(`/categories/${categoryId}`);
      setCategories(prev => prev.filter(c => c.id !== categoryId));
      if (form.getFieldValue('category') === categoryName) {
        form.setFieldsValue({ category: undefined });
      }
      message.success(`Category '${categoryName}' deleted`);
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to delete category');
    }
  };

  const columns = [
    {
      title: 'Item',
      key: 'item',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {record.image ? (
            <img src={record.image} alt={record.name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', border: '1px solid #f0f0f0' }} />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #667eea22, #764ba222)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#764ba2', fontSize: 16 }}><InboxOutlined /></div>
          )}
          <div>
            <div style={{ fontWeight: 600, color: '#1a1a2e', fontSize: 13 }}>{record.name}</div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>{record.sku}</div>
          </div>
        </div>
      )
    },
    { title: 'Type', dataIndex: 'type', key: 'type', render: v => v ? <Tag color="blue" style={{ borderRadius: 20, textTransform: 'capitalize' }}>{v}</Tag> : '-' },
    { title: 'Item Group', dataIndex: 'item_group_name', key: 'item_group_name', render: v => v ? <Tag color="purple" style={{ borderRadius: 20 }}>{v}</Tag> : '-' },
    { title: 'Unit', dataIndex: 'unit', key: 'unit', render: v => v || '-' },
    {
      title: 'On Hand',
      dataIndex: 'current_stock',
      key: 'current_stock',
      render: (val, record) => {
        const stock = val || 0;
        const low = stock <= (record.min_stock_level || 0);
        const display = stock % 1 === 0 ? Math.floor(stock) : stock.toFixed(2);
        return (
          <Tag color={low ? 'red' : 'green'} style={{ borderRadius: 20, fontWeight: 700, minWidth: 40, textAlign: 'center' }}>
            {low && <WarningOutlined style={{ marginRight: 4 }} />}{display}
          </Tag>
        );
      }
    },
    { title: 'Cost Price', dataIndex: 'cost_price', key: 'cost_price', render: val => val ? <span style={{ fontWeight: 600, color: '#595959' }}>{formatPrice(val, currency, 'USD')}</span> : '-' },
    { title: 'Selling Price', dataIndex: 'selling_price', key: 'selling_price', render: val => val ? <span style={{ fontWeight: 700, color: '#667eea' }}>{formatPrice(val, currency, 'USD')}</span> : '-' },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: canManageItems ? 110 : 60,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="View">
            <Button
              icon={<EyeOutlined />}
              size="small"
              onClick={() => viewItem(record)}
              style={{ borderRadius: 6, background: '#f0f0ff', borderColor: '#667eea', color: '#667eea' }}
            />
          </Tooltip>
          {canManageItems && (
            <Tooltip title="Edit">
              <Button
                icon={<EditOutlined />}
                size="small"
                onClick={() => editItem(record)}
                style={{ borderRadius: 6, background: '#667eea', border: 'none', color: '#fff' }}
              />
            </Tooltip>
          )}
          {canManageItems && (
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  {
                    key: 'duplicate',
                    icon: <CopyOutlined style={{ color: '#fa8c16' }} />,
                    label: 'Duplicate',
                    onClick: () => duplicateItem(record),
                  },
                  {
                    key: 'toggle',
                    icon: record.status === 'active'
                      ? <StopOutlined style={{ color: '#ff4d4f' }} />
                      : <CheckCircleOutlined style={{ color: '#52c41a' }} />,
                    label: record.status === 'active' ? 'Deactivate' : 'Activate',
                    onClick: () => toggleItemStatus(record),
                  },
                ],
              }}
            >
              <Tooltip title="More actions">
                <Button
                  icon={<MoreOutlined />}
                  size="small"
                  style={{ borderRadius: 6, border: '1px solid #d9d9d9', color: '#595959' }}
                />
              </Tooltip>
            </Dropdown>
          )}
        </Space>
      )
    }
  ];

  const fetchDropdownOptions = async () => {
    const snapshot = {
      manufacturers: [],
      brands: [],
      units: [],
      vendors: [],
      itemTypes: [],
      itemGroups: [],
      variantLibrary: [],
    };
    try {
      // Use Promise.allSettled to handle individual failures gracefully
      const results = await Promise.allSettled([
        apiService.get('/manufacturers'),
        apiService.get('/brands'),
        apiService.get('/units'),
        apiService.get('/vendors'),
        canViewItems ? apiService.get('/item-types') : Promise.resolve({ success: true, data: [] }),
        canViewItems ? apiService.get('/item-groups') : Promise.resolve({ success: true, data: [] }),
        canViewItems ? apiService.get('/items/variant-library') : Promise.resolve({ success: true, data: [] })
      ]);
      
      const [manufacturersRes, brandsRes, unitsRes, vendorsRes, itemTypesRes, itemGroupsRes, variantLibraryRes] = results;
      
      if (manufacturersRes.status === 'fulfilled') {
        const manufacturers = Array.isArray(manufacturersRes.value) ? manufacturersRes.value : (manufacturersRes.value?.data || []);
        snapshot.manufacturers = manufacturers;
        setManufacturerOptions(manufacturers);
      }
      
      if (brandsRes.status === 'fulfilled') {
        const brands = Array.isArray(brandsRes.value) ? brandsRes.value : (brandsRes.value?.data || []);
        snapshot.brands = brands;
        setBrandOptions(brands);
      }
      
      if (unitsRes.status === 'fulfilled') {
        const units = Array.isArray(unitsRes.value) ? unitsRes.value : (unitsRes.value?.data || []);
        snapshot.units = units;
        setUnitOptions(units);
      }
      
      if (vendorsRes.status === 'fulfilled') {
        const vendors = Array.isArray(vendorsRes.value) ? vendorsRes.value : (vendorsRes.value?.data || []);
        snapshot.vendors = vendors;
        setVendorOptions(vendors);
      }

      if (itemTypesRes.status === 'fulfilled') {
        const types = Array.isArray(itemTypesRes.value) ? itemTypesRes.value : (itemTypesRes.value?.data || []);
        snapshot.itemTypes = types;
        setItemTypes(types);
      }

      if (itemGroupsRes.status === 'fulfilled') {
        const groups = Array.isArray(itemGroupsRes.value) ? itemGroupsRes.value : (itemGroupsRes.value?.data || []);
        snapshot.itemGroups = groups;
        setItemGroups(groups);
      }

      if (variantLibraryRes.status === 'fulfilled') {
        const library = Array.isArray(variantLibraryRes.value) ? variantLibraryRes.value : (variantLibraryRes.value?.data || []);
        snapshot.variantLibrary = Array.isArray(library) ? library : [];
        setVariantLibrary(snapshot.variantLibrary);
      }

      // Load tax rates from new tax module
      try {
        const taxRes = await apiService.get('/tax/rates');
        if (taxRes.success) setTaxRateOptions(taxRes.data || []);
      } catch { /* silent — tax module optional */ }
    } catch (error) {
      console.error('Dropdown fetch error:', error);
    }
    return snapshot;
  };

  const fetchWarehouseTypes = async () => {
    try {
      const res = await apiService.get('/warehouse-types');
      if (res.success) setWarehouseTypes(res.data);
    } catch (e) {
      console.error('Failed to fetch warehouse types', e);
    }
  };

  const fetchItemWarehouseSummaries = useCallback(async (itemId) => {
    if (!itemId) {
      setEditingWarehouseSummaries([]);
      return [];
    }

    try {
      const response = await apiService.get(`/inventory/item-activity/${itemId}`);
      const summaries = response.success && Array.isArray(response.data) ? response.data : [];
      setEditingWarehouseSummaries(summaries);
      return summaries;
    } catch (error) {
      console.log('Warehouse stock summary unavailable for item edit', error);
      setEditingWarehouseSummaries([]);
      return [];
    }
  }, []);

  const warehouseSelectOptions = useMemo(() => {
    const merged = new Map();

    warehouses.forEach((warehouse) => {
      merged.set(warehouse.id, {
        ...warehouse,
        stock: null
      });
    });

    editingWarehouseSummaries.forEach((summary) => {
      const existing = merged.get(summary.warehouse_id) || {
        id: summary.warehouse_id,
        name: summary.warehouse_name || summary.warehouse_id,
        code: null,
        status: 'active'
      };

      merged.set(summary.warehouse_id, {
        ...existing,
        name: existing.name || summary.warehouse_name || summary.warehouse_id,
        stock: {
          available: Number(summary?.current_stock?.quantity_available || 0),
          onHand: Number(summary?.current_stock?.quantity_on_hand || 0),
          reserved: Number(summary?.current_stock?.quantity_reserved || 0)
        }
      });
    });

    return Array.from(merged.values())
      .filter((warehouse) => warehouse.status === 'active' || warehouse.stock)
      .sort((left, right) => {
        const stockDiff = (Number(right.stock?.available || 0) - Number(left.stock?.available || 0));
        if (stockDiff !== 0) return stockDiff;
        return String(left.name || '').localeCompare(String(right.name || ''));
      });
  }, [warehouses, editingWarehouseSummaries]);

  const fetchItems = async () => {
    let itemsLoaded = false;
    try {
      setLoading(true);
      
      // Stagger API calls to prevent 429 errors
      try {
        const itemsResponse = await apiService.get('/items', { params: { status: 'all' } });
        if (itemsResponse.success) {
          setItems(itemsResponse.data);
          itemsLoaded = true;
        }
      } catch (error) {
        if (error?.isPermissionError) {
          message.error('You do not have permission to view items');
          return;
        }
        throw error;
      }
      
      // Add small delay before next request
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        const warehousesResponse = await apiService.get('/warehouses', { params: { status: 'all' } });
        if (warehousesResponse.success) {
          setWarehouses(warehousesResponse.data);
        }
      } catch (error) {
        // Fallback: item users may not have warehouse_view but still need selectable warehouse list.
        try {
          const accessibleWarehousesResponse = await apiService.get('/warehouses/accessible');
          if (accessibleWarehousesResponse.success) {
            setWarehouses(accessibleWarehousesResponse.data || []);
          }
        } catch {
          console.log('Warehouse list unavailable for this user, continuing without warehouses');
        }
      }
      
      // Only fetch categories if user has permission
      if (user?.permissions?.category_view || user?.permissions?.all) {
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          const categoriesResponse = await apiService.get('/categories');
          if (categoriesResponse.success) {
            setCategories(categoriesResponse.data);
          }
        } catch (error) {
          console.log('No category access, continuing without categories');
        }
      }
    } catch (error) {
      console.error('Fetch items error:', error);
      if (!itemsLoaded) {
        message.error('Failed to fetch data');
      }
    } finally {
      setLoading(false);
    }
  };
  fetchItemsRef.current = fetchItems;

  const resetCsvImportModal = useCallback(() => {
    csvImportExcelBufferRef.current = null;
    setCsvImportModal({
      open: false,
      busy: false,
      csvImportSourceFormat: 'csv',
      csvImportRawText: '',
      csvImportFileLineCount: 0,
      headerLineNumber: 1,
      headers: [],
      rows: [],
      csvImportPreviewFilters: {
        hideMissingSku: false,
        hideMissingName: false,
        onlyReady: false,
        onlyIssues: false,
        onlyMatched: false,
      },
      importPurpose: CSV_IMPORT_PURPOSE_CREATE,
      matchField: CSV_IMPORT_DEFAULT_MATCH_FIELD,
      itemType: 'simple',
      fieldConfigs: [],
      mapping: {},
      defaultWarehouseId: undefined,
      result: null,
      addedRowIndexes: {},
      supersededRowIndexes: {},
      duplicateGroupPlans: {},
      skuSource: CSV_IMPORT_SKU_FROM_FILE,
      importSkuRuleId: undefined,
      importDefaults: {},
      catalogItemPicks: {},
      matchFileColumn: '',
    });
    activeImportRowIndexRef.current = null;
    activeImportGroupRef.current = null;
    setItemFormOpenedFromImport(false);
  }, []);

  const closeItemFormReturnToImport = useCallback(() => {
    setModalVisible(false);
    setItemFormOpenedFromImport(false);
    setImportCustomFieldsPreview([]);
    activeImportRowIndexRef.current = null;
    activeImportGroupRef.current = null;
    setEditingItem(null);
    setImageUrl('');
    setImageFile(null);
    setDuplicateBanner(null);
    setDuplicateSourcePayload(null);
    setDraftBanner(null);
    setActiveDraftId(null);
    setExistingCustomFields({});
    setVariantMatrixEdits([]);
    setCompositeComponents([]);
    setKitFulfillmentMode('prebuilt');
    setEditingWarehouseSummaries([]);
    setSelectedSkuRuleId(null);
    setLastAppliedSkuRule(null);
    form.resetFields();
  }, [form]);

  const openCsvImportModal = useCallback(async () => {
    const firstWh = warehouses?.[0]?.id;
    csvImportExcelBufferRef.current = null;
    let importSkuRuleId;
    try {
      const rules = await skuGeneratorService.listRules();
      const list = Array.isArray(rules) ? rules : [];
      setSkuRules(list);
      const defaultRule = list.find((r) => !!r.is_default) || list[0];
      importSkuRuleId = defaultRule?.id;
      if (defaultRule?.id) setSelectedSkuRuleId(defaultRule.id);
    } catch {
      setSkuRules([]);
    }
    await fetchDropdownOptions();
    setCsvImportModal({
      open: true,
      busy: false,
      csvImportSourceFormat: 'csv',
      csvImportRawText: '',
      csvImportFileLineCount: 0,
      headerLineNumber: 1,
      headers: [],
      rows: [],
      csvImportPreviewFilters: {
        hideMissingSku: false,
        hideMissingName: false,
        onlyReady: false,
        onlyIssues: false,
        onlyMatched: false,
      },
      importPurpose: CSV_IMPORT_PURPOSE_CREATE,
      matchField: CSV_IMPORT_DEFAULT_MATCH_FIELD,
      itemType: 'simple',
      fieldConfigs: [],
      mapping: {},
      defaultWarehouseId: firstWh,
      result: null,
      addedRowIndexes: {},
      supersededRowIndexes: {},
      duplicateGroupPlans: {},
      skuSource: CSV_IMPORT_SKU_FROM_FILE,
      importSkuRuleId,
      importDefaults: {},
      catalogItemPicks: {},
      matchFileColumn: '',
    });
    activeImportRowIndexRef.current = null;
    activeImportGroupRef.current = null;
    setItemFormOpenedFromImport(false);
  }, [warehouses]);

  const handleCsvImportBeforeUpload = useCallback((file) => {
    const isExcel = isExcelImportFileName(file.name);
    const reader = new FileReader();
    const maxRows = 5000;

    if (isExcel) {
      reader.onload = (e) => {
        const buf = e.target?.result;
        if (!(buf instanceof ArrayBuffer)) {
          message.error('Could not read spreadsheet file');
          return;
        }
        csvImportExcelBufferRef.current = buf;
        setCsvImportModal((prev) => {
          const headerLineNumber = Math.max(1, Math.floor(Number(prev.headerLineNumber) || 1));
          const { headers, rows, sheetRowCount } = parseExcelBufferToRows(buf, { headerLineNumber });
          if (!headers.some((h) => String(h).trim())) {
            setTimeout(() => {
              message.error('No header row found at the selected line. Change “Header line” or try the first sheet of the workbook.');
            }, 0);
            return {
              ...prev,
              csvImportSourceFormat: 'xlsx',
              csvImportRawText: '',
              csvImportFileLineCount: sheetRowCount,
              headerLineNumber,
              headers: [],
              rows: [],
              csvImportPreviewFilters: { hideMissingSku: false, hideMissingName: false, onlyReady: false, onlyIssues: false },
              mapping: {},
              result: null,
            };
          }
          const limited = rows.slice(0, maxRows);
          setTimeout(() => {
            if (rows.length > maxRows) {
              message.warning(`Importing the first ${maxRows} data rows only`);
            }
            message.success(`Excel (first sheet): row ${headerLineNumber} as header — ${limited.length} data row(s), ${headers.length} column(s)`);
          }, 0);
          const matchField = prev.matchField || CSV_IMPORT_DEFAULT_MATCH_FIELD;
          const isUpdate = prev.importPurpose === CSV_IMPORT_PURPOSE_UPDATE;
          const mapping = buildInitialCsvMapping(headers, prev.fieldConfigs || [], {
            importPurpose: prev.importPurpose,
            matchField,
          });
          const matchFileColumn = isUpdate ? guessMatchFileColumn(headers, matchField) : '';
          return {
            ...prev,
            csvImportSourceFormat: 'xlsx',
            csvImportRawText: '',
            csvImportFileLineCount: sheetRowCount,
            headerLineNumber,
            headers,
            rows: limited,
            csvImportPreviewFilters: {
              ...prev.csvImportPreviewFilters,
              onlyMatched: isUpdate,
            },
            mapping,
            matchField,
            matchFileColumn,
            importDefaults: isUpdate ? {} : prev.importDefaults,
            catalogItemPicks: {},
            result: null,
          };
        });
      };
      reader.onerror = () => message.error('Could not read file');
      reader.readAsArrayBuffer(file);
      return false;
    }

    csvImportExcelBufferRef.current = null;
    reader.onload = (e) => {
      const text = String(e.target?.result || '');
      const fileLineCount = countCsvTextLines(text);
      setCsvImportModal((prev) => {
        const headerLineNumber = Math.max(1, Math.floor(Number(prev.headerLineNumber) || 1));
        const { headers, rows } = parseCsvToRows(text, { headerLineNumber });
        if (!headers.some((h) => String(h).trim())) {
          setTimeout(() => {
            message.error('No header row found at the selected line. Change “Header line” and upload again, or pick another line after upload.');
          }, 0);
          return {
            ...prev,
            csvImportSourceFormat: 'csv',
            csvImportRawText: text,
            csvImportFileLineCount: fileLineCount,
            headerLineNumber,
            headers: [],
            rows: [],
            csvImportPreviewFilters: { hideMissingSku: false, hideMissingName: false, onlyReady: false, onlyIssues: false },
            mapping: {},
            result: null,
          };
        }
        const limited = rows.slice(0, maxRows);
        setTimeout(() => {
          if (rows.length > maxRows) {
            message.warning(`Importing the first ${maxRows} data rows only`);
          }
          message.success(`CSV: line ${headerLineNumber} as header — ${limited.length} data row(s), ${headers.length} column(s)`);
        }, 0);
        const matchField = prev.matchField || CSV_IMPORT_DEFAULT_MATCH_FIELD;
        const isUpdate = prev.importPurpose === CSV_IMPORT_PURPOSE_UPDATE;
        const mapping = buildInitialCsvMapping(headers, prev.fieldConfigs || [], {
          importPurpose: prev.importPurpose,
          matchField,
        });
        const matchFileColumn = isUpdate ? guessMatchFileColumn(headers, matchField) : '';
        return {
          ...prev,
          csvImportSourceFormat: 'csv',
          csvImportRawText: text,
          csvImportFileLineCount: fileLineCount,
          headerLineNumber,
          headers,
          rows: limited,
          csvImportPreviewFilters: {
            ...prev.csvImportPreviewFilters,
            onlyMatched: isUpdate,
          },
          mapping,
          matchField,
          matchFileColumn,
          importDefaults: isUpdate ? {} : prev.importDefaults,
          catalogItemPicks: {},
          result: null,
        };
      });
    };
    reader.onerror = () => message.error('Could not read file');
    reader.readAsText(file);
    return false;
  }, []);

  const applyCsvHeaderLineNumber = useCallback((rawLineNum) => {
    const n = Math.max(1, Math.floor(Number(rawLineNum) || 1));
    setCsvImportModal((prev) => {
      if (prev.csvImportSourceFormat === 'xlsx' && csvImportExcelBufferRef.current) {
        const buf = csvImportExcelBufferRef.current;
        const { headers, rows, sheetRowCount } = parseExcelBufferToRows(buf, { headerLineNumber: n });
        if (!headers.some((h) => String(h).trim())) {
          setTimeout(() => {
            message.warning('That row has no column headers — try another row number.');
          }, 0);
          return {
            ...prev,
            headerLineNumber: n,
            csvImportFileLineCount: sheetRowCount,
            headers: [],
            rows: [],
            csvImportPreviewFilters: { hideMissingSku: false, hideMissingName: false, onlyReady: false, onlyIssues: false },
            mapping: {},
            result: null,
          };
        }
        const maxRows = 5000;
        const limited = rows.slice(0, maxRows);
        setTimeout(() => {
          if (rows.length > maxRows) {
            message.warning(`Importing the first ${maxRows} data rows only`);
          }
        }, 0);
        return {
          ...prev,
          headerLineNumber: n,
          csvImportFileLineCount: sheetRowCount,
          headers,
          rows: limited,
          csvImportPreviewFilters: { hideMissingSku: false, hideMissingName: false, onlyReady: false, onlyIssues: false },
          mapping: prev.importPurpose === CSV_IMPORT_PURPOSE_UPDATE
            ? (prev.mapping || {})
            : buildInitialCsvMapping(headers, prev.fieldConfigs || [], {
              importPurpose: prev.importPurpose,
              matchField: prev.matchField,
            }),
          matchFileColumn: prev.importPurpose === CSV_IMPORT_PURPOSE_UPDATE
            ? guessMatchFileColumn(headers, prev.matchField)
            : '',
          result: null,
        };
      }
      if (prev.csvImportSourceFormat === 'csv' && prev.csvImportRawText) {
        const { headers, rows } = parseCsvToRows(prev.csvImportRawText, { headerLineNumber: n });
        const fileLineCount = countCsvTextLines(prev.csvImportRawText);
        if (!headers.some((h) => String(h).trim())) {
          setTimeout(() => {
            message.warning('That line has no column headers — try another line number.');
          }, 0);
          return {
            ...prev,
            headerLineNumber: n,
            csvImportFileLineCount: fileLineCount,
            headers: [],
            rows: [],
            csvImportPreviewFilters: { hideMissingSku: false, hideMissingName: false, onlyReady: false, onlyIssues: false },
            mapping: {},
            result: null,
          };
        }
        const maxRows = 5000;
        const limited = rows.slice(0, maxRows);
        setTimeout(() => {
          if (rows.length > maxRows) {
            message.warning(`Importing the first ${maxRows} data rows only`);
          }
        }, 0);
        return {
          ...prev,
          headerLineNumber: n,
          csvImportFileLineCount: fileLineCount,
          headers,
          rows: limited,
          csvImportPreviewFilters: { hideMissingSku: false, hideMissingName: false, onlyReady: false, onlyIssues: false },
          mapping: prev.importPurpose === CSV_IMPORT_PURPOSE_UPDATE
            ? (prev.mapping || {})
            : buildInitialCsvMapping(headers, prev.fieldConfigs || [], {
              importPurpose: prev.importPurpose,
              matchField: prev.matchField,
            }),
          matchFileColumn: prev.importPurpose === CSV_IMPORT_PURPOSE_UPDATE
            ? guessMatchFileColumn(headers, prev.matchField)
            : '',
          result: null,
        };
      }
      return { ...prev, headerLineNumber: n };
    });
  }, []);

  const downloadItemsCsvTemplateFile = useCallback(() => {
    const blob = new Blob([buildItemsCsvTemplate()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'items_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const formatItemFormBatchDate = (value) => {
    if (!value) return undefined;
    if (dayjs.isDayjs(value)) return value.format('YYYY-MM-DD');
    if (value instanceof Date && !Number.isNaN(value.getTime())) return dayjs(value).format('YYYY-MM-DD');
    const text = String(value).trim();
    return text || undefined;
  };

  const parseImportDateForForm = (raw) => {
    const parsed = parseImportDateValue(raw ?? '');
    return parsed.valid && parsed.value ? dayjs(parsed.value) : undefined;
  };

  const createWarehouseBatchFromItemForm = async (itemId, values) => {
    const batchNum = values.batchNumber?.trim().toUpperCase();
    const warehouseId = values.warehouseId;
    const qty = Number(values.openingStock) || 0;
    if (!batchNum || !warehouseId || !(qty > 0)) return { skipped: true };

    await apiService.createBatch({
      itemId,
      warehouseId,
      batchNumber: batchNum,
      quantityReceived: qty,
      unitCost: values.costPrice != null && values.costPrice !== ''
        ? convertPrice(values.costPrice, priceCurrency, 'USD')
        : 0,
      manufactureDate: formatItemFormBatchDate(values.batchManufactureDate),
      expiryDate: formatItemFormBatchDate(values.batchExpiryDate),
    });
    return { created: batchNum };
  };

  const syncWarehouseBatchDatesFromItemForm = async (itemId, values) => {
    const batchNum = values.batchNumber?.trim().toUpperCase();
    const warehouseId = values.warehouseId;
    if (!batchNum || !warehouseId) return { skipped: true };

    const batchRes = await apiService.getBatches({ itemId, warehouseId });
    const match = (batchRes?.data || []).find(
      (b) => b.batch_number?.toUpperCase() === batchNum
    );
    if (!match) return { skipped: true };

    await apiService.updateBatchDates(match.id, {
      manufactureDate: formatItemFormBatchDate(values.batchManufactureDate) || null,
      expiryDate: formatItemFormBatchDate(values.batchExpiryDate) || null,
    });
    return { updated: batchNum };
  };

  const handleSubmit = async (values) => {
    try {
      const isEditing = !!editingItem;
      console.log('Form values:', values);
      const itemType = values.type || itemTypes.find(t => t.name === 'simple')?.name || itemTypes[0]?.name || 'simple';
      const normalizedVariantAttributes = normalizeVariantAttributes(values.variantAttributes);
      const normalizedVariantMatrix = normalizeVariantMatrixRows(variantMatrixRows);
      const isVariantType = itemType === 'variant';
      const defaultVariantWarehouseId = normalizedVariantMatrix.find((row) => row.warehouseId)?.warehouseId || null;

      if (!isVariantType && (Number(values.openingStock) || 0) > 0 && !values.warehouseId) {
        message.error('Please select Warehouse when opening stock is greater than 0.');
        return;
      }
      if (isVariantType) {
        const stockRowMissingWarehouse = normalizedVariantMatrix.find(
          (row) => (Number(row.openingStock) || 0) > 0 && !row.warehouseId
        );
        if (stockRowMissingWarehouse) {
          message.error(`Select a warehouse for variant "${stockRowMissingWarehouse.combinationLabel}" before saving stock.`);
          return;
        }
      }
      
      // Build dimensions object if any dimension value exists
      const dimensions = (values.length || values.width || values.height) ? {
        length: values.length || 0,
        width: values.width || 0,
        height: values.height || 0
      } : null;
      
      const itemData = {
        sku: values.sku,
        name: values.name,
        description: values.description,
        image: imageUrl,
        type: itemType,
        category: values.category,
        customFields: {
          ...(existingCustomFields || {}),
          variantAttributes: normalizedVariantAttributes,
          variantMatrix: normalizedVariantMatrix,
          skuMeta: {
            ...((existingCustomFields || {}).skuMeta || {}),
            color: normalizeOptionalTextArray(values.colorCode),
            size: normalizeOptionalTextArray(values.sizeCode),
            packType: normalizeOptionalTextArray(values.packType)
          }
        },
        unit: values.unit,
        warehouseId: isVariantType ? defaultVariantWarehouseId : values.warehouseId,
        costPrice: values.costPrice != null && values.costPrice !== '' ? convertPrice(values.costPrice, priceCurrency, 'USD') : 0,
        sellingPrice: values.sellingPrice != null && values.sellingPrice !== '' ? convertPrice(values.sellingPrice, priceCurrency, 'USD') : 0,
        mrp: values.mrp ? convertPrice(values.mrp, priceCurrency, 'USD') : null,
        taxRate: values.taxRate,
        brand: values.brand,
        manufacturer: values.manufacturer,
        itemGroupId: values.itemGroupId || null,
        itemGroup: itemGroups.find((group) => group.id === values.itemGroupId)?.name || null,
        minStockLevel: values.minStockLevel,
        maxStockLevel: values.maxStockLevel,
        barcode: values.barcode,
        batchNumber: values.batchNumber?.trim().toUpperCase() || null,
        openingStock: isVariantType ? 0 : (values.openingStock || 0),
        openingValue: isVariantType ? 0 : (values.openingValue || 0),
        defaultBinId: isVariantType ? null : (values.defaultBinId || null),
        valuationMethod: values.valuationMethod,
        weight: values.weight,
        dimensions: dimensions,
        hsnCode: values.hsnCode,
        upc: values.upc,
        ean: values.ean,
        isbn: values.isbn,
        mpn: values.mpn,
        supplierCode: normalizeOptionalText(values.supplierCode) || null,
      };
      if (itemData.type === 'composite') {
        const normalizedComponents = normalizeCompositeComponents(compositeComponents);
        if (normalizedComponents.length === 0) {
          message.error('Add at least one BOM component for composite item.');
          return;
        }
        const duplicateSet = new Set(normalizedComponents.map((row) => row.itemId));
        if (duplicateSet.size !== normalizedComponents.length) {
          message.error('Duplicate component item is not allowed in BOM.');
          return;
        }
        if (editingItem?.id && normalizedComponents.some((row) => row.itemId === editingItem.id)) {
          message.error('Composite item cannot be added as its own component.');
          return;
        }
        itemData.components = normalizedComponents;
        itemData.kitFulfillmentMode = kitFulfillmentMode;
      }

      if (!isEditing && duplicateSourcePayload) {
        const comparableCurrent = JSON.stringify(buildComparableItemPayload(itemData));
        const comparableSource = JSON.stringify(duplicateSourcePayload);
        if (comparableCurrent === comparableSource) {
          message.error('This is an exact duplicate of the source item. Change at least one field before saving.');
          return;
        }
      }
      
      let savedItemId = null;
      let saveSucceeded = false;
      if (isEditing) {
        const response = await apiService.put(`/items/${editingItem.id}`, itemData);
        if (response.success) {
          saveSucceeded = true;
          savedItemId = editingItem.id;
          message.success('Item updated successfully');
        }
      } else {
        const response = await apiService.post('/items', itemData);
        if (response.success) {
          saveSucceeded = true;
          savedItemId = response.data?.itemId;
          message.success('Item created successfully');
        }
      }

      if (savedItemId && itemFormOpenedFromImport && saveSucceeded) {
        const importGroup = activeImportGroupRef.current;
        const savedRowIndex = activeImportRowIndexRef.current;
        const warehouseId = values.warehouseId || csvImportModal.defaultWarehouseId;
        const importPurpose = csvImportModal.importPurpose === CSV_IMPORT_PURPOSE_UPDATE
          ? CSV_IMPORT_PURPOSE_UPDATE
          : CSV_IMPORT_PURPOSE_CREATE;
        const batchLinesToCreate = resolveImportBatchLinesForSave({
          importGroup,
          savedRowIndex,
          rows: csvImportModal.rows,
          mapping: csvImportModal.mapping,
          importDefaults: csvImportModal.importDefaults || {},
          importPurpose,
        });

        if (batchLinesToCreate.length) {
          const batchValidation = validateImportBatchLines(batchLinesToCreate);
          if (!batchValidation.ok) {
            batchValidation.errors.forEach((err) => message.warning(err, 6));
          } else {
            if (!warehouseId) {
              message.warning('Item saved but warehouse batches were skipped — select a warehouse.');
            } else {
              const batchResult = await createImportBatchesForItem(savedItemId, batchLinesToCreate, warehouseId);
              if (batchResult.created.length) {
                message.success(`Created ${batchResult.created.length} warehouse batch(es): ${batchResult.created.join(', ')}`);
              }
              if (batchResult.errors.length) {
                Modal.warning({
                  title: 'Some batches could not be created',
                  content: (
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {batchResult.errors.map((err) => <li key={err}>{err}</li>)}
                    </ul>
                  ),
                });
              }
            }
          }
        }
      }

      if (savedItemId && saveSucceeded && !isVariantType && !(itemFormOpenedFromImport && activeImportGroupRef.current)) {
        try {
          const batchResult = await createWarehouseBatchFromItemForm(savedItemId, values);
          if (batchResult.created) {
            message.success(`Warehouse batch ${batchResult.created} created with batch dates`);
          } else if (isEditing) {
            const dateResult = await syncWarehouseBatchDatesFromItemForm(savedItemId, values);
            if (dateResult.updated) {
              message.success(`Warehouse batch ${dateResult.updated} dates updated`);
            }
          }
        } catch (e) {
          message.warning(
            `Item saved but warehouse batch was not created: ${e?.response?.data?.error || e?.message || 'failed'}`
          );
        }
      }

      const normalizedVariantRows = normalizeVariantAttributes(values.variantAttributes);
      if (normalizedVariantRows.length > 0) {
        try {
          await apiService.post('/items/variant-library', { rows: normalizedVariantRows });
          await fetchDropdownOptions();
        } catch {
          // Keep item flow successful even if library save fails.
        }
      }
      // Clear only the draft being continued on successful save.
      if (activeDraftId) {
        try { await apiService.delete(`/items/draft/${activeDraftId}`); } catch {}
      }
      setDraftBanner(null);
      setActiveDraftId(null);
      if (isEditing && itemFormOpenedFromImport && activeImportRowIndexRef.current != null) {
        const savedRowIndex = activeImportRowIndexRef.current;
        const importGroup = activeImportGroupRef.current;
        const wasUpdateImport = csvImportModal.importPurpose === CSV_IMPORT_PURPOSE_UPDATE;
        closeItemFormReturnToImport();
        setCsvImportModal((prev) => {
          const added = { ...(prev.addedRowIndexes || {}) };
          const superseded = { ...(prev.supersededRowIndexes || {}) };
          if (importGroup?.mode === 'import_batches' && Array.isArray(importGroup.rowIndexes)) {
            importGroup.rowIndexes.forEach((i) => {
              added[String(i)] = true;
            });
          } else if (importGroup?.mode === 'merge' && Array.isArray(importGroup.rowIndexes)) {
            importGroup.rowIndexes.forEach((i) => {
              added[String(i)] = true;
            });
          } else if (importGroup?.mode === 'pick_one' && Array.isArray(importGroup.rowIndexes)) {
            added[String(savedRowIndex)] = true;
            importGroup.rowIndexes.forEach((i) => {
              if (i !== savedRowIndex) superseded[String(i)] = importGroup.groupKey || true;
            });
          } else if (savedRowIndex != null) {
            added[String(savedRowIndex)] = true;
          }
          return { ...prev, open: true, addedRowIndexes: added, supersededRowIndexes: superseded };
        });
        const mergeMsg = importGroup?.mode === 'import_batches'
          ? 'Item updated and warehouse batches imported. All rows in that group are marked done.'
          : importGroup?.mode === 'merge'
          ? (wasUpdateImport
            ? 'Item updated from merged duplicate rows. All rows in that group are marked done.'
            : 'Merged item saved. All rows in that duplicate group are marked added.')
          : importGroup?.mode === 'pick_one'
            ? (wasUpdateImport
              ? 'Item updated. Other rows in that duplicate group were marked skipped.'
              : 'Item saved. Other rows in that duplicate group were marked skipped.')
            : (wasUpdateImport
              ? 'Item updated. Import list is still open — pick the next row.'
              : 'Item saved. Import list is still open — pick the next row.');
        message.success(mergeMsg);
      } else if (isEditing) {
        setModalVisible(false);
        setItemFormOpenedFromImport(false);
        activeImportRowIndexRef.current = null;
        setEditingItem(null);
        setVariantMatrixEdits([]);
        setSelectedSkuRuleId(null);
        setLastAppliedSkuRule(null);
        form.resetFields();
      } else if (itemFormOpenedFromImport && activeImportRowIndexRef.current != null) {
        const savedRowIndex = activeImportRowIndexRef.current;
        const importGroup = activeImportGroupRef.current;
        closeItemFormReturnToImport();
        setCsvImportModal((prev) => {
          const added = { ...(prev.addedRowIndexes || {}) };
          const superseded = { ...(prev.supersededRowIndexes || {}) };
          if (importGroup?.mode === 'import_batches' && Array.isArray(importGroup.rowIndexes)) {
            importGroup.rowIndexes.forEach((i) => {
              added[String(i)] = true;
            });
          } else if (importGroup?.mode === 'merge' && Array.isArray(importGroup.rowIndexes)) {
            importGroup.rowIndexes.forEach((i) => {
              added[String(i)] = true;
            });
          } else if (importGroup?.mode === 'pick_one' && Array.isArray(importGroup.rowIndexes)) {
            added[String(savedRowIndex)] = true;
            importGroup.rowIndexes.forEach((i) => {
              if (i !== savedRowIndex) superseded[String(i)] = importGroup.groupKey || true;
            });
          } else if (savedRowIndex != null) {
            added[String(savedRowIndex)] = true;
          }
          return { ...prev, open: true, addedRowIndexes: added, supersededRowIndexes: superseded };
        });
        const mergeMsg = importGroup?.mode === 'import_batches'
          ? 'Item created with warehouse batches. All rows in that group are marked added.'
          : importGroup?.mode === 'merge'
          ? 'Merged item saved. All rows in that duplicate group are marked added.'
          : importGroup?.mode === 'pick_one'
            ? 'Item saved. Other rows in that duplicate group were marked skipped.'
            : 'Item saved. Import list is still open — pick the next row.';
        message.success(mergeMsg);
      } else {
        // Keep form open for rapid multi-item entry (not from CSV import).
        setImageUrl('');
        setImageFile(null);
        setDuplicateBanner(null);
        setDuplicateSourcePayload(null);
        setExistingCustomFields({});
        setVariantMatrixEdits([]);
        setCompositeComponents([]);
        setKitFulfillmentMode('prebuilt');
        setSelectedSkuRuleId(null);
        setLastAppliedSkuRule(null);
        form.resetFields();
        form.setFieldsValue({
          type: itemTypes.find(t => t.name === 'simple')?.name || itemTypes[0]?.name || 'simple',
          itemGroupId: null,
          purchaseAccount: 'cogs',
          purchaseTaxRate: 0,
          purchaseDescription: 'Initial stock entry'
        });
      }
      fetchItems();
    } catch (error) {
      console.error('Submit error:', error);
      const rawError =
        error?.response?.data?.error ||
        error?.message ||
        '';
      const normalizedError = String(rawError).toLowerCase();

      let userMessage = rawError || `Failed to ${editingItem ? 'update' : 'create'} item`;

      if (normalizedError.includes('duplicate') || normalizedError.includes('already exists')) {
        userMessage = rawError || 'Duplicate item found. Please use a unique SKU.';
      } else if (normalizedError.includes('er_dup_entry') || normalizedError.includes('unique_tenant_sku')) {
        userMessage = 'Item with this SKU already exists. Please enter a unique SKU.';
      }

      message.error(userMessage);
    }
  };

  const handlePriceCurrencyChange = (nextCurrency) => {
    const currentCurrency = priceCurrency;
    if (!nextCurrency || nextCurrency === currentCurrency) return;

    const currentValues = form.getFieldsValue([
      'costPrice',
      'sellingPrice',
      'mrp',
      'openingValue',
      'openingStock'
    ]);

    const converted = {
      costPrice: currentValues.costPrice != null ? convertPrice(currentValues.costPrice, currentCurrency, nextCurrency) : currentValues.costPrice,
      sellingPrice: currentValues.sellingPrice != null ? convertPrice(currentValues.sellingPrice, currentCurrency, nextCurrency) : currentValues.sellingPrice,
      mrp: currentValues.mrp != null ? convertPrice(currentValues.mrp, currentCurrency, nextCurrency) : currentValues.mrp,
      openingValue: currentValues.openingValue != null ? convertPrice(currentValues.openingValue, currentCurrency, nextCurrency) : currentValues.openingValue,
    };

    // Prefer recomputing opening value from stock x cost after conversion.
    if (currentValues.openingStock > 0 && converted.costPrice > 0) {
      converted.openingValue = Math.round((currentValues.openingStock * converted.costPrice) * 100) / 100;
    }

    form.setFieldsValue(converted);
    setPriceCurrency(nextCurrency);
  };

  const toggleItemStatus = async (item) => {
    try {
      const newStatus = item.status === 'active' ? 'inactive' : 'active';
      const response = await apiService.put(`/items/${item.id}`, { status: newStatus });
      if (response.success) {
        message.success(`Item ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
        fetchItems();
      }
    } catch (error) {
      message.error('Failed to update item status');
    }
  };

const viewItem = async (item) => {
    setViewModalVisible(true);
    setLoadingHistory(true);
    try {
      const [itemRes, historyRes, priceHistRes, batchesRes] = await Promise.allSettled([
        apiService.get(`/items/${item.id}`),
        apiService.get(`/inventory/item-logs/${item.id}`),
        apiService.get(`/items/${item.id}/price-history`),
        apiService.getBatches({ itemId: item.id }),
      ]);
      setViewingItem(itemRes.status === 'fulfilled' && itemRes.value.success ? itemRes.value.data : item);
      setItemHistory(historyRes.status === 'fulfilled' && historyRes.value.success ? historyRes.value.data || [] : []);
      setPriceHistory(priceHistRes.status === 'fulfilled' && priceHistRes.value.success ? priceHistRes.value.data || [] : []);
      setViewingItemBatches(batchesRes.status === 'fulfilled' ? (batchesRes.value?.data || []) : []);
    } catch (error) {
      console.error('Failed to fetch item details:', error);
      setViewingItem(item);
      setItemHistory([]);
      setPriceHistory([]);
      setViewingItemBatches([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchBinsForWarehouse = async (warehouseId) => {
    if (!warehouseId) { setBinsForWarehouse([]); return; }
    setBinsLoading(true);
    try {
      const res = await apiService.get('/warehouse-locations/bins', {
        params: { warehouseId, status: 'all', limit: 1000 }
      });
      const bins = res.success ? (res.data || []) : [];

      // Fallback: some setups return sparse results on /bins filters; hierarchy is authoritative.
      if (bins.length === 0) {
        const hierarchyRes = await apiService.get(`/warehouse-locations/warehouses/${warehouseId}/hierarchy`);
        const hierarchyBins = hierarchyRes.success
          ? (hierarchyRes.data || []).flatMap(z => (z.racks || []).flatMap(r => r.bins || []))
          : [];
        setBinsForWarehouse(hierarchyBins);
        if (hierarchyBins.length === 0) {
          message.info('No bins found for selected warehouse. Please create bins in Warehouse Locations.');
        }
      } else {
        setBinsForWarehouse(bins);
      }
    } catch (error) {
      setBinsForWarehouse([]);
      message.error(error?.response?.data?.error || 'Failed to load bins for selected warehouse');
    } finally {
      setBinsLoading(false);
    }
  };

  const editItem = async (item) => {
    setEditingItem(item);
    setEditingWarehouseSummaries([]);
    setDuplicateSourcePayload(null);
    variantBuilderSeededRef.current = false;
    setPriceCurrency(currency);
    setImageUrl(item.image || '');
    setLastAppliedSkuRule(null);
    setSelectedSkuRuleId(null);
    
    await fetchDropdownOptions();
    await loadSkuRules();
    
    let fullItem = item;
    let warehouseSummaries = [];
    const [itemResponse, warehouseSummaryResponse] = await Promise.allSettled([
      apiService.get(`/items/${item.id}`),
      fetchItemWarehouseSummaries(item.id)
    ]);
    if (itemResponse.status === 'fulfilled' && itemResponse.value.success) {
      fullItem = itemResponse.value.data;
    } else if (itemResponse.status === 'rejected') {
      console.error('Failed to fetch full item details:', itemResponse.reason);
    }
    if (warehouseSummaryResponse.status === 'fulfilled' && Array.isArray(warehouseSummaryResponse.value)) {
      warehouseSummaries = warehouseSummaryResponse.value;
    }
    setExistingCustomFields(fullItem?.custom_fields || {});
    setVariantMatrixEdits(
      Array.isArray(fullItem?.variant_rows) && fullItem.variant_rows.length > 0
        ? normalizeVariantRowsForEdit(fullItem.variant_rows)
        : (Array.isArray(fullItem?.custom_fields?.variantMatrix) ? fullItem.custom_fields.variantMatrix : [])
    );
    setCompositeComponents(normalizeCompositeComponents(fullItem?.composite_components || []));
    setKitFulfillmentMode(fullItem?.kit_fulfillment_mode || fullItem?.kitFulfillmentMode || 'prebuilt');

    // Get warehouse from item's inventory projections first.
    // If the item has no stock projection yet, fall back to the warehouse owning
    // the saved default bin so the edit form still pre-fills correctly.
    let finalWarehouseId = null;
    if (fullItem.warehouse_ids?.length > 0) {
      finalWarehouseId = fullItem.warehouse_ids[0] || null;
    } else if (fullItem.default_bin_id) {
      try {
        const binResponse = await apiService.get(`/warehouse-locations/bins/${fullItem.default_bin_id}`);
        if (binResponse.success) {
          finalWarehouseId = binResponse.data?.warehouse_id || null;
        }
      } catch { /* no warehouse found from default bin */ }
    } else if (warehouseSummaries.length > 0) {
      const best = warehouseSummaries.reduce((currentBest, row) => (
        Number(row?.current_stock?.quantity_available || 0) > Number(currentBest?.current_stock?.quantity_available || 0)
          ? row
          : currentBest
      ), warehouseSummaries[0]);
      finalWarehouseId = best?.warehouse_id || null;
    } else {
      try {
        const invResponse = await apiService.get('/inventory');
        if (invResponse.success && invResponse.data?.length > 0) {
          const itemStocks = invResponse.data.filter(inv => inv.item_id === fullItem.id);
          if (itemStocks.length > 0) {
            const best = itemStocks.reduce((a, b) =>
              (Number(b.quantity_available) || 0) > (Number(a.quantity_available) || 0) ? b : a
            );
            finalWarehouseId = best.warehouse_id || null;
          }
        }
      } catch { /* no warehouse found */ }
    }
    
    // brand/manufacturer/unit come back as names from the API JOIN — map back to IDs for the selects
    const brandId = brandOptions.find(b => b.name === fullItem.brand)?.id ?? fullItem.brand;
    const manufacturerId = manufacturerOptions.find(m => m.name === fullItem.manufacturer)?.id ?? fullItem.manufacturer;
    const unitId = unitOptions.find(u => u.name === fullItem.unit)?.id ?? fullItem.unit;

    let batchManufactureDate;
    let batchExpiryDate;
    const masterBatchNumber = normalizeOptionalText(fullItem.batch_number)?.toUpperCase();
    if (masterBatchNumber && fullItem.id) {
      try {
        const batchRes = await apiService.getBatches({ itemId: fullItem.id });
        const itemBatches = batchRes?.data || [];
        const matchedBatch = itemBatches.find(
          (b) => b.batch_number?.toUpperCase() === masterBatchNumber
            && (!finalWarehouseId || b.warehouse_id === finalWarehouseId)
        ) || itemBatches.find((b) => b.batch_number?.toUpperCase() === masterBatchNumber);
        if (matchedBatch) {
          batchManufactureDate = matchedBatch.manufacture_date ? dayjs(matchedBatch.manufacture_date) : undefined;
          batchExpiryDate = matchedBatch.expiry_date ? dayjs(matchedBatch.expiry_date) : undefined;
        }
      } catch {
        /* warehouse batch dates optional on edit */
      }
    }

    form.setFieldsValue({
      sku: fullItem.sku,
      name: fullItem.name,
      description: normalizeOptionalText(fullItem.description),
      type: fullItem.type,
      trackInventory: deriveTrackInventoryValue(fullItem, finalWarehouseId),
      category: normalizeOptionalText(fullItem.category),
      unit: unitId,
      costPrice: convertPrice(fullItem.cost_price, 'USD', currency),
      sellingPrice: normalizeOptionalNumber(convertPrice(fullItem.selling_price, 'USD', currency), { allowZero: false }),
      mrp: normalizeOptionalNumber(convertPrice(fullItem.mrp, 'USD', currency), { allowZero: false }),
      taxRate: normalizeTaxRateForForm(fullItem.tax_rate),
      brand: brandId,
      manufacturer: manufacturerId,
      minStockLevel: normalizeOptionalNumber(fullItem.min_stock_level),
      maxStockLevel: normalizeOptionalNumber(fullItem.max_stock_level),
      barcode: normalizeOptionalText(fullItem.barcode),
      batchNumber: masterBatchNumber,
      batchManufactureDate,
      batchExpiryDate,
      hsnCode: normalizeOptionalText(fullItem.hsn_code),
      itemGroupId: fullItem.item_group_id || null,
      colorCode: formScalarMeta(fullItem?.custom_fields?.skuMeta?.color),
      sizeCode: formScalarMeta(fullItem?.custom_fields?.skuMeta?.size),
      packType: formScalarMeta(fullItem?.custom_fields?.skuMeta?.packType),
      variantAttributes: expandVariantAttributesForForm(fullItem?.custom_fields?.variantAttributes),
      openingStock: normalizeOptionalNumber(fullItem.opening_stock),
      openingValue: normalizeOptionalNumber(fullItem.opening_value, { allowZero: false }),
      valuationMethod: fullItem.valuation_method,
      warehouseId: finalWarehouseId,
      defaultBinId: fullItem.default_bin_id || null,
      weight: normalizeOptionalNumber(fullItem.weight, { allowZero: false }),
      length: normalizeOptionalNumber(fullItem.dimensions?.length, { allowZero: false }),
      width: normalizeOptionalNumber(fullItem.dimensions?.width, { allowZero: false }),
      height: normalizeOptionalNumber(fullItem.dimensions?.height, { allowZero: false }),
      upc: normalizeOptionalText(fullItem.upc),
      ean: normalizeOptionalText(fullItem.ean),
      isbn: normalizeOptionalText(fullItem.isbn),
      mpn: normalizeOptionalText(fullItem.mpn)
    });
    fetchBinsForWarehouse(finalWarehouseId);
    setModalVisible(true);
  };

  const openPossibleDuplicateForEdit = async (item) => {
    if (!item) return;
    setDuplicateBanner(null);
    setDuplicateSourcePayload(null);
    setDraftBanner(null);
    setActiveDraftId(null);
    await editItem(item);
    message.info(`Opened "${item.name}" in edit mode.`);
  };

  const handleBarcodeScan = async (barcode) => {
    setScannerOpen(false);
    // Fill EAN field first
    form.setFieldsValue({ ean: barcode });
    // Then trigger Open Food Facts lookup
    setBarcodeLoading(true);
    try {
      const product = await lookupProductByBarcode(barcode);
      if (!product) {
        message.warning('Product not found in Open Food Facts database.');
        return;
      }
      const updates = { ean: barcode };
      if (product.name) updates.name = product.name;
      if (product.brand) {
        const matchedBrand = brandOptions.find(b => b.name?.toLowerCase() === product.brand?.toLowerCase());
        if (matchedBrand) updates.brand = matchedBrand.id;
      }
      if (product.category) updates.category = product.category;
      if (product.weight) updates.weight = product.weight;
      if (product.manufacturer) {
        const matchedMfr = manufacturerOptions.find(m => m.name?.toLowerCase() === product.manufacturer?.toLowerCase());
        if (matchedMfr) updates.manufacturer = matchedMfr.id;
      }
      if (product.image) setImageUrl(product.image);
      form.setFieldsValue(updates);
      message.success(`Product found: ${product.name || 'details auto-filled'}!`);
    } catch (err) {
      message.error(err.message || 'Barcode lookup failed.');
    } finally {
      setBarcodeLoading(false);
    }
  };

  const normalizeTaxRateForForm = (value) => {
    if (value == null || value === '') return undefined;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return undefined;
    return numeric === 0 ? undefined : numeric;
  };

  const normalizeOptionalNumber = (value, { allowZero = true } = {}) => {
    if (value == null || value === '') return undefined;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return undefined;
    if (!allowZero && numeric === 0) return undefined;
    return numeric;
  };

  const expandVariantAttributesForForm = (attrs) => {
    if (!Array.isArray(attrs)) return [];
    return attrs.flatMap((a) => {
      const name = normalizeOptionalText(a?.name);
      let vals = [];
      if (Array.isArray(a?.values)) {
        vals = a.values.map((v) => normalizeOptionalText(v)).filter(Boolean);
      } else {
        const one = normalizeOptionalText(a?.values);
        if (one) vals = [one];
      }
      if (!name || !vals.length) return [];
      return [{ name, values: vals }];
    });
  };

  const normalizeVariantAttributes = (rows = []) => {
    if (!Array.isArray(rows)) return [];
    const byName = new Map();
    for (const row of rows) {
      const name = normalizeOptionalText(row?.name);
      if (!name) continue;
      let rowVals = [];
      if (Array.isArray(row?.values)) {
        rowVals = row.values.map((v) => normalizeOptionalText(v)).filter(Boolean);
      } else {
        const one = normalizeOptionalText(row?.values);
        if (one) rowVals = [one];
      }
      if (!rowVals.length) continue;
      const prev = byName.get(name) || [];
      byName.set(name, Array.from(new Set([...prev, ...rowVals])));
    }
    return Array.from(byName.entries()).map(([name, values]) => ({ name, values }));
  };

  const normalizeVariantMatrixRows = (rows = []) => {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => ({
      id: normalizeOptionalText(row?.id),
      key: String(row?.key || ''),
      combinationLabel: String(row?.combinationLabel || ''),
      attributes: row?.attributes && typeof row.attributes === 'object' ? row.attributes : {},
      sku: normalizeOptionalText(row?.sku),
      barcode: normalizeOptionalText(row?.barcode),
      costPrice: normalizeOptionalNumber(row?.costPrice),
      sellingPrice: normalizeOptionalNumber(row?.sellingPrice),
      openingStock: normalizeOptionalNumber(row?.openingStock),
      warehouseId: normalizeOptionalText(row?.warehouseId),
      active: row?.active !== false
    })).filter((row) => row.key && row.combinationLabel);
  };

  const toTitleText = (value) => String(value || '')
    .split(' ')
    .map((part) => {
      const trimmed = String(part || '').trim();
      return trimmed ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}` : '';
    })
    .filter(Boolean)
    .join(' ');

  const getVariantAttributeTokens = (row = {}) => {
    const attrs = row?.attributes && typeof row.attributes === 'object' ? row.attributes : {};
    const entries = Object.entries(attrs)
      .filter(([key, value]) => key && key !== '_imsKey' && String(value || '').trim());

    if (entries.length > 0) {
      return entries.map(([key, value]) => ({
        label: toTitleText(key),
        value: String(value).trim()
      }));
    }

    const label = String(row?.combinationLabel || row?.variant_name || '').trim();
    if (!label) return [];

    return label
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => {
        const [left, ...rest] = segment.split(':');
        if (rest.length === 0) return { label: 'Variant', value: left.trim() };
        return {
          label: toTitleText(left),
          value: rest.join(':').trim()
        };
      });
  };

  const buildVariantMatrixKeyFromAttributes = (attributes = {}) => {
    if (!attributes || typeof attributes !== 'object') return '';
    const entries = Object.entries(attributes)
      .filter(([k, v]) => String(k || '').trim() && String(k || '').trim() !== '_imsKey' && String(v || '').trim())
      .sort(([a], [b]) => String(a).localeCompare(String(b)));
    if (!entries.length) return '';
    return entries.map(([k, v]) => `${k}:${v}`).join('|');
  };

  const normalizeVariantRowsForEdit = (rows = []) => {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => {
        const attrs = row?.attributes && typeof row.attributes === 'object' ? row.attributes : {};
        const keyFromAttrs = buildVariantMatrixKeyFromAttributes(attrs);
        const key = String(attrs?._imsKey || keyFromAttrs || row?.key || row?.id || '').trim();
        return {
          ...row,
          id: row?.id || null,
          key
        };
      })
      .filter((row) => row.key);
  };

  const normalizeCompositeComponents = (rows = []) => {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => ({
        itemId: String(row?.itemId || row?.component_item_id || '').trim(),
        quantityRequired: Number(row?.quantityRequired ?? row?.quantity_required),
        consumptionTiming: String(row?.consumptionTiming || row?.consumption_timing || 'shipment').toLowerCase()
      }))
      .filter((row) => row.itemId && Number.isFinite(row.quantityRequired) && row.quantityRequired > 0)
      .map((row) => ({
        ...row,
        consumptionTiming: ['order', 'shipment'].includes(row.consumptionTiming) ? row.consumptionTiming : 'shipment'
      }));
  };

  const cartesianVariantRows = (rows = []) => {
    const normalized = normalizeVariantAttributes(rows);
    if (normalized.length === 0) return [];

    const recurse = (idx, acc, labels) => {
      if (idx >= normalized.length) {
        const key = Object.entries(acc).map(([k, v]) => `${k}:${v}`).join('|');
        return [{ key, attributes: { ...acc }, combinationLabel: labels.join(' / ') }];
      }
      const current = normalized[idx];
      return current.values.flatMap((value) =>
        recurse(
          idx + 1,
          { ...acc, [current.name]: value },
          [...labels, `${String(current.name || '').trim()}: ${String(value)}`]
        )
      );
    };

    return recurse(0, {}, []);
  };

  const watchedVariantAttributes = Form.useWatch('variantAttributes', form);
  const watchedItemType = Form.useWatch('type', form);
  const watchedItemGroupId = Form.useWatch('itemGroupId', form);
  const watchedSku = Form.useWatch('sku', form);
  const watchedName = Form.useWatch('name', form);
  const watchedBarcode = Form.useWatch('barcode', form);
  const watchedBatchNumber = Form.useWatch('batchNumber', form);
  const watchedVariant = Form.useWatch('variant', form);
  const watchedColor = Form.useWatch('colorCode', form);
  const watchedSize = Form.useWatch('sizeCode', form);
  const watchedPackType = Form.useWatch('packType', form);
  const watchedTrackInventory = Form.useWatch('trackInventory', form) === true;
  const isVariantItem = watchedItemType === 'variant';

  const possibleDuplicateItems = useMemo(() => {
    if (!modalVisible || editingItem) return [];

    const skuKey = normalizeDuplicateLookup(watchedSku);
    const nameKey = normalizeDuplicateLookup(watchedName);
    const barcodeKey = normalizeDuplicateLookup(watchedBarcode);
    const batchKey = normalizeDuplicateLookup(watchedBatchNumber);

    if (!skuKey && !nameKey && !barcodeKey && !batchKey) return [];

    return (items || [])
      .map((item) => {
        if (!item?.id) return null;

        const reasons = [];
        if (skuKey && normalizeDuplicateLookup(item.sku) === skuKey) reasons.push('Same SKU');
        if (nameKey && normalizeDuplicateLookup(item.name) === nameKey) reasons.push('Same name');
        if (barcodeKey && normalizeDuplicateLookup(item.barcode) === barcodeKey) reasons.push('Same barcode');
        if (batchKey && normalizeDuplicateLookup(item.batch_number) === batchKey) reasons.push('Same batch number');
        if (reasons.length === 0) return null;

        return {
          ...item,
          duplicateReasons: reasons,
          duplicateScore: reasons.length
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        if (right.duplicateScore !== left.duplicateScore) return right.duplicateScore - left.duplicateScore;
        if ((left.status === 'active') !== (right.status === 'active')) return left.status === 'active' ? -1 : 1;
        return String(left.name || '').localeCompare(String(right.name || ''), undefined, { sensitivity: 'base', numeric: true });
      })
      .slice(0, 5);
  }, [modalVisible, editingItem, items, watchedSku, watchedName, watchedBarcode, watchedBatchNumber]);

  const selectableItemGroups = useMemo(() => (
    (itemGroups || [])
      .filter((group) => group?.is_active || group?.id === watchedItemGroupId)
      .sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || '')))
  ), [itemGroups, watchedItemGroupId]);

  useEffect(() => {
    if (watchedItemType !== 'composite' && compositeComponents.length > 0) {
      setCompositeComponents([]);
    }
  }, [watchedItemType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!modalVisible) {
      variantBuilderSeededRef.current = false;
      return;
    }
    if (watchedItemType !== 'variant') {
      variantBuilderSeededRef.current = false;
      return;
    }
    const currentRows = normalizeVariantAttributes(form.getFieldValue('variantAttributes'));
    if (currentRows.length > 0) {
      variantBuilderSeededRef.current = true;
      return;
    }
    if (variantBuilderSeededRef.current) return;

    const seedRows = buildVariantAttributeSeedRows({
      variant: form.getFieldValue('variant'),
      colorCode: form.getFieldValue('colorCode'),
      sizeCode: form.getFieldValue('sizeCode'),
      packType: form.getFieldValue('packType')
    });

    if (seedRows.length === 0) return;

    form.setFieldsValue({ variantAttributes: seedRows });
    variantBuilderSeededRef.current = true;
  }, [modalVisible, watchedItemType, watchedVariant, watchedColor, watchedSize, watchedPackType]); // eslint-disable-line react-hooks/exhaustive-deps

  const variantMatrixRows = useMemo(() => {
    if (watchedItemType !== 'variant') return [];
    let sourceAttributes = normalizeVariantAttributes(watchedVariantAttributes);
    if (sourceAttributes.length === 0) {
      const fallback = [];
      const variantVals = normalizeOptionalTextArray(watchedVariant);
      const colorVals = normalizeOptionalTextArray(watchedColor);
      const sizeVals = normalizeOptionalTextArray(watchedSize);
      const packVals = normalizeOptionalTextArray(watchedPackType);
      if (variantVals.length) fallback.push({ name: 'Variant', values: variantVals });
      if (colorVals.length) fallback.push({ name: 'Colour', values: colorVals });
      if (sizeVals.length) fallback.push({ name: 'Size', values: sizeVals });
      if (packVals.length) fallback.push({ name: 'Pack Type', values: packVals });
      sourceAttributes = fallback;
    }

    const combos = cartesianVariantRows(sourceAttributes);
    if (combos.length === 0) return [];

    return combos.map((combo) => {
      const edited = variantMatrixEdits.find((r) => r.key === combo.key) || {};
      return {
        ...combo,
        id: edited.id || null,
        sku: edited.sku,
        barcode: edited.barcode,
        costPrice: edited.costPrice,
        sellingPrice: edited.sellingPrice,
        openingStock: edited.openingStock,
        warehouseId: edited.warehouseId,
        active: edited.active !== false
      };
    });
  }, [watchedItemType, watchedVariantAttributes, watchedVariant, watchedColor, watchedSize, watchedPackType, variantMatrixEdits]);

  const updateVariantMatrixRow = (key, patch) => {
    setVariantMatrixEdits((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      if (idx === -1) return [...prev, { key, ...patch }];
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const updateAllVariantMatrixRows = (patchOrFactory) => {
    if (!variantMatrixRows.length) return false;
    setVariantMatrixEdits((prev) => {
      const byKey = new Map(prev.map((row) => [row.key, { ...row }]));
      variantMatrixRows.forEach((row) => {
        const patch = typeof patchOrFactory === 'function' ? patchOrFactory(row) : patchOrFactory;
        if (!patch || Object.keys(patch).length === 0) return;
        byKey.set(row.key, { ...(byKey.get(row.key) || { key: row.key }), ...patch });
      });
      return Array.from(byKey.values());
    });
    return true;
  };

  const copyVariantFieldFromFirstRow = (field, label, options = {}) => {
    const firstRow = variantMatrixRows[0];
    if (!firstRow) {
      message.warning('Add at least one variant row first.');
      return;
    }

    const value = firstRow[field];
    if (!options.allowBlank && isBlankVariantMatrixValue(value)) {
      message.warning(`Enter ${label} in the first row first.`);
      return;
    }

    if (updateAllVariantMatrixRows({ [field]: value })) {
      message.success(`${label} copied to all variants.`);
    }
  };

  const handleGenerateAllVariantSkus = async () => {
    if (!variantMatrixRows.length) {
      message.warning('Add at least one variant row first.');
      return;
    }

    setSkuGenerating(true);
    try {
      const selectedRule = selectedSkuRuleId
        ? skuRules.find((r) => r.id === selectedSkuRuleId) || null
        : null;
      const generatedRows = [];
      let appliedRuleMeta = null;

      for (const row of variantMatrixRows) {
        const ctx = buildSkuGenerationContext(row);
        if (!ensureSkuRuleRequirements(selectedRule, ctx, 'Generate all SKUs')) return;

        const generated = await skuGeneratorService.generateSku(ctx);
        const sku = generated?.sku || '';
        if (sku) {
          generatedRows.push({ key: row.key, sku });
        }

        if (!appliedRuleMeta && generated?.ruleId) {
          const appliedRule = skuRules.find((rule) => rule.id === generated.ruleId);
          if (appliedRule) {
            appliedRuleMeta = {
              id: appliedRule.id,
              name: appliedRule.name,
              scope: appliedRule.scope,
              scopeValue: appliedRule.scope_value
            };
          }
        }
      }

      if (!generatedRows.length) {
        message.warning('No SKUs were generated for the current variants.');
        return;
      }

      setVariantMatrixEdits((prev) => {
        const byKey = new Map(prev.map((row) => [row.key, { ...row }]));
        generatedRows.forEach((row) => {
          byKey.set(row.key, { ...(byKey.get(row.key) || { key: row.key }), sku: row.sku });
        });
        return Array.from(byKey.values());
      });

      if (appliedRuleMeta) {
        setLastAppliedSkuRule(appliedRuleMeta);
      }
      message.success(`Generated SKUs for ${generatedRows.length} variants.`);
    } catch (e) {
      showSkuGenerationError(e);
    } finally {
      setSkuGenerating(false);
    }
  };

  const variantLibraryNames = (variantLibrary || []).map((r) => r.name).filter(Boolean);
  const getVariantLibraryValues = (attributeName) => {
    const key = String(attributeName || '').trim().toLowerCase();
    if (!key) return [];
    const row = (variantLibrary || []).find((r) => String(r?.name || '').trim().toLowerCase() === key);
    return Array.isArray(row?.values) ? row.values : [];
  };
  const getVariantLibraryValuesByAliases = (aliases = []) => {
    const aliasSet = new Set((aliases || []).map((a) => String(a || '').trim().toLowerCase()).filter(Boolean));
    const merged = [];
    (variantLibrary || []).forEach((row) => {
      const name = String(row?.name || '').trim().toLowerCase();
      if (!aliasSet.has(name)) return;
      if (Array.isArray(row?.values)) merged.push(...row.values);
    });
    return Array.from(new Set(merged.map((v) => String(v || '').trim()).filter(Boolean)));
  };
  const findVariantLibraryNameByAliasesAndValue = (aliases = [], value = '') => {
    const aliasSet = new Set((aliases || []).map((a) => String(a || '').trim().toLowerCase()).filter(Boolean));
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) return null;
    const row = (variantLibrary || []).find((r) => {
      const nameMatch = aliasSet.has(String(r?.name || '').trim().toLowerCase());
      const valueMatch = Array.isArray(r?.values) && r.values.some((v) => String(v || '').trim() === normalizedValue);
      return nameMatch && valueMatch;
    });
    return row?.name || null;
  };

  const addVariantMetaValue = async (attributeName, aliases, fieldName) => {
    const raw = prompt(`Add ${attributeName} value:`);
    const value = String(raw || '').trim();
    if (!value) return;
    try {
      await apiService.put('/items/variant-library/entry', { name: aliases[0], values: [value] });
      await fetchDropdownOptions();
      form.setFieldsValue({ [fieldName]: value });
      message.success(`${attributeName} added`);
    } catch (e) {
      message.error(e?.response?.data?.error || `Failed to add ${attributeName}`);
    }
  };

  const deleteVariantMetaSpecificValue = async (attributeName, aliases, value, fieldName) => {
    const sourceName = findVariantLibraryNameByAliasesAndValue(aliases, value) || aliases[0];
    if (!window.confirm(`Delete ${attributeName} value "${value}"?`)) return;
    try {
      await apiService.delete('/items/variant-library/entry', { params: { name: sourceName, value } });
      await fetchDropdownOptions();
      const current = formScalarMeta(form.getFieldValue(fieldName));
      if (current && current === String(value || '').trim()) {
        form.setFieldsValue({ [fieldName]: undefined });
      }
      message.success(`${attributeName} deleted`);
    } catch (e) {
      message.error(e?.response?.data?.error || `Failed to delete ${attributeName}`);
    }
  };

  const saveVariantSetupForFuture = async () => {
    const rows = normalizeVariantAttributes(form.getFieldValue('variantAttributes'));
    if (!rows.length) {
      message.warning('Add variant attributes first to save for future use.');
      return;
    }
    try {
      await apiService.post('/items/variant-library', { rows });
      await fetchDropdownOptions();
      message.success('Variant setup saved for future use.');
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to save variant setup');
    }
  };

  const duplicateItem = async (item) => {
    setEditingItem(null);
    setEditingWarehouseSummaries([]);
    setDuplicateSourcePayload(null);
    variantBuilderSeededRef.current = false;
    setPriceCurrency(currency);
    setImageUrl(item.image || '');
    setImageFile(null);
    setDraftBanner(null);
    setDuplicateBanner({ sourceName: item.name });
    setLastAppliedSkuRule(null);
    setSelectedSkuRuleId(null);
    form.resetFields();
    await fetchDropdownOptions();
    await loadSkuRules();

    let fullItem = item;
    try {
      const res = await apiService.get(`/items/${item.id}`);
      if (res.success) fullItem = res.data;
    } catch {}
    setExistingCustomFields(fullItem?.custom_fields || {});
    setVariantMatrixEdits(
      Array.isArray(fullItem?.variant_rows) && fullItem.variant_rows.length > 0
        ? normalizeVariantRowsForEdit(fullItem.variant_rows)
        : (Array.isArray(fullItem?.custom_fields?.variantMatrix) ? fullItem.custom_fields.variantMatrix : [])
    );
    setCompositeComponents(normalizeCompositeComponents(fullItem?.composite_components || []));
    setKitFulfillmentMode(fullItem?.kit_fulfillment_mode || fullItem?.kitFulfillmentMode || 'prebuilt');

    let finalWarehouseId = null;
    if (fullItem.warehouse_ids?.length > 0) {
      finalWarehouseId = fullItem.warehouse_ids[0] || null;
    } else if (fullItem.default_bin_id) {
      try {
        const binResponse = await apiService.get(`/warehouse-locations/bins/${fullItem.default_bin_id}`);
        if (binResponse.success) {
          finalWarehouseId = binResponse.data?.warehouse_id || null;
        }
      } catch { /* no warehouse found from default bin */ }
    } else {
      try {
        const invResponse = await apiService.get('/inventory');
        if (invResponse.success && invResponse.data?.length > 0) {
          const itemStocks = invResponse.data.filter(inv => inv.item_id === fullItem.id);
          if (itemStocks.length > 0) {
            const best = itemStocks.reduce((a, b) =>
              (Number(b.quantity_available) || 0) > (Number(a.quantity_available) || 0) ? b : a
            );
            finalWarehouseId = best.warehouse_id || null;
          }
        }
      } catch { /* no warehouse found */ }
    }

    const duplicateFormValues = {
      sku: normalizeOptionalText(fullItem.sku),
      name: normalizeOptionalText(fullItem.name),
      description: normalizeOptionalText(fullItem.description),
      type: fullItem.type,
      trackInventory: deriveTrackInventoryValue(fullItem, finalWarehouseId),
      category: normalizeOptionalText(fullItem.category),
      unit: unitOptions.find(u => u.name === fullItem.unit)?.id ?? fullItem.unit,
      costPrice: convertPrice(fullItem.cost_price, 'USD', currency),
      sellingPrice: normalizeOptionalNumber(convertPrice(fullItem.selling_price, 'USD', currency), { allowZero: false }),
      mrp: normalizeOptionalNumber(convertPrice(fullItem.mrp, 'USD', currency), { allowZero: false }),
      taxRate: normalizeTaxRateForForm(fullItem.tax_rate),
      brand: brandOptions.find(b => b.name === fullItem.brand)?.id ?? fullItem.brand,
      manufacturer: manufacturerOptions.find(m => m.name === fullItem.manufacturer)?.id ?? fullItem.manufacturer,
      minStockLevel: normalizeOptionalNumber(fullItem.min_stock_level),
      maxStockLevel: normalizeOptionalNumber(fullItem.max_stock_level),
      barcode: normalizeOptionalText(fullItem.barcode),
      batchNumber: normalizeOptionalText(fullItem.batch_number)?.toUpperCase(),
      hsnCode: normalizeOptionalText(fullItem.hsn_code),
      itemGroupId: fullItem.item_group_id || null,
      colorCode: formScalarMeta(fullItem?.custom_fields?.skuMeta?.color),
      sizeCode: formScalarMeta(fullItem?.custom_fields?.skuMeta?.size),
      packType: formScalarMeta(fullItem?.custom_fields?.skuMeta?.packType),
      variantAttributes: expandVariantAttributesForForm(fullItem?.custom_fields?.variantAttributes),
      openingStock: normalizeOptionalNumber(fullItem.opening_stock),
      openingValue: normalizeOptionalNumber(fullItem.opening_value, { allowZero: false }),
      valuationMethod: fullItem.valuation_method,
      warehouseId: finalWarehouseId,
      defaultBinId: fullItem.default_bin_id || null,
      weight: normalizeOptionalNumber(fullItem.weight, { allowZero: false }),
      length: normalizeOptionalNumber(fullItem.dimensions?.length, { allowZero: false }),
      width: normalizeOptionalNumber(fullItem.dimensions?.width, { allowZero: false }),
      height: normalizeOptionalNumber(fullItem.dimensions?.height, { allowZero: false }),
      upc: normalizeOptionalText(fullItem.upc),
      ean: normalizeOptionalText(fullItem.ean),
      isbn: normalizeOptionalText(fullItem.isbn),
      mpn: normalizeOptionalText(fullItem.mpn),
    };

    const duplicateComparablePayload = buildComparableItemPayload({
      sku: duplicateFormValues.sku,
      name: duplicateFormValues.name,
      description: duplicateFormValues.description,
      image: fullItem.image || '',
      type: duplicateFormValues.type,
      category: duplicateFormValues.category,
      customFields: {
        ...(fullItem?.custom_fields || {}),
        variantAttributes: normalizeVariantAttributes(duplicateFormValues.variantAttributes),
        variantMatrix: normalizeVariantMatrixRows(
          Array.isArray(fullItem?.variant_rows) && fullItem.variant_rows.length > 0
            ? normalizeVariantRowsForEdit(fullItem.variant_rows)
            : (Array.isArray(fullItem?.custom_fields?.variantMatrix) ? fullItem.custom_fields.variantMatrix : [])
        ),
        skuMeta: {
          ...((fullItem?.custom_fields || {}).skuMeta || {}),
          color: normalizeOptionalTextArray(duplicateFormValues.colorCode),
          size: normalizeOptionalTextArray(duplicateFormValues.sizeCode),
          packType: normalizeOptionalTextArray(duplicateFormValues.packType)
        }
      },
      unit: duplicateFormValues.unit,
      warehouseId: duplicateFormValues.warehouseId,
      costPrice: duplicateFormValues.costPrice != null && duplicateFormValues.costPrice !== '' ? convertPrice(duplicateFormValues.costPrice, priceCurrency, 'USD') : 0,
      sellingPrice: duplicateFormValues.sellingPrice != null && duplicateFormValues.sellingPrice !== '' ? convertPrice(duplicateFormValues.sellingPrice, priceCurrency, 'USD') : 0,
      mrp: duplicateFormValues.mrp != null && duplicateFormValues.mrp !== '' ? convertPrice(duplicateFormValues.mrp, priceCurrency, 'USD') : null,
      taxRate: duplicateFormValues.taxRate,
      brand: duplicateFormValues.brand,
      manufacturer: duplicateFormValues.manufacturer,
      itemGroupId: duplicateFormValues.itemGroupId || null,
      itemGroup: itemGroups.find((group) => group.id === duplicateFormValues.itemGroupId)?.name || fullItem.item_group_name || fullItem.item_group || null,
      minStockLevel: duplicateFormValues.minStockLevel,
      maxStockLevel: duplicateFormValues.maxStockLevel,
      barcode: duplicateFormValues.barcode,
      batchNumber: duplicateFormValues.batchNumber,
      openingStock: duplicateFormValues.openingStock || 0,
      openingValue: duplicateFormValues.openingValue || 0,
      defaultBinId: duplicateFormValues.defaultBinId || null,
      valuationMethod: duplicateFormValues.valuationMethod,
      weight: duplicateFormValues.weight,
      dimensions: (duplicateFormValues.length || duplicateFormValues.width || duplicateFormValues.height) ? {
        length: duplicateFormValues.length || 0,
        width: duplicateFormValues.width || 0,
        height: duplicateFormValues.height || 0
      } : null,
      hsnCode: duplicateFormValues.hsnCode,
      upc: duplicateFormValues.upc,
      ean: duplicateFormValues.ean,
      isbn: duplicateFormValues.isbn,
      mpn: duplicateFormValues.mpn,
      components: normalizeCompositeComponents(fullItem?.composite_components || [])
    });
    setDuplicateSourcePayload(duplicateComparablePayload);

    form.setFieldsValue(duplicateFormValues);
    fetchBinsForWarehouse(finalWarehouseId);
    setModalVisible(true);
    setTimeout(() => message.info(`Duplicated from "${item.name}" — all values copied. Change at least one field before saving.`), 300);
  };

  const openCreateModal = async () => {
    setEditingItem(null);
    setEditingWarehouseSummaries([]);
    setDuplicateSourcePayload(null);
    variantBuilderSeededRef.current = false;
    setActiveDraftId(null);
    setPriceCurrency(currency);
    setImageUrl('');
    setImageFile(null);
    form.resetFields();
    setDraftBanner(null);
    setDuplicateBanner(null);
    setLastAppliedSkuRule(null);
    setSelectedSkuRuleId(null);
    setExistingCustomFields({});
    setVariantMatrixEdits([]);
    setCompositeComponents([]);

    await fetchDropdownOptions();
    await loadSkuRules();
    form.setFieldsValue({
      type: itemTypes.find(t => t.name === 'simple')?.name || itemTypes[0]?.name || 'simple',
      trackInventory: false,
      itemGroupId: null,
      purchaseAccount: 'cogs',
      purchaseTaxRate: 0,
      purchaseDescription: 'Initial stock entry'
    });
    setModalVisible(true);
  };

  const openAddItemFromImportRow = async (rowIndex, importOptions = {}) => {
    if (!canManageItems) return;
    const {
      mapping,
      rows,
      itemType,
      fieldConfigs,
      defaultWarehouseId,
      skuSource,
      importSkuRuleId,
      importDefaults = {},
    } = csvImportModal;
    const {
      mergeRowIndexes = null,
      pickOneGroupRowIndexes = null,
      importNote = '',
      groupKey = null,
      resolveDuplicateGroup = false,
      importMode = null,
    } = importOptions;
    const isBatchImportSave = importMode === 'import_batches'
      && Array.isArray(mergeRowIndexes) && mergeRowIndexes.length > 0;
    const isMergeSave = !isBatchImportSave
      && Array.isArray(mergeRowIndexes) && mergeRowIndexes.length > 1;
    const isPickOneGroup = Array.isArray(pickOneGroupRowIndexes) && pickOneGroupRowIndexes.length > 1;
    const skuFromFile = isSkuRequiredForImport(skuSource);
    if (!mapping?.name && !importDefaults?.name) {
      message.error('Map Name to a file column, or set a default name for all rows in Default values');
      return;
    }
    if (skuFromFile && !mapping?.sku && !importDefaults?.sku) {
      message.error('Map SKU to a file column, set a default SKU for all rows, or switch to Auto-generate SKU');
      return;
    }
    if (!CSV_IMPORT_SUPPORTED_ITEM_TYPES.includes(itemType)) {
      message.error('Import supports Simple and Service item types only');
      return;
    }
    const row = rows[rowIndex];
    if (!row) {
      message.error('Row not found');
      return;
    }
    const getCell = (r, colKey) => {
      if (!colKey) return '';
      const v = r[colKey];
      if (v === undefined || v === null) return '';
      return String(v).trim();
    };
    const pick = (fieldKey) => pickImportValue(row, mapping, importDefaults, fieldKey);

    const duplicateGroups = resolveDuplicateGroup
      ? []
      : buildImportDuplicateGroups(rows, mapping, importDefaults);
    const preflight = validateImportRowBeforeOpen({
      row,
      rowIndex,
      mapping,
      fieldConfigs,
      defaultWarehouseId,
      duplicateGroups,
      skuSource,
      hasSkuRules: skuRules.length > 0,
      importDefaults,
    });
    preflight.warnings.forEach((w) => message.warning(w, 6));
    if (!preflight.ok) {
      Modal.error({
        title: 'Cannot open this row',
        content: (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {preflight.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ),
      });
      return;
    }

    const skuText = pick('sku');
    const nameText = pick('name') || skuText;
    const willAutoSku = !skuFromFile && !normalizeOptionalText(skuText);

    if (normalizeOptionalText(skuText)) {
      const skuCheck = await checkSkuAvailableForImport(skuText);
      if (!skuCheck.available) {
        message.error(skuCheck.error || `SKU "${skuText}" already exists. Change the SKU in the file or form before saving.`);
        return;
      }
    } else if (willAutoSku && skuRules.length === 0) {
      message.error('No SKU rules configured. Create a rule or map SKU from the file.');
      return;
    }

    let openingStock;
    let openingValue;
    if (isBatchImportSave) {
      const batchLines = buildImportBatchLinesFromRowIndexes(mergeRowIndexes, rows, mapping, importDefaults);
      const batchValidation = validateImportBatchLines(batchLines);
      if (!batchValidation.ok) {
        Modal.error({
          title: 'Cannot import batches',
          content: (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {batchValidation.errors.map((err) => <li key={err}>{err}</li>)}
            </ul>
          ),
        });
        return;
      }
      batchValidation.warnings.forEach((w) => message.warning(w, 6));
      openingStock = batchLines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
      openingValue = 0;
    } else if (isMergeSave) {
      const merged = buildMergedImportQuantities(mergeRowIndexes, rows, mapping, importDefaults);
      if (merged.anyInvalidStock) {
        message.warning('Some rows have invalid opening stock; valid quantities were summed.');
      }
      openingStock = merged.openingStock;
      openingValue = merged.openingValue;
    } else {
      const stockParsed = parseImportNumeric(pick('openingStock'));
      const valueParsed = parseImportNumeric(pick('openingValue'));
      if (stockParsed.invalid) {
        message.warning(`Opening stock is not a valid number; using 0.`);
      }
      if (valueParsed.invalid) {
        message.warning(`Opening value is not a valid number; it will be ignored.`);
      }
      openingStock = stockParsed.value || 0;
      openingValue = valueParsed.invalid ? 0 : (valueParsed.value || 0);
    }

    const costRaw = pick('costPrice');
    const sellRaw = pick('sellingPrice');
    const mrpRaw = pick('mrp');
    const supplierCodeStr = pick('supplierCode');

    const groupName = pick('itemGroupName');
    const brandStr = pick('brand');
    const mfrStr = pick('manufacturer');
    const unitRaw = pick('unit');
    const categoryStr = pick('category');

    const dimL = parseImportNumeric(pick('dimLength'), { emptyAsZero: false });
    const dimW = parseImportNumeric(pick('dimWidth'), { emptyAsZero: false });
    const dimH = parseImportNumeric(pick('dimHeight'), { emptyAsZero: false });

    const finalWarehouseId = openingStock > 0 ? defaultWarehouseId : undefined;

    const hidePrep = message.loading('Preparing import row...', 0);
    let itemGroupId = null;
    let brandId;
    let manufacturerId;
    let unitId;
    let resolvedCategory = normalizeOptionalText(categoryStr);
    let customFieldsObj = {};
    let customPreview = [];
    const createdForImport = [];
    let resolvedItemType = itemType;

    try {
      const customResolved = await resolveImportCustomFields({
        row,
        mapping,
        fieldConfigs,
        itemType,
        getCell,
        canManageItems,
        importDefaults,
      });
      if (customResolved.errors.length) {
        Modal.error({
          title: 'Custom field issues',
          content: (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {customResolved.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ),
        });
        return;
      }
      customFieldsObj = customResolved.customFields;
      customPreview = customResolved.preview;
      createdForImport.push(...customResolved.created);

      if (customResolved.created.length) {
        try {
          const cfgRes = await apiService.get(`/items/field-config/${itemType}`);
          const rawCfg = cfgRes?.success ? (cfgRes.data || []) : [];
          setCsvImportModal((prev) => ({
            ...prev,
            fieldConfigs: dedupeItemFieldConfigs(rawCfg),
          }));
        } catch {
          /* keep existing field config */
        }
      }

      const snapshot = await fetchDropdownOptions();
      resolvedItemType = snapshot.itemTypes.find((t) => t.name === itemType)?.name
        || snapshot.itemTypes.find((t) => t.name === 'simple')?.name
        || itemType;

      let manufacturers = snapshot.manufacturers;
      let brands = snapshot.brands;
      let units = snapshot.units;
      let groups = snapshot.itemGroups;

      if (mfrStr) {
        const mfrRes = await ensureImportDropdownOption({
          value: mfrStr,
          options: manufacturers,
          postPath: '/manufacturers',
          getPath: '/manufacturers',
          buildBody: (name) => ({ name }),
        });
        manufacturers = mfrRes.options;
        manufacturerId = mfrRes.id;
        if (mfrRes.created) createdForImport.push(`manufacturer "${mfrRes.createdLabel}"`);
      }

      if (brandStr) {
        const brandRes = await ensureImportDropdownOption({
          value: brandStr,
          options: brands,
          postPath: '/brands',
          getPath: '/brands',
          buildBody: (name) => ({ name, manufacturer_id: manufacturerId || null }),
        });
        brands = brandRes.options;
        brandId = brandRes.id;
        if (brandRes.created) createdForImport.push(`brand "${brandRes.createdLabel}"`);
      }

      const unitRes = await ensureUnitForImport(unitRaw, units);
      units = unitRes.options;
      unitId = unitRes.id;
      if (unitRes.created) createdForImport.push(`unit "${unitRes.createdLabel}"`);

      const groupRes = await ensureItemGroupForImport(groupName, groups, canManageItems);
      groups = groupRes.groups;
      itemGroupId = groupRes.id;
      if (groupRes.created) createdForImport.push(`item group "${groupRes.createdLabel}"`);

      let categoryList = categories;
      if (canViewCategories) {
        try {
          const catRes = await apiService.get('/categories');
          if (catRes?.success && Array.isArray(catRes.data)) categoryList = catRes.data;
        } catch { /* use in-memory list */ }
      }
      const catRes = await ensureCategoryForImport(
        resolvedCategory,
        categoryList,
        canManageCategories,
        canViewCategories
      );
      if (catRes.name) resolvedCategory = catRes.name;
      if (catRes.created) createdForImport.push(`category "${catRes.createdLabel}"`);
      setCategories(catRes.categoryList);

      setManufacturerOptions(manufacturers);
      setBrandOptions(brands);
      setUnitOptions(units);
      setItemGroups(groups);

      if (createdForImport.length) {
        message.success(`Prepared for import: ${createdForImport.join(', ')}`);
      }

      if (mfrStr && !manufacturerId) {
        message.warning(`Manufacturer "${mfrStr}" could not be linked. Add it manually in the form.`);
      }
      if (brandStr && !brandId) {
        message.warning(`Brand "${brandStr}" could not be linked. Add it manually in the form.`);
      }
      if (!unitId) {
        message.error('No unit could be resolved. Add a unit in Settings, then try again.');
        return;
      }
      if (groupName && !itemGroupId) {
        message.warning(`Item group "${groupName}" was not found or created.`);
      }
    } finally {
      hidePrep();
    }

    setEditingItem(null);
    setEditingWarehouseSummaries([]);
    setDuplicateSourcePayload(null);
    variantBuilderSeededRef.current = false;
    setActiveDraftId(null);
    setPriceCurrency(priceCurrency);
    setImageUrl('');
    setImageFile(null);
    form.resetFields();
    setDraftBanner(null);
    setDuplicateBanner(null);
    setLastAppliedSkuRule(null);
    setSelectedSkuRuleId(null);
    setExistingCustomFields(customFieldsObj);
    setImportCustomFieldsPreview(customPreview);
    setVariantMatrixEdits([]);
    setCompositeComponents([]);

    await loadSkuRules();

    const minSl = parseImportNumeric(pick('minStockLevel'), { emptyAsZero: false });
    const maxSl = parseImportNumeric(pick('maxStockLevel'), { emptyAsZero: false });
    const trackInventory = resolvedItemType !== 'service'
      && (openingStock > 0 || !!finalWarehouseId);

    activeImportRowIndexRef.current = rowIndex;
    if (isBatchImportSave) {
      activeImportGroupRef.current = {
        mode: 'import_batches',
        rowIndexes: mergeRowIndexes,
        primaryRowIndex: rowIndex,
        groupKey,
      };
    } else if (isMergeSave) {
      activeImportGroupRef.current = {
        mode: 'merge',
        rowIndexes: mergeRowIndexes,
        primaryRowIndex: rowIndex,
        groupKey,
      };
    } else if (isPickOneGroup) {
      activeImportGroupRef.current = {
        mode: 'pick_one',
        rowIndexes: pickOneGroupRowIndexes,
        primaryRowIndex: rowIndex,
        groupKey,
      };
    } else {
      activeImportGroupRef.current = null;
    }

    let importDescription = normalizeOptionalText(pick('description'));
    const noteText = String(importNote || '').trim();
    if (isBatchImportSave) {
      importDescription = buildImportBatchImportDescription({
        primaryRow: row,
        batchLines: buildImportBatchLinesFromRowIndexes(mergeRowIndexes, rows, mapping, importDefaults),
        rows,
        mapping,
        importDefaults,
        userNote: noteText,
      }) || undefined;
    } else if (isMergeSave) {
      importDescription = appendMergedImportWarehouseBatchNote(
        buildMergedImportDescription({
          primaryRow: row,
          rowIndexes: mergeRowIndexes,
          rows,
          mapping,
          importDefaults,
          userNote: noteText,
        }) || undefined,
        mergeRowIndexes,
        rows,
        mapping,
        importDefaults,
        CSV_IMPORT_PURPOSE_CREATE
      );
    } else if (noteText) {
      importDescription = [importDescription, `Import note: ${noteText}`].filter(Boolean).join('\n\n') || undefined;
    }

    form.setFieldsValue({
      type: resolvedItemType,
      trackInventory,
      itemGroupId,
      purchaseAccount: 'cogs',
      purchaseTaxRate: 0,
      purchaseDescription: 'Initial stock entry',
      sku: normalizeOptionalText(skuText),
      name: normalizeOptionalText(nameText),
      description: importDescription,
      category: resolvedCategory,
      unit: unitId,
      supplierCode: normalizeOptionalText(supplierCodeStr),
      costPrice: costRaw !== '' ? parseNumericImport(costRaw) : undefined,
      sellingPrice: sellRaw !== '' ? normalizeOptionalNumber(parseNumericImport(sellRaw), { allowZero: false }) : undefined,
      mrp: mrpRaw !== '' ? normalizeOptionalNumber(parseNumericImport(mrpRaw), { allowZero: false }) : undefined,
      taxRate: normalizeTaxRateForForm(parseNumericImport(pick('taxRate'))),
      brand: brandId,
      manufacturer: manufacturerId,
      minStockLevel: normalizeOptionalNumber(minSl.value),
      maxStockLevel: normalizeOptionalNumber(maxSl.value),
      barcode: normalizeOptionalText(pick('barcode')),
      batchNumber: (isBatchImportSave || (isMergeSave && buildConsolidatedImportBatchLinesFromRowIndexes(
        mergeRowIndexes,
        rows,
        mapping,
        importDefaults,
        { importPurpose: CSV_IMPORT_PURPOSE_CREATE }
      ).some((line) => line.batchNumber && line.quantity > 0)))
        ? undefined
        : normalizeOptionalText(pick('batchNumber'))?.toUpperCase(),
      batchManufactureDate: isBatchImportSave ? undefined : parseImportDateForForm(pick('batchManufactureDate')),
      batchExpiryDate: isBatchImportSave ? undefined : parseImportDateForForm(pick('batchExpiryDate')),
      hsnCode: normalizeOptionalText(pick('hsnCode')),
      variantAttributes: [],
      openingStock: normalizeOptionalNumber(openingStock),
      openingValue: normalizeOptionalNumber(openingValue, { allowZero: false }),
      valuationMethod: 'fifo',
      warehouseId: finalWarehouseId,
      defaultBinId: null,
      weight: normalizeOptionalNumber(parseNumericImport(pick('weight')), { allowZero: false }),
      length: normalizeOptionalNumber(dimL.invalid ? undefined : dimL.value, { allowZero: false }),
      width: normalizeOptionalNumber(dimW.invalid ? undefined : dimW.value, { allowZero: false }),
      height: normalizeOptionalNumber(dimH.invalid ? undefined : dimH.value, { allowZero: false }),
      upc: normalizeOptionalText(pick('upc')),
      ean: normalizeOptionalText(pick('ean')),
      isbn: normalizeOptionalText(pick('isbn')),
      mpn: normalizeOptionalText(pick('mpn')),
    });
    fetchBinsForWarehouse(finalWarehouseId);
    if (importSkuRuleId) setSelectedSkuRuleId(importSkuRuleId);
    setItemFormOpenedFromImport(true);
    setModalVisible(true);
    if (willAutoSku) {
      await autoGenerateSkuForImport(importSkuRuleId);
    } else {
      message.info('Review the form and save. Dropdown values from the file were created or matched automatically where possible.');
    }
  };

  const openUpdateItemFromImportRow = async (rowIndex, importOptions = {}) => {
    if (!canManageItems) return;
    const {
      mapping,
      rows,
      fieldConfigs,
      importDefaults = {},
      matchField = CSV_IMPORT_DEFAULT_MATCH_FIELD,
      catalogItemPicks = {},
      skuSource,
      importSkuRuleId,
      matchFileColumn = '',
    } = csvImportModal;
    const {
      mergeRowIndexes = null,
      pickOneGroupRowIndexes = null,
      importNote = '',
      groupKey = null,
      resolveDuplicateGroup = false,
      importMode = null,
    } = importOptions;
    const isBatchImportSave = importMode === 'import_batches'
      && Array.isArray(mergeRowIndexes) && mergeRowIndexes.length > 0;
    const isMergeSave = !isBatchImportSave
      && Array.isArray(mergeRowIndexes) && mergeRowIndexes.length > 1;
    const isPickOneGroup = Array.isArray(pickOneGroupRowIndexes) && pickOneGroupRowIndexes.length > 1;

    const row = rows[rowIndex];
    if (!row) {
      message.error('Row not found');
      return;
    }

    const catalogMatchIndex = buildExistingItemsMatchIndex(items, matchField);
    const duplicateGroups = resolveDuplicateGroup
      ? []
      : buildImportDuplicateGroupsForUpdate(
        rows,
        mapping,
        importDefaults,
        catalogMatchIndex,
        matchField,
        catalogItemPicks,
        matchFileColumn
      );
    const preflight = validateImportRowBeforeOpen({
      row,
      rowIndex,
      mapping,
      fieldConfigs,
      duplicateGroups,
      skuSource,
      hasSkuRules: skuRules.length > 0,
      importDefaults,
      importPurpose: CSV_IMPORT_PURPOSE_UPDATE,
      matchField,
      catalogMatchIndex,
      catalogItemPicks,
      matchFileColumn,
    });
    preflight.warnings.forEach((w) => message.warning(w, 6));
    if (!preflight.ok) {
      Modal.error({
        title: 'Cannot open this row',
        content: (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {preflight.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ),
      });
      return;
    }

    const catalogMatch = resolveCatalogMatchForRow(
      row,
      mapping,
      importDefaults,
      catalogMatchIndex,
      matchField,
      rowIndex,
      catalogItemPicks,
      matchFileColumn
    );
    const matchedItem = catalogMatch.item;
    if (!matchedItem?.id) {
      message.error('No unique catalog item matched for this row.');
      return;
    }

    const fields = createUpdateImportFieldAccessors(row, mapping, importDefaults);

    let openingStock;
    let openingValue;
    if (isBatchImportSave) {
      const batchLines = buildImportBatchLinesFromRowIndexes(
        mergeRowIndexes,
        rows,
        mapping,
        importDefaults,
        { importPurpose: CSV_IMPORT_PURPOSE_UPDATE }
      );
      const batchValidation = validateImportBatchLines(batchLines);
      if (!batchValidation.ok) {
        Modal.error({
          title: 'Cannot import batches',
          content: (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {batchValidation.errors.map((err) => <li key={err}>{err}</li>)}
            </ul>
          ),
        });
        return;
      }
      batchValidation.warnings.forEach((w) => message.warning(w, 6));
      openingStock = undefined;
      openingValue = undefined;
    } else if (isMergeSave) {
      const merged = buildMergedImportQuantitiesForUpdate(mergeRowIndexes, rows, mapping, importDefaults);
      openingStock = merged.openingStock;
      openingValue = merged.openingValue;
    } else {
      if (fields.willUpdate('openingStock')) {
        const stockParsed = parseImportNumeric(fields.getRaw('openingStock'));
        if (!stockParsed.invalid) openingStock = stockParsed.value;
      }
      if (fields.willUpdate('openingValue')) {
        const valueParsed = parseImportNumeric(fields.getRaw('openingValue'));
        if (!valueParsed.invalid) openingValue = valueParsed.value;
      }
    }

    const hidePrep = message.loading('Preparing update from import row...', 0);
    let brandId;
    let manufacturerId;
    let unitId;
    let itemGroupId;
    let resolvedCategory;
    let customFieldsObj = {};
    let customPreview = [];
    const createdForImport = [];
    let brands = brandOptions;
    let manufacturers = manufacturerOptions;
    let units = unitOptions;

    try {
      const customResolved = await resolveImportCustomFieldsForUpdate({
        row,
        mapping,
        fieldConfigs,
        itemType: matchedItem.type || 'simple',
        canManageItems,
        importDefaults,
      });
      if (customResolved.errors.length) {
        Modal.error({
          title: 'Custom field issues',
          content: (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {customResolved.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ),
        });
        return;
      }
      customFieldsObj = customResolved.customFields;
      customPreview = customResolved.preview;
      createdForImport.push(...customResolved.created);

      const snapshot = await fetchDropdownOptions();
      manufacturers = snapshot.manufacturers;
      brands = snapshot.brands;
      units = snapshot.units;
      let groups = snapshot.itemGroups;

      const brandStr = fields.willUpdate('brand') ? fields.getRaw('brand') : null;
      const mfrStr = fields.willUpdate('manufacturer') ? fields.getRaw('manufacturer') : null;
      const unitRaw = fields.willUpdate('unit') ? fields.getRaw('unit') : null;
      const categoryStr = fields.willUpdate('category') ? fields.getRaw('category') : null;
      const groupName = fields.willUpdate('itemGroupName') ? fields.getRaw('itemGroupName') : null;

      if (mfrStr) {
        const mfrRes = await ensureImportDropdownOption({
          value: mfrStr,
          options: manufacturers,
          postPath: '/manufacturers',
          getPath: '/manufacturers',
          buildBody: (name) => ({ name }),
        });
        manufacturerId = mfrRes.id;
        manufacturers = mfrRes.options;
      }
      if (brandStr) {
        const brandRes = await ensureImportDropdownOption({
          value: brandStr,
          options: brands,
          postPath: '/brands',
          getPath: '/brands',
          buildBody: (name) => ({ name }),
        });
        brandId = brandRes.id;
        brands = brandRes.options;
      }
      if (unitRaw) {
        const unitRes = await ensureUnitForImport(unitRaw, units);
        unitId = unitRes.id;
        units = unitRes.options;
      }
      if (categoryStr) {
        const catRes = await ensureCategoryForImport(categoryStr, categories, canManageCategories, canViewCategories);
        resolvedCategory = catRes.name;
        if (catRes.categoryList?.length) setCategories(catRes.categoryList);
      }
      if (groupName) {
        const groupRes = await ensureItemGroupForImport(groupName, groups, canManageItems);
        itemGroupId = groupRes.id;
        groups = groupRes.groups;
      }

      setManufacturerOptions(manufacturers);
      setBrandOptions(brands);
      setUnitOptions(units);
      setItemGroups(groups);

      if (createdForImport.length) {
        message.success(`Prepared for import: ${createdForImport.join(', ')}`);
      }
    } finally {
      hidePrep();
    }

    setEditingItem(matchedItem);
    setEditingWarehouseSummaries([]);
    setDuplicateSourcePayload(null);
    variantBuilderSeededRef.current = false;
    setActiveDraftId(null);
    setDraftBanner(null);
    setDuplicateBanner(null);
    setLastAppliedSkuRule(null);
    setSelectedSkuRuleId(null);
    setImageFile(null);
    setImportCustomFieldsPreview(customPreview);

    let fullItem = matchedItem;
    let warehouseSummaries = [];
    const [itemResponse, warehouseSummaryResponse] = await Promise.allSettled([
      apiService.get(`/items/${matchedItem.id}`),
      fetchItemWarehouseSummaries(matchedItem.id),
    ]);
    if (itemResponse.status === 'fulfilled' && itemResponse.value.success) {
      fullItem = itemResponse.value.data;
    }
    if (warehouseSummaryResponse.status === 'fulfilled' && Array.isArray(warehouseSummaryResponse.value)) {
      warehouseSummaries = warehouseSummaryResponse.value;
    }

    const existingCustom = fullItem?.custom_fields || {};
    const mergedCustomFields = { ...existingCustom, ...customFieldsObj };
    setExistingCustomFields(mergedCustomFields);
    setVariantMatrixEdits(
      Array.isArray(fullItem?.variant_rows) && fullItem.variant_rows.length > 0
        ? normalizeVariantRowsForEdit(fullItem.variant_rows)
        : (Array.isArray(fullItem?.custom_fields?.variantMatrix) ? fullItem.custom_fields.variantMatrix : [])
    );
    setCompositeComponents(normalizeCompositeComponents(fullItem?.composite_components || []));
    setKitFulfillmentMode(fullItem?.kit_fulfillment_mode || fullItem?.kitFulfillmentMode || 'prebuilt');
    setImageUrl(fullItem.image || '');

    let finalWarehouseId = null;
    if (fullItem.warehouse_ids?.length > 0) {
      finalWarehouseId = fullItem.warehouse_ids[0] || null;
    } else if (fullItem.default_bin_id) {
      try {
        const binResponse = await apiService.get(`/warehouse-locations/bins/${fullItem.default_bin_id}`);
        if (binResponse.success) finalWarehouseId = binResponse.data?.warehouse_id || null;
      } catch { /* ignore */ }
    } else if (warehouseSummaries.length > 0) {
      const best = warehouseSummaries.reduce((a, b) => (
        Number(b?.current_stock?.quantity_available || 0) > Number(a?.current_stock?.quantity_available || 0) ? b : a
      ), warehouseSummaries[0]);
      finalWarehouseId = best?.warehouse_id || null;
    }

    const existingBrandId = brands.find((b) => b.name === fullItem.brand)?.id ?? fullItem.brand;
    const existingManufacturerId = manufacturers.find((m) => m.name === fullItem.manufacturer)?.id ?? fullItem.manufacturer;
    const existingUnitId = units.find((u) => u.name === fullItem.unit)?.id ?? fullItem.unit;

    activeImportRowIndexRef.current = rowIndex;
    if (isBatchImportSave) {
      activeImportGroupRef.current = {
        mode: 'import_batches',
        rowIndexes: mergeRowIndexes,
        primaryRowIndex: rowIndex,
        groupKey,
      };
    } else if (isMergeSave) {
      activeImportGroupRef.current = {
        mode: 'merge',
        rowIndexes: mergeRowIndexes,
        primaryRowIndex: rowIndex,
        groupKey,
      };
    } else if (isPickOneGroup) {
      activeImportGroupRef.current = {
        mode: 'pick_one',
        rowIndexes: pickOneGroupRowIndexes,
        primaryRowIndex: rowIndex,
        groupKey,
      };
    } else {
      activeImportGroupRef.current = null;
    }

    let importDescription = fields.willUpdate('description')
      ? fields.overlayText('description', normalizeOptionalText(fullItem.description))
      : normalizeOptionalText(fullItem.description);
    const noteText = String(importNote || '').trim();
    if (isBatchImportSave) {
      importDescription = buildImportBatchImportDescription({
        primaryRow: row,
        batchLines: buildImportBatchLinesFromRowIndexes(
          mergeRowIndexes,
          rows,
          mapping,
          importDefaults,
          { importPurpose: CSV_IMPORT_PURPOSE_UPDATE }
        ),
        rows,
        mapping,
        importDefaults,
        userNote: noteText,
      }) || importDescription;
    } else if (isMergeSave) {
      importDescription = appendMergedImportWarehouseBatchNote(
        buildMergedImportDescription({
          primaryRow: row,
          rowIndexes: mergeRowIndexes,
          rows,
          mapping,
          importDefaults: {},
          userNote: noteText,
          mappedOnly: true,
        }) || importDescription,
        mergeRowIndexes,
        rows,
        mapping,
        importDefaults,
        CSV_IMPORT_PURPOSE_UPDATE
      );
    } else if (noteText) {
      importDescription = [importDescription, `Import note: ${noteText}`].filter(Boolean).join('\n\n') || undefined;
    }

    const dimL = fields.willUpdate('dimLength')
      ? parseImportNumeric(fields.getRaw('dimLength'), { emptyAsZero: false })
      : { invalid: true };
    const dimW = fields.willUpdate('dimWidth')
      ? parseImportNumeric(fields.getRaw('dimWidth'), { emptyAsZero: false })
      : { invalid: true };
    const dimH = fields.willUpdate('dimHeight')
      ? parseImportNumeric(fields.getRaw('dimHeight'), { emptyAsZero: false })
      : { invalid: true };

    const nextOpeningStock = openingStock !== undefined
      ? normalizeOptionalNumber(openingStock)
      : normalizeOptionalNumber(fullItem.opening_stock);
    const nextOpeningValue = openingValue !== undefined
      ? normalizeOptionalNumber(openingValue, { allowZero: false })
      : normalizeOptionalNumber(fullItem.opening_value, { allowZero: false });

    form.setFieldsValue({
      sku: fields.willUpdate('sku') ? fields.overlayText('sku', fullItem.sku) : fullItem.sku,
      name: fields.willUpdate('name') ? fields.overlayText('name', fullItem.name) : fullItem.name,
      description: importDescription,
      type: fullItem.type,
      trackInventory: deriveTrackInventoryValue(fullItem, finalWarehouseId),
      category: resolvedCategory !== undefined ? resolvedCategory : normalizeOptionalText(fullItem.category),
      unit: unitId !== undefined ? unitId : existingUnitId,
      supplierCode: fields.willUpdate('supplierCode')
        ? fields.overlayText('supplierCode', normalizeOptionalText(fullItem.supplier_code))
        : normalizeOptionalText(fullItem.supplier_code),
      costPrice: fields.willUpdate('costPrice')
        ? fields.overlayNumber('costPrice', convertPrice(fullItem.cost_price, 'USD', currency), { allowZero: true })
        : convertPrice(fullItem.cost_price, 'USD', currency),
      sellingPrice: fields.willUpdate('sellingPrice')
        ? fields.overlayNumber(
          'sellingPrice',
          normalizeOptionalNumber(convertPrice(fullItem.selling_price, 'USD', currency), { allowZero: false }),
          { allowZero: false }
        )
        : normalizeOptionalNumber(convertPrice(fullItem.selling_price, 'USD', currency), { allowZero: false }),
      mrp: fields.willUpdate('mrp')
        ? fields.overlayNumber(
          'mrp',
          normalizeOptionalNumber(convertPrice(fullItem.mrp, 'USD', currency), { allowZero: false }),
          { allowZero: false }
        )
        : normalizeOptionalNumber(convertPrice(fullItem.mrp, 'USD', currency), { allowZero: false }),
      taxRate: fields.willUpdate('taxRate')
        ? normalizeTaxRateForForm(parseNumericImport(fields.getRaw('taxRate')))
        : normalizeTaxRateForForm(fullItem.tax_rate),
      brand: brandId !== undefined ? brandId : existingBrandId,
      manufacturer: manufacturerId !== undefined ? manufacturerId : existingManufacturerId,
      minStockLevel: fields.willUpdate('minStockLevel')
        ? fields.overlayNumber('minStockLevel', normalizeOptionalNumber(fullItem.min_stock_level))
        : normalizeOptionalNumber(fullItem.min_stock_level),
      maxStockLevel: fields.willUpdate('maxStockLevel')
        ? fields.overlayNumber('maxStockLevel', normalizeOptionalNumber(fullItem.max_stock_level))
        : normalizeOptionalNumber(fullItem.max_stock_level),
      barcode: fields.willUpdate('barcode')
        ? fields.overlayText('barcode', normalizeOptionalText(fullItem.barcode))
        : normalizeOptionalText(fullItem.barcode),
      batchNumber: (isBatchImportSave || (isMergeSave && buildConsolidatedImportBatchLinesFromRowIndexes(
        mergeRowIndexes,
        rows,
        mapping,
        importDefaults,
        { importPurpose: CSV_IMPORT_PURPOSE_UPDATE }
      ).some((line) => line.batchNumber && line.quantity > 0)))
        ? normalizeOptionalText(fullItem.batch_number)?.toUpperCase()
        : (fields.willUpdate('batchNumber')
          ? fields.overlayText('batchNumber', normalizeOptionalText(fullItem.batch_number))?.toUpperCase()
          : normalizeOptionalText(fullItem.batch_number)?.toUpperCase()),
      batchManufactureDate: isBatchImportSave
        ? undefined
        : (fields.willUpdate('batchManufactureDate')
          ? parseImportDateForForm(fields.getRaw('batchManufactureDate'))
          : undefined),
      batchExpiryDate: isBatchImportSave
        ? undefined
        : (fields.willUpdate('batchExpiryDate')
          ? parseImportDateForForm(fields.getRaw('batchExpiryDate'))
          : undefined),
      hsnCode: fields.willUpdate('hsnCode')
        ? fields.overlayText('hsnCode', normalizeOptionalText(fullItem.hsn_code))
        : normalizeOptionalText(fullItem.hsn_code),
      itemGroupId: itemGroupId !== undefined && itemGroupId !== null ? itemGroupId : (fullItem.item_group_id || null),
      openingStock: nextOpeningStock,
      openingValue: nextOpeningValue,
      valuationMethod: fullItem.valuation_method,
      warehouseId: finalWarehouseId,
      defaultBinId: fullItem.default_bin_id || null,
      weight: fields.willUpdate('weight')
        ? fields.overlayNumber('weight', normalizeOptionalNumber(fullItem.weight, { allowZero: false }), { allowZero: false })
        : normalizeOptionalNumber(fullItem.weight, { allowZero: false }),
      length: !dimL.invalid
        ? normalizeOptionalNumber(dimL.value, { allowZero: false })
        : normalizeOptionalNumber(fullItem.dimensions?.length, { allowZero: false }),
      width: !dimW.invalid
        ? normalizeOptionalNumber(dimW.value, { allowZero: false })
        : normalizeOptionalNumber(fullItem.dimensions?.width, { allowZero: false }),
      height: !dimH.invalid
        ? normalizeOptionalNumber(dimH.value, { allowZero: false })
        : normalizeOptionalNumber(fullItem.dimensions?.height, { allowZero: false }),
      upc: fields.willUpdate('upc') ? fields.overlayText('upc', normalizeOptionalText(fullItem.upc)) : normalizeOptionalText(fullItem.upc),
      ean: fields.willUpdate('ean') ? fields.overlayText('ean', normalizeOptionalText(fullItem.ean)) : normalizeOptionalText(fullItem.ean),
      isbn: fields.willUpdate('isbn') ? fields.overlayText('isbn', normalizeOptionalText(fullItem.isbn)) : normalizeOptionalText(fullItem.isbn),
      mpn: fields.willUpdate('mpn') ? fields.overlayText('mpn', normalizeOptionalText(fullItem.mpn)) : normalizeOptionalText(fullItem.mpn),
    });
    fetchBinsForWarehouse(finalWarehouseId);
    if (importSkuRuleId) setSelectedSkuRuleId(importSkuRuleId);
    setItemFormOpenedFromImport(true);
    setModalVisible(true);
    const skuFromFile = isSkuRequiredForImport(skuSource);
    const willAutoSku = !skuFromFile && !willUpdateImportField(row, mapping, importDefaults, 'sku');
    if (willAutoSku) {
      await autoGenerateSkuForImport(importSkuRuleId);
    } else {
      message.info(`Updating "${fullItem.name}". Only mapped columns with values in this row will change — everything else stays as in the catalog.`);
    }
  };

  const markImportRowsUpdated = (rowIndexes, importGroup = null) => {
    setCsvImportModal((prev) => {
      const added = { ...(prev.addedRowIndexes || {}) };
      const superseded = { ...(prev.supersededRowIndexes || {}) };
      if (importGroup?.mode === 'import_batches' && Array.isArray(importGroup.rowIndexes)) {
        importGroup.rowIndexes.forEach((i) => {
          added[String(i)] = true;
        });
      } else if (importGroup?.mode === 'merge' && Array.isArray(importGroup.rowIndexes)) {
        importGroup.rowIndexes.forEach((i) => {
          added[String(i)] = true;
        });
      } else if (importGroup?.mode === 'pick_one' && Array.isArray(importGroup.rowIndexes)) {
        const primary = importGroup.primaryRowIndex;
        added[String(primary)] = true;
        importGroup.rowIndexes.forEach((i) => {
          if (i !== primary) superseded[String(i)] = importGroup.groupKey || true;
        });
      } else {
        (rowIndexes || []).forEach((i) => {
          added[String(i)] = true;
        });
      }
      return { ...prev, addedRowIndexes: added, supersededRowIndexes: superseded };
    });
  };

  const directImportBatchesFromGroup = async (group, plan, { silent = false } = {}) => {
    if (!canManageItems) return false;
    const {
      mapping,
      rows,
      importDefaults = {},
      defaultWarehouseId,
      importPurpose,
      matchField = CSV_IMPORT_DEFAULT_MATCH_FIELD,
      catalogItemPicks = {},
      matchFileColumn = '',
    } = csvImportModal;

    const selectedRowIndexes = getImportGroupSelectedRowIndexes(
      group,
      plan,
      csvImportModal.addedRowIndexes || {},
      csvImportModal.supersededRowIndexes || {}
    );
    if (!selectedRowIndexes.length) {
      if (!silent) message.error('Select at least one row for batch import.');
      return false;
    }
    if (!defaultWarehouseId) {
      if (!silent) message.error('Select a default warehouse before importing batches.');
      return false;
    }

    const isUpdateImport = importPurpose === CSV_IMPORT_PURPOSE_UPDATE;

    const batchLines = buildImportBatchLinesFromRowIndexes(
      selectedRowIndexes,
      rows,
      mapping,
      importDefaults,
      { importPurpose: isUpdateImport ? CSV_IMPORT_PURPOSE_UPDATE : CSV_IMPORT_PURPOSE_CREATE }
    );
    const validation = validateImportBatchLines(batchLines);
    if (!validation.ok) {
      if (!silent) {
        Modal.error({
          title: 'Cannot import batches',
          content: (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {validation.errors.map((err) => <li key={err}>{err}</li>)}
            </ul>
          ),
        });
      }
      return false;
    }
    if (!silent) validation.warnings.forEach((w) => message.warning(w, 5));

    let itemId = group.catalogItemId || null;
    let itemName = group.catalogItemName || group.nameDisplay || 'Item';

    if (isUpdateImport) {
      const primaryIndex = plan.selectedRowIndex ?? selectedRowIndexes[0];
      const catalogMatchIndex = buildExistingItemsMatchIndex(items, matchField);
      const catalogMatch = resolveCatalogMatchForRow(
        rows[primaryIndex],
        mapping,
        importDefaults,
        catalogMatchIndex,
        matchField,
        primaryIndex,
        catalogItemPicks,
        matchFileColumn
      );
      if (catalogMatch.status !== 'matched' || !catalogMatch.item?.id) {
        if (!silent) message.error('Could not match an existing catalog item for batch import.');
        return false;
      }
      itemId = catalogMatch.item.id;
      itemName = catalogMatch.item.name || itemName;
    } else {
      const primaryIndex = plan.selectedRowIndex ?? selectedRowIndexes[0];
      const primaryRow = rows[primaryIndex];
      const skuText = pickImportValue(primaryRow, mapping, importDefaults, 'sku');
      const existing = items.find(
        (item) => normalizeDuplicateLookup(item.sku) === normalizeDuplicateLookup(skuText)
      );
      if (existing?.id) {
        itemId = existing.id;
        itemName = existing.name || itemName;
      } else {
        if (!silent) {
          message.info('Item not in catalog yet. Use "Add batches in form" to create the item and warehouse batches together.');
        }
        return false;
      }
    }

    try {
      const batchResult = await createImportBatchesForItem(itemId, batchLines, defaultWarehouseId);
      if (batchResult.errors.length) {
        if (!silent) {
          Modal.warning({
            title: 'Some batches could not be created',
            content: (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {batchResult.errors.map((err) => <li key={err}>{err}</li>)}
              </ul>
            ),
          });
        }
        if (!batchResult.created.length) return false;
      }

      markImportRowsUpdated(selectedRowIndexes, {
        mode: 'import_batches',
        rowIndexes: selectedRowIndexes,
        primaryRowIndex: plan.selectedRowIndex ?? selectedRowIndexes[0],
        groupKey: group.groupKey,
      });
      await fetchItems();
      if (!silent) {
        message.success(
          `Created ${batchResult.created.length} batch(es) for "${itemName}": ${batchResult.created.join(', ')}`
        );
      }
      return true;
    } catch (e) {
      if (!silent) message.error(e?.response?.data?.error || 'Failed to import batches');
      return false;
    }
  };

  const directUpdateItemFromImportRow = async (rowIndex, importOptions = {}) => {
    if (!canManageItems) return false;
    const {
      mapping,
      rows,
      fieldConfigs,
      importDefaults = {},
      matchField = CSV_IMPORT_DEFAULT_MATCH_FIELD,
      catalogItemPicks = {},
      skuSource,
      importSkuRuleId,
      defaultWarehouseId,
      matchFileColumn = '',
    } = csvImportModal;
    const {
      mergeRowIndexes = null,
      pickOneGroupRowIndexes = null,
      importNote = '',
      groupKey = null,
      resolveDuplicateGroup = false,
      importMode = null,
      silent = false,
    } = importOptions;
    const isBatchImportDirect = importMode === 'import_batches'
      && Array.isArray(mergeRowIndexes) && mergeRowIndexes.length > 0;
    const isMergeSave = !isBatchImportDirect
      && Array.isArray(mergeRowIndexes) && mergeRowIndexes.length > 1;
    const isPickOneGroup = Array.isArray(pickOneGroupRowIndexes) && pickOneGroupRowIndexes.length > 1;

    const row = rows[rowIndex];
    if (!row) {
      if (!silent) message.error('Row not found');
      return false;
    }

    if (isBatchImportDirect) {
      const selectedRowIndexes = mergeRowIndexes;
      const batchGroup = {
        groupKey,
        rowIndexes: selectedRowIndexes,
        catalogItemId: null,
        catalogItemName: null,
        batchAnalysis: analyzeImportDuplicateGroupBatches(
          { rowIndexes: selectedRowIndexes },
          rows,
          mapping,
          importDefaults,
          CSV_IMPORT_PURPOSE_UPDATE
        ),
      };
      return directImportBatchesFromGroup(
        batchGroup,
        {
          selectedRowIndexes,
          selectedRowIndex: rowIndex,
          note: importNote,
          mode: 'import_batches',
        },
        { silent }
      );
    }

    const catalogMatchIndex = buildExistingItemsMatchIndex(items, matchField);
    const duplicateGroups = resolveDuplicateGroup
      ? []
      : buildImportDuplicateGroupsForUpdate(
        rows,
        mapping,
        importDefaults,
        catalogMatchIndex,
        matchField,
        catalogItemPicks,
        matchFileColumn
      );
    const preflight = validateImportRowBeforeOpen({
      row,
      rowIndex,
      mapping,
      fieldConfigs,
      duplicateGroups,
      skuSource,
      hasSkuRules: skuRules.length > 0,
      importDefaults,
      importPurpose: CSV_IMPORT_PURPOSE_UPDATE,
      matchField,
      catalogMatchIndex,
      catalogItemPicks,
      matchFileColumn,
    });
    if (!silent) preflight.warnings.forEach((w) => message.warning(w, 6));
    if (!preflight.ok) {
      if (!silent) {
        Modal.error({
          title: 'Cannot update this row directly',
          content: (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {preflight.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ),
        });
      }
      return false;
    }

    const catalogMatch = resolveCatalogMatchForRow(
      row,
      mapping,
      importDefaults,
      catalogMatchIndex,
      matchField,
      rowIndex,
      catalogItemPicks,
      matchFileColumn
    );
    const matchedItem = catalogMatch.item;
    if (!matchedItem?.id) {
      if (!silent) message.error('No unique catalog item matched for this row.');
      return false;
    }

    let fullItem = matchedItem;
    try {
      const itemResponse = await apiService.get(`/items/${matchedItem.id}`);
      if (itemResponse.success) fullItem = itemResponse.data;
    } catch {
      /* use list row */
    }

    if (!CSV_IMPORT_SUPPORTED_ITEM_TYPES.includes(fullItem.type)) {
      if (!silent) {
        message.error(`Direct update supports Simple and Service items only ("${fullItem.name}" is ${fullItem.type}). Use Update in form.`);
      }
      return false;
    }

    const prepared = await prepareDirectImportUpdatePayload({
      row,
      rows,
      mapping,
      importDefaults,
      fullItem,
      fieldConfigs,
      skuSource: skuSource || CSV_IMPORT_SKU_FROM_FILE,
      importSkuRuleId,
      skuRules,
      priceCurrency,
      canManageItems,
      canManageCategories,
      canViewCategories,
      categories,
      brandOptions,
      manufacturerOptions,
      unitOptions,
      itemGroups,
      defaultWarehouseId,
      mergeOptions: isMergeSave
        ? { mergeRowIndexes, importNote }
        : (importNote ? { importNote } : null),
    });

    if (prepared.errors.length) {
      if (!silent) {
        Modal.error({
          title: 'Cannot update this row directly',
          content: (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {prepared.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ),
        });
      }
      return false;
    }

    try {
      const response = await apiService.put(`/items/${matchedItem.id}`, prepared.payload);
      if (!response.success) {
        if (!silent) message.error(response.error || 'Update failed');
        return false;
      }

      if (prepared.masterData) {
        if (prepared.masterData.brands?.length) setBrandOptions(prepared.masterData.brands);
        if (prepared.masterData.manufacturers?.length) setManufacturerOptions(prepared.masterData.manufacturers);
        if (prepared.masterData.units?.length) setUnitOptions(prepared.masterData.units);
        if (prepared.masterData.groups?.length) setItemGroups(prepared.masterData.groups);
      }

      const importGroup = isMergeSave
        ? { mode: 'merge', rowIndexes: mergeRowIndexes, primaryRowIndex: rowIndex, groupKey }
        : isPickOneGroup
          ? { mode: 'pick_one', rowIndexes: pickOneGroupRowIndexes, primaryRowIndex: rowIndex, groupKey }
          : null;
      const batchLinesToCreate = resolveImportBatchLinesForSave({
        importGroup,
        savedRowIndex: rowIndex,
        rows,
        mapping,
        importDefaults,
        importPurpose: CSV_IMPORT_PURPOSE_UPDATE,
      });
      if (batchLinesToCreate.length && defaultWarehouseId) {
        const batchValidation = validateImportBatchLines(batchLinesToCreate);
        if (batchValidation.ok) {
          const batchResult = await createImportBatchesForItem(
            matchedItem.id,
            batchLinesToCreate,
            defaultWarehouseId
          );
          if (!silent && batchResult.created.length) {
            message.success(`Created ${batchResult.created.length} warehouse batch(es): ${batchResult.created.join(', ')}`);
          }
          if (batchResult.errors.length && !silent) {
            Modal.warning({
              title: 'Some batches could not be created',
              content: (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {batchResult.errors.map((err) => <li key={err}>{err}</li>)}
                </ul>
              ),
            });
          }
        } else if (!silent) {
          batchValidation.errors.forEach((err) => message.warning(err, 5));
        }
      } else if (batchLinesToCreate.length && !defaultWarehouseId && !silent) {
        message.warning('Item updated but warehouse batches were skipped — select a default warehouse.');
      }

      markImportRowsUpdated([rowIndex], importGroup);
      await fetchItems();

      if (!silent) {
        if (prepared.warnings.length) {
          prepared.warnings.forEach((w) => message.warning(w, 5));
        }
        message.success(`Updated "${prepared.payload.name || matchedItem.name}" directly from import.`);
      }
      return true;
    } catch (e) {
      if (!silent) message.error(e?.response?.data?.error || 'Failed to update item');
      return false;
    }
  };

  const bulkDirectUpdateReadyImportRows = async () => {
    if (!canManageItems) return;
    const readyRows = csvImportBulkDirectReadyRows;

    if (!readyRows.length) {
      message.info('No ready rows to update directly. Resolve ambiguous matches and duplicate groups first.');
      return;
    }

    Modal.confirm({
      title: `Update ${readyRows.length} item(s) directly?`,
      content: 'Only fields you added in mappings or defaults are sent to the API. Unlisted fields stay unchanged. Auto-generate SKU applies when SKU is not mapped and has no default.',
      okText: 'Update all',
      cancelText: 'Cancel',
      onOk: async () => {
        setCsvImportModal((prev) => ({ ...prev, busy: true }));
        let ok = 0;
        let failed = 0;
        const hide = message.loading(`Updating 0 / ${readyRows.length}…`, 0);
        try {
          for (let i = 0; i < readyRows.length; i += 1) {
            const rowIndex = Number(readyRows[i]._rowIndex);
            hide();
            const progress = message.loading(`Updating ${i + 1} / ${readyRows.length}…`, 0);
            const success = await directUpdateItemFromImportRow(rowIndex, { silent: true });
            progress();
            if (success) ok += 1;
            else failed += 1;
          }
        } finally {
          hide();
          setCsvImportModal((prev) => ({ ...prev, busy: false }));
        }
        if (failed === 0) {
          message.success(`Updated ${ok} item(s) directly from import.`);
        } else {
          message.warning(`Updated ${ok} item(s); ${failed} failed (see row status or use Update in form).`);
        }
      },
    });
  };

  const openImportRowInForm = (rowIndex, importOptions = {}) => {
    if (csvImportModal.importPurpose === CSV_IMPORT_PURPOSE_UPDATE) {
      return openUpdateItemFromImportRow(rowIndex, importOptions);
    }
    return openAddItemFromImportRow(rowIndex, importOptions);
  };

  const fetchDrafts = async () => {
    try {
      setDraftsLoading(true);
      const res = await apiService.get('/items/drafts');
      setDrafts(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setDrafts([]);
    } finally {
      setDraftsLoading(false);
    }
  };

  const openDraft = async (draft) => {
    setEditingItem(null);
    setActiveDraftId(draft.id);
    setPriceCurrency(currency);
    setImageUrl(draft.data?.image || '');
    setImageFile(null);
    setExistingCustomFields(draft.data?.customFields || {});
    setVariantMatrixEdits(Array.isArray(draft.data?.customFields?.variantMatrix) ? draft.data.customFields.variantMatrix : []);
    setCompositeComponents(normalizeCompositeComponents(draft.data?.components || []));
    setLastAppliedSkuRule(null);
    setSelectedSkuRuleId(null);
    form.resetFields();
    await fetchDropdownOptions();
    await loadSkuRules();
    form.setFieldsValue(draft.data);
    setDraftBanner({ savedAt: draft.savedAt, draftId: draft.id });
    setModalVisible(true);
  };

  const hasDraftableValues = useCallback((values = {}) => {
    const fieldsToCheck = [
      'sku', 'name', 'description', 'category', 'unit', 'warehouseId', 'type',
      'brand', 'manufacturer', 'barcode', 'batchNumber', 'upc', 'ean', 'isbn', 'mpn', 'itemGroupId'
    ];
    const hasText = fieldsToCheck.some((k) => {
      const v = values[k];
      return typeof v === 'string' ? v.trim().length > 0 : !!v;
    });
    const hasNumeric = ['costPrice', 'sellingPrice', 'mrp', 'openingStock', 'weight', 'minStockLevel', 'maxStockLevel']
      .some((k) => Number(values[k]) > 0);
    return hasText || hasNumeric || !!imageUrl;
  }, [imageUrl]);

  const saveDraftSilently = useCallback(async (source = 'manual') => {
    if (editingItem) return false;
    if (autoDraftSavingRef.current) return false;

    const values = form.getFieldsValue();
    if (!hasDraftableValues(values)) return false;

    autoDraftSavingRef.current = true;
    try {
      await apiService.post('/items/draft', { ...values, image: imageUrl, components: compositeComponents });
      if (source === 'session-timeout') {
        message.info('Session about to expire: item saved as draft.');
      }
      fetchDrafts();
      return true;
    } catch {
      if (source === 'session-timeout') {
        message.error('Could not auto-save draft before session expiry.');
      }
      return false;
    } finally {
      autoDraftSavingRef.current = false;
    }
  }, [compositeComponents, editingItem, form, hasDraftableValues, imageUrl]);

  const handleSaveDraft = async () => {
    try {
      const saved = await saveDraftSilently('manual');
      if (!saved) {
        message.warning('Nothing to save as draft yet.');
        return;
      }
      message.success('Draft saved! You can continue later.');
      setModalVisible(false);
      setEditingItem(null);
      setActiveDraftId(null);
      setDraftBanner(null);
      setCompositeComponents([]);
      fetchDrafts();
    } catch {
      message.error('Failed to save draft');
    }
  };

  useEffect(() => {
    // Reset auto-save latch when timer has enough buffer again.
    if (sessionSecondsLeft == null || sessionSecondsLeft > 30) {
      autoDraftSavedRef.current = false;
      return;
    }

    // Auto-save once shortly before inactivity logout.
    if (
      modalVisible &&
      !editingItem &&
      sessionSecondsLeft > 0 &&
      sessionSecondsLeft <= 20 &&
      !autoDraftSavedRef.current
    ) {
      autoDraftSavedRef.current = true;
      saveDraftSilently('session-timeout');
    }
  }, [sessionSecondsLeft, modalVisible, editingItem, saveDraftSilently]);

  useEffect(() => {
    const initializeData = async () => {
      await fetchItems();
      await new Promise(resolve => setTimeout(resolve, 200));
      await fetchDropdownOptions();
      await fetchDrafts();
    };
    
    initializeData();
    
    // Refresh vendor list when window regains focus (after adding vendor in new tab)
    const handleFocus = () => {
      if (modalVisible) {
        setTimeout(() => fetchDropdownOptions(), 100);
      }
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [modalVisible]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const requestedItemGroupId = params.get('itemGroupId') || 'all';
    setItemGroupFilter((current) => (current === requestedItemGroupId ? current : requestedItemGroupId));
  }, [location.search]);

  useEffect(() => {
    if (!csvImportModal.open) return undefined;
    let cancelled = false;
    (async () => {
      const type = csvImportModal.itemType || 'simple';
      try {
        const res = await apiService.get(`/items/field-config/${type}`);
        const raw = res?.success ? (res.data || []) : [];
        const fieldConfigs = dedupeItemFieldConfigs(raw);
        if (cancelled) return;
        setCsvImportModal((prev) => {
          if (!prev.open || prev.itemType !== type) return prev;
          const next = { ...prev, fieldConfigs };
          if (prev.headers?.length && prev.importPurpose !== CSV_IMPORT_PURPOSE_UPDATE) {
            next.mapping = buildInitialCsvMapping(prev.headers, fieldConfigs, {
              importPurpose: prev.importPurpose,
              matchField: prev.matchField,
            });
          }
          return next;
        });
      } catch {
        if (!cancelled) message.error('Failed to load custom field config');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [csvImportModal.open, csvImportModal.itemType]);

  const sectionStyle = {
    background: '#fff',
    border: '1px solid #ebebf5',
    borderRadius: 14,
    padding: '20px 20px 8px',
    marginBottom: 18,
    boxShadow: '0 2px 10px rgba(102,126,234,0.06)',
  };
  const sectionHeader = {
    fontWeight: 700,
    fontSize: 13,
    color: '#667eea',
    marginBottom: 18,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    borderBottom: '2px solid #f0f0ff',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };
  const sectionIconStyle = {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    borderRadius: 8,
    padding: '5px 7px',
    color: '#fff',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const filteredItems = items.filter(item => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (itemGroupFilter !== 'all' && item.item_group_id !== itemGroupFilter) return false;
    if (!searchText) return true;
    return (
      item.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.item_group_name?.toLowerCase().includes(searchText.toLowerCase())
    );
  });

  const getItemSortDate = (item) => {
    const rawValue = item?.created_at || item?.updated_at || null;
    if (!rawValue) return 0;
    const parsed = new Date(rawValue).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const sortedFilteredItems = useMemo(() => {
    const list = [...filteredItems];

    list.sort((left, right) => {
      const leftName = String(left?.name || '');
      const rightName = String(right?.name || '');

      switch (sortBy) {
        case 'name_desc':
          return rightName.localeCompare(leftName, undefined, { sensitivity: 'base', numeric: true });
        case 'date_desc':
          return getItemSortDate(right) - getItemSortDate(left) || leftName.localeCompare(rightName, undefined, { sensitivity: 'base', numeric: true });
        case 'date_asc':
          return getItemSortDate(left) - getItemSortDate(right) || leftName.localeCompare(rightName, undefined, { sensitivity: 'base', numeric: true });
        case 'name_asc':
        default:
          return leftName.localeCompare(rightName, undefined, { sensitivity: 'base', numeric: true });
      }
    });

    return list;
  }, [filteredItems, sortBy]);

  useEffect(() => {
    setCatalogGridPage(1);
  }, [searchText, statusFilter, itemGroupFilter, sortBy, itemsViewMode]);

  const getSelectedUnitLabel = () => {
    const selectedUnit = form.getFieldValue('unit');
    if (!selectedUnit) return 'kg';
    const unitRow = unitOptions.find((u) => u.id === selectedUnit || u.name === selectedUnit || u.symbol === selectedUnit);
    if (unitRow?.symbol) return unitRow.symbol;
    if (unitRow?.name) return unitRow.name;
    // If unit lookup is stale (e.g. recently deleted), avoid showing raw UUID.
    return 'selected unit';
  };
  const activeCount = items.filter(i => i.status === 'active').length;
  const lowStockCount = items.filter(i => (i.current_stock || 0) <= (i.min_stock_level || 0)).length;

  const csvImportHeaderSelectOptions = useMemo(() => [
    { value: '', label: '— None —' },
    ...(csvImportModal.headers || []).map((h) => ({ value: h, label: h })),
  ], [csvImportModal.headers]);

  const csvImportTypeSelectOptions = useMemo(() => {
    const fromApi = (itemTypes || [])
      .filter((t) => CSV_IMPORT_SUPPORTED_ITEM_TYPES.includes(t.name))
      .map((t) => ({ value: t.name, label: t.name }));
    if (fromApi.length) return fromApi;
    return CSV_IMPORT_SUPPORTED_ITEM_TYPES.map((name) => ({ value: name, label: name }));
  }, [itemTypes]);

  const csvImportMappingRows = useMemo(() => {
    const skuRequired = isSkuRequiredForImport(csvImportModal.skuSource);
    const core = CSV_IMPORT_CORE_TARGETS.map((t) => ({
      key: t.id,
      group: t.group,
      label: t.label,
      required: t.id === 'sku' ? skuRequired : !!t.required,
    }));
    const custom = (csvImportModal.fieldConfigs || []).map((c) => ({
      key: `cf:${c.field_name || c.fieldName}`,
      group: 'Custom fields',
      label: c.field_label || c.fieldLabel || c.field_name,
      required: Boolean(c.is_required),
    }));
    return [...core, ...custom];
  }, [csvImportModal.fieldConfigs, csvImportModal.skuSource]);

  const csvImportCatalogMatchIndex = useMemo(() => {
    const matchField = csvImportModal.matchField || CSV_IMPORT_DEFAULT_MATCH_FIELD;
    return buildExistingItemsMatchIndex(items, matchField);
  }, [items, csvImportModal.matchField]);

  const csvImportDuplicateGroups = useMemo(() => {
    const {
      rows,
      mapping,
      importDefaults,
      importPurpose,
      matchField,
      catalogItemPicks,
      matchFileColumn = '',
    } = csvImportModal;
    if (!rows?.length) return [];
    if (importPurpose === CSV_IMPORT_PURPOSE_UPDATE) {
      return buildImportDuplicateGroupsForUpdate(
        rows,
        mapping,
        importDefaults || {},
        csvImportCatalogMatchIndex,
        matchField || CSV_IMPORT_DEFAULT_MATCH_FIELD,
        catalogItemPicks || {},
        matchFileColumn
      );
    }
    return buildImportDuplicateGroups(rows, mapping, importDefaults || {});
  }, [
    csvImportModal.rows,
    csvImportModal.mapping,
    csvImportModal.importDefaults,
    csvImportModal.importPurpose,
    csvImportModal.matchField,
    csvImportModal.catalogItemPicks,
    csvImportModal.matchFileColumn,
    csvImportCatalogMatchIndex,
  ]);

  const csvImportIssueContext = useMemo(() => {
    const {
      mapping,
      defaultWarehouseId,
      fieldConfigs,
      skuSource,
      importDefaults,
      importPurpose,
      matchField,
      matchFileColumn = '',
    } = csvImportModal;
    const existingSkuKeys = new Set(
      (items || [])
        .map((i) => String(i.sku || '').trim().toLowerCase())
        .filter(Boolean)
    );
    return {
      mapping,
      fieldConfigs: fieldConfigs || [],
      defaultWarehouseId,
      duplicateGroups: csvImportDuplicateGroups,
      existingSkuKeys,
      skuSource: skuSource || CSV_IMPORT_SKU_FROM_FILE,
      hasSkuRules: skuRules.length > 0,
      importDefaults: importDefaults || {},
      importPurpose: importPurpose || CSV_IMPORT_PURPOSE_CREATE,
      matchField: matchField || CSV_IMPORT_DEFAULT_MATCH_FIELD,
      matchFileColumn: matchFileColumn || '',
      catalogMatchIndex: csvImportCatalogMatchIndex,
      catalogItemPicks: csvImportModal.catalogItemPicks || {},
    };
  }, [
    csvImportModal.mapping,
    csvImportModal.defaultWarehouseId,
    csvImportModal.fieldConfigs,
    csvImportModal.skuSource,
    csvImportModal.importDefaults,
    csvImportModal.importPurpose,
    csvImportModal.matchField,
    csvImportModal.matchFileColumn,
    csvImportModal.catalogItemPicks,
    csvImportDuplicateGroups,
    csvImportCatalogMatchIndex,
    items,
    skuRules.length,
  ]);

  const csvImportRowsWithAssessment = useMemo(() => {
    const { rows } = csvImportModal;
    if (!rows?.length) return [];
    const ctx = csvImportIssueContext;
    return rows.map((row, idx) => {
      const added = !!csvImportModal.addedRowIndexes?.[String(idx)];
      const superseded = !!csvImportModal.supersededRowIndexes?.[String(idx)];
      const issues = assessImportRowIssues({
        row,
        rowIndex: idx,
        rows,
        mapping: ctx.mapping,
        fieldConfigs: ctx.fieldConfigs,
        defaultWarehouseId: ctx.defaultWarehouseId,
        duplicateGroups: ctx.duplicateGroups,
        existingSkuKeys: ctx.existingSkuKeys,
        brandOptions,
        manufacturerOptions,
        unitOptions,
        canManageItems,
        skuSource: ctx.skuSource,
        hasSkuRules: ctx.hasSkuRules,
        importDefaults: ctx.importDefaults,
        importPurpose: ctx.importPurpose,
        matchField: ctx.matchField,
        matchFileColumn: ctx.matchFileColumn,
        catalogMatchIndex: ctx.catalogMatchIndex,
        catalogItemPicks: ctx.catalogItemPicks,
      });
      const level = added ? 'added' : superseded ? 'superseded' : issues.level;
      const catalogMatch = issues.catalogMatch;
      return {
        ...row,
        _rowIndex: String(idx),
        _importIssues: issues,
        _importLevel: level,
        _importSuperseded: superseded,
        _catalogMatch: catalogMatch,
        _matchedItem: catalogMatch?.status === 'matched' ? catalogMatch.item : null,
      };
    });
  }, [
    csvImportModal.rows,
    csvImportModal.addedRowIndexes,
    csvImportModal.supersededRowIndexes,
    csvImportModal.catalogItemPicks,
    csvImportIssueContext,
    brandOptions,
    manufacturerOptions,
    unitOptions,
    canManageItems,
  ]);

  const csvImportIssueStats = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    let added = 0;
    const isUpdate = csvImportModal.importPurpose === CSV_IMPORT_PURPOSE_UPDATE;
    csvImportRowsWithAssessment.forEach((r) => {
      if (isUpdate && !isImportRowFoundInCatalog(r._catalogMatch)) return;
      if (r._importLevel === 'added') added += 1;
      else if (r._importLevel === 'error') errors += 1;
      else if (r._importLevel === 'warning') warnings += 1;
    });
    return { errors, warnings, added, total: csvImportRowsWithAssessment.length };
  }, [csvImportRowsWithAssessment, csvImportModal.importPurpose]);

  const csvImportPreviewRows = useMemo(() => {
    const { mapping, csvImportPreviewFilters: pf, importPurpose, matchField } = csvImportModal;
    const skuSource = csvImportModal.skuSource || CSV_IMPORT_SKU_FROM_FILE;
    const importDefaults = csvImportModal.importDefaults || {};
    const isUpdateImport = importPurpose === CSV_IMPORT_PURPOSE_UPDATE;
    const onlyMatched = pf?.onlyMatched ?? isUpdateImport;
    return csvImportRowsWithAssessment.filter((r) => {
      if (isUpdateImport && onlyMatched && !isImportRowFoundInCatalog(r._catalogMatch)) return false;
      if (pf?.hideMissingSku && !csvImportRowHasMappedValue(r, mapping, 'sku') && !importDefaults?.sku) return false;
      if (pf?.hideMissingName && !pickImportValue(r, mapping, importDefaults, 'name')) return false;
      if (pf?.onlyReady) {
        const ready = isUpdateImport
          ? isImportUpdateRowReady(
            r,
            mapping,
            importDefaults,
            csvImportCatalogMatchIndex,
            matchField,
            Number(r._rowIndex),
            csvImportModal.catalogItemPicks,
            csvImportModal.matchFileColumn
          )
          : isImportRowReady(r, mapping, skuSource, importDefaults);
        if (!ready) return false;
      }
      if (pf?.onlyIssues && r._importLevel !== 'error' && r._importLevel !== 'warning') return false;
      return true;
    });
  }, [
    csvImportRowsWithAssessment,
    csvImportModal.mapping,
    csvImportModal.csvImportPreviewFilters,
    csvImportModal.skuSource,
    csvImportModal.importDefaults,
    csvImportModal.importPurpose,
    csvImportModal.matchField,
    csvImportModal.matchFileColumn,
    csvImportModal.catalogItemPicks,
    csvImportCatalogMatchIndex,
  ]);

  const csvImportMatchStats = useMemo(() => {
    if (csvImportModal.importPurpose !== CSV_IMPORT_PURPOSE_UPDATE) {
      return { matched: 0, unmatched: 0, ambiguous: 0, empty: 0, inCatalog: 0 };
    }
    let matched = 0;
    let unmatched = 0;
    let ambiguous = 0;
    let empty = 0;
    csvImportRowsWithAssessment.forEach((r) => {
      const st = r._catalogMatch?.status;
      if (st === 'matched') matched += 1;
      else if (st === 'ambiguous') ambiguous += 1;
      else if (st === 'empty') empty += 1;
      else if (st === 'no_match') unmatched += 1;
    });
    return { matched, unmatched, ambiguous, empty, inCatalog: matched + ambiguous };
  }, [csvImportRowsWithAssessment, csvImportModal.importPurpose]);

  const csvImportMatchedUpdateRows = useMemo(() => {
    if (csvImportModal.importPurpose !== CSV_IMPORT_PURPOSE_UPDATE) return [];
    return csvImportRowsWithAssessment.filter((r) => isImportRowFoundInCatalog(r._catalogMatch));
  }, [csvImportRowsWithAssessment, csvImportModal.importPurpose]);

  const csvImportSheetMatchGroups = useMemo(() => {
    if (csvImportModal.importPurpose !== CSV_IMPORT_PURPOSE_UPDATE) return [];
    const {
      rows,
      mapping,
      importDefaults,
      matchField,
      catalogItemPicks,
      matchFileColumn,
    } = csvImportModal;
    if (!rows?.length) return [];
    return buildImportSheetMatchGroupsForUpdate(
      rows,
      mapping || {},
      importDefaults || {},
      csvImportCatalogMatchIndex,
      matchField || CSV_IMPORT_DEFAULT_MATCH_FIELD,
      catalogItemPicks || {},
      matchFileColumn || ''
    );
  }, [
    csvImportModal.importPurpose,
    csvImportModal.rows,
    csvImportModal.mapping,
    csvImportModal.importDefaults,
    csvImportModal.matchField,
    csvImportModal.catalogItemPicks,
    csvImportModal.matchFileColumn,
    csvImportCatalogMatchIndex,
  ]);

  const csvImportBulkDirectReadyRows = useMemo(() => {
    if (csvImportModal.importPurpose !== CSV_IMPORT_PURPOSE_UPDATE) return [];
    const matchIndex = buildExistingItemsMatchIndex(items, csvImportModal.matchField);
    return csvImportRowsWithAssessment.filter((r) => {
      const rowIndex = Number(r._rowIndex);
      if (csvImportModal.addedRowIndexes?.[String(rowIndex)]) return false;
      if (!r._importIssues?.ok) return false;
      if (!isImportUpdateRowReady(
        r,
        csvImportModal.mapping,
        csvImportModal.importDefaults,
        matchIndex,
        csvImportModal.matchField,
        rowIndex,
        csvImportModal.catalogItemPicks,
        csvImportModal.matchFileColumn
      )) return false;
      if (isImportRowInPendingDuplicateGroup(
        rowIndex,
        csvImportDuplicateGroups,
        csvImportModal.addedRowIndexes,
        csvImportModal.supersededRowIndexes,
        csvImportModal.duplicateGroupPlans || {}
      )) return false;
      if (isImportRowInPendingSheetMatchGroup(
        rowIndex,
        csvImportSheetMatchGroups,
        csvImportModal.addedRowIndexes,
        csvImportModal.supersededRowIndexes,
        csvImportModal.duplicateGroupPlans || {}
      )) return false;
      return true;
    });
  }, [
    csvImportRowsWithAssessment,
    csvImportModal.importPurpose,
    csvImportModal.addedRowIndexes,
    csvImportModal.mapping,
    csvImportModal.importDefaults,
    csvImportModal.matchField,
    csvImportModal.matchFileColumn,
    csvImportModal.catalogItemPicks,
    csvImportModal.duplicateGroupPlans,
    csvImportDuplicateGroups,
    csvImportSheetMatchGroups,
    items,
  ]);

  const importDefaultCount = useMemo(
    () => countImportDefaultsSet(csvImportModal.importDefaults),
    [csvImportModal.importDefaults]
  );

  const csvImportReadyChecklist = useMemo(() => {
    const m = csvImportModal.mapping || {};
    const defs = csvImportModal.importDefaults || {};
    const skuSource = csvImportModal.skuSource || CSV_IMPORT_SKU_FROM_FILE;
    const autoSku = skuSource === CSV_IMPORT_SKU_AUTO_RULE;
    const isUpdateImport = csvImportModal.importPurpose === CSV_IMPORT_PURPOSE_UPDATE;
    const matchField = csvImportModal.matchField || CSV_IMPORT_DEFAULT_MATCH_FIELD;
    const matchFileColumn = csvImportModal.matchFileColumn || '';
    const matchCfg = CSV_IMPORT_MATCH_FIELDS.find((f) => f.id === matchField) || CSV_IMPORT_MATCH_FIELDS[0];
    const reqCustom = (csvImportModal.fieldConfigs || []).filter((c) => c.is_required || c.isRequired);
    return {
      isUpdateImport,
      skuMapped: autoSku || !!m.sku || !!defs.sku,
      skuAutoRule: autoSku,
      skuRuleReady: autoSku ? skuRules.length > 0 && !!(csvImportModal.importSkuRuleId || skuRules.find((r) => r.is_default)) : true,
      nameMapped: !!m.name || !!defs.name,
      matchFieldLabel: matchCfg.label,
      matchMapped: hasImportMatchColumnMapped(m, defs, matchField, matchFileColumn),
      updateFieldsCount: isUpdateImport ? countUpdateImportFieldSources(m, defs) : 0,
      importDefaultsCount: importDefaultCount,
      requiredCustom: reqCustom.map((c) => {
        const fn = c.field_name || c.fieldName;
        const cfKey = `cf:${fn}`;
        return {
          key: fn,
          label: c.field_label || c.fieldLabel || fn,
          ok: !!m[cfKey] || !!defs[cfKey],
        };
      }),
    };
  }, [
    csvImportModal.mapping,
    csvImportModal.fieldConfigs,
    csvImportModal.skuSource,
    csvImportModal.importSkuRuleId,
    csvImportModal.importDefaults,
    csvImportModal.importPurpose,
    csvImportModal.matchField,
    csvImportModal.matchFileColumn,
    importDefaultCount,
    skuRules,
  ]);

  const isCsvUpdateImport = csvImportModal.importPurpose === CSV_IMPORT_PURPOSE_UPDATE;

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 16, padding: '24px 28px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '10px 14px' }}>
            <ShopOutlined style={{ fontSize: 28, color: '#fff' }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>Items</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>Manage your inventory items</div>
          </div>
        </div>
        {canManageItems && (
          <Space size={12}>
            <Button
              icon={<ImportOutlined />}
              size="large"
              onClick={openCsvImportModal}
              style={{ background: 'rgba(255,255,255,0.95)', color: '#4338ca', border: '2px solid rgba(255,255,255,0.85)', fontWeight: 700, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', fontSize: 15 }}
            >
              Import file
            </Button>
            <Button
              icon={<PlusOutlined />}
              size="large"
              onClick={openCreateModal}
              style={{ background: '#fff', color: '#764ba2', border: '2px solid rgba(255,255,255,0.6)', fontWeight: 700, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontSize: 15 }}
            >
              Add Item
            </Button>
          </Space>
        )}
      </div>

      {/* Stat Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {[
          { title: 'Total Items', value: items.length, icon: <InboxOutlined />, color: '#667eea', bg: '#f0f0ff' },
          { title: 'Active Items', value: activeCount, icon: <AppstoreOutlined />, color: '#52c41a', bg: '#f6ffed' },
          { title: 'Categories', value: categories.length, icon: <TagsOutlined />, color: '#fa8c16', bg: '#fff7e6' },
          { title: 'Low Stock', value: lowStockCount, icon: <WarningOutlined />, color: '#ff4d4f', bg: '#fff1f0' },
        ].map(s => (
          <Col xs={12} sm={6} key={s.title}>
            <Card variant="borderless" style={{ borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }} styles={{ body: { padding: '18px 20px' } }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ background: s.bg, borderRadius: 10, padding: 10, fontSize: 22, color: s.color }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.1 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>{s.title}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Table Card */}
      <Card
        variant="borderless"
        style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '18px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Space size={6}>
            {[
              { key: 'all', label: 'All', count: items.length, color: '#667eea', bg: '#f0f0ff', border: '#667eea' },
              { key: 'active', label: 'Active', count: items.filter(i => i.status === 'active').length, color: '#52c41a', bg: '#f6ffed', border: '#52c41a' },
              { key: 'inactive', label: 'Inactive', count: items.filter(i => i.status === 'inactive').length, color: '#ff4d4f', bg: '#fff1f0', border: '#ff4d4f' },
            ].map(f => (
              <span
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  border: `1.5px solid ${statusFilter === f.key ? f.border : '#e0e0e0'}`,
                  background: statusFilter === f.key ? f.bg : '#fff',
                  color: statusFilter === f.key ? f.color : '#8c8c8c',
                  transition: 'all 0.15s',
                }}
              >
                {f.label}
                <span style={{ background: statusFilter === f.key ? f.color : '#d9d9d9', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 11 }}>{f.count}</span>
              </span>
            ))}
          </Space>
          <Space wrap>
            <Input
              placeholder="Search by name, SKU, category or group..."
              prefix={<SearchOutlined style={{ color: '#bbb' }} />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 260, borderRadius: 10 }}
              allowClear
            />
            <Select
              value={itemGroupFilter}
              onChange={setItemGroupFilter}
              style={{ width: 220 }}
              options={[
                { value: 'all', label: 'All Item Groups' },
                ...itemGroups.map((group) => ({
                  value: group.id,
                  label: group.name
                }))
              ]}
            />
            <Select
              value={sortBy}
              onChange={setSortBy}
              style={{ width: 180 }}
              options={[
                { value: 'name_asc', label: 'Name: A to Z' },
                { value: 'name_desc', label: 'Name: Z to A' },
                { value: 'date_desc', label: 'Date: Newest' },
                { value: 'date_asc', label: 'Date: Oldest' }
              ]}
            />
            <ViewModeToggle
              value={itemsViewMode}
              onChange={setItemsViewMode}
              size="middle"
            />
            {canManageItems && (
              <Tooltip title="Configure SKU auto-generator rules (prefix, counter, date, per-category overrides)">
                <Button
                  icon={<SettingOutlined />}
                  onClick={openSkuRulesModal}
                  style={{
                    background: '#fff',
                    color: '#764ba2',
                    border: '1.5px solid #764ba2',
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 13,
                    height: 38,
                  }}
                >
                  SKU Rules
                </Button>
              </Tooltip>
            )}
            {canManageItems && (
              <Button
                icon={<ImportOutlined />}
                onClick={openCsvImportModal}
                style={{
                  background: '#fff',
                  color: '#4338ca',
                  border: '1.5px solid #4338ca',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  height: 38,
                }}
              >
                Import file
              </Button>
            )}
            {canManageItems && (
              <Button
                icon={<PlusOutlined />}
                onClick={openCreateModal}
                style={{
                  background: '#52c41a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  boxShadow: '0 3px 10px rgba(82,196,26,0.4)',
                  padding: '0 20px',
                  height: 38,
                }}
              >
                Add Item
              </Button>
            )}
          </Space>
        </div>
        <div style={{ padding: '16px 24px 24px' }}>
        <Tabs
          defaultActiveKey="items"
          items={[
            {
              key: 'items',
              label: <span>All Items <Tag color="purple" style={{ borderRadius: 20, marginLeft: 4 }}>{sortedFilteredItems.length}</Tag></span>,
              children: itemsViewMode === 'grid' ? (
                <ItemCatalogGrid
                  items={sortedFilteredItems}
                  loading={loading}
                  currency={currency}
                  canManageItems={canManageItems}
                  page={catalogGridPage}
                  pageSize={catalogGridPageSize}
                  onPageChange={setCatalogGridPage}
                  onPageSizeChange={(size) => {
                    setCatalogGridPageSize(size);
                    setCatalogGridPage(1);
                  }}
                  onView={viewItem}
                  onEdit={editItem}
                  onDuplicate={duplicateItem}
                  onToggleStatus={toggleItemStatus}
                />
              ) : (
                <Table
                  columns={columns}
                  dataSource={sortedFilteredItems}
                  loading={loading}
                  rowKey="id"
                  scroll={{ x: 'max-content' }}
                  rowClassName={(_, i) => i % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
                  pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} items`, style: { marginTop: 16 } }}
                />
              )
            },
            {
              key: 'drafts',
              label: <span>Drafts {drafts.length > 0 && <Tag color="orange" style={{ borderRadius: 20, marginLeft: 4 }}>{drafts.length}</Tag>}</span>,
              children: (
                <Table
                  loading={draftsLoading}
                  rowKey="id"
                  dataSource={drafts}
                  pagination={false}
                  locale={{ emptyText: 'No drafts saved' }}
                  columns={[
                    {
                      title: 'Item Name',
                      render: (_, r) => r.data?.name || <span style={{ color: '#bbb' }}>Untitled</span>
                    },
                    {
                      title: 'SKU',
                      render: (_, r) => r.data?.sku || '-'
                    },
                    {
                      title: 'Type',
                      render: (_, r) => r.data?.type ? <Tag color="blue" style={{ borderRadius: 20, textTransform: 'capitalize' }}>{r.data.type}</Tag> : '-'
                    },
                    {
                      title: 'Last Saved',
                      render: (_, r) => <span style={{ color: '#8c8c8c', fontSize: 13 }}>{new Date(r.savedAt).toLocaleString()}</span>
                    },
                    {
                      title: 'Actions',
                      render: (_, r) => (
                        <Space>
                          <Button
                            size="small"
                            style={{ borderRadius: 6, background: '#667eea', border: 'none', color: '#fff', fontWeight: 600 }}
                            onClick={() => openDraft(r)}
                          >
                            Continue
                          </Button>
                          <Button
                            size="small"
                            danger
                            style={{ borderRadius: 6 }}
                            onClick={async () => {
                              try {
                                await apiService.delete(`/items/draft/${r.id}`);
                                message.success('Draft deleted');
                                fetchDrafts();
                              } catch { message.error('Failed to delete draft'); }
                            }}
                          >
                            Delete
                          </Button>
                        </Space>
                      )
                    }
                  ]}
                />
              )
            }
          ]}
        />
        </div>
      </Card>

      <Modal
        title={isCsvUpdateImport ? 'Update items from CSV or Excel' : 'Import items from CSV or Excel'}
        open={csvImportModal.open}
        getContainer={() => document.body}
        wrapClassName="items-csv-import-modal-wrap"
        zIndex={CSV_IMPORT_MODAL_Z_INDEX}
        maskClosable={!itemFormOpenedFromImport}
        onCancel={() => {
          if (csvImportModal.busy) return;
          if (modalVisible && itemFormOpenedFromImport) {
            closeItemFormReturnToImport();
            return;
          }
          resetCsvImportModal();
        }}
        width={1080}
        destroyOnHidden
        footer={[
          <Button key="tpl" icon={<DownloadOutlined />} onClick={downloadItemsCsvTemplateFile}>
            Sample CSV
          </Button>,
          <Button
            key="remap"
            disabled={!csvImportModal.headers.length || csvImportModal.busy}
            onClick={() => {
              setCsvImportModal((prev) => {
                const isUpdate = prev.importPurpose === CSV_IMPORT_PURPOSE_UPDATE;
                if (isUpdate) {
                  return {
                    ...prev,
                    matchFileColumn: guessMatchFileColumn(prev.headers, prev.matchField),
                    result: null,
                  };
                }
                return {
                  ...prev,
                  mapping: buildInitialCsvMapping(prev.headers, prev.fieldConfigs || [], {
                    importPurpose: prev.importPurpose,
                    matchField: prev.matchField,
                  }),
                  result: null,
                };
              });
            }}
          >
            {isCsvUpdateImport ? 'Re-guess match column' : 'Re-auto map columns'}
          </Button>,
          <Button key="close" disabled={csvImportModal.busy} onClick={resetCsvImportModal}>
            Close
          </Button>,
        ]}
      >
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 14 }}
          message={isCsvUpdateImport ? 'Match file rows to existing items, then update in form' : 'Map your file columns to item fields'}
          description={
            <span>
              Choose which <AntText strong>row</AntText> in the file contains column names (CSV line or Excel sheet row). CSV and Excel (
              <AntText strong>.xlsx</AntText>
              ,{' '}
              <AntText strong>.xls</AntText>
              ) are supported — Excel uses the{' '}
              <AntText strong>first worksheet</AntText>
              {' '}only. Map columns to app fields.
              {isCsvUpdateImport ? (
                <>
                  {' '}Use <AntText strong>Update existing items</AntText> to change items already in your catalog. <AntText strong>Only map the fields you want to change</AntText> — unmapped fields keep their existing values. Match uses the field you choose (e.g. map <AntText strong>Description</AntText> to find items by name). Use <AntText strong>Auto-generate SKU</AntText> without mapping SKU to assign new SKUs from your rule. <AntText strong>Update directly</AntText> or <AntText strong>Update in form</AntText> per matched row.
                </>
              ) : (
                <>
                  {' '}Choose <AntText strong>SKU from file</AntText> or <AntText strong>Auto-generate SKU</AntText> (SKU column optional). When you use <AntText strong>Add in form</AntText>, missing master data is created where allowed and SKU is generated from your rule if configured. Rows with the same <AntText strong>SKU</AntText>, <AntText strong>item name</AntText>, or <AntText strong>description</AntText> are grouped under <AntText strong>Duplicate item groups</AntText> so you can merge quantities, pick one row, or add a note. Other rows use <AntText strong>Add in form</AntText>. Simple and Service types only (up to 5,000 data rows).
                </>
              )}
              {' '}Prices use your current item currency (
              <AntText strong>{priceCurrency}</AntText>
              ) and are converted to USD for the API like the item form.
              {isCsvUpdateImport
                ? ' On update, map only the columns you want to change — other item data is left unchanged.'
                : ' Use Default values for all rows when you do not want to map a column. File values override defaults when both exist.'}
            </span>
          }
        />
        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col xs={24}>
            <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 12 }}>Import action</div>
            <Radio.Group
              value={csvImportModal.importPurpose || CSV_IMPORT_PURPOSE_CREATE}
              disabled={csvImportModal.busy}
              onChange={(e) => {
                const nextPurpose = e.target.value;
                setCsvImportModal((prev) => {
                  const isUpdate = nextPurpose === CSV_IMPORT_PURPOSE_UPDATE;
                  const matchField = isUpdate
                    ? (prev.matchField || CSV_IMPORT_DEFAULT_MATCH_FIELD)
                    : CSV_IMPORT_DEFAULT_MATCH_FIELD;
                  return {
                    ...prev,
                    importPurpose: nextPurpose,
                    matchField,
                    mapping: isUpdate ? {} : buildInitialCsvMapping(prev.headers || [], prev.fieldConfigs || [], {
                      importPurpose: nextPurpose,
                      matchField,
                    }),
                    importDefaults: isUpdate ? {} : (prev.importDefaults || {}),
                    matchFileColumn: isUpdate && prev.headers?.length
                      ? guessMatchFileColumn(prev.headers, matchField)
                      : '',
                    csvImportPreviewFilters: {
                      ...prev.csvImportPreviewFilters,
                      onlyMatched: isUpdate,
                    },
                    catalogItemPicks: {},
                    result: null,
                  };
                });
              }}
            >
              <Radio value={CSV_IMPORT_PURPOSE_CREATE}>Create new items</Radio>
              <Radio value={CSV_IMPORT_PURPOSE_UPDATE}>Update existing items</Radio>
            </Radio.Group>
          </Col>
        </Row>
        {isCsvUpdateImport && (
          <Row gutter={12} style={{ marginBottom: 12 }}>
            <Col xs={24} sm={12} md={8}>
              <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 12 }}>Match catalog item by</div>
              <Select
                style={{ width: '100%' }}
                disabled={csvImportModal.busy}
                value={csvImportModal.matchField || CSV_IMPORT_DEFAULT_MATCH_FIELD}
                options={CSV_IMPORT_MATCH_FIELDS.map((f) => ({ value: f.id, label: f.label }))}
                onChange={(v) => {
                  setCsvImportModal((prev) => ({
                    ...prev,
                    matchField: v,
                    matchFileColumn: prev.headers?.length ? guessMatchFileColumn(prev.headers, v) : '',
                    catalogItemPicks: {},
                    result: null,
                  }));
                }}
              />
            </Col>
            {csvImportModal.headers.length > 0 && (
              <Col xs={24} sm={12} md={8}>
                <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 12 }}>File column for match</div>
                <Select
                  showSearch
                  allowClear
                  placeholder="Select column"
                  style={{ width: '100%' }}
                  disabled={csvImportModal.busy}
                  value={csvImportModal.matchFileColumn || undefined}
                  options={csvImportHeaderSelectOptions}
                  optionFilterProp="label"
                  onChange={(v) => {
                    setCsvImportModal((prev) => ({
                      ...prev,
                      matchFileColumn: v || '',
                      catalogItemPicks: {},
                      result: null,
                    }));
                  }}
                />
                <AntText type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  Values in this column are matched to existing items by{' '}
                  <AntText strong>{csvImportReadyChecklist.matchFieldLabel}</AntText>.
                  Only matched rows appear in the update list.
                </AntText>
              </Col>
            )}
            {csvImportModal.rows.length > 0 && (
              <Col xs={24} sm={12} md={14}>
                <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 12 }}>Catalog match summary</div>
                <Space wrap size={[8, 8]}>
                  <Tag color="success">{csvImportMatchStats.inCatalog} in catalog (listed below)</Tag>
                  <Tag color="processing">{csvImportMatchStats.matched} ready to update</Tag>
                  {csvImportMatchStats.ambiguous > 0 && (
                    <Tag color="warning">{csvImportMatchStats.ambiguous} pick catalog item</Tag>
                  )}
                  <Tag color="default">{csvImportMatchStats.unmatched + csvImportMatchStats.empty} not in catalog (ignored)</Tag>
                </Space>
                <AntText type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
                  Unmatched sheet rows are skipped. Use field mappings below only for values you want to change.
                </AntText>
                {csvImportMatchStats.ambiguous > 0 && (
                  <AntText type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                    Same name on multiple catalog items — pick which one in the list below, or map <AntText strong>SKU</AntText> to disambiguate.
                  </AntText>
                )}
              </Col>
            )}
          </Row>
        )}
        <Row gutter={12} style={{ marginBottom: 12 }}>
          {!isCsvUpdateImport && (
            <Col xs={24} sm={8}>
              <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 12 }}>Item type</div>
              <Select
                style={{ width: '100%' }}
                value={csvImportModal.itemType}
                disabled={csvImportModal.busy}
                options={csvImportTypeSelectOptions}
                onChange={(v) => {
                  setCsvImportModal((prev) => ({ ...prev, itemType: v, result: null }));
                }}
              />
            </Col>
          )}
          <Col xs={24} sm={isCsvUpdateImport ? 24 : 16}>
            <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 12 }}>Default warehouse (required if any row has opening stock)</div>
            <Select
              allowClear
              placeholder="Select warehouse"
              style={{ width: '100%' }}
              value={csvImportModal.defaultWarehouseId}
              disabled={csvImportModal.busy}
              options={(warehouses || []).map((w) => ({
                value: w.id,
                label: w.name || w.code || w.id,
              }))}
              onChange={(v) => setCsvImportModal((prev) => ({ ...prev, defaultWarehouseId: v || undefined, result: null }))}
            />
          </Col>
        </Row>

        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col xs={24}>
            <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 12 }}>
              {isCsvUpdateImport ? 'SKU on update' : 'SKU for imported items'}
            </div>
            <Radio.Group
              value={csvImportModal.skuSource || CSV_IMPORT_SKU_FROM_FILE}
              disabled={csvImportModal.busy}
              onChange={(e) => {
                const next = e.target.value;
                setCsvImportModal((prev) => ({
                  ...prev,
                  skuSource: next,
                  result: null,
                }));
              }}
            >
              <Radio value={CSV_IMPORT_SKU_FROM_FILE}>
                {isCsvUpdateImport
                  ? 'From file column (optional — keeps existing SKU when file cell is empty)'
                  : 'From file column (map SKU — required per row)'}
              </Radio>
              <Radio value={CSV_IMPORT_SKU_AUTO_RULE}>
                Auto-generate using SKU rules (when file SKU is empty and no default)
              </Radio>
            </Radio.Group>
            {csvImportModal.skuSource === CSV_IMPORT_SKU_AUTO_RULE && (
              <div style={{ marginTop: 10, maxWidth: 480 }}>
                <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 12 }}>SKU rule for import</div>
                <Select
                  style={{ width: '100%' }}
                  placeholder={skuRules.length ? 'Select SKU rule' : 'No rules — create in SKU settings'}
                  disabled={csvImportModal.busy || !skuRules.length}
                  value={csvImportModal.importSkuRuleId}
                  options={skuRules.map((r) => ({
                    value: r.id,
                    label: `${r.name}${r.is_default ? ' [Default]' : ''}${r.scope === 'category' ? ` (${r.scope_value})` : ''}`,
                  }))}
                  onChange={(v) => setCsvImportModal((prev) => ({ ...prev, importSkuRuleId: v }))}
                />
                <AntText type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  {isCsvUpdateImport
                    ? 'When SKU is not mapped (or the mapped cell is empty), a new SKU is generated from this rule. You do not need to map the SKU column.'
                    : 'Each row opens the item form with Name (required). SKU is generated automatically from this rule when the file SKU cell is empty.'}
                </AntText>
              </div>
            )}
          </Col>
        </Row>

        {!isCsvUpdateImport && (
          <ImportDefaultsPanel
            importDefaults={csvImportModal.importDefaults || {}}
            importPurpose={csvImportModal.importPurpose || CSV_IMPORT_PURPOSE_CREATE}
            skuSource={csvImportModal.skuSource}
            disabled={csvImportModal.busy}
            coreTargets={CSV_IMPORT_CORE_TARGETS}
            fieldConfigs={csvImportModal.fieldConfigs}
            categories={categories}
            unitOptions={unitOptions}
            brandOptions={brandOptions}
            manufacturerOptions={manufacturerOptions}
            itemGroups={itemGroups}
            taxRateOptions={taxRateOptions}
            canViewCategories={canViewCategories}
            defaultCount={importDefaultCount}
            onFieldChange={(fieldId, value) => {
              setCsvImportModal((prev) => ({
                ...prev,
                importDefaults: { ...(prev.importDefaults || {}), [fieldId]: value },
                result: null,
              }));
            }}
          />
        )}

        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col xs={24} sm={14} md={10}>
            <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 12 }}>Header row (1-based — CSV line or Excel row)</div>
            <InputNumber
              min={1}
              max={csvImportModal.csvImportFileLineCount > 0 ? csvImportModal.csvImportFileLineCount : undefined}
              value={csvImportModal.headerLineNumber}
              disabled={csvImportModal.busy}
              style={{ width: '100%' }}
              onChange={(v) => applyCsvHeaderLineNumber(v ?? 1)}
            />
            <AntText type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
              {csvImportModal.csvImportFileLineCount > 0
                ? (
                  csvImportModal.csvImportSourceFormat === 'xlsx'
                    ? `First sheet has ${csvImportModal.csvImportFileLineCount} used row(s) (trailing blank rows dropped). Row ${csvImportModal.headerLineNumber} is the header; following non-blank rows are data.`
                    : `Detected ${csvImportModal.csvImportFileLineCount} line(s) in the CSV (trailing empty lines dropped). Line ${csvImportModal.headerLineNumber} is the header row; the next non-blank lines are data.`
                )
                : 'Set the header row before or after upload (same numbering as Excel row numbers). Blank data rows are skipped.'}
            </AntText>
          </Col>
        </Row>

        <Upload.Dragger
          accept=".csv,.txt,.xlsx,.xls,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          multiple={false}
          showUploadList={false}
          disabled={csvImportModal.busy}
          beforeUpload={handleCsvImportBeforeUpload}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">Drop a CSV or Excel file here, or click to select</p>
          <p className="ant-upload-hint">UTF-8 CSV recommended. Excel: first sheet only (.xlsx / .xls). Use “Header row” if titles or blank rows appear before column names.</p>
        </Upload.Dragger>

        {isCsvUpdateImport && csvImportModal.headers.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <ImportUpdateFieldsPanel
              mapping={csvImportModal.mapping || {}}
              importDefaults={csvImportModal.importDefaults || {}}
              disabled={csvImportModal.busy}
              coreTargets={CSV_IMPORT_CORE_TARGETS}
              fieldConfigs={csvImportModal.fieldConfigs}
              headers={csvImportModal.headers}
              skuSource={csvImportModal.skuSource}
              categories={categories}
              unitOptions={unitOptions}
              brandOptions={brandOptions}
              manufacturerOptions={manufacturerOptions}
              itemGroups={itemGroups}
              taxRateOptions={taxRateOptions}
              canViewCategories={canViewCategories}
              onMappingChange={(fieldId, fileColumn) => {
                setCsvImportModal((prev) => ({
                  ...prev,
                  mapping: { ...(prev.mapping || {}), [fieldId]: fileColumn },
                  result: null,
                }));
              }}
              onDefaultChange={(fieldId, value) => {
                setCsvImportModal((prev) => ({
                  ...prev,
                  importDefaults: { ...(prev.importDefaults || {}), [fieldId]: value },
                  result: null,
                }));
              }}
              onRemoveMapping={(fieldId) => {
                setCsvImportModal((prev) => {
                  const next = { ...(prev.mapping || {}) };
                  delete next[fieldId];
                  return { ...prev, mapping: next, result: null };
                });
              }}
              onRemoveDefault={(fieldId) => {
                setCsvImportModal((prev) => {
                  const next = { ...(prev.importDefaults || {}) };
                  delete next[fieldId];
                  return { ...prev, importDefaults: next, result: null };
                });
              }}
            />
          </div>
        )}

        {!isCsvUpdateImport && csvImportModal.headers.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <AntText strong style={{ display: 'block', marginBottom: 8 }}>
              Column mapping ({csvImportModal.headers.length} file column(s), {csvImportModal.rows.length} data row(s))
            </AntText>
            <Table
              size="small"
              pagination={false}
              rowKey="key"
              scroll={{ y: 340 }}
              dataSource={csvImportMappingRows}
              columns={[
                { title: 'Section', dataIndex: 'group', width: 130, ellipsis: true },
                {
                  title: 'App field',
                  key: 'field',
                  width: 220,
                  render: (_, r) => (
                    <span>
                      {r.label}
                      {r.required ? <Tag color="red" style={{ marginLeft: 6, fontSize: 10 }}>required</Tag> : null}
                      {!r.required && csvImportModal.importDefaults?.[r.key] ? (
                        <Tag color="blue" style={{ marginLeft: 6, fontSize: 10 }}>default set</Tag>
                      ) : null}
                    </span>
                  ),
                },
                {
                  title: 'Maps from file column',
                  key: 'map',
                  render: (_, r) => (
                    <Select
                      style={{ width: '100%' }}
                      showSearch
                      optionFilterProp="label"
                      disabled={csvImportModal.busy}
                      value={csvImportModal.mapping[r.key] ?? ''}
                      options={csvImportHeaderSelectOptions}
                      onChange={(v) => {
                        setCsvImportModal((prev) => ({
                          ...prev,
                          mapping: { ...prev.mapping, [r.key]: v || '' },
                        }));
                      }}
                    />
                  ),
                },
              ]}
            />
          </div>
        )}

        {isCsvUpdateImport && csvImportModal.rows.length > 0 && csvImportModal.headers.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <AntText strong>
                Items matched for update ({csvImportMatchedUpdateRows.length})
              </AntText>
              {csvImportBulkDirectReadyRows.length > 0 && (
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  disabled={csvImportModal.busy || !canManageItems}
                  onClick={bulkDirectUpdateReadyImportRows}
                >
                  Update all ready directly ({csvImportBulkDirectReadyRows.length})
                </Button>
              )}
            </div>
            {csvImportMatchedUpdateRows.length === 0 ? (
              <Alert
                type="info"
                showIcon
                message="No catalog matches yet"
                description="Select a file column for catalog match above. Rows that match an item in your Items list will appear here. Other rows are ignored."
              />
            ) : (
              <Table
                size="small"
                rowKey="_rowIndex"
                dataSource={csvImportMatchedUpdateRows}
                scroll={{ x: 'max-content' }}
                pagination={{
                  defaultPageSize: 25,
                  pageSizeOptions: ['10', '25', '50', '100'],
                  showSizeChanger: true,
                  showTotal: (t) => `${t} matched row(s)`,
                }}
                columns={[
                  {
                    title: 'Line',
                    dataIndex: '__sourceLine',
                    width: 64,
                    render: (v) => (v != null ? v : '—'),
                  },
                  {
                    title: 'Sheet value',
                    key: 'sheetVal',
                    width: 200,
                    ellipsis: true,
                    render: (_, r) => getImportRowSheetMatchLabel(
                      r,
                      csvImportModal.mapping,
                      csvImportModal.importDefaults,
                      csvImportModal.matchField,
                      csvImportModal.matchFileColumn
                    ),
                  },
                  {
                    title: 'Catalog item',
                    key: 'catalogItem',
                    width: 240,
                    render: (_, r) => {
                      const match = r._catalogMatch;
                      const rowKey = String(r._rowIndex);
                      if (match?.status === 'matched' && r._matchedItem) {
                        return (
                          <span>
                            {r._matchedItem.sku ? `${r._matchedItem.sku} — ` : ''}
                            {r._matchedItem.name || '—'}
                          </span>
                        );
                      }
                      if (match?.status === 'ambiguous') {
                        return (
                          <Select
                            size="small"
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            placeholder="Pick catalog item"
                            style={{ width: '100%' }}
                            disabled={csvImportModal.busy}
                            value={csvImportModal.catalogItemPicks?.[rowKey]}
                            options={(match.matches || []).map((item) => ({
                              value: item.id,
                              label: `${item.sku || 'no SKU'} — ${item.name || '—'}`,
                            }))}
                            onChange={(v) => {
                              setCsvImportModal((prev) => {
                                const nextPicks = { ...(prev.catalogItemPicks || {}) };
                                if (v) nextPicks[rowKey] = v;
                                else delete nextPicks[rowKey];
                                return { ...prev, catalogItemPicks: nextPicks };
                              });
                            }}
                          />
                        );
                      }
                      return '—';
                    },
                  },
                  {
                    title: 'Status',
                    key: 'st',
                    width: 100,
                    render: (_, r) => {
                      if (r._importLevel === 'added') return <Tag color="success">Updated</Tag>;
                      if (r._catalogMatch?.status === 'matched') return <Tag color="success">Ready</Tag>;
                      if (r._catalogMatch?.status === 'ambiguous') {
                        return csvImportModal.catalogItemPicks?.[String(r._rowIndex)]
                          ? <Tag color="processing">Ready</Tag>
                          : <Tag color="warning">Pick item</Tag>;
                      }
                      return null;
                    },
                  },
                  {
                    title: 'Action',
                    key: 'act',
                    width: 200,
                    render: (_, r) => {
                      const rowIndex = Number(r._rowIndex);
                      const canOpen = r._importIssues?.ok
                        && !isImportRowInPendingDuplicateGroup(
                          rowIndex,
                          csvImportDuplicateGroups,
                          csvImportModal.addedRowIndexes,
                          csvImportModal.supersededRowIndexes,
                          csvImportModal.duplicateGroupPlans || {}
                        )
                        && !isImportRowInPendingSheetMatchGroup(
                          rowIndex,
                          csvImportSheetMatchGroups,
                          csvImportModal.addedRowIndexes,
                          csvImportModal.supersededRowIndexes,
                          csvImportModal.duplicateGroupPlans || {}
                        );
                      if (csvImportModal.addedRowIndexes?.[String(rowIndex)]) return null;
                      return (
                        <Space size={4} direction="vertical">
                          <Button
                            type="link"
                            size="small"
                            style={{ padding: 0, height: 'auto' }}
                            disabled={csvImportModal.busy || !canManageItems || !canOpen}
                            onClick={() => directUpdateItemFromImportRow(rowIndex)}
                          >
                            Update directly
                          </Button>
                          <Button
                            type="link"
                            size="small"
                            style={{ padding: 0, height: 'auto' }}
                            disabled={csvImportModal.busy || !canManageItems || !canOpen}
                            onClick={() => openImportRowInForm(rowIndex)}
                          >
                            Update in form
                          </Button>
                        </Space>
                      );
                    },
                  },
                ]}
              />
            )}
          </div>
        )}

        {isCsvUpdateImport && csvImportModal.rows.length > 0 && csvImportModal.headers.length > 0
          && csvImportSheetMatchGroups.length > 0 && (
          <ImportSheetMatchGroupsPanel
            groups={csvImportSheetMatchGroups}
            groupPlans={csvImportModal.duplicateGroupPlans || {}}
            rows={csvImportModal.rows || []}
            addedRowIndexes={csvImportModal.addedRowIndexes || {}}
            supersededRowIndexes={csvImportModal.supersededRowIndexes || {}}
            disabled={csvImportModal.busy}
            canManageItems={canManageItems}
            matchFieldLabel={csvImportReadyChecklist.matchFieldLabel}
            mapping={csvImportModal.mapping || {}}
            importDefaults={csvImportModal.importDefaults || {}}
            skuSource={csvImportModal.skuSource || CSV_IMPORT_SKU_FROM_FILE}
            onPlanChange={(groupKey, patch) => {
              setCsvImportModal((prev) => ({
                ...prev,
                duplicateGroupPlans: {
                  ...(prev.duplicateGroupPlans || {}),
                  [groupKey]: {
                    ...(prev.duplicateGroupPlans?.[groupKey] || {}),
                    ...patch,
                  },
                },
              }));
            }}
            onCatalogPickForGroup={(group, itemId) => {
              setCsvImportModal((prev) => {
                const nextPicks = { ...(prev.catalogItemPicks || {}) };
                if (itemId) {
                  group.rowIndexes.forEach((i) => {
                    nextPicks[String(i)] = itemId;
                  });
                } else {
                  group.rowIndexes.forEach((i) => {
                    delete nextPicks[String(i)];
                  });
                }
                return { ...prev, catalogItemPicks: nextPicks, result: null };
              });
            }}
            onMergeUpdateDirect={(group, plan) => {
              const mergeRowIndexes = getSheetMatchGroupSelectedRowIndexes(
                group,
                plan,
                csvImportModal.addedRowIndexes || {},
                csvImportModal.supersededRowIndexes || {}
              );
              if (!mergeRowIndexes.length) return;
              directUpdateItemFromImportRow(mergeRowIndexes[0], {
                mergeRowIndexes,
                importNote: plan.note,
                groupKey: group.groupKey,
                resolveDuplicateGroup: true,
              });
            }}
            onMergeUpdateInForm={(group, plan) => {
              const mergeRowIndexes = getSheetMatchGroupSelectedRowIndexes(
                group,
                plan,
                csvImportModal.addedRowIndexes || {},
                csvImportModal.supersededRowIndexes || {}
              );
              if (!mergeRowIndexes.length) return;
              openImportRowInForm(mergeRowIndexes[0], {
                mergeRowIndexes,
                importNote: plan.note,
                groupKey: group.groupKey,
                resolveDuplicateGroup: true,
                importMode: plan.mode === 'import_batches' ? 'import_batches' : undefined,
              });
            }}
            onDirectImportBatches={(group, plan) => {
              directImportBatchesFromGroup(
                {
                  ...group,
                  catalogItemId: group.resolvedItem?.id || group.catalogItemId,
                  catalogItemName: group.resolvedItem?.name || group.catalogItemName,
                },
                plan
              );
            }}
          />
        )}

        {csvImportModal.rows.length > 0 && csvImportModal.headers.length > 0 && csvImportDuplicateGroups.length > 0
          && !(isCsvUpdateImport && csvImportSheetMatchGroups.length > 0) && (
          <ImportDuplicateGroupsPanel
            groups={csvImportDuplicateGroups}
            duplicateGroupPlans={csvImportModal.duplicateGroupPlans || {}}
            rows={csvImportModal.rows || []}
            mapping={csvImportModal.mapping || {}}
            importDefaults={csvImportModal.importDefaults || {}}
            addedRowIndexes={csvImportModal.addedRowIndexes || {}}
            supersededRowIndexes={csvImportModal.supersededRowIndexes || {}}
            disabled={csvImportModal.busy}
            canManageItems={canManageItems}
            importPurpose={csvImportModal.importPurpose || CSV_IMPORT_PURPOSE_CREATE}
            onPlanChange={(groupKey, patch) => {
              setCsvImportModal((prev) => ({
                ...prev,
                duplicateGroupPlans: {
                  ...(prev.duplicateGroupPlans || {}),
                  [groupKey]: {
                    ...(prev.duplicateGroupPlans?.[groupKey] || {}),
                    ...patch,
                  },
                },
              }));
            }}
            onAddInForm={(group, plan) => {
              if (plan.mode === 'import_batches' || plan.mode === 'merge') {
                const mergeRowIndexes = getImportGroupSelectedRowIndexes(
                  group,
                  plan,
                  csvImportModal.addedRowIndexes || {},
                  csvImportModal.supersededRowIndexes || {}
                );
                if (!mergeRowIndexes.length) return;
                openImportRowInForm(mergeRowIndexes[0], {
                  mergeRowIndexes,
                  importNote: plan.note,
                  groupKey: group.groupKey,
                  resolveDuplicateGroup: true,
                  importMode: plan.mode === 'import_batches' ? 'import_batches' : undefined,
                });
              } else {
                const primaryIndex = plan.selectedRowIndex ?? group.rowIndexes[0];
                openImportRowInForm(primaryIndex, {
                  pickOneGroupRowIndexes: group.rowIndexes,
                  importNote: plan.note,
                  groupKey: group.groupKey,
                  resolveDuplicateGroup: true,
                });
              }
            }}
            onDirectImportBatches={(group, plan) => {
              directImportBatchesFromGroup(group, plan);
            }}
            onDirectUpdate={isCsvUpdateImport ? (group, plan) => {
              if (plan.mode === 'import_batches') {
                directImportBatchesFromGroup(group, plan);
                return;
              }
              if (plan.mode === 'merge') {
                const mergeRowIndexes = getImportGroupSelectedRowIndexes(
                  group,
                  plan,
                  csvImportModal.addedRowIndexes || {},
                  csvImportModal.supersededRowIndexes || {}
                );
                if (!mergeRowIndexes.length) return;
                directUpdateItemFromImportRow(mergeRowIndexes[0], {
                  mergeRowIndexes,
                  importNote: plan.note,
                  groupKey: group.groupKey,
                  resolveDuplicateGroup: true,
                });
              } else {
                const primaryIndex = plan.selectedRowIndex ?? group.rowIndexes[0];
                directUpdateItemFromImportRow(primaryIndex, {
                  pickOneGroupRowIndexes: group.rowIndexes,
                  importNote: plan.note,
                  groupKey: group.groupKey,
                  resolveDuplicateGroup: true,
                });
              }
            } : undefined}
          />
        )}

        {csvImportModal.rows.length > 0 && csvImportModal.headers.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <AntText strong style={{ display: 'block', marginBottom: 8 }}>
              {isCsvUpdateImport ? 'Update requirements (mapping)' : 'Add-item requirements (mapping)'}
            </AntText>
            <Space wrap size={[8, 8]} style={{ marginBottom: 10 }}>
              {csvImportReadyChecklist.isUpdateImport ? (
                <>
                  <Tag
                    icon={csvImportReadyChecklist.matchMapped ? <CheckOutlined /> : <CloseOutlined />}
                    color={csvImportReadyChecklist.matchMapped ? 'success' : 'default'}
                  >
                    {csvImportReadyChecklist.matchFieldLabel} (match column)
                  </Tag>
                  {csvImportReadyChecklist.updateFieldsCount > 0 ? (
                    <Tag color="processing">
                      {csvImportReadyChecklist.updateFieldsCount} field(s) to update
                    </Tag>
                  ) : (
                    <Tag color="warning">Add at least one field mapping or default</Tag>
                  )}
                  {csvImportReadyChecklist.skuAutoRule ? (
                    <Tag
                      icon={csvImportReadyChecklist.skuRuleReady ? <CheckOutlined /> : <CloseOutlined />}
                      color={csvImportReadyChecklist.skuRuleReady ? 'processing' : 'warning'}
                    >
                      Auto SKU on empty (rule)
                    </Tag>
                  ) : (
                    <Tag color="default">SKU optional (keeps existing)</Tag>
                  )}
                </>
              ) : (
                <>
                  {csvImportReadyChecklist.skuAutoRule ? (
                    <Tag
                      icon={csvImportReadyChecklist.skuRuleReady ? <CheckOutlined /> : <CloseOutlined />}
                      color={csvImportReadyChecklist.skuRuleReady ? 'processing' : 'warning'}
                    >
                      Auto SKU (rule)
                    </Tag>
                  ) : (
                    <Tag
                      icon={csvImportReadyChecklist.skuMapped ? <CheckOutlined /> : <CloseOutlined />}
                      color={csvImportReadyChecklist.skuMapped ? 'success' : 'default'}
                    >
                      SKU column mapped
                    </Tag>
                  )}
                  <Tag
                    icon={csvImportReadyChecklist.nameMapped ? <CheckOutlined /> : <CloseOutlined />}
                    color={csvImportReadyChecklist.nameMapped ? 'success' : 'default'}
                  >
                    Name (column or default)
                  </Tag>
                </>
              )}
              {!isCsvUpdateImport && csvImportReadyChecklist.importDefaultsCount > 0 && (
                <Tag color="processing">{csvImportReadyChecklist.importDefaultsCount} import default(s)</Tag>
              )}
              {csvImportReadyChecklist.requiredCustom.map((c) => (
                <Tag
                  key={c.key}
                  icon={c.ok ? <CheckOutlined /> : <CloseOutlined />}
                  color={c.ok ? 'success' : 'warning'}
                >
                  {c.label} (required custom field)
                </Tag>
              ))}
            </Space>
            <AntText type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              {isCsvUpdateImport ? (
                <>
                  Use the <AntText strong>Items matched for update</AntText> list above for day-to-day work.
                  Full preview below is optional (all sheet rows).
                </>
              ) : (
                <>
                  Preview shows loaded rows (after filters).
                </>
              )}
              {!isCsvUpdateImport && (
                <>
                  {' '}<AntText strong>Ready</AntText> means Name is mapped and filled
                  {csvImportModal.skuSource === CSV_IMPORT_SKU_AUTO_RULE
                    ? ' (SKU may be blank — generated from your rule on Add in form).'
                    : ', and SKU is mapped and filled.'}
                  {' '}Use <AntText strong>Add in form</AntText> per row.
                </>
              )}
              {isCsvUpdateImport && (
                <>
                  {' '}<AntText strong>Ready</AntText> = matched catalog item (pick if needed). Use <AntText strong>Update directly</AntText> or <AntText strong>Update in form</AntText>.
                </>
              )}
            </AntText>
            <Space wrap style={{ marginBottom: 8 }}>
              <AntText strong>Preview filters:</AntText>
              <Checkbox
                checked={!!csvImportModal.csvImportPreviewFilters?.hideMissingSku}
                disabled={csvImportModal.busy}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setCsvImportModal((prev) => ({
                    ...prev,
                    csvImportPreviewFilters: {
                      ...prev.csvImportPreviewFilters,
                      hideMissingSku: checked,
                    },
                  }));
                }}
              >
                Hide rows missing SKU
              </Checkbox>
              <Checkbox
                checked={!!csvImportModal.csvImportPreviewFilters?.hideMissingName}
                disabled={csvImportModal.busy}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setCsvImportModal((prev) => ({
                    ...prev,
                    csvImportPreviewFilters: {
                      ...prev.csvImportPreviewFilters,
                      hideMissingName: checked,
                    },
                  }));
                }}
              >
                Hide rows missing Name
              </Checkbox>
              <Checkbox
                checked={!!csvImportModal.csvImportPreviewFilters?.onlyReady}
                disabled={csvImportModal.busy}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setCsvImportModal((prev) => ({
                    ...prev,
                    csvImportPreviewFilters: {
                      ...prev.csvImportPreviewFilters,
                      onlyReady: checked,
                    },
                  }));
                }}
              >
                Only ready rows (Name{csvImportModal.skuSource === CSV_IMPORT_SKU_AUTO_RULE ? '' : ' + SKU'})
              </Checkbox>
              <Checkbox
                checked={!!csvImportModal.csvImportPreviewFilters?.onlyIssues}
                disabled={csvImportModal.busy}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setCsvImportModal((prev) => ({
                    ...prev,
                    csvImportPreviewFilters: {
                      ...prev.csvImportPreviewFilters,
                      onlyIssues: checked,
                    },
                  }));
                }}
              >
                Only rows with issues
              </Checkbox>
              {isCsvUpdateImport && (
                <Checkbox
                  checked={csvImportModal.csvImportPreviewFilters?.onlyMatched ?? true}
                  disabled={csvImportModal.busy}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setCsvImportModal((prev) => ({
                      ...prev,
                      csvImportPreviewFilters: {
                        ...prev.csvImportPreviewFilters,
                        onlyMatched: checked,
                      },
                    }));
                  }}
                >
                  Hide rows not in catalog
                </Checkbox>
              )}
            </Space>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 8, fontSize: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, background: '#fff1f0', border: '1px solid #ffccc7' }} />
                <AntText type="secondary">Blocking mismatch</AntText>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, background: '#fffbe6', border: '1px solid #ffe58f' }} />
                <AntText type="secondary">Warning / will auto-fix</AntText>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, background: '#f6ffed', border: '1px solid #b7eb8f' }} />
                <AntText type="secondary">{isCsvUpdateImport ? 'Updated' : 'Added'}</AntText>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, background: '#f5f5f5', border: '1px solid #d9d9d9' }} />
                <AntText type="secondary">Skipped (duplicate group)</AntText>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, background: '#ffccc7', border: '1px solid #ff7875' }} />
                <AntText type="secondary">Mismatched cell</AntText>
              </span>
            </div>
            {isCsvUpdateImport && csvImportPreviewRows.length === 0 && csvImportModal.rows.length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 10 }}
                message="No rows in preview"
                description={
                  <span>
                    {csvImportMatchStats.matched === 0 && csvImportMatchStats.ambiguous === 0 ? (
                      <>
                        None of the {csvImportModal.rows.length} file row(s) matched an existing catalog item by{' '}
                        <AntText strong>{csvImportReadyChecklist.matchFieldLabel}</AntText>.
                        {' '}Uncheck <AntText strong>Only matched catalog items</AntText> to see all rows and why each failed.
                        {' '}Select the correct <AntText strong>File column for match</AntText> (e.g. product title in Description).
                        {' '}Values must match items already in your Items list (case-insensitive).
                      </>
                    ) : csvImportMatchStats.ambiguous > 0 && csvImportMatchStats.matched === 0 ? (
                      <>
                        {csvImportMatchStats.ambiguous} row(s) match multiple catalog items with the same name (e.g. KM and KMX-10).
                        {' '}Uncheck <AntText strong>Only matched catalog items</AntText>, map <AntText strong>SKU</AntText> to <AntText strong>SERIAL NUMBER</AntText>, or pick the item in the <AntText strong>Matched item</AntText> column.
                      </>
                    ) : (
                      <>
                        {csvImportMatchStats.matched} row(s) matched the catalog but are hidden by filters.
                        {' '}Uncheck <AntText strong>Only matched catalog items</AntText> or adjust other preview filters.
                      </>
                    )}
                  </span>
                }
              />
            )}
            <AntText type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
              Showing {csvImportPreviewRows.length} of {csvImportModal.rows.length} row(s) in preview
              {csvImportIssueStats.errors > 0 && (
                <>
                  {' '}· <AntText type="danger" strong>{csvImportIssueStats.errors}</AntText> blocking
                </>
              )}
              {csvImportIssueStats.warnings > 0 && (
                <>
                  {' '}· <AntText style={{ color: '#d48806' }} strong>{csvImportIssueStats.warnings}</AntText> warning(s)
                </>
              )}
              {csvImportIssueStats.added > 0 && (
                <>
                  {' '}· <AntText type="success" strong>{csvImportIssueStats.added}</AntText> {isCsvUpdateImport ? 'updated' : 'added'}
                </>
              )}
              {isCsvUpdateImport && csvImportMatchStats.matched > 0 && (
                <>
                  {' '}· <AntText type="success" strong>{csvImportMatchStats.matched}</AntText> catalog match(es)
                </>
              )}
            </AntText>
            <Table
              style={{ marginTop: 4 }}
              size="small"
              rowKey="_rowIndex"
              dataSource={csvImportPreviewRows}
              scroll={{ x: 'max-content', y: 360 }}
              pagination={{
                defaultPageSize: 50,
                pageSizeOptions: ['25', '50', '100', '200'],
                showSizeChanger: true,
                showTotal: (t) => `Preview ${t} row(s)`,
              }}
              onRow={(record) => ({
                style: IMPORT_PREVIEW_ROW_STYLE[record._importLevel] || IMPORT_PREVIEW_ROW_STYLE.ok,
              })}
              columns={[
                {
                  title: 'Line',
                  dataIndex: '__sourceLine',
                  width: 64,
                  fixed: 'left',
                  render: (v) => (v != null ? v : '—'),
                },
                {
                  title: 'Issues',
                  key: 'issues',
                  width: 168,
                  fixed: 'left',
                  render: (_, r) => {
                    if (r._importLevel === 'added') {
                      return <Tag color="success" style={{ margin: 0 }}>{isCsvUpdateImport ? 'Updated' : 'Added'}</Tag>;
                    }
                    if (r._importSuperseded) {
                      return <Tag style={{ margin: 0 }}>Skipped</Tag>;
                    }
                    const iss = r._importIssues;
                    if (!iss || r._importLevel === 'ok') {
                      return (
                        <Tag color="success" style={{ margin: 0 }} icon={<CheckCircleOutlined />}>
                          OK
                        </Tag>
                      );
                    }
                    const tip = (
                      <div style={{ maxWidth: 360 }}>
                        {iss.errors?.length > 0 && (
                          <div style={{ marginBottom: iss.warnings?.length ? 8 : 0 }}>
                            <AntText strong type="danger">Blocking</AntText>
                            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                              {iss.errors.map((e) => (
                                <li key={e}>{e}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {iss.warnings?.length > 0 && (
                          <div>
                            <AntText strong style={{ color: '#d48806' }}>Warnings</AntText>
                            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                              {iss.warnings.map((w) => (
                                <li key={w}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                    if (r._importLevel === 'error') {
                      return (
                        <Tooltip title={tip}>
                          <Tag color="error" style={{ margin: 0, cursor: 'help' }} icon={<CloseOutlined />}>
                            Blocked
                          </Tag>
                        </Tooltip>
                      );
                    }
                    return (
                      <Tooltip title={tip}>
                        <Tag color="warning" style={{ margin: 0, cursor: 'help' }} icon={<WarningOutlined />}>
                          Review
                        </Tag>
                      </Tooltip>
                    );
                  },
                },
                ...(isCsvUpdateImport ? [{
                  title: 'Matched item',
                  key: 'matchedItem',
                  width: 220,
                  fixed: 'left',
                  render: (_, r) => {
                    const match = r._catalogMatch;
                    const rowKey = String(r._rowIndex);
                    if (match?.status === 'matched' && r._matchedItem) {
                      const tip = match.disambiguatedBy === 'sku'
                        ? `Matched by name + SKU (${r._matchedItem.sku})`
                        : match.pickedManually
                          ? `You selected SKU ${r._matchedItem.sku || '—'}`
                          : (r._matchedItem.sku ? `SKU: ${r._matchedItem.sku}` : undefined);
                      return (
                        <Tooltip title={tip}>
                          <span>
                            {r._matchedItem.sku ? `${r._matchedItem.sku} — ` : ''}
                            {r._matchedItem.name || '—'}
                          </span>
                        </Tooltip>
                      );
                    }
                    if (match?.status === 'ambiguous') {
                      return (
                        <Select
                          size="small"
                          allowClear
                          showSearch
                          optionFilterProp="label"
                          placeholder="Pick catalog item"
                          style={{ width: '100%' }}
                          disabled={csvImportModal.busy}
                          value={csvImportModal.catalogItemPicks?.[rowKey]}
                          options={(match.matches || []).map((item) => ({
                            value: item.id,
                            label: `${item.sku || 'no SKU'} — ${item.name || '—'}`,
                          }))}
                          onChange={(v) => {
                            setCsvImportModal((prev) => {
                              const nextPicks = { ...(prev.catalogItemPicks || {}) };
                              if (v) nextPicks[rowKey] = v;
                              else delete nextPicks[rowKey];
                              return { ...prev, catalogItemPicks: nextPicks };
                            });
                          }}
                        />
                      );
                    }
                    if (match?.status === 'no_match') {
                      return <AntText type="danger">Not found</AntText>;
                    }
                    return <AntText type="secondary">—</AntText>;
                  },
                }] : []),
                {
                  title: 'Action',
                  key: 'addInForm',
                  width: isCsvUpdateImport ? 148 : 132,
                  fixed: 'left',
                  render: (_, r) => {
                    const rowKey = String(r._rowIndex);
                    const rowIndex = Number(r._rowIndex);
                    if (csvImportModal.addedRowIndexes?.[rowKey]) {
                      return null;
                    }
                    if (r._importSuperseded) {
                      return (
                        <AntText type="secondary" style={{ fontSize: 12 }}>
                          Use group above
                        </AntText>
                      );
                    }
                    const pendingDup = isImportRowInPendingDuplicateGroup(
                      rowIndex,
                      csvImportDuplicateGroups,
                      csvImportModal.addedRowIndexes,
                      csvImportModal.supersededRowIndexes,
                      csvImportModal.duplicateGroupPlans || {}
                    );
                    const canOpen = r._importIssues?.ok && !pendingDup;
                    const tip = pendingDup
                      ? 'This row matches another by SKU, name, or description — resolve it in Duplicate item groups above'
                      : canOpen
                        ? (isCsvUpdateImport
                          ? 'Update matched catalog item with file values'
                          : 'Open add-item form with mapped values')
                        : (r._importIssues?.errors?.[0] || 'Fix blocking issues before opening the form');
                    if (isCsvUpdateImport) {
                      return (
                        <Space size={0} direction="vertical">
                          <Tooltip title={canOpen ? 'Apply file values without opening the form' : tip}>
                            <Button
                              type="link"
                              size="small"
                              style={{ padding: 0, height: 'auto' }}
                              disabled={csvImportModal.busy || !canManageItems || !canOpen}
                              onClick={() => directUpdateItemFromImportRow(rowIndex)}
                            >
                              Update directly
                            </Button>
                          </Tooltip>
                          <Tooltip title={tip}>
                            <Button
                              type="link"
                              size="small"
                              style={{ padding: 0, height: 'auto' }}
                              disabled={csvImportModal.busy || !canManageItems || !canOpen}
                              onClick={() => openImportRowInForm(rowIndex)}
                            >
                              Update in form
                            </Button>
                          </Tooltip>
                        </Space>
                      );
                    }
                    return (
                      <Tooltip title={tip}>
                        <Button
                          type="link"
                          size="small"
                          disabled={csvImportModal.busy || !canManageItems || !canOpen}
                          onClick={() => openImportRowInForm(rowIndex)}
                        >
                          Add in form
                        </Button>
                      </Tooltip>
                    );
                  },
                },
                ...csvImportModal.headers.map((h) => ({
                  title: h,
                  key: h,
                  ellipsis: true,
                  width: 118,
                  onCell: (record) => {
                    if (record._importIssues?.mismatchColumns?.includes(h)) {
                      return { style: IMPORT_PREVIEW_CELL_MISMATCH_STYLE };
                    }
                    return {};
                  },
                  render: (_, r) => {
                    const v = r[h];
                    if (v === undefined || v === null) return '';
                    const text = String(v);
                    const mismatch = r._importIssues?.mismatchColumns?.includes(h);
                    if (!mismatch) return text;
                    return (
                      <Tooltip title="Value does not match system rules or master data">
                        <span style={{ fontWeight: 600, color: '#cf1322' }}>{text}</span>
                      </Tooltip>
                    );
                  },
                })),
              ]}
            />
          </div>
        )}

      </Modal>
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 16 }}>
              {editingItem ? <EditOutlined /> : <PlusOutlined />}
            </div>
            <span style={{ fontWeight: 700, fontSize: 17 }}>
              {editingItem ? 'Edit Item' : itemFormOpenedFromImport ? 'Add Item from Import' : 'Add New Item'}
            </span>
          </div>
        }
        open={modalVisible}
        getContainer={() => document.body}
        wrapClassName={itemFormOpenedFromImport ? 'items-item-form-import-wrap' : undefined}
        zIndex={itemFormOpenedFromImport ? ITEM_FORM_MODAL_OVER_IMPORT_Z_INDEX : undefined}
        onCancel={() => {
          if (itemFormOpenedFromImport) {
            closeItemFormReturnToImport();
            return;
          }
          setModalVisible(false);
          setItemFormOpenedFromImport(false);
          setEditingItem(null);
          setImageUrl('');
          setImageFile(null);
          setDuplicateBanner(null);
          setDuplicateSourcePayload(null);
          setDraftBanner(null);
          setActiveDraftId(null);
          setExistingCustomFields({});
          setVariantMatrixEdits([]);
          setCompositeComponents([]);
          setEditingWarehouseSummaries([]);
          setSelectedSkuRuleId(null);
          setLastAppliedSkuRule(null);
          form.resetFields();
        }}
        footer={null}
        width="min(1440px, 99vw)"
        style={{ top: 8 }}
        styles={{
          body: { background: '#fafbff', borderRadius: '0 0 12px 12px', maxHeight: '88vh', overflowY: 'auto', padding: 20 },
          ...(itemFormOpenedFromImport ? {
            mask: { zIndex: ITEM_FORM_MODAL_OVER_IMPORT_Z_INDEX },
            wrapper: { zIndex: ITEM_FORM_MODAL_OVER_IMPORT_Z_INDEX },
          } : {}),
        }}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}
          style={{ '--ant-input-border-radius': '8px' }}
        >

          {/* Duplicate banner */}
          {duplicateBanner && (
            <div style={{ background: 'linear-gradient(135deg, #fff7e6, #fffbe6)', border: '1px solid #ffd591', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <CopyOutlined style={{ color: '#fa8c16', fontSize: 18 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#d46b08', fontSize: 13 }}>Duplicated from "{duplicateBanner.sourceName}"</div>
                <div style={{ fontSize: 12, color: '#ad6800', marginTop: 2 }}>All values are copied. Update at least one field before saving so this does not remain an exact duplicate.</div>
              </div>
              <Button size="small" style={{ borderRadius: 6, borderColor: '#ffa940', color: '#fa8c16' }} onClick={() => setDuplicateBanner(null)}>Dismiss</Button>
            </div>
          )}

          {/* Draft restored banner */}
          {draftBanner && (
            <div style={{ background: '#e6f4ff', border: '1px solid #91caff', borderRadius: 8, padding: '8px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#1677ff' }}>📝 Draft restored from {new Date(draftBanner.savedAt).toLocaleString()}</span>
              <Button size="small" danger onClick={async () => {
                try {
                  if (draftBanner?.draftId) {
                    await apiService.delete(`/items/draft/${draftBanner.draftId}`);
                  }
                } catch {}
                setDraftBanner(null);
                setActiveDraftId(null);
                form.resetFields();
                setImageUrl('');
                fetchDrafts();
              }}>Discard</Button>
            </div>
          )}

          {!editingItem && possibleDuplicateItems.length > 0 && (
            <div style={{ background: 'linear-gradient(135deg, #fffbe6, #fff7e6)', border: '1px solid #ffd666', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <WarningOutlined style={{ color: '#d48806', fontSize: 18, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#ad6800', fontSize: 13, marginBottom: 4 }}>
                    Possible existing item found
                  </div>
                  <div style={{ fontSize: 12, color: '#ad6800', marginBottom: 12 }}>
                    A matching item already exists by SKU, name, barcode, or batch number. Update the existing record if it is the same master data, or use <strong>Copy all data</strong> to pre-fill this form from a match and then change SKU or other fields before saving as a new item.
                  </div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {possibleDuplicateItems.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          alignItems: 'center',
                          background: '#fff',
                          border: '1px solid #ffe58f',
                          borderRadius: 8,
                          padding: '10px 12px'
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700, color: '#262626' }}>
                            {item.name || 'Unnamed Item'}
                          </div>
                          <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                            SKU: {item.sku || 'N/A'}
                            {item.barcode ? ` | Barcode: ${item.barcode}` : ''}
                            {item.batch_number ? ` | Batch: ${item.batch_number}` : ''}
                          </div>
                          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {item.duplicateReasons.map((reason) => (
                              <Tag key={`${item.id}-${reason}`} color="orange" style={{ borderRadius: 20, marginInlineEnd: 0 }}>
                                {reason}
                              </Tag>
                            ))}
                            <Tag color={item.status === 'active' ? 'green' : 'default'} style={{ borderRadius: 20, marginInlineEnd: 0, textTransform: 'capitalize' }}>
                              {item.status || 'unknown'}
                            </Tag>
                          </div>
                        </div>
                        <Space wrap>
                          <Button
                            size="small"
                            icon={<EyeOutlined />}
                            style={{ borderRadius: 6 }}
                            onClick={() => viewItem(item)}
                          >
                            View
                          </Button>
                          {canManageItems && (
                            <>
                              <Tooltip title="Load every field from this item into the form. You stay on Add Item — change SKU (and anything else) before save.">
                                <Button
                                  size="small"
                                  icon={<CopyOutlined />}
                                  style={{ borderRadius: 6 }}
                                  onClick={() => duplicateItem(item)}
                                >
                                  Copy all data
                                </Button>
                              </Tooltip>
                              <Button
                                size="small"
                                type="primary"
                                icon={<EditOutlined />}
                                style={{ borderRadius: 6 }}
                                onClick={() => openPossibleDuplicateForEdit(item)}
                              >
                                Update Existing
                              </Button>
                            </>
                          )}
                        </Space>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Section: Basic Info ── */}
          <div style={sectionStyle}>
            {itemFormOpenedFromImport && importCustomFieldsPreview.length > 0 && (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 14 }}
                message="Custom fields from import"
                description={
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {importCustomFieldsPreview.map((f) => (
                      <Tag key={f.key} style={{ margin: 0 }}>
                        {f.label}: <strong>{String(f.value)}</strong>
                      </Tag>
                    ))}
                  </div>
                }
              />
            )}
            <div style={sectionHeader}>
              <span style={sectionIconStyle}><AppstoreOutlined /></span>
              Basic Information
            </div>
            <Row gutter={16}>
              <Col xs={24} md={16}>
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      name="sku"
                      label={
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span>SKU</span>
                          {canManageItems && (
                            <Tooltip title="Open SKU rule settings">
                              <Button
                                type="text"
                                size="small"
                                icon={<SettingOutlined />}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openSkuRulesModal();
                                }}
                                style={{
                                  width: 22,
                                  height: 22,
                                  minWidth: 22,
                                  padding: 0,
                                  borderRadius: '50%',
                                  color: '#764ba2'
                                }}
                              />
                            </Tooltip>
                          )}
                        </span>
                      }
                      validateTrigger={['onBlur', 'onSubmit']}
                      rules={[{ validator: validateSkuAvailability }]}
                      style={{ marginBottom: 10 }}
                    >
                      <Input
                        placeholder="e.g. ITEM-001"
                        style={{ borderRadius: 8 }}
                      />
                    </Form.Item>
                    <div
                      style={{
                        marginBottom: 8,
                        padding: '10px 10px',
                        borderRadius: 12,
                        border: '1px solid #edf0ff',
                        background: 'linear-gradient(180deg, #fbfbff 0%, #f7f7ff 100%)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Select
                          placeholder="Pick SKU rule (optional)"
                          value={selectedSkuRuleId}
                          allowClear
                          loading={skuRulesLoading}
                          onChange={(value) => {
                            setSelectedSkuRuleId(value || null);
                            setLastAppliedSkuRule(null);
                          }}
                          style={{ width: '100%' }}
                          options={skuRules.map((r) => ({
                            value: r.id,
                            label: `${r.name}${r.scope === 'category' ? ` (Category: ${r.scope_value})` : ' (Institution)'}${r.is_default ? ' [Default]' : ''}`
                          }))}
                        />
                        {lastAppliedSkuRule ? (
                          <Tag color="purple" style={{ marginInlineEnd: 0, whiteSpace: 'nowrap' }}>
                            Applied: {lastAppliedSkuRule.name}
                          </Tag>
                        ) : null}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, color: '#6b7280' }}>
                        Leave empty to auto-pick (category rule → default → secondary)
                      </div>
                      <Tooltip title="Generate SKU using the selected rule (or auto-pick if none)">
                        <Button
                          block
                          type="primary"
                          loading={skuGenerating}
                          icon={<ThunderboltOutlined />}
                          onClick={handleGenerateSku}
                          style={{
                            marginTop: 10,
                            height: 40,
                            borderRadius: 12,
                            border: 'none',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            boxShadow: '0 10px 22px rgba(118, 75, 162, 0.22)',
                            fontWeight: 700
                          }}
                        >
                          Generate SKU
                        </Button>
                      </Tooltip>
                    </div>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="name" label="Item Name" rules={[{ required: true, message: 'Please input name!' }]}>
                      <Input placeholder="Enter item name" style={{ borderRadius: 8 }} />
                    </Form.Item>
                  </Col>
                </Row>
                {watchedItemType !== 'variant' && (
                <>
                <div
                  style={{
                    marginBottom: 14,
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1px solid #e6ecff',
                    background: 'linear-gradient(180deg, #fbfcff 0%, #f7f9ff 100%)'
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#3659c9', marginBottom: 4 }}>
                    Quick Variant Tags
                  </div>
                  <div style={{ fontSize: 12, color: '#5b6475', lineHeight: 1.6 }}>
                    Use these optional fields for a single descriptor such as colour, size, or packing. They help with SKU generation and search, but they are not meant for multi-combination variants.
                  </div>
                </div>
                <Row gutter={16}>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      name="variant"
                      label="Variant / Packing"
                      tooltip="Example: ALOE, 7G, PREMIUM, 100ML"
                    >
                      <Select
                        showSearch
                        allowClear
                        optionFilterProp="title"
                        placeholder="Select variant / packing"
                        dropdownRender={(menu) => (
                          <div>
                            {menu}
                            {canManageItems && (
                              <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                                <Button type="link" size="small" onClick={() => addVariantMetaValue('Variant/Packing', ['variant'], 'variant')}>
                                  + Add Variant/Packing
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      >
                        {getVariantLibraryValuesByAliases(['variant', 'packing', 'pack']).map((v) => (
                          <Select.Option key={v} value={v} title={v}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{v}</span>
                              {canManageItems && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteVariantMetaSpecificValue('Variant/Packing', ['variant', 'packing', 'pack'], v, 'variant');
                                  }}
                                  style={{ marginLeft: 8, color: '#ff4d4f', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  ×
                                </span>
                              )}
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      name="colorCode"
                      label="Colour"
                      tooltip="Color or shade code, reusable for variant matrix/SKU context"
                    >
                      <Select
                        showSearch
                        allowClear
                        optionFilterProp="title"
                        placeholder="Select colour"
                        dropdownRender={(menu) => (
                          <div>
                            {menu}
                            {canManageItems && (
                              <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                                <Button type="link" size="small" onClick={() => addVariantMetaValue('Colour', ['color'], 'colorCode')}>
                                  + Add Colour
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      >
                        {getVariantLibraryValuesByAliases(['color', 'colour']).map((v) => (
                          <Select.Option key={v} value={v} title={v}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{v}</span>
                              {canManageItems && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteVariantMetaSpecificValue('Colour', ['color', 'colour'], v, 'colorCode');
                                  }}
                                  style={{ marginLeft: 8, color: '#ff4d4f', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  ×
                                </span>
                              )}
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      name="sizeCode"
                      label="Size"
                      tooltip="Used by SKU {SIZE}. Example: 100ML, 7G, XL"
                    >
                      <Select
                        showSearch
                        allowClear
                        optionFilterProp="title"
                        placeholder="Select size"
                        dropdownRender={(menu) => (
                          <div>
                            {menu}
                            {canManageItems && (
                              <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                                <Button type="link" size="small" onClick={() => addVariantMetaValue('Size', ['size'], 'sizeCode')}>
                                  + Add Size
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      >
                        {getVariantLibraryValuesByAliases(['size']).map((v) => (
                          <Select.Option key={v} value={v} title={v}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{v}</span>
                              {canManageItems && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteVariantMetaSpecificValue('Size', ['size'], v, 'sizeCode');
                                  }}
                                  style={{ marginLeft: 8, color: '#ff4d4f', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  ×
                                </span>
                              )}
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      name="packType"
                      label="Pack Type"
                      tooltip="Used by SKU {TYPE}. Example: SCH, BTL, BOX"
                    >
                      <Select
                        showSearch
                        allowClear
                        optionFilterProp="title"
                        placeholder="Select pack type"
                        dropdownRender={(menu) => (
                          <div>
                            {menu}
                            {canManageItems && (
                              <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                                <Button type="link" size="small" onClick={() => addVariantMetaValue('Pack Type', ['pack type'], 'packType')}>
                                  + Add Pack Type
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      >
                        {getVariantLibraryValuesByAliases(['pack type', 'packtype', 'type']).map((v) => (
                          <Select.Option key={v} value={v} title={v}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{v}</span>
                              {canManageItems && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteVariantMetaSpecificValue('Pack Type', ['pack type', 'packtype', 'type'], v, 'packType');
                                  }}
                                  style={{ marginLeft: 8, color: '#ff4d4f', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  ×
                                </span>
                              )}
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                </>
                )}
                {watchedItemType === 'variant' && (
                <>
                <div
                  style={{
                    marginBottom: 14,
                    padding: '14px 16px',
                    borderRadius: 14,
                    border: '1px solid #d8e4ff',
                    background: 'linear-gradient(135deg, #f7f9ff 0%, #eef4ff 100%)',
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.08)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#2343a7' }}>
                      Variant Configuration
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Tag color="blue" style={{ marginInlineEnd: 0 }}>Single source of truth</Tag>
                      <Tag color="purple" style={{ marginInlineEnd: 0 }}>Auto-generate combinations</Tag>
                      <Tag color="geekblue" style={{ marginInlineEnd: 0 }}>Child SKU ready</Tag>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.6 }}>
                    This item is in <strong>Variant</strong> mode, so use the builder below to define attributes like Size, Colour, and Pack Type. The old quick fields are hidden here to avoid duplicate entry and confusion.
                  </div>
                </div>
                <Form.List name="variantAttributes">
                  {(fields, { add, remove }) => (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: '#667eea', fontWeight: 700, textTransform: 'uppercase' }}>
                          Multi-Variant Builder
                        </span>
                        <Button size="small" onClick={() => add({ name: '', values: undefined })}>
                          + Add Attribute
                        </Button>
                      </div>
                      <div style={{ background: '#f8faff', border: '1px solid #e6ecff', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                        <div style={{ fontSize: 12, color: '#1f3b8f', fontWeight: 600, marginBottom: 4 }}>
                          Build Variant Dimensions (Professional Setup)
                        </div>
                        <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.5 }}>
                          Each row is one attribute name with <strong>one or more</strong> values. Select multiple values in the same row, and the matrix combines all selected values across attributes.
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
                          Example: one row <strong>Size</strong> {'=>'} 7G, 15G and one row <strong>Colour</strong> {'=>'} Red, Blue {'=>'} 4 variants
                        </div>
                      </div>
                      {fields.map(({ key, name, ...restField }) => (
                        <Row key={key} gutter={8} style={{ marginBottom: 8 }}>
                          <Col xs={24} sm={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'name']}
                              rules={[{ required: true, message: 'Attribute name required' }]}
                            >
                              <Select
                                showSearch
                                allowClear
                                placeholder="Attribute name (Size, Colour, Pack Type)"
                                options={variantLibraryNames.map((option) => ({ value: option, label: option }))}
                                filterOption={(inputValue, option) =>
                                  String(option?.label || '').toLowerCase().includes(String(inputValue || '').toLowerCase())
                                }
                                onChange={() => {
                                  form.setFieldValue(['variantAttributes', name, 'values'], []);
                                }}
                                dropdownRender={(menu) => (
                                  <div>
                                    {menu}
                                    {canManageItems && (
                                      <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                                        <Button
                                          type="link"
                                          size="small"
                                          onClick={async () => {
                                            const raw = prompt('Add Attribute Name (e.g. Size, Colour, Pack Type):');
                                            const attrName = String(raw || '').trim();
                                            if (!attrName) return;
                                            try {
                                              await apiService.put('/items/variant-library/entry', { name: attrName, values: [] });
                                              await fetchDropdownOptions();
                                              form.setFieldValue(['variantAttributes', name, 'name'], attrName);
                                              message.success('Attribute name added');
                                            } catch (e) {
                                              message.error(e?.response?.data?.error || 'Failed to add attribute name');
                                            }
                                          }}
                                        >
                                          + Add Attribute Name
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={14}>
                            <Form.Item
                              {...restField}
                              name={[name, 'values']}
                              rules={[{
                                validator: (_, value) => (
                                  normalizeOptionalTextArray(value).length > 0
                                    ? Promise.resolve()
                                    : Promise.reject(new Error('Select or add at least one value'))
                                )
                              }]}
                            >
                              <Select
                                mode="multiple"
                                showSearch
                                allowClear
                                maxTagCount="responsive"
                                placeholder="Attribute values"
                                options={getVariantLibraryValues(form.getFieldValue(['variantAttributes', name, 'name'])).map((value) => ({ value, label: value }))}
                                dropdownRender={(menu) => (
                                  <div>
                                    {menu}
                                    {canManageItems && (
                                      <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                                        <Button
                                          type="link"
                                          size="small"
                                          onClick={async () => {
                                            const attrName = normalizeOptionalText(form.getFieldValue(['variantAttributes', name, 'name']));
                                            if (!attrName) {
                                              message.warning('Choose attribute name first');
                                              return;
                                            }
                                            const raw = prompt('Add attribute value:');
                                            const v = String(raw || '').trim();
                                            if (!v) return;
                                            try {
                                              await apiService.put('/items/variant-library/entry', { name: attrName, values: [v] });
                                              await fetchDropdownOptions();
                                              const currentValues = normalizeOptionalTextArray(form.getFieldValue(['variantAttributes', name, 'values']));
                                              form.setFieldValue(
                                                ['variantAttributes', name, 'values'],
                                                Array.from(new Set([...currentValues, v]))
                                              );
                                              message.success(`Value "${v}" saved to library`);
                                            } catch (e) {
                                              message.error(e?.response?.data?.error || 'Failed to save attribute value');
                                            }
                                          }}
                                        >
                                          + Add Value to Library
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={2} style={{ display: 'flex', alignItems: 'center' }}>
                            <Button danger type="text" onClick={() => remove(name)}>
                              Delete
                            </Button>
                          </Col>
                        </Row>
                      ))}
                      {fields.length === 0 && (
                        <div style={{ fontSize: 12, color: '#8c8c8c', lineHeight: 1.5 }}>
                          No attributes added yet. Start with one dimension like <strong>Size</strong> or <strong>Colour</strong>, then select multiple values in the same row.
                          Use clear business names to keep SKU generation and variant matrix consistent.
                        </div>
                      )}
                    </div>
                  )}
                </Form.List>
                </>
                )}
                {watchedItemType === 'variant' && (
                  <div
                    style={{
                      marginBottom: 18,
                      border: '1px solid #dbe3f2',
                      borderRadius: 14,
                      background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
                      boxShadow: '0 10px 24px rgba(15, 23, 42, 0.04)',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        padding: '14px 16px',
                        borderBottom: '1px solid #edf2f7',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        flexWrap: 'wrap',
                        background: 'linear-gradient(180deg, #fcfdff 0%, #f6f8fc 100%)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#334155' }}>Variant Matrix ({variantMatrixRows.length})</div>
                        <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
                          Use the first row as your template, then apply repeated values across every variant in one click.
                        </div>
                      </div>
                      <Button onClick={saveVariantSetupForFuture}>
                        Save setup for future
                      </Button>
                    </div>
                    {variantMatrixRows.length === 0 ? (
                      <div style={{ padding: 14, fontSize: 12, color: '#8c8c8c' }}>
                        Add at least one variant attribute with values to generate combinations.
                      </div>
                    ) : (
                      <div style={{ maxHeight: 360, overflowY: 'auto', padding: 14 }}>
                        <div style={{ minWidth: VARIANT_MATRIX_MIN_WIDTH }}>
                          <div
                            style={{
                              marginBottom: 12,
                              padding: '10px 12px',
                              borderRadius: 12,
                              border: '1px solid #e2e8f0',
                              background: '#f8fbff',
                              fontSize: 12,
                              color: '#64748b'
                            }}
                          >
                            Enter repeated values in the first row, then use <strong>Copy to all</strong> in the header for price, stock, warehouse, or active status.
                          </div>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: VARIANT_MATRIX_GRID_TEMPLATE,
                              columnGap: 12,
                              alignItems: 'end',
                              padding: '0 10px 10px',
                              borderBottom: '1px solid #e8eef8',
                              marginBottom: 12
                            }}
                          >
                            <div style={VARIANT_MATRIX_LABEL_STYLE}>Combination</div>
                            <div>
                              <div style={VARIANT_MATRIX_LABEL_STYLE}>Child SKU</div>
                              <Button
                                type="link"
                                size="small"
                                onClick={handleGenerateAllVariantSkus}
                                loading={skuGenerating}
                                style={VARIANT_MATRIX_ACTION_STYLE}
                              >
                                Generate all
                              </Button>
                            </div>
                            <div style={VARIANT_MATRIX_LABEL_STYLE}>Barcode</div>
                            <div>
                              <div style={VARIANT_MATRIX_LABEL_STYLE}>Sell</div>
                              <Button
                                type="link"
                                size="small"
                                onClick={() => copyVariantFieldFromFirstRow('sellingPrice', 'selling price')}
                                style={VARIANT_MATRIX_ACTION_STYLE}
                              >
                                Copy to all
                              </Button>
                            </div>
                            <div>
                              <div style={VARIANT_MATRIX_LABEL_STYLE}>Stock</div>
                              <Button
                                type="link"
                                size="small"
                                onClick={() => {
                                  if (window.confirm('Copy opening stock from the first row to all variants?')) {
                                    copyVariantFieldFromFirstRow('openingStock', 'opening stock');
                                  }
                                }}
                                style={VARIANT_MATRIX_ACTION_STYLE}
                              >
                                Copy to all
                              </Button>
                            </div>
                            <div>
                              <div style={VARIANT_MATRIX_LABEL_STYLE}>Warehouse</div>
                              <Button
                                type="link"
                                size="small"
                                onClick={() => copyVariantFieldFromFirstRow('warehouseId', 'warehouse')}
                                style={VARIANT_MATRIX_ACTION_STYLE}
                              >
                                Copy to all
                              </Button>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ ...VARIANT_MATRIX_LABEL_STYLE, textAlign: 'center' }}>On</div>
                              <Button
                                type="link"
                                size="small"
                                onClick={() => copyVariantFieldFromFirstRow('active', 'active status', { allowBlank: true })}
                                style={VARIANT_MATRIX_ACTION_STYLE}
                              >
                                Copy to all
                              </Button>
                            </div>
                          </div>
                          {variantMatrixRows.map((row) => (
                            <div
                              key={row.key}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: VARIANT_MATRIX_GRID_TEMPLATE,
                                columnGap: 12,
                                alignItems: 'center',
                                marginBottom: 12,
                                padding: 12,
                                border: '1px solid #dde7f5',
                                borderRadius: 14,
                                background: '#ffffff',
                                boxShadow: '0 6px 18px rgba(148, 163, 184, 0.12)'
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    minHeight: 40,
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0 12px',
                                    border: '1px solid #d9e2f1',
                                    borderRadius: 10,
                                    background: '#f8fbff',
                                    fontWeight: 600,
                                    color: '#1f2937'
                                  }}
                                >
                                  {row.combinationLabel}
                                </div>
                              </div>
                              <Input
                                size="large"
                                value={row.sku}
                                onChange={(e) => updateVariantMatrixRow(row.key, { sku: e.target.value })}
                                placeholder="Child SKU"
                              />
                              <Input
                                size="large"
                                value={row.barcode}
                                onChange={(e) => updateVariantMatrixRow(row.key, { barcode: e.target.value })}
                                placeholder="Barcode"
                              />
                              <InputNumber
                                size="large"
                                min={0}
                                style={{ width: '100%' }}
                                value={row.sellingPrice}
                                onChange={(v) => updateVariantMatrixRow(row.key, { sellingPrice: v })}
                                placeholder="Sell"
                              />
                              <InputNumber
                                size="large"
                                min={0}
                                style={{ width: '100%' }}
                                value={row.openingStock}
                                onChange={(v) => updateVariantMatrixRow(row.key, { openingStock: v })}
                                placeholder="Stock"
                              />
                              <Select
                                size="large"
                                allowClear
                                showSearch
                                optionFilterProp="children"
                                value={row.warehouseId}
                                onChange={(v) => updateVariantMatrixRow(row.key, { warehouseId: v })}
                                placeholder="Warehouse"
                              >
                                {warehouses.map((w) => (
                                  <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
                                ))}
                              </Select>
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={row.active !== false}
                                  onChange={(e) => updateVariantMatrixRow(row.key, { active: e.target.checked })}
                                  title="Active"
                                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <Row gutter={16}>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      name="type"
                      label="Item type"
                      initialValue="simple"
                      rules={[{ required: true, message: 'Select item type' }]}
                      tooltip="Simple: one SKU. Variant: options (e.g. size). Composite: BOM / kit. Service: non-stock."
                    >
                      <Select
                        placeholder={itemTypes.length ? 'Select type' : 'Select or add a type'}
                        showSearch
                        optionFilterProp="children"
                        dropdownRender={(menu) => (
                          <div>
                            {menu}
                            {canManageItems && (
                              <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                                <Button type="link" size="small" onClick={handleInlineAddItemType}>
                                  + Add Type
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      >
                        {itemTypes.map(type => (
                          <Select.Option key={type.id} value={type.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ textTransform: 'capitalize' }}>{type.name}</span>
                              {canManageItems && !PROTECTED_ITEM_TYPES.has(String(type.name || '').toLowerCase()) && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteItemType(type.id, type.name);
                                  }}
                                  style={{
                                    marginLeft: 8,
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    backgroundColor: '#ff4d4f',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.backgroundColor = '#d9363e';
                                    e.target.style.transform = 'scale(1.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.backgroundColor = '#ff4d4f';
                                    e.target.style.transform = 'scale(1)';
                                  }}
                                >
                                  ×
                                </span>
                              )}
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item name="category" label="Category">
                      {canViewCategories ? (
                      <Select
                        placeholder={categories.length ? 'Select category' : 'Select or add a category'}
                        allowClear
                        showSearch
                        optionFilterProp="children"
                        dropdownRender={(menu) => (
                          <div>
                            {menu}
                            <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                              <Button type="link" size="small" onClick={handleInlineAddCategory}>
                                + Add Category
                              </Button>
                            </div>
                          </div>
                        )}
                      >
                        {categories.map(category => (
                          <Select.Option key={category.id} value={category.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{category.name}</span>
                              {canManageCategories && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCategory(category.id, category.name);
                                  }}
                                  style={{
                                    marginLeft: 8,
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    backgroundColor: '#ff4d4f',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.backgroundColor = '#d9363e';
                                    e.target.style.transform = 'scale(1.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.backgroundColor = '#ff4d4f';
                                    e.target.style.transform = 'scale(1)';
                                  }}
                                >
                                  ×
                                </span>
                              )}
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                      ) : (
                        <Input placeholder="Enter category name" />
                      )}
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item name="unit" label="Unit" initialValue="pcs">
                      <Select 
                      placeholder="Select unit"
                      allowClear
                      dropdownRender={(menu) => (
                        <div>
                          {menu}
                          <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                            <Button 
                              type="link" 
                              size="small"
                              onClick={async () => {
                                const newOption = prompt('Enter new unit:');
                                if (newOption && !unitOptions.find(u => u.name === newOption)) {
                                  try {
                                    const response = await apiService.post('/units', { name: newOption, symbol: newOption });
                                    if (response) {
                                      await fetchDropdownOptions();
                                      message.success('Unit added successfully');
                                    }
                                  } catch (error) {
                                    message.error('Failed to add unit');
                                  }
                                }
                              }}
                            >
                              + Add Unit
                            </Button>
                          </div>
                        </div>
                      )}
                    >
                      {unitOptions.map(unit => (
                        <Select.Option key={unit.id} value={unit.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>
                              {unit.name}
                              {unit.symbol && String(unit.symbol).trim().toLowerCase() !== String(unit.name || '').trim().toLowerCase()
                                ? ` (${unit.symbol})`
                                : ''}
                            </span>
                            <span
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await apiService.delete(`/units/${unit.id}`);
                                  setUnitOptions(prev => prev.filter(u => u.id !== unit.id));
                                  if (form.getFieldValue('unit') === unit.id) {
                                    form.setFieldsValue({ unit: undefined });
                                  }
                                  message.success(`Unit '${unit.name}' deleted`);
                                } catch (error) {
                                  message.error(error?.response?.data?.error || 'Failed to delete unit');
                                }
                              }}
                              style={{ 
                                marginLeft: 8,
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                backgroundColor: '#ff4d4f',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#d9363e';
                                e.target.style.transform = 'scale(1.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#ff4d4f';
                                e.target.style.transform = 'scale(1)';
                              }}
                            >
                              ×
                            </span>
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      name="itemGroupId"
                      label="Item Group"
                      tooltip="Use item groups to organize related items for reporting, filtering, and master-data consistency."
                    >
                      <Select
                        allowClear
                        placeholder={itemGroups.length ? 'Select item group' : 'No item groups available'}
                        optionFilterProp="label"
                        options={selectableItemGroups.map((group) => ({
                          value: group.id,
                          label: group.name
                        }))}
                        dropdownRender={(menu) => (
                          <div>
                            {menu}
                            <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0', fontSize: 12, color: '#6b7280' }}>
                              Manage item groups from the <strong>Item Groups</strong> page in the Items menu.
                            </div>
                          </div>
                        )}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                {watchedItemType === 'composite' && (
                  <>
                    <Row gutter={16} style={{ marginBottom: 12 }}>
                      <Col xs={24} md={12}>
                        <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#64748b' }}>
                          SALES / FULFILMENT MODE
                        </div>
                        <Select
                          style={{ width: '100%' }}
                          value={kitFulfillmentMode}
                          onChange={setKitFulfillmentMode}
                          options={[
                            {
                              value: 'prebuilt',
                              label: 'Pre-built kits — sell finished kit stock (assemble parts first)',
                            },
                            {
                              value: 'explode_on_ship',
                              label: 'Explode on ship — consume BOM components when fulfilling orders',
                            },
                          ]}
                        />
                      </Col>
                    </Row>
                    <CompositeBomSection
                      components={compositeComponents}
                      onComponentsChange={setCompositeComponents}
                      catalogItems={items}
                      excludeItemId={ editingItem?.id }
                    />
                  </>
                )}
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item name="returnableItem" valuePropName="checked" style={{ marginBottom: 8 }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 12px', background: '#f5f5ff', borderRadius: 8, border: '1px solid #e0e0ff', fontSize: 13, color: '#595959', userSelect: 'none' }}>
                        <input type="checkbox" style={{ accentColor: '#667eea', width: 15, height: 15 }} />
                        <span>Returnable Item</span>
                      </label>
                    </Form.Item>
                  </Col>
                </Row>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="image" label="Item Image">
                  <div style={{ position: 'relative' }}>
                    <Upload name="image" listType="picture-card" showUploadList={false}
                      style={{ width: '100%' }}
                      beforeUpload={(file) => {
                        if (!['image/jpeg','image/png'].includes(file.type)) { message.error('JPG/PNG only!'); return false; }
                        if (file.size / 1024 / 1024 > 2) { message.error('Max 2MB!'); return false; }
                        const reader = new FileReader();
                        reader.onload = e => setImageUrl(e.target.result);
                        reader.readAsDataURL(file);
                        setImageFile(file);
                        return false;
                      }}
                    >
                      {imageUrl ? (
                        <div style={{ position: 'relative', width: '100%', height: 260 }}>
                          <img src={imageUrl} alt="item" style={{ width: '100%', height: 260, objectFit: 'cover', borderRadius: 10 }} />
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s', color: '#fff', fontSize: 13, fontWeight: 600, gap: 6 }}
                            onMouseEnter={e => e.currentTarget.style.opacity = 1}
                            onMouseLeave={e => e.currentTarget.style.opacity = 0}
                          >
                            <UploadOutlined style={{ fontSize: 24 }} />
                            Change Image
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: 260, background: 'linear-gradient(135deg, #f5f5ff 0%, #faf0ff 100%)', border: '2px dashed #c5b8f5', borderRadius: 10, color: '#9b8fd4', cursor: 'pointer', transition: 'all 0.2s', gap: 8 }}>
                          <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: '50%', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UploadOutlined style={{ fontSize: 24, color: '#fff' }} />
                          </div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#667eea' }}>Click or drag to upload</div>
                          <div style={{ fontSize: 11, color: '#aaa', background: '#fff', borderRadius: 20, padding: '2px 10px', border: '1px solid #e8e8ff' }}>JPG / PNG · max 2MB</div>
                        </div>
                      )}
                    </Upload>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => { setImageUrl(''); setImageFile(null); }}
                        style={{ position: 'absolute', top: 8, right: 8, background: '#ff4d4f', border: 'none', borderRadius: '50%', width: 26, height: 26, color: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.25)', zIndex: 2 }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item label="Dimensions (L × W × H)">
                  <Input.Group compact>
                    <Form.Item name="length" noStyle><InputNumber placeholder="L" style={{ width: '33%' }} min={0} /></Form.Item>
                    <Form.Item name="width" noStyle><InputNumber placeholder="W" style={{ width: '33%' }} min={0} /></Form.Item>
                    <Form.Item name="height" noStyle><InputNumber placeholder="H" style={{ width: '34%' }} min={0} /></Form.Item>
                  </Input.Group>
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, cur) => prev.unit !== cur.unit}
                >
                  {() => {
                    const unitLabel = getSelectedUnitLabel();
                    return (
                      <Form.Item
                        name="weight"
                        label={`Weight (per unit, ${unitLabel})`}
                        tooltip={`Enter net weight for one selling unit in ${unitLabel}.`}
                      >
                        <Input placeholder={`Per unit weight in ${unitLabel}`} />
                      </Form.Item>
                    );
                  }}
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="manufacturer" label="Manufacturer">
                    <Select 
                      placeholder="Select or Add Manufacturer" 
                      allowClear
                      dropdownRender={(menu) => (
                        <div>
                          {menu}
                          <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                            <Button 
                              type="link" 
                              size="small"
                              onClick={async () => {
                                const newOption = prompt('Enter new manufacturer:');
                                if (newOption && !manufacturerOptions.find(m => m.name === newOption)) {
                                  try {
                                    const response = await apiService.post('/manufacturers', { name: newOption });
                                    if (response) {
                                      await fetchDropdownOptions();
                                      message.success('Manufacturer added successfully');
                                    }
                                  } catch (error) {
                                    message.error('Failed to add manufacturer');
                                  }
                                }
                              }}
                            >
                              + Add Manufacturer
                            </Button>
                          </div>
                        </div>
                      )}
                    >
                      {manufacturerOptions.map(manufacturer => (
                        <Select.Option key={manufacturer.id} value={manufacturer.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{manufacturer.name}</span>
                            <span
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await apiService.delete(`/manufacturers/${manufacturer.id}`);
                                  await fetchDropdownOptions();
                                  message.success(`Manufacturer '${manufacturer.name}' deleted`);
                                } catch (error) {
                                  message.error('Failed to delete manufacturer');
                                }
                              }}
                              style={{ 
                                marginLeft: 8,
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                backgroundColor: '#ff4d4f',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#d9363e';
                                e.target.style.transform = 'scale(1.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#ff4d4f';
                                e.target.style.transform = 'scale(1)';
                              }}
                            >
                              ×
                            </span>
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="upc" label="UPC">
                  <Input placeholder="Enter UPC" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="brand" label="Brand">
                <Select 
                  placeholder="Select or Add Brand" 
                  allowClear
                  dropdownRender={(menu) => (
                    <div>
                      {menu}
                      <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                        <Button 
                          type="link" 
                          size="small"
                          onClick={async () => {
                            const newOption = prompt('Enter new brand:');
                            if (newOption && !brandOptions.find(b => b.name === newOption)) {
                              try {
                                const response = await apiService.post('/brands', { name: newOption });
                                if (response) {
                                  await fetchDropdownOptions();
                                  message.success('Brand added successfully');
                                }
                              } catch (error) {
                                message.error('Failed to add brand');
                              }
                            }
                          }}
                        >
                          + Add Brand
                        </Button>
                      </div>
                    </div>
                  )}
                >
                  {brandOptions.map(brand => (
                    <Select.Option key={brand.id} value={brand.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{brand.name}</span>
                        <span
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await apiService.delete(`/brands/${brand.id}`);
                              await fetchDropdownOptions();
                              message.success(`Brand '${brand.name}' deleted`);
                            } catch (error) {
                              message.error('Failed to delete brand');
                            }
                          }}
                          style={{ 
                            marginLeft: 8,
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            backgroundColor: '#ff4d4f',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#d9363e';
                            e.target.style.transform = 'scale(1.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = '#ff4d4f';
                            e.target.style.transform = 'scale(1)';
                          }}
                        >
                          ×
                        </span>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="mpn" label="MPN">
                  <Input placeholder="Enter MPN" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="ean" label="EAN">
                  <Input.Search
                  placeholder="Enter EAN to lookup product"
                  enterButton={<span><BarcodeOutlined /> Lookup</span>}
                  loading={barcodeLoading}
                  addonBefore={
                    <span
                      style={{ cursor: 'pointer', color: '#1890ff' }}
                      onClick={() => setScannerOpen(true)}
                      title="Scan with mobile"
                    >
                      📱
                    </span>
                  }
                  onSearch={async (value) => {
                    if (!value) return;
                    setBarcodeLoading(true);
                    try {
                      const product = await lookupProductByBarcode(value);
                      if (!product) {
                        message.warning('Product not found in Open Food Facts database.');
                        return;
                      }
                      const updates = {};
                      if (product.name) updates.name = product.name;
                      if (product.brand) {
                        const matchedBrand = brandOptions.find(b => b.name?.toLowerCase() === product.brand?.toLowerCase());
                        if (matchedBrand) updates.brand = matchedBrand.id;
                      }
                      if (product.category) updates.category = product.category;
                      if (product.weight) updates.weight = product.weight;
                      if (product.ean) updates.ean = product.ean;
                      if (product.manufacturer) {
                        const matchedMfr = manufacturerOptions.find(m => m.name?.toLowerCase() === product.manufacturer?.toLowerCase());
                        if (matchedMfr) updates.manufacturer = matchedMfr.id;
                      }
                      if (product.image) setImageUrl(product.image);
                      form.setFieldsValue(updates);
                      message.success(`Product found: ${product.name || 'details auto-filled'}!`);
                    } catch (err) {
                      message.error(err.message || 'Barcode lookup failed.');
                    } finally {
                      setBarcodeLoading(false);
                    }
                  }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="isbn" label="ISBN">
                  <Input placeholder="Enter ISBN" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="barcode" label="Barcode">
                  <Input placeholder="Enter Barcode" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="hsnCode" label="HSN Code">
                  <Input placeholder="Enter HSN Code" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="supplierCode" label="Supplier Code">
                  <Input placeholder="Supplier / vendor code" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="batchNumber"
                  label="Batch Number"
                  getValueFromEvent={(event) => String(event?.target?.value || '').toUpperCase()}
                >
                  <Input placeholder="Enter Batch Number" />
                </Form.Item>
              </Col>
            </Row>
            {watchedBatchNumber && (
              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Form.Item name="batchManufactureDate" label="Batch Manufacture Date">
                    <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="batchExpiryDate" label="Batch Expiry Date">
                    <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <div style={{ paddingTop: 30, color: '#8c8c8c', fontSize: 12 }}>
                    Dates apply to the warehouse batch created when batch number, warehouse, and opening stock are set.
                  </div>
                </Col>
              </Row>
            )}
          </div>{/* end Basic Info section */}

          {/* ── Section: Sales ── */}
          <div style={sectionStyle}>
            <div style={sectionHeader}>
              <span style={sectionIconStyle}><DollarOutlined /></span>
              Sales Information
            </div>
          {isVariantItem && (
            <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: '#f7faff', border: '1px solid #d6e4ff', fontSize: 12, color: '#1d39c4' }}>
              Variant item detected. Child variants use the prices entered in the Variant Matrix above. The fields below act as shared defaults only when a variant row price is left blank.
            </div>
          )}
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Price Currency">
                <Select
                  value={priceCurrency}
                  onChange={handlePriceCurrencyChange}
                  options={currencies.map(c => ({ value: c.code, label: `${c.code} - ${c.name}` }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ paddingTop: 30, color: '#595959', fontSize: 12 }}>
                Prices are entered as <strong>per unit</strong> based on selected Unit and are converted to USD on save.
              </div>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="sellingPrice" label={`${isVariantItem ? 'Default Selling Price' : 'Selling Price'} (per unit, ${priceCurrency})`} rules={[{ type: 'number', message: 'Please enter a valid number' }]}>
                <InputNumber 
                  min={0} 
                  step={0.01} 
                  precision={2}
                  style={{ width: '100%' }} 
                  placeholder={isVariantItem ? 'Optional fallback for variants' : 'Enter selling price'}
                  parser={value => value.replace(/[^0-9.]/g, '')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="mrp" label={`${isVariantItem ? 'Default MRP' : 'MRP'} (per unit, ${priceCurrency})`} rules={[{ type: 'number', message: 'Please enter a valid number' }]}>
                <InputNumber 
                  min={0} 
                  step={0.01} 
                  precision={2}
                  style={{ width: '100%' }} 
                  placeholder="Enter MRP"
                  parser={value => value.replace(/[^0-9.]/g, '')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="account" label="Account">
                <Select placeholder="Select account" allowClear>
                  <Select.Option value="sales">Sales</Select.Option>
                  <Select.Option value="income">Income</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="taxRate" label="Tax Rate (%)" rules={[{ type: 'number', message: 'Please enter a valid number' }]}>
                {taxRateOptions.length > 0 ? (
                  <Select allowClear placeholder="Select tax rate" showSearch optionFilterProp="children">
                    {taxRateOptions.map(t => (
                      <Select.Option key={t.id} value={parseFloat(t.rate)}>
                        {t.name} ({parseFloat(t.rate).toFixed(2)}%) — {t.tax_type?.toUpperCase()}
                      </Select.Option>
                    ))}
                  </Select>
                ) : (
                  <InputNumber
                    min={0} max={100} step={0.01} precision={2}
                    style={{ width: '100%' }}
                    placeholder="Enter tax rate"
                    parser={value => value.replace(/[^0-9.]/g, '')}
                  />
                )}
              </Form.Item>
            </Col>
            <Col xs={24} sm={16}>
              <Form.Item name="salesDescription" label="Description">
                <Input.TextArea placeholder="Sales description" rows={2} />
              </Form.Item>
            </Col>
          </Row>

          </div>{/* end Sales section */}

          {/* ── Section: Purchase ── */}
          <div style={sectionStyle}>
            <div style={sectionHeader}>
              <span style={sectionIconStyle}><ShopOutlined /></span>
              Purchase Information
            </div>
          {isVariantItem && (
            <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: '#faf8ff', border: '1px solid #e6d8ff', fontSize: 12, color: '#531dab' }}>
              Shared purchase settings stay here. If you use child-level costs later, this default cost is the fallback for variants without their own cost.
            </div>
          )}
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="costPrice" label={`${isVariantItem ? 'Default Cost Price' : 'Cost Price'} (per unit, ${priceCurrency})`} rules={[{ type: 'number', message: 'Please enter a valid number' }]}>
                <InputNumber 
                  min={0} 
                  step={0.01} 
                  precision={2}
                  style={{ width: '100%' }} 
                  placeholder="Enter cost price"
                  parser={value => value.replace(/[^0-9.]/g, '')}
                  onChange={(value) => {
                    // Auto-calculate opening value if opening stock exists
                    const openingStock = form.getFieldValue('openingStock');
                    if (openingStock > 0 && value > 0) {
                      const calculatedValue = openingStock * value;
                      // Round to 2 decimal places to avoid floating point issues
                      form.setFieldsValue({ openingValue: Math.round(calculatedValue * 100) / 100 });
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="purchaseAccount" label="Account">
                <Select placeholder="Select account" allowClear>
                  <Select.Option value="cogs">Cost of Goods Sold</Select.Option>
                  <Select.Option value="expense">Expense</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="purchaseTaxRate" label="Tax Rate (%)" rules={[{ type: 'number', message: 'Please enter a valid number' }]}>
                <InputNumber 
                  min={0} 
                  max={100} 
                  step={0.01} 
                  precision={2}
                  style={{ width: '100%' }} 
                  placeholder="Enter tax rate"
                  parser={value => value.replace(/[^0-9.]/g, '')}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="purchaseDescription" label="Description">
                <Input.TextArea placeholder="Purchase description" rows={2} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="preferredVendor" label="Preferred Vendor">
                <Select 
                  placeholder="Select Vendor" 
                  allowClear
                  showSearch
                  filterOption={filterSelectOption}
                >
                  {vendorOptions.map(vendor => (
                    <Select.Option key={vendor.id} value={vendor.id}>
                      {vendor.display_name || vendor.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          </div>{/* end Purchase section */}

          {/* ── Section: Inventory ── */}
          <div style={sectionStyle}>
            <div style={sectionHeader}>
              <span style={sectionIconStyle}><InboxOutlined /></span>
              Inventory Tracking
            </div>
            {isVariantItem ? (
              <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, background: '#f6ffed', border: '1px solid #b7eb8f', fontSize: 12, color: '#135200' }}>
                Variant stock is tracked per combination. Use the <strong>Stock</strong> and <strong>Warehouse</strong> columns in the Variant Matrix above. In sales, users will choose the parent item, then the exact variant, and stock will be checked for that specific variant only.
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'inline-flex', padding: '6px 12px', background: '#f5f5ff', borderRadius: 8, border: '1px solid #e0e0ff' }}>
                  <Form.Item name="trackInventory" valuePropName="checked" noStyle>
                    <Checkbox style={{ fontSize: 13, color: '#595959' }}>
                      Track Inventory for this Item
                    </Checkbox>
                  </Form.Item>
                </div>
              </div>
            )}
          {(isVariantItem || watchedTrackInventory) && (
          <>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="inventoryAccount" label="Inventory Account">
                <Select placeholder="Select an account" allowClear>
                  <Select.Option value="inventory">Inventory Asset</Select.Option>
                  <Select.Option value="stock">Stock</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="minStockLevel" label="Min Stock Level">
                <InputNumber 
                  min={0} 
                  style={{ width: '100%' }} 
                  placeholder="Enter min stock level"
                  parser={value => value.replace(/[^0-9.]/g, '')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="maxStockLevel" label="Max Stock Level">
                <InputNumber 
                  min={0} 
                  style={{ width: '100%' }} 
                  placeholder="Enter max stock level"
                  parser={value => value.replace(/[^0-9.]/g, '')}
                />
              </Form.Item>
            </Col>
          </Row>
          {!isVariantItem && (
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="openingStock" label="Opening Stock">
                <InputNumber 
                  min={0} 
                  style={{ width: '100%' }} 
                  placeholder="Enter opening stock"
                  parser={value => value.replace(/[^0-9.]/g, '')}
                  onChange={(value) => {
                    // Auto-calculate opening value
                    const costPrice = form.getFieldValue('costPrice');
                    if (value > 0 && costPrice > 0) {
                      const calculatedValue = value * costPrice;
                      form.setFieldsValue({ openingValue: Math.round(calculatedValue * 100) / 100 });
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item 
                name="openingValue" 
                label="Opening Value (Auto-calculated)"
              >
                <InputNumber 
                  disabled
                  min={0} 
                  step={0.01}
                  precision={2}
                  style={{ width: '100%' }} 
                  placeholder="Auto-calculated"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="warehouseId"
                label="Warehouse"
                rules={[{ required: true, message: 'Please select a warehouse!' }]}
              >
                <Select
                  placeholder="Select warehouse"
                  allowClear
                  showSearch
                  optionLabelProp="label"
                  optionFilterProp="label"
                  dropdownStyle={{ minWidth: 320 }}
                  onChange={(value) => {
                    form.setFieldsValue({ defaultBinId: null });
                    fetchBinsForWarehouse(value);
                  }}
                  notFoundContent={
                    <div style={{ textAlign: 'center', padding: '8px 0' }}>
                      <div style={{ color: '#8c8c8c', marginBottom: 8 }}>No warehouses found</div>
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => setWarehouseModalVisible(true)}
                      >
                        Add Warehouse
                      </Button>
                    </div>
                  }
                  dropdownRender={(menu) => (
                    <div>
                      {menu}
                      <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                        <Button
                          type="link"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => setWarehouseModalVisible(true)}
                        >
                          Add New Warehouse
                        </Button>
                      </div>
                    </div>
                  )}
                >
                  {warehouseSelectOptions.map((warehouse) => {
                    const stock = warehouse.stock;
                    return (
                      <Select.Option
                        key={warehouse.id}
                        value={warehouse.id}
                        label={`${warehouse.name}${warehouse.status !== 'active' ? ' (inactive)' : ''}`}
                      >
                        <div>
                          <strong>
                            {warehouse.name}
                            {warehouse.status !== 'active' ? ' (inactive)' : ''}
                          </strong>
                          {(warehouse.code || stock) && <br />}
                          {warehouse.code && (
                            <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                              Code: {warehouse.code}
                            </span>
                          )}
                          {warehouse.code && stock && <br />}
                          {stock && (
                            <span
                              style={{
                                fontSize: 12,
                                color: stock.available > 0 ? '#52c41a' : '#8c8c8c'
                              }}
                            >
                              Available: {formatStockQty(stock.available)} | On hand: {formatStockQty(stock.onHand)} | Reserved: {formatStockQty(stock.reserved)}
                            </span>
                          )}
                        </div>
                      </Select.Option>
                    );
                  })}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          )}
          </>
          )}
          {!isVariantItem && (
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                noStyle
                shouldUpdate={(prev, cur) => prev.warehouseId !== cur.warehouseId}
              >
                {({ getFieldValue }) => {
                  const hasWarehouse = !!getFieldValue('warehouseId');
                  return (
                    <Form.Item
                      name="defaultBinId"
                      label="Default Bin (optional)"
                      tooltip="Preferred putaway bin for this item. Used as the default destination in GRN / Putaway flows."
                    >
                      <Select
                        placeholder={hasWarehouse ? 'Select bin' : 'Select a warehouse first'}
                        allowClear
                        showSearch
                        loading={binsLoading}
                        disabled={!hasWarehouse}
                        optionFilterProp="label"
                        options={binsForWarehouse.map(b => ({
                          value: b.id,
                          label: `${b.zone_code} / ${b.rack_code} / ${b.code}${b.name ? ` — ${b.name}` : ''}`
                        }))}
                      />
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </Col>
          </Row>
          )}
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="valuationMethod" label="Inventory Valuation Method">
                <Select placeholder="Select valuation method" allowClear>
                  <Select.Option value="fifo">FIFO</Select.Option>
                  <Select.Option value="lifo">LIFO</Select.Option>
                  <Select.Option value="weighted_average">Weighted Average</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="description" label="Notes / Description">
                  <Input.TextArea placeholder="Enter description" rows={3} />
                </Form.Item>
              </Col>
            </Row>
          </div>{/* end Inventory section */}

          <div style={{ position: 'sticky', bottom: 0, background: 'linear-gradient(to top, #fafbff 80%, transparent)', zIndex: 10, marginLeft: -24, marginRight: -24, padding: '16px 24px 8px', borderTop: '1px solid #ebebf5' }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                icon={editingItem ? <EditOutlined /> : <PlusOutlined />}
                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none', borderRadius: 10, fontWeight: 700, paddingInline: 28, boxShadow: '0 4px 14px rgba(102,126,234,0.45)' }}
              >
                {editingItem ? 'Update Item' : 'Create Item'}
              </Button>
              {!editingItem && (
                <Button size="large" style={{ borderRadius: 10, borderColor: '#faad14', color: '#faad14', fontWeight: 600 }} onClick={handleSaveDraft}>
                  Save as Draft
                </Button>
              )}
              <Button
                size="large"
                style={{ borderRadius: 10, color: '#8c8c8c' }}
                onClick={() => {
                  if (itemFormOpenedFromImport) {
                    closeItemFormReturnToImport();
                    return;
                  }
                  setModalVisible(false);
                  setItemFormOpenedFromImport(false);
                  setEditingItem(null);
                  setDuplicateBanner(null);
                  setDuplicateSourcePayload(null);
                  setCompositeComponents([]);
                  setEditingWarehouseSummaries([]);
                  form.resetFields();
                }}
              >
                {itemFormOpenedFromImport ? 'Back to import list' : 'Cancel'}
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 16 }}>
              <EyeOutlined />
            </div>
            <span style={{ fontWeight: 700, fontSize: 17 }}>Item Details</span>
          </div>
        }
        open={viewModalVisible}
        onCancel={() => { setViewModalVisible(false); setViewingItem(null); setItemHistory([]); setPriceHistory([]); setViewingItemBatches([]); }}
        footer={[<Button key="close" style={{ borderRadius: 10 }} onClick={() => { setViewModalVisible(false); setViewingItem(null); setItemHistory([]); setPriceHistory([]); setViewingItemBatches([]); }}>Close</Button>]}
        width="min(1280px, 98vw)"
        style={{ top: 16 }}
        styles={{ body: { background: '#fafbff', maxHeight: '82vh', overflowY: 'auto', padding: '20px 24px' } }}
      >
        {viewingItem && (
          <div>
            {/* Top hero strip */}
            <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 12, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              {viewingItem.image ? (
                <img src={viewingItem.image} alt={viewingItem.name} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 12, border: '3px solid rgba(255,255,255,0.4)' }} />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#fff' }}><InboxOutlined /></div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>{viewingItem.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>SKU: {viewingItem.sku}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Tag color={viewingItem.status === 'active' ? 'success' : 'error'} style={{ borderRadius: 20 }}>{viewingItem.status}</Tag>
                  {viewingItem.type && <Tag color="blue" style={{ borderRadius: 20 }}>{viewingItem.type}</Tag>}
                  {viewingItem.category && <Tag color="orange" style={{ borderRadius: 20 }}>{viewingItem.category}</Tag>}
                  {viewingItem.item_group_name && <Tag color="purple" style={{ borderRadius: 20 }}>{viewingItem.item_group_name}</Tag>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[{ label: 'Selling Price', val: viewingItem.selling_price ? formatPrice(viewingItem.selling_price, currency, 'USD') : '—' },
                  { label: 'On Hand', val: (() => { const s = viewingItem.current_stock || 0; return s % 1 === 0 ? Math.floor(s) : s.toFixed(2); })() }].map(x => (
                  <div key={x.label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 16px', textAlign: 'center' }}>
                    <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{x.val}</div>
                    <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>{x.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detail grid */}
            <Row gutter={16}>
              {[[
                ['Cost Price', viewingItem.cost_price ? formatPrice(viewingItem.cost_price, currency, 'USD') : 'N/A'],
                ['MRP', viewingItem.mrp ? formatPrice(viewingItem.mrp, currency, 'USD') : 'N/A'],
                ['Tax Rate', viewingItem.tax_rate ? `${viewingItem.tax_rate}%` : 'N/A'],
                ['Unit', viewingItem.unit || 'N/A'],
                ['Item Group', viewingItem.item_group_name || 'N/A'],
                ['Brand', viewingItem.brand || 'N/A'],
                ['Manufacturer', viewingItem.manufacturer || 'N/A'],
              ], [
                ['Status', <Tag color={viewingItem.status === 'active' ? 'success' : 'error'} style={{ borderRadius: 20, marginInlineEnd: 0, textTransform: 'capitalize' }}>{viewingItem.status || 'N/A'}</Tag>],
                ['Min Stock', viewingItem.min_stock_level ?? 'N/A'],
                ['Max Stock', viewingItem.max_stock_level ?? 'N/A'],
                ['Opening Stock', viewingItem.opening_stock ?? 'N/A'],
                ['Valuation', viewingItem.valuation_method || 'N/A'],
                ['HSN Code', viewingItem.hsn_code || 'N/A'],
                ['Barcode', viewingItem.barcode || 'N/A'],
              ], [
                ['Batch Number', viewingItem.batch_number || 'N/A'],
                ['UPC', viewingItem.upc || 'N/A'],
                ['EAN', viewingItem.ean || 'N/A'],
                ['ISBN', viewingItem.isbn || 'N/A'],
                ['MPN', viewingItem.mpn || 'N/A'],
                ['Weight', viewingItem.weight ? `${viewingItem.weight} ${viewingItem.weight_unit || 'kg'}` : 'N/A'],
                ['Dimensions', viewingItem.dimensions ? `${viewingItem.dimensions.length||0}×${viewingItem.dimensions.width||0}×${viewingItem.dimensions.height||0}` : 'N/A'],
              ]].map((group, gi) => (
                <Col xs={24} sm={8} key={gi}>
                  <Card variant="borderless" style={{ borderRadius: 12, background: '#fff', boxShadow: '0 1px 8px rgba(0,0,0,0.06)', marginBottom: 12 }} styles={{ body: { padding: '14px 18px' } }}>
                    {group.map(([label, val]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                        <span style={{ color: '#8c8c8c' }}>{label}</span>
                        <span style={{ fontWeight: 600, color: '#1a1a2e', maxWidth: '55%', textAlign: 'right', wordBreak: 'break-word' }}>{val}</span>
                      </div>
                    ))}
                  </Card>
                </Col>
              ))}
            </Row>
            {viewingItem.description && (
              <div style={{ background: '#fff', borderRadius: 12, padding: '12px 18px', marginBottom: 12, boxShadow: '0 1px 8px rgba(0,0,0,0.06)', fontSize: 13, color: '#595959' }}>
                <strong>Description:</strong> {viewingItem.description}
              </div>
            )}

            <Card
              size="small"
              title={(
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span>Warehouse Batches</span>
                  <Tag color="purple" style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                    {viewingItemBatches.length} batch{viewingItemBatches.length === 1 ? '' : 'es'}
                  </Tag>
                </div>
              )}
              style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden' }}
              styles={{ body: { paddingTop: 8 } }}
            >
              {viewingItemBatches.length === 0 ? (
                <Empty description="No warehouse batches recorded for this item" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Table
                  size="small"
                  rowKey="id"
                  dataSource={viewingItemBatches}
                  pagination={{ pageSize: 5, size: 'small', hideOnSinglePage: true }}
                  scroll={{ x: 720 }}
                  columns={[
                    { title: 'Batch #', dataIndex: 'batch_number', key: 'batch_number', width: 130, ellipsis: true },
                    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name', width: 140, ellipsis: true },
                    {
                      title: 'Received',
                      dataIndex: 'quantity_received',
                      key: 'quantity_received',
                      width: 90,
                      render: (v) => parseFloat(v || 0).toFixed(2),
                    },
                    {
                      title: 'Available',
                      key: 'quantity_remaining',
                      width: 90,
                      render: (_, row) => {
                        const remaining = parseFloat(row.quantity_remaining ?? row.quantity_available ?? 0);
                        const color = remaining <= 0 ? 'default' : remaining <= 10 ? 'orange' : 'green';
                        return <Tag color={color}>{remaining.toFixed(2)}</Tag>;
                      },
                    },
                    {
                      title: 'Manufacture Date',
                      dataIndex: 'manufacture_date',
                      key: 'manufacture_date',
                      width: 120,
                      render: (v) => (v ? new Date(v).toLocaleDateString() : '-'),
                    },
                    {
                      title: 'Expiry',
                      dataIndex: 'expiry_date',
                      key: 'expiry_date',
                      width: 120,
                      render: (v) => (v ? new Date(v).toLocaleDateString() : '-'),
                    },
                    {
                      title: 'Status',
                      dataIndex: 'status',
                      key: 'status',
                      width: 100,
                      render: (v) => <Tag color={v === 'active' ? 'green' : v === 'expired' ? 'red' : 'orange'}>{v?.toUpperCase()}</Tag>,
                    },
                  ]}
                />
              )}
            </Card>

            {String(viewingItem.type || '').toLowerCase() === 'variant' && (
              <Card
                size="small"
                title={(
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span>Variant Details</span>
                    <Tag color="blue" style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                      {(Array.isArray(viewingItem.variant_rows) && viewingItem.variant_rows.length > 0
                        ? viewingItem.variant_rows.length
                        : (Array.isArray(viewingItem?.custom_fields?.variantMatrix) ? viewingItem.custom_fields.variantMatrix.length : 0)
                      ) || 0} variants
                    </Tag>
                  </div>
                )}
                style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden' }}
                styles={{ body: { paddingTop: 8 } }}
              >
                {(() => {
                  const rows = Array.isArray(viewingItem.variant_rows) && viewingItem.variant_rows.length > 0
                    ? viewingItem.variant_rows
                    : (Array.isArray(viewingItem?.custom_fields?.variantMatrix) ? viewingItem.custom_fields.variantMatrix : []);
                  if (!rows.length) {
                    return <Empty description="No variant rows available" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
                  }
                  return (
                    <Table
                      size="middle"
                      rowKey={(row, idx) => row.id || row.key || `${row.sku || 'variant'}-${idx}`}
                      dataSource={rows}
                      bordered={false}
                      scroll={{ x: 760 }}
                      style={{ border: '1px solid #f0f3f8', borderRadius: 12, overflow: 'hidden' }}
                      rowClassName={(_, idx) => (idx % 2 === 0 ? 'table-row-light' : 'table-row-dark')}
                      pagination={{
                        pageSize: 6,
                        size: 'small',
                        hideOnSinglePage: true,
                        position: ['bottomRight'],
                        style: { margin: '12px 12px 0 0' }
                      }}
                      columns={[
                        {
                          title: 'Variant',
                          key: 'variant',
                          width: 360,
                          render: (_, row) => {
                            const tokens = getVariantAttributeTokens(row);
                            const primaryLabel = String(row.combinationLabel || row.variant_name || '').trim();
                            return (
                              <div>
                                {tokens.length > 0 && (
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {tokens.map((token, tokenIdx) => (
                                      <Tag
                                        key={`${token.label}-${token.value}-${tokenIdx}`}
                                        color="blue"
                                        style={{
                                          borderRadius: 999,
                                          marginInlineEnd: 0,
                                          paddingInline: 10,
                                          borderColor: '#d6e4ff',
                                          background: '#f5f9ff',
                                          color: '#1d39c4'
                                        }}
                                      >
                                        <span style={{ fontWeight: 600 }}>{token.label}</span>: {token.value}
                                      </Tag>
                                    ))}
                                  </div>
                                )}
                                {tokens.length === 0 && (
                                  <div style={{ fontWeight: 600, color: '#1f2937' }}>
                                    {primaryLabel || 'Unnamed variant'}
                                  </div>
                                )}
                              </div>
                            );
                          }
                        },
                        {
                          title: 'Child SKU',
                          key: 'sku',
                          width: 120,
                          render: (_, row) => row.sku ? (
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 10px',
                              borderRadius: 999,
                              background: '#f3f4f6',
                              border: '1px solid #e5e7eb',
                              fontFamily: 'Consolas, monospace',
                              fontSize: 12,
                              color: '#111827'
                            }}>
                              {row.sku}
                            </span>
                          ) : <span style={{ color: '#9ca3af' }}>-</span>
                        },
                        {
                          title: 'Barcode',
                          key: 'barcode',
                          width: 120,
                          render: (_, row) => row.barcode || <span style={{ color: '#9ca3af' }}>-</span>
                        },
                        {
                          title: 'Sell Price',
                          key: 'selling',
                          width: 120,
                          render: (_, row) => {
                            const val = row.sellingPrice ?? row.selling_price;
                            return val != null ? (
                              <span style={{ fontWeight: 700, color: '#1677ff' }}>
                                {formatPrice(Number(val) || 0, currency, 'USD')}
                              </span>
                            ) : <span style={{ color: '#9ca3af' }}>-</span>;
                          }
                        },
                        {
                          title: 'Status',
                          key: 'status',
                          width: 100,
                          render: (_, row) => {
                            const active = row.active !== undefined ? !!row.active : String(row.status || '').toLowerCase() === 'active';
                            return (
                              <Tag
                                color={active ? 'success' : 'default'}
                                style={{ borderRadius: 999, marginInlineEnd: 0, textTransform: 'capitalize', fontWeight: 600 }}
                              >
                                {active ? 'active' : 'inactive'}
                              </Tag>
                            );
                          }
                        }
                      ]}
                    />
                  );
                })()}
              </Card>
            )}
            
            <div style={{ marginTop: 24, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
              ) : (
                <Tabs items={[
                  {
                    key: 'transactions',
                    label: <span><HistoryOutlined /> Transaction History</span>,
                    children: itemHistory.length > 0 ? (
                      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                        <Timeline>
                          {itemHistory.map((log, index) => {
                            const eventType = log.type || log.event_type || '';
                            const fieldChanges = Array.isArray(log.field_changes) ? log.field_changes : [];
                            const summaryText = log.summary || log.description;
                            const getEventColor = (type) => {
                              if (['PurchaseReceived', 'SaleReturned', 'SaleReservationCancelled'].includes(type)) return 'green';
                              if (['SaleShipped', 'PurchaseReturned', 'StockDamaged', 'StockExpired'].includes(type)) return 'red';
                              if (['SaleReserved'].includes(type)) return 'orange';
                              if (type === 'ADJUSTMENT') return 'blue';
                              if (['TransferIn', 'TransferOut'].includes(type)) return 'purple';
                              if (type === 'ITEM_CREATED') return 'green';
                              if (type === 'ITEM_UPDATED') return 'cyan';
                              if (type === 'ITEM_COMPONENTS_UPDATED') return 'purple';
                              if (type === 'ITEM_DELETED') return 'red';
                              return 'gray';
                            };
                            const getEventLabel = (type, logRow) => {
                              if (type === 'PurchaseReceived' && isOpeningStockReceipt(logRow)) {
                                return 'Opening Stock';
                              }
                              const labels = {
                                PurchaseReceived: 'Stock Received (PO)',
                                PurchaseReturned: 'Purchase Returned',
                                SaleReserved: 'Stock Reserved (SO)',
                                SaleShipped: 'Stock Shipped (SO)',
                                SaleReturned: 'Sale Returned',
                                SaleReservationCancelled: 'Reservation Cancelled',
                                TransferIn: 'Transfer In',
                                TransferOut: 'Transfer Out',
                                StockDamaged: 'Stock Damaged',
                                StockExpired: 'Stock Expired',
                                ADJUSTMENT: 'Stock Adjusted',
                                ITEM_CREATED: 'Item Created',
                                ITEM_UPDATED: 'Item Updated',
                                ITEM_COMPONENTS_UPDATED: 'BOM Updated',
                                ITEM_DELETED: 'Item Deleted',
                              };
                              return labels[type] || type;
                            };
                            const qty = log.quantity ?? log.quantity_change;
                            const isPositive = ['PurchaseReceived', 'TransferIn', 'SaleReturned', 'SaleReservationCancelled'].includes(eventType) || (eventType === 'ADJUSTMENT' && log.sub_type === 'increase');
                            const isNegative = ['SaleShipped', 'SaleReserved', 'TransferOut', 'PurchaseReturned', 'StockDamaged', 'StockExpired'].includes(eventType) || (eventType === 'ADJUSTMENT' && log.sub_type === 'decrease');
                            const signedQty = qty != null ? (isNegative ? -Math.abs(qty) : isPositive ? Math.abs(qty) : qty) : null;
                            const unitCost = log.details?.unitCost || log.details?.unitPrice || log.unit_cost;
                            const ref = getInventoryLogReferenceDisplay(log);
                            const notes = log.reason || log.notes;
                            return (
                              <Timeline.Item key={index} color={getEventColor(eventType)}>
                                <div style={{ marginBottom: 8 }}>
                                  <Tag color={getEventColor(eventType)}>{getEventLabel(eventType, log)}</Tag>
                                  <span style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 8 }}>
                                    {new Date(log.timestamp || log.operation_date).toLocaleString()}
                                  </span>
                                </div>
                                <div style={{ fontSize: 13 }}>
                                  {log.warehouse && <div>Warehouse: <strong>{log.warehouse}</strong></div>}
                                  {signedQty != null && (
                                    <div>Quantity: <strong style={{ color: signedQty >= 0 ? '#52c41a' : '#ff4d4f' }}>
                                      {signedQty > 0 ? '+' : ''}{signedQty}
                                    </strong></div>
                                  )}
                                  {unitCost != null && <div>Unit Cost: <strong>{formatPrice(unitCost, currency, 'USD')}</strong></div>}
                                  {fieldChanges.length > 0 && (
                                    <div style={{ marginTop: 8 }}>
                                      {fieldChanges.slice(0, 8).map((change, changeIndex) => (
                                        <div key={`${log.id || index}-field-${changeIndex}`}>
                                          {change.label}: <strong>{change.from_display}</strong>{' -> '}<strong>{change.to_display}</strong>
                                        </div>
                                      ))}
                                      {fieldChanges.length > 8 && (
                                        <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                                          +{fieldChanges.length - 8} more field changes
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {log.performed_by?.trim() && <div style={{ color: '#8c8c8c', fontSize: 12 }}>By: {log.performed_by}</div>}
                                  {ref && <div style={{ color: '#8c8c8c', fontSize: 12 }}>Ref: {ref}</div>}
                                  {summaryText && <div style={{ color: '#8c8c8c', fontSize: 12 }}>{summaryText}</div>}
                                  {notes && <div style={{ color: '#8c8c8c', fontSize: 12 }}>Notes: {notes}</div>}
                                </div>
                              </Timeline.Item>
                            );
                          })}
                        </Timeline>
                      </div>
                    ) : <Empty description="No transaction history available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  },
                  {
                    key: 'price-history',
                    label: <span><DollarOutlined /> Price History</span>,
                    children: priceHistory.length > 0 ? (
                      <Table
                        size="small"
                        rowKey={(r, i) => i}
                        dataSource={priceHistory}
                        pagination={{ pageSize: 10, size: 'small' }}
                        columns={[
                          {
                            title: 'Price Type',
                            dataIndex: 'price_type',
                            key: 'price_type',
                            render: (v) => ({ cost: 'Cost Price', selling: 'Selling Price', mrp: 'MRP' }[v] || v)
                          },
                          {
                            title: 'Old Price',
                            dataIndex: 'old_price',
                            key: 'old_price',
                            render: (v) => v != null ? formatPrice(v, currency, 'USD') : '-'
                          },
                          {
                            title: 'New Price',
                            dataIndex: 'new_price',
                            key: 'new_price',
                            render: (v, r) => {
                              const diff = r.old_price != null ? v - r.old_price : null;
                              return (
                                <span>
                                  {formatPrice(v, currency, 'USD')}
                                  {diff != null && (
                                    <Tag color={diff > 0 ? 'red' : 'green'} style={{ marginLeft: 8 }}>
                                      {diff > 0 ? '+' : ''}{formatPrice(diff, currency, 'USD')}
                                    </Tag>
                                  )}
                                </span>
                              );
                            }
                          },
                          {
                            title: 'Changed By',
                            key: 'changed_by',
                            render: (_, r) => r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : '-'
                          },
                          {
                            title: 'Reason',
                            dataIndex: 'reason',
                            key: 'reason',
                            render: (v) => v || '-'
                          },
                          {
                            title: 'Date',
                            dataIndex: 'effective_date',
                            key: 'effective_date',
                            render: (v) => v ? new Date(v).toLocaleDateString() : '-'
                          }
                        ]}
                      />
                    ) : <Empty description="No price history available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  }
                ]} />
              )}
            </div>
          </div>
        )}
      </Modal>
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 16 }}>
              <PlusOutlined />
            </div>
            <span style={{ fontWeight: 700, fontSize: 17 }}>Add New Warehouse</span>
          </div>
        }
        open={warehouseModalVisible}
        onCancel={() => { setWarehouseModalVisible(false); warehouseForm.resetFields(); }}
        footer={null}
        width="min(480px, 96vw)"
        style={{ top: 40 }}
        styles={{ body: { background: '#fafbff' } }}
      >
        <Form
          form={warehouseForm}
          layout="vertical"
          onFinish={async (values) => {
            try {
              const response = await apiService.post('/warehouses', {
                code: values.code,
                name: values.name,
                type: values.type || null,
                address: values.address || null,
                contactPerson: values.contactPerson || null,
                phone: values.phone || null,
                email: values.email || null
              });
              if (response.success) {
                message.success('Warehouse created successfully');
                const newWarehouseId = response.data?.warehouseId;
                const warehousesResponse = await apiService.get('/warehouses', { params: { status: 'all' } });
                if (warehousesResponse.success) {
                  setWarehouses(warehousesResponse.data);
                  if (newWarehouseId) {
                    form.setFieldsValue({ warehouseId: newWarehouseId });
                  }
                }
                setWarehouseModalVisible(false);
                warehouseForm.resetFields();
              }
            } catch (error) {
              const errMsg = error?.response?.data?.error || error?.message || 'Failed to create warehouse';
              message.error(errMsg);
            }
          }}
        >
          <Form.Item name="code" label="Code" rules={[{ required: true, message: 'Please input code!' }]}>
            <Input placeholder="e.g. WH-001" />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please input name!' }]}>
            <Input placeholder="Enter warehouse name" />
          </Form.Item>
          <Form.Item name="type" label="Type">
            <Select
              placeholder="Select warehouse type"
              allowClear
              onDropdownVisibleChange={(open) => { if (open) fetchWarehouseTypes(); }}
              dropdownRender={(menu) => (
                <>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {warehouseTypes.map(type => (
                      <div key={type.id} style={{ padding: '5px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {editingTypeId === type.id ? (
                          <>
                            <Input
                              size="small"
                              value={editingTypeName}
                              onChange={(e) => setEditingTypeName(e.target.value)}
                              onKeyDown={(e) => e.stopPropagation()}
                              style={{ flex: 1, marginRight: 8 }}
                            />
                            <Space size="small">
                              <Button size="small" type="primary"
                                onClick={async () => {
                                  if (!editingTypeName.trim()) { message.warning('Type name cannot be empty'); return; }
                                  try {
                                    const res = await apiService.put(`/warehouse-types/${type.id}`, { name: editingTypeName });
                                    if (res.success) { message.success('Type updated'); setEditingTypeId(null); setEditingTypeName(''); fetchWarehouseTypes(); }
                                  } catch { message.error('Failed to update type'); }
                                }}
                              >Save</Button>
                              <Button size="small" icon={<CloseOutlined />} onClick={() => { setEditingTypeId(null); setEditingTypeName(''); }} />
                            </Space>
                          </>
                        ) : (
                          <>
                            <span style={{ flex: 1, cursor: 'pointer' }} onClick={() => warehouseForm.setFieldsValue({ type: type.id })}>{type.name}</span>
                            <Space size="small">
                              <Button size="small" type="text" icon={<EditOutlined />}
                                onClick={(e) => { e.stopPropagation(); setEditingTypeId(type.id); setEditingTypeName(type.name); }}
                              />
                              <Popconfirm title="Delete this type?" onConfirm={async (e) => {
                                e?.stopPropagation();
                                try {
                                  const res = await apiService.delete(`/warehouse-types/${type.id}`);
                                  if (res.success) { message.success('Type deleted'); fetchWarehouseTypes(); }
                                } catch { message.error('Failed to delete type'); }
                              }} onCancel={(e) => e?.stopPropagation()}>
                                <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                              </Popconfirm>
                            </Space>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <Divider style={{ margin: '8px 0' }} />
                  <Space style={{ padding: '0 8px 4px' }}>
                    <Input
                      placeholder="New type name"
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <Button type="text" icon={<PlusOutlined />}
                      onClick={async () => {
                        if (!newTypeName.trim()) { message.warning('Please enter a type name'); return; }
                        try {
                          const res = await apiService.post('/warehouse-types', { name: newTypeName });
                          if (res.success) { message.success('Type created'); setNewTypeName(''); fetchWarehouseTypes(); }
                        } catch { message.error('Failed to create type'); }
                      }}
                    >Add</Button>
                  </Space>
                </>
              )}
            >
              {warehouseTypes.map(type => (
                <Select.Option key={type.id} value={type.id}>{type.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea placeholder="Enter address" rows={2} />
          </Form.Item>
          <Form.Item name="contactPerson" label="Contact Person">
            <Input placeholder="Enter contact person" />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input placeholder="Enter phone number" />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input placeholder="Enter email" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none', borderRadius: 8, fontWeight: 600 }}
              >
                Create Warehouse
              </Button>
              <Button style={{ borderRadius: 8 }} onClick={() => { setWarehouseModalVisible(false); warehouseForm.resetFields(); }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onBarcode={handleBarcodeScan}
      />

      {/* -------------------- SKU Auto-Generator: Manage Rules ----------------- */}
      <Modal
        title={<span><ThunderboltOutlined style={{ color: '#764ba2', marginRight: 8 }} />Manage SKU Rules</span>}
        open={skuRulesOpen}
        onCancel={() => { setSkuRulesOpen(false); setEditingSkuRule(null); skuRuleForm.resetFields(); }}
        footer={null}
        width="min(1200px, 98vw)"
        style={{ top: 8 }}
        styles={{ body: { background: '#f8f9ff', borderRadius: '0 0 12px 12px', maxHeight: '86vh', overflowY: 'auto', padding: 16 } }}
        destroyOnHidden
      >
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* --- Existing rules list --- */}
          <div style={{ flex: '1 1 360px', minWidth: 340, background: '#fff', border: '1px solid #eef0f7', borderRadius: 12, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <b style={{ fontSize: 14, color: '#1f2937' }}>Active Rules</b>
              <Button size="small" type="primary" icon={<PlusOutlined />} onClick={startNewSkuRule} style={{ background: '#764ba2', border: 'none' }}>
                New Rule
              </Button>
            </div>
            <Table
              size="small"
              rowKey="id"
              loading={skuRulesLoading}
              dataSource={skuRules}
              pagination={false}
              bordered
              scroll={{ y: 520 }}
              locale={{ emptyText: 'No rules yet. Create one to start auto-generating SKUs.' }}
              columns={[
                {
                  title: 'Name',
                  dataIndex: 'name',
                  render: (v, r) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{v}</div>
                      <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                        {r.scope === 'category' ? `Category: ${r.scope_value}` : 'Institution default'}
                        {r.is_default ? <Tag color="purple" style={{ marginLeft: 6 }}>Default</Tag> : null}
                      </div>
                    </div>
                  )
                },
                {
                  title: 'Next',
                  render: (_, r) => {
                    const n = (Number(r.counter_current) || 0) + 1;
                    const padded = String(n).padStart(r.counter_padding || 4, '0');
                    return <Tag color="geekblue">{r.use_counter ? padded : '—'}</Tag>;
                  }
                },
                {
                  title: '',
                  width: 90,
                  render: (_, r) => (
                    <Space size={4}>
                      <Button size="small" type="link" onClick={() => startEditSkuRule(r)}>Edit</Button>
                      <Popconfirm title="Remove this rule?" onConfirm={() => removeSkuRule(r.id)} okText="Remove" okButtonProps={{ danger: true }}>
                        <Button size="small" type="link" danger>Delete</Button>
                      </Popconfirm>
                    </Space>
                  )
                }
              ]}
            />
          </div>

          {/* --- Edit / create form --- */}
          <div style={{ flex: '1 1 620px', minWidth: 420, background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #eef0f7' }}>
            <div style={{ fontWeight: 700, marginBottom: 12, color: '#1f2937' }}>
              {editingSkuRule ? `Edit: ${editingSkuRule.name}` : 'Create a new rule'}
            </div>
            <Form
              form={skuRuleForm}
              layout="vertical"
              size="middle"
              labelCol={{ style: { paddingBottom: 2 } }}
              initialValues={{
                scope: 'default',
                prefixMode: 'static',
                prefixSources: ['name'],
                prefixSourceConfig: buildDefaultDerivedConfig(),
                prefixLength: 3,
                separator: '-',
                useDate: false,
                dateFormat: 'YYMM',
                useCounter: true,
                counterStart: 1,
                counterPadding: 4,
                isDefault: false
              }}
            >
              <div style={{ background: '#fafbff', border: '1px solid #edf0ff', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="name" label="Rule Name" rules={[{ required: true, message: 'Name is required' }]} style={{ marginBottom: 10 }}>
                      <Input placeholder="e.g. Default, Electronics, Apparel" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="scope" label="Applies To" rules={[{ required: true }]} style={{ marginBottom: 10 }}>
                      <Select>
                        <Select.Option value="default">Institution default</Select.Option>
                        <Select.Option value="category">Specific category</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, cur) => prev.scope !== cur.scope}
                    >
                      {({ getFieldValue }) => getFieldValue('scope') === 'category' ? (
                        <Form.Item name="scopeValue" label="Category" rules={[{ required: true, message: 'Pick a category' }]} style={{ marginBottom: 0 }}>
                          <Select
                            placeholder="Select category"
                            showSearch
                            options={(categories || []).map(c => ({ value: c.name, label: c.name }))}
                          />
                        </Form.Item>
                      ) : (
                        <Form.Item name="isDefault" label="Usage" style={{ marginBottom: 0 }}>
                          <Select>
                            <Select.Option value={true}>Use as default</Select.Option>
                            <Select.Option value={false}>Secondary (manual pick)</Select.Option>
                          </Select>
                        </Form.Item>
                      )}
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              <Divider style={{ margin: '10px 0 14px', fontSize: 12 }} orientation="left">Prefix</Divider>
              <Row gutter={12}>
                <Col span={10}>
                  <Form.Item name="prefixMode" label="Mode" rules={[{ required: true }]}>
                    <Select>
                      <Select.Option value="static">Static text</Select.Option>
                      <Select.Option value="derived">Derived from field</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={14}>
                  <Form.Item noStyle shouldUpdate={(p, c) => p.prefixMode !== c.prefixMode}>
                    {({ getFieldValue }) => getFieldValue('prefixMode') === 'static' ? (
                      <>
                        <Form.Item
                          name="prefixStatic"
                          label="Text"
                          rules={[{ required: true, message: 'Enter a prefix' }]}
                          style={{ marginBottom: 8 }}
                        >
                          <Input placeholder="e.g. ITEM or {BRAND}-{ITEM}-{SIZE}-{TYPE}-{SEQ}" maxLength={80} />
                        </Form.Item>
                        <div style={{ marginBottom: 6, fontSize: 12, color: '#6b7280' }}>Template tokens</div>
                        <div style={{ marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: 8 }}>
                          {[
                            '{BRAND}', '{ITEM}', '{VARIANT}', '{COLOR}', '{SIZE}', '{TYPE}', '{CATEGORY}',
                            '{MANUFACTURER}', '{UNIT}', '{WAREHOUSE}', '{HSN}', '{MPN}', '{BARCODE}', '{DATE}', '{SEQ}'
                          ].map((token) => (
                            <Button key={token} size="small" onClick={() => insertSkuToken(token)}>
                              {token}
                            </Button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <Form.Item noStyle shouldUpdate={(p, c) =>
                        p.prefixSources !== c.prefixSources || p.prefixSourceConfig !== c.prefixSourceConfig
                      }>
                        {({ getFieldValue }) => {
                          const selected = Array.isArray(getFieldValue('prefixSources'))
                            ? getFieldValue('prefixSources').filter(Boolean)
                            : [];
                          return (
                            <>
                              <Form.Item name="prefixSources" label="Source fields" rules={[{ required: true, message: 'Select at least one field' }]}>
                                <Select
                                  mode="multiple"
                                  maxTagCount="responsive"
                                  placeholder="Choose one or more fields"
                                  options={DERIVED_SOURCE_OPTIONS}
                                  onChange={(nextValues) => {
                                    const prevValues = skuRuleForm.getFieldValue('prefixSources') || [];
                                    const ordered = preserveSelectionOrder(prevValues, nextValues);
                                    skuRuleForm.setFieldsValue({ prefixSources: ordered });
                                  }}
                                />
                              </Form.Item>
                              {selected.length > 0 && (
                                <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 10, marginTop: -4, background: '#fcfcff' }}>
                                  {selected.map((src) => (
                                    <Row gutter={10} key={src} style={{ marginBottom: 10, padding: '8px 8px 2px', background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8 }}>
                                      <Col xs={24} sm={8}>
                                        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Field</div>
                                        <div style={{ fontSize: 13, color: '#262626', textTransform: 'capitalize', fontWeight: 600 }}>
                                          {DERIVED_SOURCE_LABELS[src] || src}
                                        </div>
                                      </Col>
                                      <Col xs={12} sm={8}>
                                        <Form.Item noStyle shouldUpdate={(p, c) =>
                                          p?.prefixSourceConfig?.[src]?.mode !== c?.prefixSourceConfig?.[src]?.mode
                                        }>
                                          {({ getFieldValue }) => {
                                            const mode = getFieldValue(['prefixSourceConfig', src, 'mode']) || 'abbr';
                                            const disableLen = mode === 'abbr';
                                            return (
                                              <Form.Item
                                                name={['prefixSourceConfig', src, 'len']}
                                                label="Chars"
                                                style={{ marginBottom: 0 }}
                                                labelCol={{ style: { paddingBottom: 2 } }}
                                                extra={disableLen ? 'Disabled for first letters' : undefined}
                                              >
                                                <InputNumber min={1} max={10} style={{ width: '100%' }} disabled={disableLen} />
                                              </Form.Item>
                                            );
                                          }}
                                        </Form.Item>
                                      </Col>
                                      <Col xs={12} sm={8}>
                                        <Form.Item name={['prefixSourceConfig', src, 'mode']} label="Pick style" style={{ marginBottom: 0 }} labelCol={{ style: { paddingBottom: 2 } }}>
                                          <Select>
                                            <Select.Option value="abbr">First letters</Select.Option>
                                            <Select.Option value="slice">First chars</Select.Option>
                                          </Select>
                                        </Form.Item>
                                      </Col>
                                    </Row>
                                  ))}
                                </div>
                              )}
                            </>
                          );
                        }}
                      </Form.Item>
                    )}
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="separator" label="Separator" style={{ marginBottom: 10 }}>
                <Select>
                  <Select.Option value="-">Dash (-)</Select.Option>
                  <Select.Option value="_">Underscore (_)</Select.Option>
                  <Select.Option value="">None</Select.Option>
                </Select>
              </Form.Item>

              <Divider style={{ margin: '10px 0 14px', fontSize: 12 }} orientation="left">Date segment (optional)</Divider>
              <Row gutter={12}>
                <Col span={10}>
                  <Form.Item name="useDate" label="Include date" style={{ marginBottom: 10 }}>
                    <Select>
                      <Select.Option value={false}>No</Select.Option>
                      <Select.Option value={true}>Yes</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={14}>
                  <Form.Item noStyle shouldUpdate={(p, c) => p.useDate !== c.useDate}>
                    {({ getFieldValue }) => getFieldValue('useDate') ? (
                      <Form.Item name="dateFormat" label="Format" rules={[{ required: true }]}>
                        <Select>
                          <Select.Option value="YY">YY (26)</Select.Option>
                          <Select.Option value="YYMM">YYMM (2604)</Select.Option>
                          <Select.Option value="YYYYMM">YYYYMM (202604)</Select.Option>
                          <Select.Option value="YYYYMMDD">YYYYMMDD (20260421)</Select.Option>
                        </Select>
                      </Form.Item>
                    ) : null}
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: '10px 0 14px', fontSize: 12 }} orientation="left">Counter</Divider>
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="useCounter" label="Include counter">
                    <Select>
                      <Select.Option value={true}>Yes</Select.Option>
                      <Select.Option value={false}>No</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="counterStart" label="Start at">
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="counterPadding" label="Zero-pad width">
                    <InputNumber min={1} max={10} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                {editingSkuRule && (
                  <Button onClick={() => { setEditingSkuRule(null); skuRuleForm.resetFields(); }}>Cancel edit</Button>
                )}
                <Button type="primary" onClick={submitSkuRule} style={{ background: '#764ba2', border: 'none' }}>
                  {editingSkuRule ? 'Update Rule' : 'Create Rule'}
                </Button>
              </div>
            </Form>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default Items;
