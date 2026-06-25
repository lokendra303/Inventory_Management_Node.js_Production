import { Modal } from 'antd';

export const extractSkuTemplateTokens = (template = '') =>
  (String(template || '').match(/\{([^}]+)\}/g) || [])
    .map((wrap) => String(wrap).slice(1, -1).split('|')[0]?.trim()?.toUpperCase())
    .filter(Boolean);

export const toSkuCode = (value, len = 3) => {
  const parts = String(value || '')
    .trim()
    .split(/[^A-Za-z0-9]+/g)
    .filter(Boolean);
  const compact = parts.length >= 2
    ? parts.map((part) => part[0].toUpperCase()).join('')
    : parts.join('').toUpperCase();
  return compact.replace(/[^A-Z0-9]+/g, '').slice(0, len);
};

export function buildSkuContextFromValues(values = {}, opts = {}) {
  const {
    units = [],
    warehouses = [],
    itemType = 'simple',
    selectedRuleId = null,
  } = opts;

  const unitValue = values.unit;
  const unitRow = units.find(
    (u) => u.id === unitValue || u.name === unitValue || u.symbol === unitValue
  );
  const unitLabel = unitRow?.symbol || unitRow?.name || unitValue || '';
  const warehouseId = values.warehouseId;
  const warehouseRow = warehouses.find((w) => String(w.id) === String(warehouseId));
  const warehouseLabel = warehouseRow?.code || warehouseRow?.name || warehouseId || '';
  const itemName = values.name || '';
  const categoryName = values.category || '';
  const variantValue = String(values.variant || '').trim();
  const colorValue = String(values.colorCode || '').trim();
  const sizeValue = String(values.sizeCode || '').trim();
  const packTypeValue = String(values.packType || '').trim();

  return {
    ruleId: selectedRuleId || undefined,
    category: categoryName,
    name: itemName,
    item: itemName,
    type: itemType,
    unit: unitLabel,
    warehouse: warehouseLabel,
    variant: variantValue,
    color: colorValue,
    hsnCode: values.hsnCode || '',
    mpn: values.mpn || '',
    barcode: values.barcode || values.ean || '',
    brandCode: toSkuCode(values.brand, 3),
    itemCode: toSkuCode(itemName, 4),
    categoryCode: toSkuCode(categoryName, 3),
    typeCode: toSkuCode(packTypeValue || itemType, 3),
    unitCode: toSkuCode(unitLabel, 4),
    warehouseCode: toSkuCode(warehouseLabel, 4),
    variantCode: toSkuCode(variantValue, 4),
    colorCode: toSkuCode(colorValue, 4),
    size: toSkuCode(sizeValue || unitLabel, 8),
    typeValue: packTypeValue || itemType,
  };
}

export function ensureSkuRuleRequirements(selectedRule, ctx, actionLabel = 'Generate SKU') {
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
    TYPE: { label: 'Item Type', value: ctx.typeValue || ctx.type },
    CATEGORY: { label: 'Category', value: ctx.category },
    MANUFACTURER: { label: 'Manufacturer', value: ctx.manufacturer },
    UNIT: { label: 'Unit', value: ctx.unit },
    WAREHOUSE: { label: 'Warehouse', value: ctx.warehouse },
    HSN: { label: 'HSN Code', value: ctx.hsnCode },
    MPN: { label: 'MPN', value: ctx.mpn },
    BARCODE: { label: 'Barcode / EAN', value: ctx.barcode },
  };

  const missingFields = extractSkuTemplateTokens(selectedRule.prefix_static)
    .map((token) => tokenRequirements[token])
    .filter((requirement) => requirement && !String(requirement.value || '').trim())
    .map((requirement) => requirement.label);

  const uniqueMissing = Array.from(new Set(missingFields));
  if (uniqueMissing.length === 0) return true;

  Modal.warning({
    title: 'Required fields missing for selected SKU rule',
    content: `Fill these fields first, then click ${actionLabel}: ${uniqueMissing.join(', ')}`,
    okText: 'Understood',
  });
  return false;
}

export function showSkuGenerationError(error) {
  const err = error?.response?.data?.error || error?.message || 'Failed to generate SKU';
  const normalizedErr = String(err || '').toLowerCase();
  if (normalizedErr.includes('failed to allocate unique sku after multiple attempts')) {
    Modal.warning({
      title: 'SKU generation needs attention',
      width: 560,
      content:
        'Could not generate a unique SKU with the current rule after several retries. '
        + 'Try another rule, adjust counter padding, or enter SKU manually.',
      okText: 'Got it',
    });
    return;
  }

  Modal.error({
    title: 'SKU generation failed',
    content: err,
    okText: 'Close',
  });
}
