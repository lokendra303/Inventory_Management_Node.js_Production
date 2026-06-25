import { Modal } from 'antd';
import { toSkuCode } from './skuGeneration';

const metaFromSource = (values = {}, item = null) => {
  const cf = item?.custom_fields || item?.customFields || values.custom_fields || {};
  const skuMeta = cf?.skuMeta && typeof cf.skuMeta === 'object' ? cf.skuMeta : {};
  const pick = (key, fallback = '') => {
    const fromValues = values[key];
    if (fromValues) return String(fromValues).trim();
    const fromMeta = skuMeta[key];
    if (Array.isArray(fromMeta)) return fromMeta.filter(Boolean).join(', ');
    if (fromMeta) return String(fromMeta).trim();
    return String(fallback || '').trim();
  };

  const variant = pick('variant', values.variant);
  const color = pick('color', values.colorCode || values.color);
  const size = pick('size', values.sizeCode || values.size);
  const packType = pick('packType', values.packType);
  const brand = values.brand || item?.brand_name || item?.brand || '';
  const manufacturer = values.manufacturer || item?.manufacturer_name || item?.manufacturer || '';

  return { variant, color, size, packType, brand, manufacturer };
};

export function buildOpeningBatchPreviewContext(values = {}, opts = {}) {
  const { warehouses = [], selectedRuleId = null } = opts;
  const warehouseId = values.warehouseId;
  const warehouseRow = warehouses.find((w) => String(w.id) === String(warehouseId));
  const warehouseLabel = warehouseRow?.code || warehouseRow?.name || warehouseId || '';
  const sku = values.sku || '';
  const name = values.name || '';
  const meta = metaFromSource(values);

  return {
    context: 'opening_stock',
    ruleId: selectedRuleId || undefined,
    warehouseId,
    sku,
    name,
    item: name,
    category: values.category || '',
    type: values.type || 'composite',
    unit: values.unit || '',
    warehouse: warehouseLabel,
    brand: meta.brand,
    manufacturer: meta.manufacturer,
    variant: meta.variant,
    color: meta.color,
    size: meta.size || values.unit || '',
    typeValue: meta.packType || values.type || '',
    skuCode: toSkuCode(sku, 24) || sku,
    itemCode: toSkuCode(name, 4),
    categoryCode: toSkuCode(values.category, 3),
    brandCode: toSkuCode(meta.brand, 3),
    variantCode: toSkuCode(meta.variant, 4),
    colorCode: toSkuCode(meta.color, 4),
    warehouseCode: toSkuCode(warehouseLabel, 4),
    unitCode: toSkuCode(values.unit, 4),
    typeCode: toSkuCode(meta.packType || values.type, 3),
  };
}

export function buildKitBatchContext(values = {}, opts = {}) {
  const {
    compositeItemId,
    warehouseId,
    warehouses = [],
    kitItem = null,
    selectedRuleId = null,
  } = opts;

  const warehouseRow = warehouses.find((w) => String(w.id) === String(warehouseId));
  const warehouseLabel = warehouseRow?.code || warehouseRow?.name || warehouseId || '';
  const sku = kitItem?.sku || values.sku || '';
  const name = kitItem?.name || values.name || '';
  const category = kitItem?.category || values.category || '';
  const meta = metaFromSource(values, kitItem);

  return {
    context: 'kit_assembly',
    ruleId: selectedRuleId || undefined,
    itemId: compositeItemId,
    warehouseId,
    sku,
    name,
    item: name,
    category,
    type: kitItem?.type || values.type || 'composite',
    unit: kitItem?.unit || values.unit || '',
    warehouse: warehouseLabel,
    brand: meta.brand,
    manufacturer: meta.manufacturer,
    variant: meta.variant,
    color: meta.color,
    size: meta.size || kitItem?.unit || values.unit || '',
    typeValue: meta.packType || kitItem?.type || values.type || '',
    skuCode: toSkuCode(sku, 24) || sku,
    itemCode: toSkuCode(name, 4),
    categoryCode: toSkuCode(category, 3),
    brandCode: toSkuCode(meta.brand, 3),
    variantCode: toSkuCode(meta.variant, 4),
    colorCode: toSkuCode(meta.color, 4),
    warehouseCode: toSkuCode(warehouseLabel, 4),
    unitCode: toSkuCode(kitItem?.unit || values.unit, 4),
    typeCode: toSkuCode(meta.packType || kitItem?.type, 3),
  };
}

export function showBatchGenerationError(error) {
  const err = error?.response?.data?.error || error?.message || 'Failed to generate batch number';
  Modal.error({
    title: 'Batch generation failed',
    content: err,
    okText: 'Close',
  });
}
