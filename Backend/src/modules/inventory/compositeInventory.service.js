const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const projectionService = require('../../projections/inventoryProjections');
const inventoryService = require('./inventory.service');
const itemService = require('../entity/item.service');
const logger = require('../../utils/logger');

const FULFILLMENT_PREBUILT = 'prebuilt';
const FULFILLMENT_EXPLODE = 'explode_on_ship';

function componentSoLineId(soLineId, componentItemId) {
  return `${soLineId}:${componentItemId}`;
}

class CompositeInventoryService {
  normalizeFulfillmentMode(mode) {
    const m = String(mode || FULFILLMENT_PREBUILT).toLowerCase();
    return m === FULFILLMENT_EXPLODE ? FULFILLMENT_EXPLODE : FULFILLMENT_PREBUILT;
  }

  async getItemRow(institutionId, itemId) {
    const rows = await db.query(
      `SELECT id, type, kit_fulfillment_mode, name, sku
         FROM items
        WHERE institution_id = ? AND id = ?
        LIMIT 1`,
      [institutionId, itemId]
    );
    if (!rows.length) throw new Error('Item not found');
    return rows[0];
  }

  async isComposite(institutionId, itemId) {
    const row = await this.getItemRow(institutionId, itemId);
    return String(row.type || '').toLowerCase() === 'composite';
  }

  async getFulfillmentMode(institutionId, itemId) {
    const row = await this.getItemRow(institutionId, itemId);
    if (String(row.type || '').toLowerCase() !== 'composite') return null;
    return this.normalizeFulfillmentMode(row.kit_fulfillment_mode);
  }

  async getAvailability(institutionId, compositeItemId, warehouseId) {
    const row = await this.getItemRow(institutionId, compositeItemId);
    if (String(row.type || '').toLowerCase() !== 'composite') {
      throw new Error('Item is not a composite kit');
    }

    const components = await itemService.getCompositeComponents(institutionId, compositeItemId);
    const buildableFromComponents = await itemService.calculateCompositeStock(
      institutionId,
      compositeItemId,
      warehouseId
    );
    const kitProj = await projectionService.getInventoryProjection(
      institutionId,
      compositeItemId,
      warehouseId
    );
    const kitOnHand = kitProj ? Number(kitProj.quantity_on_hand) : 0;
    const kitAvailable = kitProj ? Number(kitProj.quantity_available) : 0;

    const componentDetails = [];
    for (const c of components) {
      const p = await projectionService.getInventoryProjection(
        institutionId,
        c.component_item_id,
        warehouseId
      );
      const avail = p ? Number(p.quantity_available) : 0;
      const req = Number(c.quantity_required);
      componentDetails.push({
        componentItemId: c.component_item_id,
        sku: c.sku,
        name: c.component_name,
        unit: c.unit,
        quantityRequiredPerKit: req,
        consumptionTiming: c.consumption_timing || 'shipment',
        available: avail,
        kitsSupportable: req > 0 ? Math.floor(avail / req) : 0
      });
    }

    return {
      compositeItemId,
      warehouseId,
      fulfillmentMode: this.normalizeFulfillmentMode(row.kit_fulfillment_mode),
      kitOnHand,
      kitAvailable,
      buildableFromComponents,
      componentDetails
    };
  }

  async assembleKit(institutionId, { compositeItemId, warehouseId, quantity, notes }, userId) {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('Quantity must be a positive number');
    }

    const row = await this.getItemRow(institutionId, compositeItemId);
    if (String(row.type || '').toLowerCase() !== 'composite') {
      throw new Error('Only composite kit items can be assembled');
    }

    const components = await itemService.getCompositeComponents(institutionId, compositeItemId);
    if (!components.length) {
      throw new Error('Composite item has no BOM components');
    }

    const buildable = await itemService.calculateCompositeStock(
      institutionId,
      compositeItemId,
      warehouseId
    );
    if (qty > buildable) {
      throw new Error(
        `Insufficient components to assemble ${qty} kit(s). Maximum buildable from parts: ${buildable}`
      );
    }

    const batchRef = `ASM-${Date.now()}`;
    const reason = notes ? `KIT_ASSEMBLY: ${notes}` : 'KIT_ASSEMBLY';
    let totalUnitCost = 0;
    const decreased = [];

