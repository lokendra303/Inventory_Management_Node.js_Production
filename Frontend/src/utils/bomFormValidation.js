const isExplodeFulfillment = (mode) => (
  String(mode || 'prebuilt').toLowerCase() === 'explode_on_ship'
);

const isExplodeSubAssembly = (item) => (
  item
  && String(item.type || '').toLowerCase() === 'composite'
  && isExplodeFulfillment(item.kit_fulfillment_mode || item.kitFulfillmentMode)
);

const isManufacturableItem = (item) => (
  item?.is_manufacturable !== 0 && item?.is_manufacturable !== false
);

export function validateBomComponents(components = [], catalogItems = []) {
  const rows = Array.isArray(components) ? components : [];
  const emptyRows = rows.filter((row) => !row?.itemId);
  if (emptyRows.length > 0) {
    return { ok: false, message: 'Select a component item for each BOM row (or remove empty rows)' };
  }

  const explodeSub = rows.find((row) => {
    const item = catalogItems.find((c) => String(c.id) === String(row.itemId));
    return isExplodeSubAssembly(item);
  });
  if (explodeSub) {
    return {
      ok: false,
      message: 'Explode-on-ship BOM items cannot be used as sub-assemblies. Use Pre-built sub-assemblies or add raw components.',
    };
  }

  const nonManufacturable = rows.find((row) => {
    const item = catalogItems.find((c) => String(c.id) === String(row.itemId));
    return item && !isManufacturableItem(item);
  });
  if (nonManufacturable) {
    const item = catalogItems.find((c) => String(c.id) === String(nonManufacturable.itemId));
    const label = item?.sku || item?.name || 'selected item';
    return {
      ok: false,
      message: `"${label}" cannot be used as a BOM component (manufacturing usage is disabled on that item).`,
    };
  }

  const badQty = rows.find((row) => {
    const qty = Number(row?.quantityRequired);
    return !Number.isFinite(qty) || qty <= 0;
  });
  if (badQty) {
    return { ok: false, message: 'Each BOM component must have a quantity greater than zero' };
  }

  const ids = rows.map((row) => String(row.itemId));
  if (new Set(ids).size !== ids.length) {
    return { ok: false, message: 'Duplicate component is not allowed — use one row and increase qty' };
  }

  if (ids.length === 0) {
    return { ok: false, message: 'Add at least one BOM component' };
  }

  return { ok: true };
}

export function validateBomBusinessRules({
  values = {},
  components = [],
  catalogItems = [],
  kitFulfillmentMode = 'prebuilt',
  isEditing = false,
}) {
  const componentResult = validateBomComponents(components, catalogItems);
  if (!componentResult.ok) return componentResult;

  const isExplode = isExplodeFulfillment(kitFulfillmentMode);
  const tracksInventory = !isExplode && values.trackInventory === true;
  const openingStock = Number(values.openingStock) || 0;
  const minStock = Number(values.minStockLevel) || 0;
  const maxStock = Number(values.maxStockLevel) || 0;

  if (isExplode && values.trackInventory) {
    return { ok: false, message: 'Explode-on-ship items cannot track finished goods inventory' };
  }

  if (isExplode && (values.isBatchTracked || values.isSerialized || values.hasExpiry)) {
    return {
      ok: false,
      message: 'Batch, serial, and expiry tracking apply to finished goods stock — not explode-on-ship items',
    };
  }

  if (!isExplode && tracksInventory && minStock > 0 && maxStock > 0 && minStock > maxStock) {
    return { ok: false, message: 'Min stock level cannot be greater than max stock level' };
  }

  if (!isEditing && tracksInventory && openingStock > 0 && !values.warehouseId) {
    return { ok: false, message: 'Warehouse is required when opening stock is greater than zero' };
  }

  if (
    !isEditing
    && tracksInventory
    && openingStock > 0
    && values.warehouseId
    && values.hasExpiry
    && !values.openingExpiryDate
  ) {
    return {
      ok: false,
      message: 'Expiry date is required when expiry tracking is on and opening stock is set',
    };
  }

  if (values.isSellable !== false) {
    const selling = Number(values.sellingPrice);
    const mrp = Number(values.mrp);
    if (Number.isFinite(mrp) && mrp > 0 && Number.isFinite(selling) && selling > mrp) {
      return { ok: false, message: 'Selling price cannot be greater than MRP' };
    }
  }

  const incompleteCharge = (Array.isArray(values.bomAdditionalCharges) ? values.bomAdditionalCharges : [])
    .find((row) => {
      const label = String(row?.label || '').trim();
      const amount = Number(row?.amount);
      return (label && !Number.isFinite(amount)) || (!label && Number.isFinite(amount) && amount >= 0);
    });
  if (incompleteCharge) {
    return { ok: false, message: 'Complete each additional cost row (name and amount) or remove it' };
  }

  return { ok: true };
}
