const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');
const itemFieldService = require('./itemField.service');
const itemPriceHistoryService = require('./itemPriceHistory.service');
const itemGroupService = require('./itemGroup.service');

class ItemService {
  _normalizeCompositeComponents(components = []) {
    if (!Array.isArray(components)) return [];
    return components
      .map((component) => ({
        itemId: String(component?.itemId || component?.componentItemId || '').trim(),
        quantityRequired: Number(component?.quantityRequired),
        consumptionTiming: String(component?.consumptionTiming || 'shipment').trim().toLowerCase()
      }))
      .filter((component) => component.itemId && Number.isFinite(component.quantityRequired) && component.quantityRequired > 0)
      .map((component) => ({
        ...component,
        consumptionTiming: ['order', 'shipment'].includes(component.consumptionTiming) ? component.consumptionTiming : 'shipment'
      }));
  }

  async _replaceCompositeComponents(institutionId, compositeItemId, components = []) {
    const compositeRows = await db.query(
      `SELECT id, type
         FROM items
        WHERE institution_id = ? AND id = ?
        LIMIT 1`,
      [institutionId, compositeItemId]
    );
    if (compositeRows.length === 0) {
      throw new Error('Composite item not found');
    }
    const compositeType = String(compositeRows[0].type || '').toLowerCase();
    if (compositeType !== 'composite') {
      throw new Error('Components can only be managed for composite items');
    }

    const normalizedComponents = this._normalizeCompositeComponents(components);
    if (normalizedComponents.length === 0) {
      throw new Error('Composite item must have at least one component');
    }

    const uniqueComponentIds = new Set(normalizedComponents.map((component) => component.itemId));
    if (uniqueComponentIds.size !== normalizedComponents.length) {
      throw new Error('Duplicate component is not allowed for the same composite item');
    }
    if (uniqueComponentIds.has(compositeItemId)) {
      throw new Error('Composite item cannot reference itself as component');
    }

    const componentIds = Array.from(uniqueComponentIds);
    const placeholders = componentIds.map(() => '?').join(',');
    const candidateComponents = await db.query(
      `SELECT id, status, type
         FROM items
        WHERE institution_id = ?
          AND id IN (${placeholders})`,
      [institutionId, ...componentIds]
    );
    if (candidateComponents.length !== uniqueComponentIds.size) {
      const foundIds = new Set(candidateComponents.map((row) => String(row.id)));
      const missingIds = Array.from(uniqueComponentIds).filter((id) => !foundIds.has(String(id)));
      throw new Error(`Invalid component item IDs: ${missingIds.join(', ')}`);
    }
    const inactiveIds = candidateComponents
      .filter((row) => String(row.status || '').toLowerCase() !== 'active')
      .map((row) => String(row.id));
    if (inactiveIds.length > 0) {
      throw new Error(`Inactive component items: ${inactiveIds.join(', ')}`);
    }
    const unsupportedTypeIds = candidateComponents
      .filter((row) => ['service', 'composite'].includes(String(row.type || '').toLowerCase()))
      .map((row) => String(row.id));
    if (unsupportedTypeIds.length > 0) {
      throw new Error(`Unsupported component item types for IDs: ${unsupportedTypeIds.join(', ')}`);
    }

    await db.query(
      'DELETE FROM composite_components WHERE institution_id = ? AND composite_item_id = ?',
      [institutionId, compositeItemId]
    );

    for (const component of normalizedComponents) {
      await db.query(
        `INSERT INTO composite_components
         (id, institution_id, composite_item_id, component_item_id, quantity_required, consumption_timing)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          institutionId,
          compositeItemId,
          component.itemId,
          component.quantityRequired,
          component.consumptionTiming
        ]
      );
    }

    return normalizedComponents.length;
  }

  _normalizeVariantRows(rows = []) {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => ({
        id: row?.id ? String(row.id).trim() : null,
        key: String(row?.key || '').trim(),
        combinationLabel: String(row?.combinationLabel || '').trim(),
        attributes: row?.attributes && typeof row.attributes === 'object' ? row.attributes : {},
        sku: String(row?.sku || '').trim(),
        barcode: row?.barcode ? String(row.barcode).trim() : null,
        costPrice: Number(row?.costPrice) || 0,
        sellingPrice: Number(row?.sellingPrice) || 0,
        openingStock: Number(row?.openingStock) || 0,
        warehouseId: row?.warehouseId ? String(row.warehouseId).trim() : null,
        active: row?.active !== false
      }))
      .filter((row) => row.key && row.combinationLabel);
  }

  _safeParseJson(value, fallback = null) {
    if (value == null) return fallback;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  async _resolveItemGroup(institutionId, payload = {}) {
    return itemGroupService.resolveItemGroupRef(institutionId, payload);
  }

  async getItemAuditSnapshot(institutionId, itemId) {
    const rows = await db.query(
      `SELECT i.id, i.sku, i.name, i.description, i.type, i.kit_fulfillment_mode, i.category, i.unit, i.barcode, i.hsn_code,
              i.custom_fields, i.valuation_method, i.allow_negative_stock, i.status, i.cost_price,
              i.selling_price, i.mrp, i.tax_rate, i.brand, i.manufacturer, i.item_group_id,
              COALESCE(ig.name, i.item_group) AS item_group_name,
              i.min_stock_level, i.max_stock_level, i.weight, i.dimensions, i.upc, i.ean, i.isbn,
              i.mpn, i.opening_stock, i.opening_value, i.default_bin_id,
              (
                SELECT ip.warehouse_id
                FROM inventory_projections ip
                WHERE ip.institution_id = i.institution_id AND ip.item_id = i.id
                ORDER BY ip.updated_at DESC, ip.id DESC
                LIMIT 1
              ) AS warehouse_id
         FROM items i
         LEFT JOIN item_groups ig ON ig.id = i.item_group_id AND ig.institution_id = i.institution_id
         WHERE i.institution_id = ? AND i.id = ?
         LIMIT 1`,
      [institutionId, itemId]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const customFields = this._safeParseJson(row.custom_fields, {});
    const dimensions = this._safeParseJson(row.dimensions, null);
    const normalizedType = String(row.type || '').toLowerCase();
    const snapshot = {
      id: row.id,
      sku: row.sku,
      name: row.name,
      description: row.description,
      type: row.type,
      category: row.category,
      unit: row.unit,
      barcode: row.barcode,
      hsnCode: row.hsn_code,
      customFields,
      valuationMethod: row.valuation_method,
      allowNegativeStock: Boolean(row.allow_negative_stock),
      status: row.status,
      costPrice: row.cost_price != null ? Number(row.cost_price) : null,
      sellingPrice: row.selling_price != null ? Number(row.selling_price) : null,
      mrp: row.mrp != null ? Number(row.mrp) : null,
      taxRate: row.tax_rate != null ? Number(row.tax_rate) : null,
      brand: row.brand,
      manufacturer: row.manufacturer,
      itemGroupId: row.item_group_id || null,
      itemGroup: row.item_group_name || null,
      minStockLevel: row.min_stock_level != null ? Number(row.min_stock_level) : null,
      maxStockLevel: row.max_stock_level != null ? Number(row.max_stock_level) : null,
      warehouseId: row.warehouse_id || null,
      weight: row.weight != null ? Number(row.weight) : null,
      dimensions,
      upc: row.upc,
      ean: row.ean,
      isbn: row.isbn,
      mpn: row.mpn,
      openingStock: row.opening_stock != null ? Number(row.opening_stock) : null,
      openingValue: row.opening_value != null ? Number(row.opening_value) : null,
      defaultBinId: row.default_bin_id || null,
      components: [],
    };

    if (normalizedType === 'composite') {
      const components = await this.getCompositeComponents(institutionId, itemId);
      snapshot.components = components.map((component) => ({
        itemId: component.component_item_id,
        quantityRequired: Number(component.quantity_required || 0),
        consumptionTiming: component.consumption_timing || 'shipment'
      }));
      snapshot.kitFulfillmentMode = row.kit_fulfillment_mode || 'prebuilt';
    }

    return snapshot;
  }

  async _syncItemVariants(institutionId, parentItemId, parentSku, customFields = {}) {
    const rows = this._normalizeVariantRows(customFields?.variantMatrix);

    const toAttrValue = (attrs, keys = []) => {
      const entries = Object.entries(attrs || {});
      const found = entries.find(([k]) => keys.includes(String(k || '').toLowerCase()));
      return found ? String(found[1] || '').trim() || null : null;
    };

    const parseAttrs = (raw) => {
      if (!raw) return {};
      if (typeof raw === 'object') return raw;
      try { return JSON.parse(raw || '{}'); } catch { return {}; }
    };

    const imsKeyFromStored = (variantAttributes) => {
      const a = parseAttrs(variantAttributes);
      return a._imsKey ? String(a._imsKey) : null;
    };

    const existing = await db.query(
      'SELECT id, variant_attributes, sku FROM item_variants WHERE institution_id = ? AND parent_item_id = ?',
      [institutionId, parentItemId]
    );
    const byId = new Map(existing.map((r) => [r.id, r]));
    const byImsKey = new Map();
    for (const r of existing) {
      const k = imsKeyFromStored(r.variant_attributes);
      if (k) byImsKey.set(k, r.id);
    }

    if (rows.length === 0) {
      if (existing.length) {
        await db.query(
          'DELETE FROM item_variants WHERE institution_id = ? AND parent_item_id = ?',
          [institutionId, parentItemId]
        );
      }
      return 0;
    }

    const resolveVariantSku = async (seedSku, excludeVariantId) => {
      let suffix = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const candidate = suffix === 0 ? seedSku : `${seedSku}-${suffix}`;
        const dupItem = await db.query(
          'SELECT id FROM items WHERE institution_id = ? AND sku = ? LIMIT 1',
          [institutionId, candidate]
        );
        if (dupItem.length > 0) {
          suffix += 1;
          continue;
        }
        const existsV = await db.query(
          'SELECT id, parent_item_id FROM item_variants WHERE institution_id = ? AND sku = ? LIMIT 1',
          [institutionId, candidate]
        );
        if (existsV.length === 0) return candidate;
        if (excludeVariantId && existsV[0].id === excludeVariantId) return candidate;
        suffix += 1;
      }
    };

    const keptIds = new Set();

    for (let idx = 0; idx < rows.length; idx += 1) {
      const row = rows[idx];
      const attrsWithKey = { ...(row.attributes || {}), _imsKey: row.key };

      let baseSku = row.sku;
      if (!baseSku) {
        baseSku = `${parentSku || 'VAR'}-${String(idx + 1).padStart(3, '0')}`;
      }

      let variantId = null;
      if (row.id && byId.has(row.id)) {
        // Guard against accidental overwrite: if key changed, treat as a new variant row.
        const storedKey = imsKeyFromStored(byId.get(row.id)?.variant_attributes);
        if (!storedKey || storedKey === row.key) {
          variantId = row.id;
        }
      }
      if (!variantId && byImsKey.has(row.key)) {
        variantId = byImsKey.get(row.key);
      }

      const candidateSku = await resolveVariantSku(baseSku, variantId);
      const variantAttribsJson = JSON.stringify(attrsWithKey);

      if (variantId && byId.has(variantId)) {
        await db.query(
          `UPDATE item_variants
           SET variant_name = ?, sku = ?, barcode = ?, cost_price = ?, selling_price = ?,
               color = ?, size = ?, variant_attributes = ?, status = ?, updated_at = NOW()
           WHERE id = ? AND institution_id = ? AND parent_item_id = ?`,
          [
            row.combinationLabel,
            candidateSku,
            row.barcode,
            row.costPrice,
            row.sellingPrice,
            toAttrValue(row.attributes, ['color', 'colour']),
            toAttrValue(row.attributes, ['size']),
            variantAttribsJson,
            row.active ? 'active' : 'inactive',
            variantId,
            institutionId,
            parentItemId
          ]
        );
        keptIds.add(variantId);
      } else {
        const newId = uuidv4();
        await db.query(
          `INSERT INTO item_variants
           (id, institution_id, parent_item_id, variant_name, sku, barcode, cost_price, selling_price, color, size, variant_attributes, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newId,
            institutionId,
            parentItemId,
            row.combinationLabel,
            candidateSku,
            row.barcode,
            row.costPrice,
            row.sellingPrice,
            toAttrValue(row.attributes, ['color', 'colour']),
            toAttrValue(row.attributes, ['size']),
            variantAttribsJson,
            row.active ? 'active' : 'inactive'
          ]
        );
        keptIds.add(newId);
        byImsKey.set(row.key, newId);
        byId.set(newId, { id: newId });
      }
    }

