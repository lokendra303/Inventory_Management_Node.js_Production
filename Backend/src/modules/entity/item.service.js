const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');
const itemFieldService = require('./itemField.service');
const itemPriceHistoryService = require('./itemPriceHistory.service');

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

    const availableComponents = await db.query(
      `SELECT id
         FROM items
        WHERE institution_id = ?
          AND status = 'active'
          AND id IN (?)`,
      [institutionId, Array.from(uniqueComponentIds)]
    );
    if (availableComponents.length !== uniqueComponentIds.size) {
      throw new Error('One or more component items are invalid or inactive');
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

  async _syncItemVariants(institutionId, parentItemId, parentSku, customFields = {}) {
    const rows = this._normalizeVariantRows(customFields?.variantMatrix);

    await db.query(
      'DELETE FROM item_variants WHERE institution_id = ? AND parent_item_id = ?',
      [institutionId, parentItemId]
    );

    if (rows.length === 0) return 0;

    const toAttrValue = (attrs, keys = []) => {
      const entries = Object.entries(attrs || {});
      const found = entries.find(([k]) => keys.includes(String(k || '').toLowerCase()));
      return found ? String(found[1] || '').trim() || null : null;
    };

    for (let idx = 0; idx < rows.length; idx += 1) {
      const row = rows[idx];
      let sku = row.sku;
      if (!sku) {
        const seed = `${parentSku || 'VAR'}-${String(idx + 1).padStart(3, '0')}`;
        sku = seed;
      }

      // Ensure unique SKU inside item_variants per institution.
      let candidate = sku;
      let suffix = 1;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const exists = await db.query(
          'SELECT id FROM item_variants WHERE institution_id = ? AND sku = ? LIMIT 1',
          [institutionId, candidate]
        );
        if (exists.length === 0) break;
        suffix += 1;
        candidate = `${sku}-${suffix}`;
      }

      await db.query(
        `INSERT INTO item_variants
         (id, institution_id, parent_item_id, variant_name, sku, barcode, cost_price, selling_price, color, size, variant_attributes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          institutionId,
          parentItemId,
          row.combinationLabel,
          candidate,
          row.barcode,
          row.costPrice,
          row.sellingPrice,
          toAttrValue(row.attributes, ['color', 'colour']),
          toAttrValue(row.attributes, ['size']),
          JSON.stringify(row.attributes || {}),
          row.active ? 'active' : 'inactive'
        ]
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
      purchaseAccount,
      salesAccount,
      openingStock = 0,
      openingValue = 0,
      asOfDate,
      warehouseId,
      defaultBinId = null
    } = itemData;

    // Validate custom fields based on item type
    const validationErrors = await itemFieldService.validateCustomFields(institutionId, type, customFields);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    // Provide clear business error instead of raw DB duplicate key message.
    const normalizedSku = String(sku || '').trim();
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

    const itemId = uuidv4();

    await db.query(
      `INSERT INTO items 
       (id, institution_id, created_by, sku, name, description, image, type, category, unit, barcode, hsn_code, 
        custom_fields, default_bin_id, valuation_method, allow_negative_stock, cost_price, selling_price, mrp, 
        tax_rate, tax_type, weight, weight_unit, dimensions, brand, manufacturer, supplier_code,
        min_stock_level, max_stock_level, is_serialized, is_batch_tracked, has_expiry, 
        shelf_life_days, storage_conditions, item_group, purchase_account, sales_account,
        opening_stock, opening_value, as_of_date, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [itemId, institutionId, userId, normalizedSku, name, description || null, image || null, type, category || null, unit, barcode || null, hsnCode || null,
       JSON.stringify(customFields), defaultBinId || null, valuationMethod, allowNegativeStock, costPrice, sellingPrice, mrp,
       taxRate, taxType, weight, weightUnit, dimensions || null, brand || null, manufacturer || null, supplierCode || null,
       minStockLevel, maxStockLevel, isSerialized, isBatchTracked, hasExpiry,
       shelfLifeDays || null, storageConditions || null, itemGroup || null, purchaseAccount || null, salesAccount || null,
       openingStock, openingValue, asOfDate || null]
    );

    if (type === 'variant') {
      await this._syncItemVariants(institutionId, itemId, normalizedSku, customFields || {});
    }
    if (type === 'composite') {
      await this._replaceCompositeComponents(institutionId, itemId, itemData.components || []);
    }

    // Create initial inventory using inventory event flow so it appears in item transaction history.
    if (warehouseId && openingStock > 0) {
      const inventoryService = require('../inventory/inventory.service');
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
      defaultBinId
    } = updateData;

    const updateFields = [];
    const updateValues = [];

    // Fetch current prices before update for price history tracking
    const [oldItem] = await db.query(
      'SELECT cost_price, selling_price, mrp FROM items WHERE institution_id = ? AND id = ?',
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
    if (itemGroup !== undefined) {
      updateFields.push('item_group = ?');
      updateValues.push(itemGroup);
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

    // Update opening stock through inventory event flow so transaction history is generated.
    if (openingStock !== undefined || warehouseId !== undefined) {
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
    const nextType = type !== undefined
      ? type
      : (await db.query('SELECT type FROM items WHERE institution_id = ? AND id = ? LIMIT 1', [institutionId, itemId]))?.[0]?.type;
    if (nextType === 'composite' || updateData.components !== undefined) {
      await this._replaceCompositeComponents(institutionId, itemId, updateData.components || []);
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
       GROUP_CONCAT(DISTINCT ip.warehouse_id) as warehouse_ids
       FROM items i
       LEFT JOIN inventory_projections ip ON i.id = ip.item_id AND ip.institution_id = i.institution_id
       LEFT JOIN brands b ON i.brand = b.id
       LEFT JOIN manufacturers m ON i.manufacturer = m.id
       LEFT JOIN units u ON i.unit = u.id
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
      custom_fields: safeParseObj(item.custom_fields),
      dimensions: safeParse(item.dimensions),
      warehouse_ids: item.warehouse_ids ? item.warehouse_ids.split(',') : [],
      variant_rows
    };
    if (String(item.type || '').toLowerCase() === 'composite') {
      response.composite_components = await this.getCompositeComponents(institutionId, itemId);
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
    if (normalizedValues.length === 0) throw new Error('At least one value is required');

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

    await db.query(
      `UPDATE variant_attribute_library
          SET values_json = ?,
              usage_count = usage_count + 1,
              last_used_at = NOW(),
              status = 'active',
              updated_at = NOW()
        WHERE institution_id = ? AND name = ?`,
      [JSON.stringify(normalizedValues), institutionId, normalizedName]
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
                 u.name as unit_name
                 FROM items i
                 LEFT JOIN inventory_projections ip ON i.id = ip.item_id AND ip.institution_id = i.institution_id
                 LEFT JOIN brands b ON i.brand = b.id
                 LEFT JOIN manufacturers m ON i.manufacturer = m.id
                 LEFT JOIN units u ON i.unit = u.id
                 WHERE i.institution_id = ?`;
    const params = [institutionId];

    if (filters.status === 'all') {
      query += " AND i.status != 'draft'";
    } else {
      query += ' AND i.status = ?';
      params.push(filters.status || 'active');
    }

    query += ' GROUP BY i.id ORDER BY i.name';

    const items = await db.query(query, params);

    const safeParseObj = (val) => {
      if (!val) return {};
      if (typeof val === 'object') return val;
      try { return JSON.parse(val); } catch { return {}; }
    };

    return items.map(item => ({
      ...item,
      brand: item.brand_name || item.brand,
      manufacturer: item.manufacturer_name || item.manufacturer,
      unit: item.unit_name || item.unit,
      custom_fields: safeParseObj(item.custom_fields),
    }));
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