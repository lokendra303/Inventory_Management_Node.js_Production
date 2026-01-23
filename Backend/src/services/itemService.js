const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const logger = require('../utils/logger');

class ItemService {
  async createItem(tenantId, itemData, userId) {
    const {
      sku,
      name,
      description,
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
      asOfDate
    } = itemData;

    const itemId = uuidv4();

    await db.query(
      `INSERT INTO items 
       (id, tenant_id, sku, name, description, type, category, unit, barcode, hsn_code, 
        custom_fields, valuation_method, allow_negative_stock, cost_price, selling_price, mrp, 
        tax_rate, tax_type, weight, weight_unit, dimensions, brand, manufacturer, supplier_code,
        min_stock_level, max_stock_level, is_serialized, is_batch_tracked, has_expiry, 
        shelf_life_days, storage_conditions, item_group, purchase_account, sales_account,
        opening_stock, opening_value, as_of_date, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [itemId, tenantId, sku, name, description, type, category, unit, barcode, hsnCode,
       JSON.stringify(customFields), valuationMethod, allowNegativeStock, costPrice, sellingPrice, mrp,
       taxRate, taxType, weight, weightUnit, dimensions, brand, manufacturer, supplierCode,
       minStockLevel, maxStockLevel, isSerialized, isBatchTracked, hasExpiry,
       shelfLifeDays, storageConditions, itemGroup, purchaseAccount, salesAccount,
       openingStock, openingValue, asOfDate]
    );

    logger.info('Item created', { itemId, tenantId, sku, userId });
    return itemId;
  }

  async updateItem(tenantId, itemId, updateData, userId) {
    const {
      sku,
      name,
      description,
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
      minStockLevel,
      maxStockLevel
    } = updateData;

    const updateFields = [];
    const updateValues = [];

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
    if (minStockLevel !== undefined) {
      updateFields.push('min_stock_level = ?');
      updateValues.push(minStockLevel);
    }
    if (maxStockLevel !== undefined) {
      updateFields.push('max_stock_level = ?');
      updateValues.push(maxStockLevel);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(tenantId, itemId);

    console.log('Update query fields:', updateFields);
    console.log('Update query values:', updateValues);

    const result = await db.query(
      `UPDATE items SET ${updateFields.join(', ')} WHERE tenant_id = ? AND id = ?`,
      updateValues
    );

    console.log('Update result:', result);

    if (result.affectedRows === 0) {
      throw new Error('Item not found');
    }

    // Verify the update by fetching the updated item
    const updatedItem = await db.query(
      'SELECT id, name, cost_price, selling_price, mrp FROM items WHERE tenant_id = ? AND id = ?',
      [tenantId, itemId]
    );
    console.log('Updated item verification:', updatedItem[0]);

    logger.info('Item updated', { itemId, tenantId, userId });
    return itemId;
  }

  async getItem(tenantId, itemId) {
    const items = await db.query(
      'SELECT * FROM items WHERE tenant_id = ? AND id = ?',
      [tenantId, itemId]
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

  async getItemBySku(tenantId, sku) {
    const items = await db.query(
      'SELECT * FROM items WHERE tenant_id = ? AND sku = ?',
      [tenantId, sku]
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

  async getItems(tenantId, filters = {}) {
    let query = 'SELECT * FROM items WHERE tenant_id = ?';
    const params = [tenantId];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY name';

    const items = await db.query(query, params);

    return items.map(item => {
      try {
        return {
          ...item,
          custom_fields: item.custom_fields ? JSON.parse(item.custom_fields) : {}
        };
      } catch (e) {
        return {
          ...item,
          custom_fields: {}
        };
      }
    });
  }

  async createCompositeItem(tenantId, compositeData, userId) {
    const { itemData, components } = compositeData;

    if (!components || components.length === 0) {
      throw new Error('Composite item must have at least one component');
    }

    const itemId = await db.transaction(async (connection) => {
      // Create the composite item
      const compositeItemId = await this.createItem(tenantId, {
        ...itemData,
        type: 'composite'
      }, userId);

      // Add components
      for (const component of components) {
        const componentId = uuidv4();
        await connection.execute(
          `INSERT INTO composite_components 
           (id, tenant_id, composite_item_id, component_item_id, quantity_required, consumption_timing) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            componentId,
            tenantId,
            compositeItemId,
            component.itemId,
            component.quantityRequired,
            component.consumptionTiming || 'shipment'
          ]
        );
      }

      return compositeItemId;
    });

    logger.info('Composite item created', { itemId, tenantId, userId, componentCount: components.length });
    return itemId;
  }

  async getCompositeComponents(tenantId, compositeItemId) {
    return await db.query(
      `SELECT cc.*, i.sku, i.name as component_name, i.unit
       FROM composite_components cc
       JOIN items i ON cc.component_item_id = i.id
       WHERE cc.tenant_id = ? AND cc.composite_item_id = ?`,
      [tenantId, compositeItemId]
    );
  }

  async calculateCompositeStock(tenantId, compositeItemId, warehouseId) {
    const components = await this.getCompositeComponents(tenantId, compositeItemId);
    
    if (components.length === 0) {
      return 0;
    }

    const projectionService = require('../projections/inventoryProjections');
    let minAvailableStock = Infinity;

    for (const component of components) {
      const componentStock = await projectionService.getInventoryProjection(
        tenantId,
        component.component_item_id,
        warehouseId
      );

      const availableQuantity = componentStock ? componentStock.quantity_available : 0;
      const possibleCompositeQuantity = Math.floor(availableQuantity / component.quantity_required);
      
      minAvailableStock = Math.min(minAvailableStock, possibleCompositeQuantity);
    }

    return minAvailableStock === Infinity ? 0 : minAvailableStock;
  }

  async deleteItem(tenantId, itemId, userId) {
    // Check if item has any inventory
    const inventory = await db.query(
      'SELECT COUNT(*) as count FROM inventory_projections WHERE tenant_id = ? AND item_id = ? AND quantity_on_hand > 0',
      [tenantId, itemId]
    );

    if (inventory[0].count > 0) {
      throw new Error('Cannot delete item with existing inventory');
    }

    // Soft delete
    const result = await db.query(
      'UPDATE items SET status = "inactive", updated_at = NOW() WHERE tenant_id = ? AND id = ?',
      [tenantId, itemId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Item not found');
    }

    logger.info('Item deleted', { itemId, tenantId, userId });
    return true;
  }

  async getItemCategories(tenantId) {
    const categories = await db.query(
      'SELECT DISTINCT category FROM items WHERE tenant_id = ? AND category IS NOT NULL ORDER BY category',
      [tenantId]
    );

    return categories.map(row => row.category);
  }
}

module.exports = new ItemService();