    const toDelete = existing.filter((r) => !keptIds.has(r.id)).map((r) => r.id);
    if (toDelete.length) {
      const ph = toDelete.map(() => '?').join(',');
      await db.query(
        `DELETE FROM item_variants WHERE institution_id = ? AND parent_item_id = ? AND id IN (${ph})`,
        [institutionId, parentItemId, ...toDelete]
      );
    }

    return rows.length;
  }

  async createItem(institutionId, itemData, userId) {
    const {
      sku,
      name,
      description,
      image,
      type = 'simple',
      category,
      unit = 'pcs',
      barcode,
      batchNumber,
      hsnCode,
      customFields = {},
      valuationMethod = 'fifo',
      allowNegativeStock = false,
      costPrice = 0,
      sellingPrice = 0,
      mrp = 0,
      taxRate = 0,
      taxType = 'exclusive',
      weight = 0,
      weightUnit = 'kg',
      dimensions,
      brand,
      manufacturer,
      supplierCode,
      minStockLevel = 0,
      maxStockLevel = 0,
      isSerialized = false,
      isBatchTracked = false,
      hasExpiry = false,
      shelfLifeDays,
      storageConditions,
      itemGroup,
      itemGroupId,
      purchaseAccount,
      salesAccount,
      openingStock = 0,
      openingValue = 0,
      asOfDate,
      warehouseId,
      defaultBinId = null,
      kitFulfillmentMode = 'prebuilt'
    } = itemData;

    // Validate custom fields based on item type
    const validationErrors = await itemFieldService.validateCustomFields(institutionId, type, customFields);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    // Provide clear business error instead of raw DB duplicate key message.
    const normalizedSku = String(sku || '').trim();
    const normalizedBatchNumber = String(batchNumber || '').trim().toUpperCase() || null;
    if (!normalizedSku) {
      throw new Error('SKU is required');
    }

    const duplicateSkuRows = await db.query(
      `SELECT id, name
       FROM items
       WHERE institution_id = ? AND sku = ?
       LIMIT 1`,
      [institutionId, normalizedSku]
    );
    if (duplicateSkuRows.length > 0) {
      throw new Error(`Item with SKU "${normalizedSku}" already exists`);
    }

    const resolvedItemGroup = await this._resolveItemGroup(institutionId, { itemGroupId, itemGroup });
    const itemId = uuidv4();

    const normalizedKitMode = String(type).toLowerCase() === 'composite'
      ? (String(kitFulfillmentMode || 'prebuilt').toLowerCase() === 'explode_on_ship' ? 'explode_on_ship' : 'prebuilt')
      : 'prebuilt';

    await db.query(
      `INSERT INTO items 
       (id, institution_id, created_by, sku, name, description, image, type, kit_fulfillment_mode, category, unit, barcode, batch_number, hsn_code, 
        custom_fields, default_bin_id, valuation_method, allow_negative_stock, cost_price, selling_price, mrp, 
        tax_rate, tax_type, weight, weight_unit, dimensions, brand, manufacturer, supplier_code,
        min_stock_level, max_stock_level, is_serialized, is_batch_tracked, has_expiry, 
        shelf_life_days, storage_conditions, item_group, item_group_id, purchase_account, sales_account,
        opening_stock, opening_value, as_of_date, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [itemId, institutionId, userId, normalizedSku, name, description || null, image || null, type, normalizedKitMode, category || null, unit, barcode || null, normalizedBatchNumber, hsnCode || null,
       JSON.stringify(customFields), defaultBinId || null, valuationMethod, allowNegativeStock, costPrice, sellingPrice, mrp,
       taxRate, taxType, weight, weightUnit, dimensions || null, brand || null, manufacturer || null, supplierCode || null,
       minStockLevel, maxStockLevel, isSerialized, isBatchTracked, hasExpiry,
       shelfLifeDays || null, storageConditions || null, resolvedItemGroup?.itemGroupName || null, resolvedItemGroup?.itemGroupId || null, purchaseAccount || null, salesAccount || null,
       openingStock, openingValue, asOfDate || null]
    );

    if (type === 'variant') {
      await this._syncItemVariants(institutionId, itemId, normalizedSku, customFields || {});
    }
    if (type === 'composite') {
      await this._replaceCompositeComponents(institutionId, itemId, itemData.components || []);
    }

    const inventoryService = require('../inventory/inventory.service');

    if (type === 'variant' && warehouseId) {
      const variantRows = this._normalizeVariantRows(customFields?.variantMatrix);
      const dbVariants = await db.query(
        'SELECT id, variant_attributes FROM item_variants WHERE institution_id = ? AND parent_item_id = ?',
        [institutionId, itemId]
      );
      const keyToId = new Map();
      for (const v of dbVariants) {
        let a = {};
        if (v.variant_attributes && typeof v.variant_attributes === 'object') a = v.variant_attributes;
        else if (typeof v.variant_attributes === 'string') {
          try { a = JSON.parse(v.variant_attributes || '{}'); } catch { a = {}; }
        }
        if (a._imsKey) keyToId.set(String(a._imsKey), v.id);
      }
      const normalizedCostPrice = Number(costPrice) || 0;
      for (const vr of variantRows) {
        const qty = Number(vr.openingStock) || 0;
        if (qty <= 0) continue;
        const vid = keyToId.get(vr.key);
        if (!vid) continue;
        const wh = vr.warehouseId || warehouseId;
        const rowCost = Number(vr.costPrice) || 0;
        const openingUnitCost = rowCost > 0 ? rowCost : normalizedCostPrice;
        await inventoryService.receiveStock(
          institutionId,
          {
            itemId,
            warehouseId: wh,
            quantity: qty,
            unitCost: openingUnitCost,
            poId: `OPENING-${itemId}`,
            poLineId: `${itemId}-OPENING-${vid}`,
            grnNumber: `OPENING-${Date.now()}`,
            itemVariantId: vid
          },
          userId
        );
      }
    } else if (warehouseId && openingStock > 0) {
      const normalizedOpeningStock = Number(openingStock) || 0;
      const normalizedCostPrice = Number(costPrice) || 0;
      const normalizedOpeningValue = Number(openingValue) || 0;
      const openingUnitCost = normalizedOpeningStock > 0 && normalizedOpeningValue > 0
        ? (normalizedOpeningValue / normalizedOpeningStock)
        : normalizedCostPrice;

      await inventoryService.receiveStock(
        institutionId,
        {
          itemId,
          warehouseId,
          quantity: normalizedOpeningStock,
          unitCost: openingUnitCost,
          poId: `OPENING-${itemId}`,
          poLineId: `${itemId}-OPENING`,
          grnNumber: `OPENING-${Date.now()}`
        },
        userId
      );
    } else if (openingStock > 0 && !warehouseId) {
      logger.warn('Opening stock provided without warehouse', { itemId, openingStock, institutionId });
    }

    logger.info('Item created', { itemId, institutionId, sku: normalizedSku, userId });
    return itemId;
  }

  async updateItem(institutionId, itemId, updateData, userId) {
    const {
      sku,
      name,
      description,
      image,
      category,
      unit,
      barcode,
      batchNumber,
      hsnCode,
      customFields,
      valuationMethod,
      allowNegativeStock,
      status,
      costPrice,
      sellingPrice,
      mrp,
      taxRate,
      brand,
      manufacturer,
      itemGroup,
      itemGroupId,
      minStockLevel,
      maxStockLevel,
      warehouseId,
      type,
      weight,
      dimensions,
      upc,
      ean,
      isbn,
      mpn,
      openingStock,
      openingValue,
      defaultBinId,
      kitFulfillmentMode
    } = updateData;

    const updateFields = [];
    const updateValues = [];

    // Fetch current prices before update for price history tracking
    const [oldItem] = await db.query(
      'SELECT cost_price, selling_price, mrp, type FROM items WHERE institution_id = ? AND id = ?',
      [institutionId, itemId]
    );

    if (sku !== undefined) {
      updateFields.push('sku = ?');
      updateValues.push(sku);
    }
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (image !== undefined) {
      updateFields.push('image = ?');
      updateValues.push(image);
    }
    if (category !== undefined) {
      updateFields.push('category = ?');
      updateValues.push(category);
    }
    if (unit !== undefined) {
      updateFields.push('unit = ?');
      updateValues.push(unit);
    }
    if (barcode !== undefined) {
      updateFields.push('barcode = ?');
      updateValues.push(barcode);
    }
    if (batchNumber !== undefined) {
      updateFields.push('batch_number = ?');
      updateValues.push(String(batchNumber || '').trim().toUpperCase() || null);
    }
    if (hsnCode !== undefined) {
      updateFields.push('hsn_code = ?');
      updateValues.push(hsnCode);
    }
    if (customFields !== undefined) {
      updateFields.push('custom_fields = ?');
      updateValues.push(JSON.stringify(customFields));
    }
    if (valuationMethod !== undefined) {
      updateFields.push('valuation_method = ?');
      updateValues.push(valuationMethod);
    }
    if (allowNegativeStock !== undefined) {
      updateFields.push('allow_negative_stock = ?');
      updateValues.push(allowNegativeStock);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (costPrice !== undefined) {
      updateFields.push('cost_price = ?');
      updateValues.push(costPrice);
    }
    if (sellingPrice !== undefined) {
      updateFields.push('selling_price = ?');
      updateValues.push(sellingPrice);
    }
    if (mrp !== undefined) {
      updateFields.push('mrp = ?');
      updateValues.push(mrp);
    }
    if (taxRate !== undefined) {
      updateFields.push('tax_rate = ?');
      updateValues.push(taxRate);
    }
    if (brand !== undefined) {
      updateFields.push('brand = ?');
      updateValues.push(brand);
    }
    if (manufacturer !== undefined) {
      updateFields.push('manufacturer = ?');
      updateValues.push(manufacturer);
    }
    if (itemGroup !== undefined || itemGroupId !== undefined) {
      const resolvedItemGroup = await this._resolveItemGroup(institutionId, { itemGroupId, itemGroup });
      updateFields.push('item_group = ?');
      updateValues.push(resolvedItemGroup?.itemGroupName || null);
      updateFields.push('item_group_id = ?');
      updateValues.push(resolvedItemGroup?.itemGroupId || null);
    }
    if (minStockLevel !== undefined) {
      updateFields.push('min_stock_level = ?');
      updateValues.push(minStockLevel);
    }
    if (maxStockLevel !== undefined) {
      updateFields.push('max_stock_level = ?');
      updateValues.push(maxStockLevel);
    }
    if (type !== undefined) {
      updateFields.push('type = ?');
      updateValues.push(type);
    }
    if (weight !== undefined) {
      updateFields.push('weight = ?');
      updateValues.push(weight);
    }
    if (dimensions !== undefined) {
      updateFields.push('dimensions = ?');
      updateValues.push(typeof dimensions === 'object' ? JSON.stringify(dimensions) : dimensions);
    }
    if (upc !== undefined) {
      updateFields.push('upc = ?');
      updateValues.push(upc);
    }
    if (ean !== undefined) {
      updateFields.push('ean = ?');
      updateValues.push(ean);
    }
    if (isbn !== undefined) {
      updateFields.push('isbn = ?');
      updateValues.push(isbn);
    }
    if (mpn !== undefined) {
      updateFields.push('mpn = ?');
      updateValues.push(mpn);
    }
    if (openingStock !== undefined) {
      updateFields.push('opening_stock = ?');
      updateValues.push(openingStock);
    }
    if (openingValue !== undefined) {
      updateFields.push('opening_value = ?');
      updateValues.push(openingValue);
    }
    if (defaultBinId !== undefined) {
      updateFields.push('default_bin_id = ?');
      updateValues.push(defaultBinId || null);
    }
    if (kitFulfillmentMode !== undefined) {
      const nextTypeForMode = type !== undefined ? type : oldItem?.type;
      if (String(nextTypeForMode || '').toLowerCase() !== 'composite') {
        throw new Error('Kit fulfillment mode applies only to composite items');
      }
      const normalizedKitMode =
        String(kitFulfillmentMode || 'prebuilt').toLowerCase() === 'explode_on_ship'
          ? 'explode_on_ship'
          : 'prebuilt';
      updateFields.push('kit_fulfillment_mode = ?');
      updateValues.push(normalizedKitMode);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push('updated_at = NOW()');
    
    const result = await db.query(
      `UPDATE items SET ${updateFields.join(', ')} WHERE institution_id = ? AND id = ?`,
      [...updateValues, institutionId, itemId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Item not found');
    }

    // Record price history if any price field changed
    if (costPrice !== undefined || sellingPrice !== undefined || mrp !== undefined) {
      await itemPriceHistoryService.recordPriceChange(
        institutionId, itemId, userId,
        { cost_price: oldItem.cost_price, selling_price: oldItem.selling_price, mrp: oldItem.mrp },
        { cost_price: costPrice, selling_price: sellingPrice, mrp }
      );
    }

    // Update inventory projections if cost price changed
    if (costPrice !== undefined) {
      await db.query(
        `UPDATE inventory_projections 
         SET average_cost = ?, total_value = quantity_on_hand * ?, updated_at = NOW()
         WHERE institution_id = ? AND item_id = ?`,
        [costPrice, costPrice, institutionId, itemId]
      );
    }

    const effectiveItemType = type !== undefined ? type : oldItem?.type;

    // Update opening stock through inventory event flow so transaction history is generated.
    if ((openingStock !== undefined || warehouseId !== undefined) && effectiveItemType !== 'variant') {
      // Determine the warehouse to use
      let targetWarehouseId = warehouseId;
      
      // If warehouse not provided, try to get existing warehouse from inventory_projections
      if (!targetWarehouseId) {
        const existingProjections = await db.query(
          'SELECT warehouse_id FROM inventory_projections WHERE institution_id = ? AND item_id = ? LIMIT 1',
          [institutionId, itemId]
        );
        if (existingProjections.length > 0) {
          targetWarehouseId = existingProjections[0].warehouse_id;
        }
      }
      
      // Only proceed if we have a warehouse and explicit opening stock update.
      if (targetWarehouseId && openingStock !== undefined) {
        const inventoryService = require('../inventory/inventory.service');
        const targetOpeningStock = Number(openingStock) || 0;
        const existingProjection = await db.query(
          'SELECT quantity_on_hand FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ? LIMIT 1',
          [institutionId, itemId, targetWarehouseId]
        );
        const currentOnHand = existingProjection.length > 0 ? Number(existingProjection[0].quantity_on_hand || 0) : 0;
        const delta = targetOpeningStock - currentOnHand;

        if (delta !== 0) {
          // Route both directions through adjustments so Transaction History always has explicit entries.
          await inventoryService.adjustStock(
            institutionId,
            {
              itemId,
              warehouseId: targetWarehouseId,
              quantityChange: Math.abs(delta),
              adjustmentType: delta > 0 ? 'increase' : 'decrease',
              reason: 'Opening stock updated from item master',
              lossType: 'MANUAL'
            },
            userId
          );
        }
      }
    }

    if (type === 'variant' || (customFields && Object.prototype.hasOwnProperty.call(customFields, 'variantMatrix'))) {
      const parentRow = await db.query(
        'SELECT sku, type FROM items WHERE institution_id = ? AND id = ? LIMIT 1',
        [institutionId, itemId]
      );
      const parentSku = parentRow?.[0]?.sku || sku || '';
      const itemType = parentRow?.[0]?.type || type;
      if (itemType === 'variant') {
        await this._syncItemVariants(institutionId, itemId, parentSku, customFields || {});
      } else {
        await db.query(
          'DELETE FROM item_variants WHERE institution_id = ? AND parent_item_id = ?',
          [institutionId, itemId]
        );
      }
    }
    const currentType = String(oldItem?.type || '').toLowerCase();
    const nextType = type !== undefined
      ? type
      : (await db.query('SELECT type FROM items WHERE institution_id = ? AND id = ? LIMIT 1', [institutionId, itemId]))?.[0]?.type;
    const nextTypeNormalized = String(nextType || '').toLowerCase();
    if (updateData.components !== undefined && nextTypeNormalized !== 'composite') {
      throw new Error('Components can only be updated for composite items');
    }
    if (nextTypeNormalized === 'composite' || updateData.components !== undefined) {
      await this._replaceCompositeComponents(institutionId, itemId, updateData.components || []);
    } else if (currentType === 'composite' && nextTypeNormalized !== 'composite') {
      await db.query(
        'DELETE FROM composite_components WHERE institution_id = ? AND composite_item_id = ?',
        [institutionId, itemId]
      );
    }

    logger.info('Item updated', { itemId, institutionId, userId });
    return itemId;
  }

  async getItem(institutionId, itemId) {
    const items = await db.query(
      `SELECT i.*, 
       COALESCE(SUM(ip.quantity_on_hand), 0) as current_stock,
       b.name as brand_name,
       m.name as manufacturer_name,
       u.name as unit_name,
       ig.id as item_group_ref_id,
       COALESCE(ig.name, i.item_group) as item_group_name,
       GROUP_CONCAT(DISTINCT ip.warehouse_id) as warehouse_ids
       FROM items i
       LEFT JOIN inventory_projections ip ON i.id = ip.item_id AND ip.institution_id = i.institution_id
       LEFT JOIN brands b ON i.brand = b.id
       LEFT JOIN manufacturers m ON i.manufacturer = m.id
       LEFT JOIN units u ON i.unit = u.id
       LEFT JOIN item_groups ig ON ig.id = i.item_group_id AND ig.institution_id = i.institution_id
       WHERE i.institution_id = ? AND i.id = ?
       GROUP BY i.id`,
      [institutionId, itemId]
    );

    if (items.length === 0) {
      return null;
    }

    const item = items[0];

    const safeParse = (val) => {
      if (!val) return null;
      if (typeof val === 'object') return val;
      try { return JSON.parse(val); } catch { return null; }
    };

    const safeParseObj = (val) => {
      if (!val) return {};
      if (typeof val === 'object') return val;
      try { return JSON.parse(val); } catch { return {}; }
    };

    const variants = await db.query(
      `SELECT id, parent_item_id, variant_name, sku, barcode, cost_price, selling_price, color, size, variant_attributes, status
       FROM item_variants
       WHERE institution_id = ? AND parent_item_id = ?
       ORDER BY variant_name ASC`,
      [institutionId, itemId]
    );

    const variant_rows = variants.map((row) => {
      let attrs = {};
      if (row.variant_attributes && typeof row.variant_attributes === 'object') attrs = row.variant_attributes;
      else if (typeof row.variant_attributes === 'string') {
        try { attrs = JSON.parse(row.variant_attributes || '{}'); } catch { attrs = {}; }
      }
      return {
        id: row.id,
        key: row.id,
        combinationLabel: row.variant_name,
        sku: row.sku,
        barcode: row.barcode,
        costPrice: Number(row.cost_price || 0),
        sellingPrice: Number(row.selling_price || 0),
        attributes: attrs,
        active: row.status === 'active'
      };
    });

    const response = {
      ...item,
      brand: item.brand_name || item.brand,
      manufacturer: item.manufacturer_name || item.manufacturer,
      unit: item.unit_name || item.unit,
      item_group_id: item.item_group_ref_id || item.item_group_id || null,
      item_group_name: item.item_group_name || item.item_group || null,
      item_group: item.item_group_name || item.item_group || null,
      custom_fields: safeParseObj(item.custom_fields),
      dimensions: safeParse(item.dimensions),
      warehouse_ids: item.warehouse_ids ? item.warehouse_ids.split(',') : [],
      variant_rows
    };
    if (String(item.type || '').toLowerCase() === 'composite') {
      response.composite_components = await this.getCompositeComponents(institutionId, itemId);
      response.kit_fulfillment_mode = item.kit_fulfillment_mode || 'prebuilt';
      response.kitFulfillmentMode = item.kit_fulfillment_mode || 'prebuilt';
    }
    return response;
  }

  async getItemBySku(institutionId, sku) {
    const items = await db.query(
      'SELECT * FROM items WHERE institution_id = ? AND sku = ?',
      [institutionId, sku]
    );

    if (items.length === 0) {
      return null;
    }

    const item = items[0];
    return {
      ...item,
      custom_fields: JSON.parse(item.custom_fields || '{}')
    };
  }

  async checkSkuAvailability(institutionId, sku, excludeItemId = null) {
    const normalizedSku = String(sku || '').trim();
    if (!normalizedSku) {
      return { available: false, reason: 'SKU is required' };
    }

    const rows = await db.query(
      `SELECT id
       FROM items
       WHERE institution_id = ? AND sku = ?
         AND (? IS NULL OR id <> ?)
       LIMIT 1`,
      [institutionId, normalizedSku, excludeItemId, excludeItemId]
    );

    return {
      available: rows.length === 0
    };
  }

  async listVariantLibrary(institutionId) {
    const rows = await db.query(
      `SELECT id, name, values_json, usage_count, last_used_at
       FROM variant_attribute_library
       WHERE institution_id = ? AND status = 'active'
       ORDER BY name ASC`,
      [institutionId]
    );

    return rows.map((row) => {
      let values = [];
      if (Array.isArray(row.values_json)) {
        values = row.values_json;
      } else if (typeof row.values_json === 'string') {
        try { values = JSON.parse(row.values_json || '[]'); } catch { values = []; }
      }
      return {
        id: row.id,
        name: row.name,
        values: Array.isArray(values) ? values : [],
        usageCount: Number(row.usage_count || 0),
        lastUsedAt: row.last_used_at || null
      };
    });
  }

  async saveVariantLibrary(institutionId, rows = [], userId) {
    if (!Array.isArray(rows)) return 0;

    const normalizeText = (value) => String(value || '').trim();
    const normalizeValues = (values) => {
      if (!Array.isArray(values)) return [];
      const deduped = new Set(
        values
          .map((v) => normalizeText(v))
          .filter(Boolean)
      );
      return Array.from(deduped);
    };

    let affected = 0;
    for (const row of rows) {
      const name = normalizeText(row?.name);
      const values = normalizeValues(row?.values);
      if (!name || values.length === 0) continue;

      const existing = await db.query(
        `SELECT id, values_json
         FROM variant_attribute_library
         WHERE institution_id = ? AND name = ?
         LIMIT 1`,
        [institutionId, name]
      );

      if (existing.length === 0) {
        await db.query(
          `INSERT INTO variant_attribute_library
           (id, institution_id, name, values_json, usage_count, last_used_at, status, created_by)
           VALUES (?, ?, ?, ?, 1, NOW(), 'active', ?)`,
          [uuidv4(), institutionId, name, JSON.stringify(values), userId || null]
        );
      } else {
        let currentValues = [];
        const raw = existing[0].values_json;
        if (Array.isArray(raw)) currentValues = raw;
        else if (typeof raw === 'string') {
          try { currentValues = JSON.parse(raw || '[]'); } catch { currentValues = []; }
        }

        const mergedValues = Array.from(new Set([
          ...currentValues.map((v) => normalizeText(v)).filter(Boolean),
          ...values
        ]));

        await db.query(
          `UPDATE variant_attribute_library
              SET values_json = ?,
                  usage_count = usage_count + 1,
                  last_used_at = NOW(),
                  status = 'active',
                  updated_at = NOW()
            WHERE institution_id = ? AND name = ?`,
          [JSON.stringify(mergedValues), institutionId, name]
        );
      }
      affected += 1;
    }

    return affected;
  }

  async setVariantLibraryEntry(institutionId, name, values = [], userId = null) {
    const normalizedName = String(name || '').trim();
    const normalizedValues = Array.from(new Set(
      (Array.isArray(values) ? values : [])
        .map((v) => String(v || '').trim())
        .filter(Boolean)
    ));
    if (!normalizedName) throw new Error('Attribute name is required');

    const existing = await db.query(
      `SELECT id, values_json
       FROM variant_attribute_library
       WHERE institution_id = ? AND name = ?
       LIMIT 1`,
      [institutionId, normalizedName]
    );

    if (existing.length === 0) {
      await db.query(
        `INSERT INTO variant_attribute_library
         (id, institution_id, name, values_json, usage_count, last_used_at, status, created_by)
         VALUES (?, ?, ?, ?, 1, NOW(), 'active', ?)`,
        [uuidv4(), institutionId, normalizedName, JSON.stringify(normalizedValues), userId]
      );
      return true;
    }

    let currentValues = [];
    const raw = existing[0].values_json;
    if (Array.isArray(raw)) currentValues = raw;
    else if (typeof raw === 'string') {
      try { currentValues = JSON.parse(raw || '[]'); } catch { currentValues = []; }
    }

    const mergedValues = Array.from(new Set([
      ...currentValues.map((v) => String(v || '').trim()).filter(Boolean),
      ...normalizedValues
    ]));
    const usageIncrement = normalizedValues.length > 0 ? 1 : 0;

    await db.query(
      `UPDATE variant_attribute_library
          SET values_json = ?,
              usage_count = usage_count + ?,
              last_used_at = NOW(),
              status = 'active',
              updated_at = NOW()
        WHERE institution_id = ? AND name = ?`,
      [JSON.stringify(mergedValues), usageIncrement, institutionId, normalizedName]
    );
    return true;
  }

  async deleteVariantLibraryEntryValue(institutionId, name, value) {
    const normalizedName = String(name || '').trim();
    const normalizedValue = String(value || '').trim();
    if (!normalizedName || !normalizedValue) {
      throw new Error('Name and value are required');
    }

    const rows = await db.query(
      `SELECT values_json
       FROM variant_attribute_library
       WHERE institution_id = ? AND name = ? AND status = 'active'
       LIMIT 1`,
      [institutionId, normalizedName]
    );
    if (rows.length === 0) return false;

    let currentValues = [];
    const raw = rows[0].values_json;
    if (Array.isArray(raw)) currentValues = raw;
    else if (typeof raw === 'string') {
      try { currentValues = JSON.parse(raw || '[]'); } catch { currentValues = []; }
    }

    const filtered = currentValues
      .map((v) => String(v || '').trim())
      .filter((v) => v && v !== normalizedValue);

    if (filtered.length === 0) {
      await db.query(
        `UPDATE variant_attribute_library
            SET values_json = '[]',
                status = 'inactive',
                updated_at = NOW()
          WHERE institution_id = ? AND name = ?`,
        [institutionId, normalizedName]
      );
      return true;
    }

    await db.query(
      `UPDATE variant_attribute_library
          SET values_json = ?,
              updated_at = NOW()
        WHERE institution_id = ? AND name = ?`,
      [JSON.stringify(Array.from(new Set(filtered))), institutionId, normalizedName]
    );
    return true;
  }

  async getItems(institutionId, filters = {}) {
    let query = `SELECT i.*, 
                 COALESCE(SUM(ip.quantity_on_hand), 0) as current_stock,
                 b.name as brand_name,
                 m.name as manufacturer_name,
                 u.name as unit_name,
                 ig.id as item_group_ref_id,
                 COALESCE(ig.name, i.item_group) as item_group_name
                 FROM items i
                 LEFT JOIN inventory_projections ip ON i.id = ip.item_id AND ip.institution_id = i.institution_id
                 LEFT JOIN brands b ON i.brand = b.id
                 LEFT JOIN manufacturers m ON i.manufacturer = m.id
                 LEFT JOIN units u ON i.unit = u.id
                 LEFT JOIN item_groups ig ON ig.id = i.item_group_id AND ig.institution_id = i.institution_id
                 WHERE i.institution_id = ?`;
    const params = [institutionId];

    if (filters.status === 'all') {
      query += " AND i.status != 'draft'";
    } else {
      query += ' AND i.status = ?';
      params.push(filters.status || 'active');
    }

    if (filters.type) {
      query += ' AND i.type = ?';
      params.push(filters.type);
    }

    if (filters.category) {
      query += ' AND i.category = ?';
      params.push(filters.category);
    }

    if (filters.itemGroupId) {
      query += ' AND i.item_group_id = ?';
      params.push(filters.itemGroupId);
    }

    if (filters.search) {
      query += ' AND (i.name LIKE ? OR i.sku LIKE ? OR COALESCE(i.category, \'\') LIKE ? OR COALESCE(i.batch_number, \'\') LIKE ? OR COALESCE(ig.name, i.item_group, \'\') LIKE ?)';
      const searchTerm = `%${String(filters.search).trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ' GROUP BY i.id ORDER BY i.name';

    const items = await db.query(query, params);

    const safeParseObj = (val) => {
      if (!val) return {};
      if (typeof val === 'object') return val;
      try { return JSON.parse(val); } catch { return {}; }
    };

    const mapped = items.map(item => ({
      ...item,
      brand: item.brand_name || item.brand,
      manufacturer: item.manufacturer_name || item.manufacturer,
      unit: item.unit_name || item.unit,
      item_group_id: item.item_group_ref_id || item.item_group_id || null,
      item_group_name: item.item_group_name || item.item_group || null,
      item_group: item.item_group_name || item.item_group || null,
      custom_fields: safeParseObj(item.custom_fields),
    }));

    if (filters.includeVariants) {
      const parentIds = mapped.filter((i) => i.type === 'variant').map((i) => i.id);
      if (parentIds.length > 0) {
        const ph = parentIds.map(() => '?').join(',');
        const variants = await db.query(
          `SELECT id, parent_item_id, variant_name, sku, selling_price, status
           FROM item_variants
           WHERE institution_id = ? AND parent_item_id IN (${ph}) AND status = 'active'
           ORDER BY parent_item_id ASC, variant_name ASC`,
          [institutionId, ...parentIds]
        );
        const byParent = new Map();
        for (const v of variants) {
          if (!byParent.has(v.parent_item_id)) byParent.set(v.parent_item_id, []);
          byParent.get(v.parent_item_id).push({
            id: v.id,
            combinationLabel: v.variant_name,
            sku: v.sku,
            sellingPrice: Number(v.selling_price || 0)
          });
        }
        return mapped.map((item) => ({
          ...item,
          variant_options: item.type === 'variant' ? (byParent.get(item.id) || []) : []
        }));
      }
    }

    return mapped;
  }

  async getItemFieldConfig(institutionId, itemType) {
    return await itemFieldService.getFieldConfig(institutionId, itemType);
  }

  async createItemFieldConfig(institutionId, fieldData, userId) {
    return await itemFieldService.createFieldConfig(institutionId, fieldData, userId);
  }

  async getItemTypeFields(itemType) {
    const defaultConfigs = itemFieldService.getDefaultFieldConfigs();
    return defaultConfigs[itemType] || [];
  }

  async updateItemFieldOptions(institutionId, itemType, fieldName, options, userId) {
    const result = await db.query(
      'UPDATE item_field_configs SET options = ?, updated_at = NOW() WHERE institution_id = ? AND item_type = ? AND field_name = ?',
      [JSON.stringify(options), institutionId, itemType, fieldName]
    );

    if (result.affectedRows === 0) {
      throw new Error('Field configuration not found');
    }

    logger.info('Field options updated', { itemType, fieldName, institutionId, userId });
    return true;
  }

  async createCompositeItem(institutionId, compositeData, userId) {
    const { itemData, components } = compositeData;

    const itemId = await this.createItem(institutionId, {
      ...itemData,
      type: 'composite',
      components
    }, userId);

    logger.info('Composite item created', { itemId, institutionId, userId, componentCount: Array.isArray(components) ? components.length : 0 });
    return itemId;
  }

  async updateCompositeComponents(institutionId, compositeItemId, components, userId) {
    const updatedCount = await this._replaceCompositeComponents(institutionId, compositeItemId, components || []);
    logger.info('Composite components updated', { compositeItemId, institutionId, userId, updatedCount });
    return updatedCount;
  }

  async getCompositeComponents(institutionId, compositeItemId) {
    return await db.query(
      `SELECT cc.*, i.sku, i.name as component_name, i.unit
       FROM composite_components cc
       JOIN items i ON cc.component_item_id = i.id
       WHERE cc.institution_id = ? AND cc.composite_item_id = ?`,
      [institutionId, compositeItemId]
    );
  }

  async calculateCompositeStock(institutionId, compositeItemId, warehouseId) {
    const components = await this.getCompositeComponents(institutionId, compositeItemId);
    
    if (components.length === 0) {
      return 0;
    }

    const projectionService = require('../../projections/inventoryProjections');
    let minAvailableStock = Infinity;

    for (const component of components) {
      const componentStock = await projectionService.getInventoryProjection(
        institutionId,
        component.component_item_id,
        warehouseId
      );

      const availableQuantity = componentStock ? componentStock.quantity_available : 0;
      const possibleCompositeQuantity = Math.floor(availableQuantity / component.quantity_required);
      
      minAvailableStock = Math.min(minAvailableStock, possibleCompositeQuantity);
    }

    return minAvailableStock === Infinity ? 0 : minAvailableStock;
  }

  async deleteItem(institutionId, itemId, userId) {
    // Check if item has any inventory
    const inventory = await db.query(
      'SELECT COUNT(*) as count FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND quantity_on_hand > 0',
      [institutionId, itemId]
    );

    if (inventory[0].count > 0) {
      throw new Error('Cannot delete item with existing inventory');
    }

    // Soft delete
    const result = await db.query(
      'UPDATE items SET status = "inactive", updated_at = NOW() WHERE institution_id = ? AND id = ?',
      [institutionId, itemId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Item not found');
    }

    logger.info('Item deleted', { itemId, institutionId, userId });
    return true;
  }

  async saveDraft(institutionId, userId, draftData) {
    const serialized = typeof draftData === 'string' ? draftData : JSON.stringify(draftData);
    const draftId = uuidv4();
    const draftSku = `DRAFT-${draftId.slice(0, 8).toUpperCase()}`;
    await db.query(
      `INSERT INTO items (id, institution_id, created_by, draft_data, status, name, sku, type, unit, custom_fields)
       VALUES (?, ?, ?, ?, 'draft', ?, ?, 'simple', 'pcs', '{}')`,
      [draftId, institutionId, userId, serialized, 'Item Draft', draftSku]
    );
    return draftId;
  }

  async getDraft(institutionId, userId) {
    const drafts = await this.getDrafts(institutionId, userId);
    return drafts.length > 0 ? drafts[0] : null;
  }

  async getDrafts(institutionId, userId) {
    const rows = await db.query(
      `SELECT id, draft_data, updated_at
         FROM items
        WHERE institution_id = ? AND created_by = ? AND status = 'draft'
        ORDER BY updated_at DESC`,
      [institutionId, userId]
    );

    return rows.map((row) => {
      let parsed = row.draft_data;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { parsed = {}; }
      }
      // handle double-serialized case
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { parsed = {}; }
      }

      return {
        id: row.id,
        data: parsed,
        savedAt: row.updated_at
      };
    });
  }

  async deleteDraft(institutionId, userId, draftId = null) {
    if (draftId) {
      await db.query(
        `DELETE FROM items
         WHERE institution_id = ? AND created_by = ? AND status = 'draft' AND id = ?`,
        [institutionId, userId, draftId]
      );
      return;
    }

    await db.query(
      `DELETE FROM items
       WHERE institution_id = ? AND created_by = ? AND status = 'draft'`,
      [institutionId, userId]
    );
  }

  async getItemCategories(institutionId) {
    const categories = await db.query(
      'SELECT DISTINCT category FROM items WHERE institution_id = ? AND category IS NOT NULL ORDER BY category',
      [institutionId]
    );

    return categories.map(row => row.category);
  }
}

module.exports = new ItemService();