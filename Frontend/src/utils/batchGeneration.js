import { Modal } from 'antd';
import { toSkuCode } from './skuGeneration';

export function buildOpeningBatchPreviewContext(values = {}, opts = {}) {
  const { warehouses = [], selectedRuleId = null } = opts;
  const warehouseId = values.warehouseId;
  const warehouseRow = warehouses.find((w) => String(w.id) === String(warehouseId));
  const warehouseLabel = warehouseRow?.code || warehouseRow?.name || warehouseId || '';
  const sku = values.sku || '';
  const name = values.name || '';

  return {
    context: 'opening_stock',
    ruleId: selectedRuleId || undefined,
    warehouseId,
    sku,
    name,
    item: name,
    category: values.category || '',
    type: 'composite',
    unit: values.unit || '',
    warehouse: warehouseLabel,
    skuCode: toSkuCode(sku, 24) || sku,
    itemCode: toSkuCode(name, 4),
    categoryCode: toSkuCode(values.category, 3),
    warehouseCode: toSkuCode(warehouseLabel, 4),
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
  const sku = kitItem?.sku || '';
  const name = kitItem?.name || '';
  const category = kitItem?.category || '';

  return {
    context: 'kit_assembly',
    ruleId: selectedRuleId || undefined,
    itemId: compositeItemId,
    warehouseId,
    sku,
    name,
    item: name,
    category,
    type: kitItem?.type || 'composite',
    unit: kitItem?.unit || '',
    warehouse: warehouseLabel,
    skuCode: toSkuCode(sku, 24) || sku,
    itemCode: toSkuCode(name, 4),
    categoryCode: toSkuCode(category, 3),
    warehouseCode: toSkuCode(warehouseLabel, 4),
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
