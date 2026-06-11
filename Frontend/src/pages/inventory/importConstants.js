/** Shared import constants (no React/api deps — safe for UI + helpers). */

export const CSV_IMPORT_SKU_FROM_FILE = 'from_file';
export const CSV_IMPORT_SKU_AUTO_RULE = 'auto_rule';

export const CSV_IMPORT_PURPOSE_CREATE = 'create';
export const CSV_IMPORT_PURPOSE_UPDATE = 'update';

/**
 * How to find an existing catalog item when import purpose is update.
 * `mappingKey` is the CSV_IMPORT_CORE_TARGETS id used for file values.
 * `itemFields` are property names on catalog item rows from GET /items.
 */
export const CSV_IMPORT_MATCH_FIELDS = [
  { id: 'name', label: 'Item name', mappingKey: 'name', itemFields: ['name'] },
  { id: 'sku', label: 'SKU', mappingKey: 'sku', itemFields: ['sku'] },
  { id: 'barcode', label: 'Barcode', mappingKey: 'barcode', itemFields: ['barcode'] },
  { id: 'ean', label: 'EAN', mappingKey: 'ean', itemFields: ['ean'] },
  { id: 'upc', label: 'UPC', mappingKey: 'upc', itemFields: ['upc'] },
  { id: 'description', label: 'Description', mappingKey: 'description', itemFields: ['description'] },
  { id: 'batchNumber', label: 'Batch number', mappingKey: 'batchNumber', itemFields: ['batch_number', 'batchNumber'] },
  { id: 'supplierCode', label: 'Supplier code', mappingKey: 'supplierCode', itemFields: ['supplier_code', 'supplierCode'] },
  { id: 'mpn', label: 'MPN', mappingKey: 'mpn', itemFields: ['mpn'] },
];

export const CSV_IMPORT_DEFAULT_MATCH_FIELD = 'name';

export const CSV_IMPORT_DEFAULTABLE_CORE_IDS = [
  'sku',
  'description', 'barcode', 'category', 'unit', 'itemGroupName',
  'brand', 'manufacturer', 'supplierCode',
  'costPrice', 'sellingPrice', 'mrp', 'taxRate',
  'weight', 'hsnCode', 'batchNumber',
  'minStockLevel', 'maxStockLevel', 'openingStock', 'openingValue',
  'dimLength', 'dimWidth', 'dimHeight',
  'upc', 'ean', 'isbn', 'mpn',
];