    try {
      for (const c of components) {
        const lineQty = qty * Number(c.quantity_required);
        const proj = await projectionService.getInventoryProjection(
          institutionId,
          c.component_item_id,
          warehouseId
        );
        const avgCost = proj ? Number(proj.average_cost) : 0;
        totalUnitCost += lineQty * avgCost;

        await inventoryService.adjustStock(
          institutionId,
          {
            itemId: c.component_item_id,
            warehouseId,
            quantityChange: lineQty,
            adjustmentType: 'decrease',
            reason,
            lossType: 'MANUAL'
          },
          userId
        );
        decreased.push({ itemId: c.component_item_id, quantity: lineQty });
      }

      const unitKitCost = qty > 0 ? totalUnitCost / qty : 0;
      await inventoryService.receiveStock(
        institutionId,
        {
          itemId: compositeItemId,
          warehouseId,
          quantity: qty,
          unitCost: unitKitCost,
          poId: uuidv4(),
          poLineId: uuidv4(),
          grnNumber: batchRef
        },
        userId
      );

      logger.info('Kit assembled', {
        institutionId,
        compositeItemId,
        warehouseId,
        quantity: qty,
        userId,
        batchRef
      });

      return { batchRef, quantity: qty, unitKitCost };
    } catch (err) {
      for (const row of decreased) {
        try {
          await inventoryService.adjustStock(
            institutionId,
            {
              itemId: row.itemId,
              warehouseId,
              quantityChange: row.quantity,
              adjustmentType: 'increase',
              reason: `KIT_ASSEMBLY_ROLLBACK:${batchRef}`,
              lossType: 'MANUAL'
            },
            userId
          );
        } catch (rollbackErr) {
          logger.error('Kit assembly rollback failed', {
            institutionId,
            itemId: row.itemId,
            error: rollbackErr.message
          });
        }
      }
      throw err;
    }
  }

  async disassembleKit(institutionId, { compositeItemId, warehouseId, quantity, notes }, userId) {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('Quantity must be a positive number');
    }

    const row = await this.getItemRow(institutionId, compositeItemId);
    if (String(row.type || '').toLowerCase() !== 'composite') {
      throw new Error('Only composite kit items can be disassembled');
    }

    const components = await itemService.getCompositeComponents(institutionId, compositeItemId);
    if (!components.length) {
      throw new Error('Composite item has no BOM components');
    }

    const kitProj = await projectionService.getInventoryProjection(
      institutionId,
      compositeItemId,
      warehouseId
    );
    const kitAvailable = kitProj ? Number(kitProj.quantity_available) : 0;
    if (kitAvailable < qty) {
      throw new Error(
        `Insufficient finished kit stock to disassemble. Available: ${kitAvailable}, requested: ${qty}`
      );
    }

    const batchRef = `DSM-${Date.now()}`;
    const reason = notes ? `KIT_DISASSEMBLY: ${notes}` : 'KIT_DISASSEMBLY';

    await inventoryService.adjustStock(
      institutionId,
      {
        itemId: compositeItemId,
        warehouseId,
        quantityChange: qty,
        adjustmentType: 'decrease',
        reason,
        lossType: 'MANUAL'
      },
      userId
    );

    for (const c of components) {
      const lineQty = qty * Number(c.quantity_required);
      await inventoryService.adjustStock(
        institutionId,
        {
          itemId: c.component_item_id,
          warehouseId,
          quantityChange: lineQty,
          adjustmentType: 'increase',
          reason,
          lossType: 'MANUAL'
        },
        userId
      );
    }

    logger.info('Kit disassembled', {
      institutionId,
      compositeItemId,
      warehouseId,
      quantity: qty,
      userId,
      batchRef
    });

    return { batchRef, quantity: qty };
  }

  async reserveForSalesLine(institutionId, line, userId) {
    const {
      itemId,
      warehouseId,
      quantity,
      unitPrice,
      soId,
      soLineId,
      itemVariantId
    } = line;
    const mode = await this.getFulfillmentMode(institutionId, itemId);
    if (!mode) {
      return inventoryService.reserveStock(
        institutionId,
        { itemId, warehouseId, quantity, unitPrice, soId, soLineId, itemVariantId },
        userId
      );
    }

    if (mode === FULFILLMENT_PREBUILT) {
      const stock = await projectionService.getInventoryProjection(
        institutionId,
        itemId,
        warehouseId,
        itemVariantId
      );
      const availableQty = stock ? Number(stock.quantity_available) : 0;
      if (availableQty < quantity) {
        const buildable = await itemService.calculateCompositeStock(
          institutionId,
          itemId,
          warehouseId
        );
        throw new Error(
          `Insufficient finished kit stock (available ${availableQty}, requested ${quantity}). ` +
            `Assemble kits first — up to ${buildable} can be built from components.`
        );
      }
      return inventoryService.reserveStock(
        institutionId,
        { itemId, warehouseId, quantity, unitPrice, soId, soLineId, itemVariantId },
        userId
      );
    }

    const components = await itemService.getCompositeComponents(institutionId, itemId);
    let reservedAny = false;
    for (const c of components) {
      if (String(c.consumption_timing || 'shipment').toLowerCase() !== 'order') continue;
      const compQty = quantity * Number(c.quantity_required);
      await inventoryService.reserveStock(
        institutionId,
        {
          itemId: c.component_item_id,
          warehouseId,
          quantity: compQty,
          unitPrice: 0,
          soId,
          soLineId: componentSoLineId(soLineId, c.component_item_id),
          itemVariantId: undefined
        },
        userId
      );
      reservedAny = true;
    }
    return reservedAny ? 'composite-explode-reserved' : null;
  }

  async shipForSalesLine(institutionId, line, shipmentNumber, userId) {
    const {
      itemId,
      warehouseId,
      quantity,
      unitPrice,
      soId,
      soLineId,
      itemVariantId
    } = line;
    const mode = await this.getFulfillmentMode(institutionId, itemId);
    if (!mode) {
      return inventoryService.shipStock(
        institutionId,
        {
          itemId,
          warehouseId,
          quantity,
          unitPrice,
          soId,
          soLineId,
          shipmentNumber,
          itemVariantId
        },
        userId
      );
    }

    if (mode === FULFILLMENT_PREBUILT) {
      return inventoryService.shipStock(
        institutionId,
        {
          itemId,
          warehouseId,
          quantity,
          unitPrice,
          soId,
          soLineId,
          shipmentNumber,
          itemVariantId
        },
        userId
      );
    }

    const components = await itemService.getCompositeComponents(institutionId, itemId);
    for (const c of components) {
      const compQty = quantity * Number(c.quantity_required);
      const compLineId = componentSoLineId(soLineId, c.component_item_id);
      const timing = String(c.consumption_timing || 'shipment').toLowerCase();
      const shipPayload = {
        itemId: c.component_item_id,
        warehouseId,
        quantity: compQty,
        unitPrice: 0,
        soId,
        soLineId: compLineId,
        shipmentNumber,
        itemVariantId: undefined,
        skipSoLineValidation: true
      };

      if (timing === 'shipment') {
        const stock = await projectionService.getInventoryProjection(
          institutionId,
          c.component_item_id,
          warehouseId
        );
        const availableQty = stock ? Number(stock.quantity_available) : 0;
        if (availableQty < compQty) {
          throw new Error(
            `Insufficient component stock for kit shipment (${c.component_name || c.component_item_id}): ` +
              `available ${availableQty}, required ${compQty}`
          );
        }
        await inventoryService.reserveStock(
          institutionId,
          {
            itemId: c.component_item_id,
            warehouseId,
            quantity: compQty,
            unitPrice: 0,
            soId,
            soLineId: compLineId,
            itemVariantId: undefined
          },
          userId
        );
      }

      await inventoryService.shipStock(institutionId, shipPayload, userId);
    }
    return 'composite-explode-shipped';
  }

  async releaseForSalesLine(institutionId, line, userId) {
    const {
      itemId,
      warehouseId,
      quantity,
      soId,
      soLineId,
      itemVariantId
    } = line;
    const mode = await this.getFulfillmentMode(institutionId, itemId);
    if (!mode) {
      return inventoryService.releaseReservedStock(
        institutionId,
        { itemId, warehouseId, quantity, soId, soLineId, itemVariantId },
        userId
      );
    }

    if (mode === FULFILLMENT_PREBUILT) {
      return inventoryService.releaseReservedStock(
        institutionId,
        { itemId, warehouseId, quantity, soId, soLineId, itemVariantId },
        userId
      );
    }

    const components = await itemService.getCompositeComponents(institutionId, itemId);
    for (const c of components) {
      if (String(c.consumption_timing || 'shipment').toLowerCase() !== 'order') continue;
      const compQty = quantity * Number(c.quantity_required);
      await inventoryService.releaseReservedStock(
        institutionId,
        {
          itemId: c.component_item_id,
          warehouseId,
          quantity: compQty,
          soId,
          soLineId: componentSoLineId(soLineId, c.component_item_id),
          itemVariantId: undefined
        },
        userId
      );
    }
  }
}

module.exports = new CompositeInventoryService();
module.exports.FULFILLMENT_PREBUILT = FULFILLMENT_PREBUILT;
module.exports.FULFILLMENT_EXPLODE = FULFILLMENT_EXPLODE;
