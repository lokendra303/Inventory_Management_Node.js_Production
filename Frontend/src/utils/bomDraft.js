import dayjs from 'dayjs';
import {
  buildSkuMetaFromFormValues,
  mapSkuMetaToVariantFormFields,
} from './variantLibraryHelpers';

const TEXT_KEYS = [
  'sku', 'name', 'description', 'category', 'hsnCode', 'barcode', 'brand', 'manufacturer',
  'supplierCode', 'upc', 'mpn', 'ean', 'isbn', 'weight', 'salesDescription', 'purchaseDescription',
  'variant', 'colorCode', 'sizeCode', 'packType',
];

const NUMERIC_KEYS = [
  'costPrice', 'sellingPrice', 'mrp', 'openingStock', 'openingValue', 'minStockLevel', 'maxStockLevel',
  'taxRate', 'purchaseTaxRate', 'shelfLifeDays', 'length', 'width', 'height',
];

function optionalText(value) {
  if (value == null || value === '') return undefined;
  return String(value).trim() || undefined;
}

function optionalNumber(value, fallback = undefined) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function hasBomDraftContent(values = {}, components = [], imageUrl = '') {
  const hasText = TEXT_KEYS.some((k) => String(values[k] || '').trim());
  const hasNumeric = NUMERIC_KEYS.some((k) => Number(values[k]) > 0);
  const hasComponents = (components || []).some((row) => String(row?.itemId || '').trim());
  return hasText || hasNumeric || hasComponents || Boolean(imageUrl);
}

export function serializeBomDraft(values = {}, components = [], kitFulfillmentMode = 'prebuilt', imageUrl = '') {
  const {
    openingManufactureDate,
    openingExpiryDate,
    ...rest
  } = values;

  return {
    ...rest,
    image: imageUrl || undefined,
    openingManufactureDate: openingManufactureDate?.format
      ? openingManufactureDate.format('YYYY-MM-DD')
      : (openingManufactureDate || undefined),
    openingExpiryDate: openingExpiryDate?.format
      ? openingExpiryDate.format('YYYY-MM-DD')
      : (openingExpiryDate || undefined),
    components: Array.isArray(components) ? components : [],
    kitFulfillmentMode,
    _draftKind: 'bom',
  };
}
export function restoreBomDraftToForm(draftData = {}, form, setters = {}) {
  const {
    components: draftComponents,
    kitFulfillmentMode,
    image,
    _draftKind,
    ...fields
  } = draftData;

  form.setFieldsValue({
    ...fields,
    openingManufactureDate: fields.openingManufactureDate
      ? dayjs(fields.openingManufactureDate)
      : undefined,
    openingExpiryDate: fields.openingExpiryDate
      ? dayjs(fields.openingExpiryDate)
      : undefined,
  });

  if (setters.setKitFulfillmentMode) {
    setters.setKitFulfillmentMode(kitFulfillmentMode || 'prebuilt');
  }

  if (setters.setImageUrl && image) {
    setters.setImageUrl(image);
  }

  const comps = Array.isArray(draftComponents) && draftComponents.length
    ? draftComponents
    : [{ itemId: '', quantityRequired: 1, consumptionTiming: 'shipment' }];

  if (setters.setComponents) {
    setters.setComponents(comps);
  }

  return { components: comps, kitFulfillmentMode: kitFulfillmentMode || 'prebuilt', imageUrl: image || '' };
}

