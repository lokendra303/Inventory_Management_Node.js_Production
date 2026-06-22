import dayjs from 'dayjs';

const TEXT_KEYS = [
  'sku', 'name', 'description', 'category', 'hsnCode', 'barcode', 'brand', 'manufacturer',
  'supplierCode', 'upc', 'mpn', 'ean', 'isbn', 'weight', 'salesDescription', 'purchaseDescription',
];

const NUMERIC_KEYS = [
  'costPrice', 'sellingPrice', 'mrp', 'openingStock', 'openingValue', 'minStockLevel', 'maxStockLevel',
  'taxRate', 'purchaseTaxRate', 'shelfLifeDays', 'length', 'width', 'height',
];

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
  };
}

export function buildBomSubmitPayload(values = {}, extras = {}) {
  const {
    components,
    kitFulfillmentMode,
    imageUrl,
    existingCustomFields = {},
  } = extras;

  const dimensions = (values.length || values.width || values.height)
    ? {
      length: values.length || 0,
      width: values.width || 0,
      height: values.height || 0,
    }
    : null;

  const customFields = { ...existingCustomFields };
  if (values.returnableItem) customFields.returnableItem = true;
  else delete customFields.returnableItem;
  if (values.salesDescription) customFields.salesDescription = values.salesDescription;
  if (values.purchaseDescription) customFields.purchaseDescription = values.purchaseDescription;
  if (values.purchaseTaxRate != null) customFields.purchaseTaxRate = values.purchaseTaxRate;

  return {
    ...values,
    type: 'composite',
    image: imageUrl || undefined,
    kitFulfillmentMode,
    components,
    dimensions,
    itemGroupId: values.itemGroupId || null,
    salesAccount: values.salesAccount,
    purchaseAccount: values.purchaseAccount,
    customFields: Object.keys(customFields).length ? customFields : undefined,
    openingManufactureDate: values.openingManufactureDate?.format
      ? values.openingManufactureDate.format('YYYY-MM-DD')
      : undefined,
    openingExpiryDate: values.openingExpiryDate?.format
      ? values.openingExpiryDate.format('YYYY-MM-DD')
      : undefined,
    length: undefined,
    width: undefined,
    height: undefined,
    returnableItem: undefined,
    salesDescription: undefined,
    purchaseDescription: undefined,
    purchaseTaxRate: undefined,
  };
}
