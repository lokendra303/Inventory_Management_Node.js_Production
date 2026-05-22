/** Shared import constants (no React/api deps — safe for UI + helpers). */

export const CSV_IMPORT_SKU_FROM_FILE = 'from_file';
export const CSV_IMPORT_SKU_AUTO_RULE = 'auto_rule';

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