export function mapBomItemToFormValues(item = {}) {
  const dims = item.dimensions && typeof item.dimensions === 'object'
    ? item.dimensions
    : (() => {
      try { return JSON.parse(item.dimensions || '{}'); } catch { return {}; }
    })();

  return {
    sku: item.sku,
    name: item.name,
    description: item.description,
    category: item.category,
    itemGroupId: item.item_group_id || item.itemGroupId || null,
    unit: item.unit,
    barcode: item.barcode,
    hsnCode: item.hsn_code || item.hsnCode,
    supplierCode: item.supplier_code || item.supplierCode,
    upc: item.upc,
    ean: item.ean,
    isbn: item.isbn,
    mpn: item.mpn,
    brand: item.brand,
    manufacturer: item.manufacturer,
    weight: item.weight,
    length: dims?.length,
    width: dims?.width,
    height: dims?.height,
    costPrice: item.cost_price != null ? Number(item.cost_price) : undefined,
    sellingPrice: item.selling_price != null ? Number(item.selling_price) : undefined,
    mrp: item.mrp != null ? Number(item.mrp) : undefined,
    taxRate: item.tax_rate != null ? Number(item.tax_rate) : undefined,
    salesAccount: item.sales_account || item.salesAccount,
    purchaseAccount: item.purchase_account || item.purchaseAccount || 'cogs',
    minStockLevel: item.min_stock_level,
    maxStockLevel: item.max_stock_level,
    valuationMethod: item.valuation_method || 'fifo',
    allowNegativeStock: Boolean(item.allow_negative_stock),
    isBatchTracked: Boolean(item.is_batch_tracked),
    isSerialized: Boolean(item.is_serialized),
    hasExpiry: Boolean(item.has_expiry),
    shelfLifeDays: item.shelf_life_days,
    defaultBinId: item.default_bin_id || item.defaultBinId,
    openingStock: item.opening_stock,
    openingValue: item.opening_value,
    warehouseId: item.warehouse_id || (Array.isArray(item.warehouse_ids) ? item.warehouse_ids[0] : undefined),
    status: item.status || 'active',
    returnableItem: Boolean(item.custom_fields?.returnableItem || item.custom_fields?.returnable),
    trackInventory: false,
    isSellable: item.is_sellable !== 0 && item.is_sellable !== false,
    isPurchasable: item.is_purchasable !== 0 && item.is_purchasable !== false,
    isManufacturable: item.is_manufacturable !== 0 && item.is_manufacturable !== false,
    ...mapSkuMetaToVariantFormFields(item.custom_fields || {}),
    bomAdditionalCharges: Array.isArray(item.custom_fields?.bomAdditionalCharges)
      ? item.custom_fields.bomAdditionalCharges.map((row) => ({
        label: row?.label || '',
        amount: row?.amount != null ? Number(row.amount) : undefined,
      }))
      : [],
  };
}

export function buildBomSubmitPayload(values = {}, extras = {}) {
  const {
    components,
    kitFulfillmentMode,
    imageUrl,
    existingCustomFields = {},
    isEditing = false,
  } = extras;

  const itemIsSellable = values.isSellable !== false;
  const itemIsPurchasable = values.isPurchasable === true;
  const itemIsManufacturable = values.isManufacturable !== false;
  const isExplodeMode = String(kitFulfillmentMode || 'prebuilt').toLowerCase() === 'explode_on_ship';
  const tracksInventory = !isExplodeMode && values.trackInventory === true;

  const customFields = {
    ...existingCustomFields,
    ...(values.customFields && typeof values.customFields === 'object' ? values.customFields : {}),
  };
  if (values.returnableItem) customFields.returnableItem = true;
  else delete customFields.returnableItem;
  if (values.salesDescription) customFields.salesDescription = values.salesDescription;
  else delete customFields.salesDescription;
  if (values.purchaseDescription) customFields.purchaseDescription = values.purchaseDescription;
  else delete customFields.purchaseDescription;
  if (itemIsPurchasable && values.purchaseTaxRate != null) customFields.purchaseTaxRate = values.purchaseTaxRate;
  else delete customFields.purchaseTaxRate;

  const normalizedCharges = (Array.isArray(values.bomAdditionalCharges) ? values.bomAdditionalCharges : [])
    .map((row) => ({
      label: String(row?.label || '').trim(),
      amount: Number(row?.amount),
    }))
    .filter((row) => row.label && Number.isFinite(row.amount) && row.amount >= 0);
  if (normalizedCharges.length) customFields.bomAdditionalCharges = normalizedCharges;
  else delete customFields.bomAdditionalCharges;

  const skuMeta = buildSkuMetaFromFormValues(values);
  if (skuMeta) {
    customFields.skuMeta = {
      ...((existingCustomFields || {}).skuMeta || {}),
      ...skuMeta,
    };
  } else if (customFields.skuMeta) {
    delete customFields.skuMeta.variant;
    delete customFields.skuMeta.color;
    delete customFields.skuMeta.size;
    delete customFields.skuMeta.packType;
    if (!Object.keys(customFields.skuMeta).length) delete customFields.skuMeta;
  }

  Object.keys(customFields).forEach((key) => {
    const val = customFields[key];
    if (val === undefined || val === null || val === '') delete customFields[key];
  });

  const dimensions = (values.length || values.width || values.height)
    ? {
      length: optionalNumber(values.length, 0),
      width: optionalNumber(values.width, 0),
      height: optionalNumber(values.height, 0),
    }
    : undefined;

  const payload = {
    sku: optionalText(values.sku),
    name: optionalText(values.name),
    type: 'composite',
    description: optionalText(values.description),
    category: optionalText(values.category),
    unit: values.unit || 'pcs',
    barcode: optionalText(values.barcode),
    hsnCode: optionalText(values.hsnCode),
    supplierCode: itemIsPurchasable ? optionalText(values.supplierCode) : undefined,
    upc: optionalText(values.upc),
    mpn: optionalText(values.mpn),
    ean: optionalText(values.ean),
    isbn: optionalText(values.isbn),
    brand: values.brand || undefined,
    manufacturer: values.manufacturer || undefined,
    weight: optionalText(values.weight),
    dimensions,
    image: imageUrl || undefined,
    kitFulfillmentMode: kitFulfillmentMode || 'prebuilt',
    components,
    itemGroupId: values.itemGroupId || undefined,
    valuationMethod: values.valuationMethod || 'fifo',
    allowNegativeStock: Boolean(values.allowNegativeStock),
    purchaseAccount: itemIsPurchasable ? (values.purchaseAccount || 'cogs') : undefined,
    salesAccount: itemIsSellable ? (values.salesAccount || undefined) : undefined,
    isSellable: itemIsSellable,
    isPurchasable: itemIsPurchasable,
    isManufacturable: itemIsManufacturable,
    costPrice: optionalNumber(values.costPrice, 0),
    sellingPrice: itemIsSellable ? optionalNumber(values.sellingPrice, 0) : 0,
    mrp: itemIsSellable ? optionalNumber(values.mrp) : undefined,
    taxRate: itemIsSellable ? optionalNumber(values.taxRate, 0) : 0,
    isBatchTracked: tracksInventory ? Boolean(values.isBatchTracked) : false,
    isSerialized: tracksInventory ? Boolean(values.isSerialized) : false,
    hasExpiry: tracksInventory ? Boolean(values.hasExpiry) : false,
    shelfLifeDays: tracksInventory && values.hasExpiry ? optionalNumber(values.shelfLifeDays) : undefined,
    minStockLevel: tracksInventory ? optionalNumber(values.minStockLevel, 0) : 0,
    maxStockLevel: tracksInventory ? optionalNumber(values.maxStockLevel, 0) : 0,
    customFields: Object.keys(customFields).length ? customFields : undefined,
    status: values.status || undefined,
  };

  if (!isEditing && tracksInventory) {
    payload.openingStock = optionalNumber(values.openingStock, 0);
    payload.openingValue = optionalNumber(values.openingValue, 0);
    payload.warehouseId = values.warehouseId || undefined;
    payload.defaultBinId = values.defaultBinId || undefined;
    payload.openingBatchNumber = optionalText(values.openingBatchNumber);
    payload.openingManufactureDate = values.openingManufactureDate?.format
      ? values.openingManufactureDate.format('YYYY-MM-DD')
      : optionalText(values.openingManufactureDate);
    payload.openingExpiryDate = values.openingExpiryDate?.format
      ? values.openingExpiryDate.format('YYYY-MM-DD')
      : optionalText(values.openingExpiryDate);
    payload.openingBatchRuleId = values.openingBatchRuleId || undefined;
  }

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });

  return payload;
}
