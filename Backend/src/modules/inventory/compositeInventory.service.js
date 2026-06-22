const db = require('../../database/connection');
const projectionService = require('../../projections/inventoryProjections');
const inventoryService = require('./inventory.service');
const itemService = require('../entity/item.service');
const batchSerialService = require('./batchSerial.service');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

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
      `SELECT id, type, kit_fulfillment_mode, name, sku,
              is_batch_tracked, is_serialized, has_expiry
         FROM items
        WHERE institution_id = ? AND id = ?
        LIMIT 1`,
      [institutionId, itemId]
    );
    if (!rows.length) throw new Error('Item not found');
    return rows[0];
  }

  async calculateBuildableWithBatches(institutionId, compositeItemId, warehouseId) {
    const components = await itemService.getCompositeComponents(institutionId, compositeItemId);
    if (!components.length) return 0;

    let minAvailableStock = Infinity;
    for (const component of components) {
      const tracking = await batchSerialService.getItemTracking(
        institutionId,
        component.component_item_id
      );
      let availableQuantity;
      if (tracking.isBatchTracked) {
        availableQuantity = await batchSerialService.getBatchStockTotal(
          institutionId,
          component.component_item_id,
          warehouseId
        );
      } else {
        const componentStock = await projectionService.getInventoryProjection(
          institutionId,
          component.component_item_id,
          warehouseId
        );
        availableQuantity = componentStock ? Number(componentStock.quantity_available) : 0;
      }
      const req = Number(component.quantity_required);
      const possibleCompositeQuantity = req > 0 ? Math.floor(availableQuantity / req) : 0;
      minAvailableStock = Math.min(minAvailableStock, possibleCompositeQuantity);
    }

    const projectionBuildable = await itemService.calculateCompositeStock(
      institutionId,
      compositeItemId,
      warehouseId
    );
    const batchBuildable = minAvailableStock === Infinity ? 0 : minAvailableStock;
    return Math.min(projectionBuildable, batchBuildable);
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

  async applyKitAssemblyCost(institutionId, itemId, warehouseId, addedQty, unitCost) {
    const added = Number(addedQty) || 0;
    const unit = Number(unitCost) || 0;
    if (added <= 0) return;

    const rows = await db.query(
      `SELECT quantity_on_hand, average_cost
         FROM inventory_projections
        WHERE institution_id = ? AND item_id = ? AND warehouse_id = ? AND item_variant_id IS NULL
        LIMIT 1`,
      [institutionId, itemId, warehouseId]
    );
    if (!rows.length) return;

    const onHand = Number(rows[0].quantity_on_hand) || 0;
    const avgCost = Number(rows[0].average_cost) || 0;
    const prevOnHand = Math.max(onHand - added, 0);
    const newAvgCost = onHand > 0
      ? ((prevOnHand * avgCost) + (added * unit)) / onHand
      : unit;

    await db.query(
      `UPDATE inventory_projections
          SET average_cost = ?, total_value = quantity_on_hand * ?
        WHERE institution_id = ? AND item_id = ? AND warehouse_id = ? AND item_variant_id IS NULL`,
      [newAvgCost, newAvgCost, institutionId, itemId, warehouseId]
    );
  }

  async getAvailability(institutionId, compositeItemId, warehouseId) {
    const row = await this.getItemRow(institutionId, compositeItemId);
    if (String(row.type || '').toLowerCase() !== 'composite') {
      throw new Error('Item is not a composite kit');
    }

    const components = await itemService.getCompositeComponents(institutionId, compositeItemId);
    const buildableFromComponents = await this.calculateBuildableWithBatches(
      institutionId,
      compositeItemId,
      warehouseId
    );
    const batchGen = require('../settings/batchGenerator.service');
    const batchCtx = await batchGen.buildContextFromItem(
      institutionId,
      compositeItemId,
      warehouseId
    );
    batchCtx.context = 'kit_assembly';
    const batchPreview = await batchGen.previewBatch(institutionId, batchCtx);
    const suggestedOutputBatchNumber = batchPreview.preview;
    const batchRule = batchPreview.rule;
    const kitTracking = {
      isBatchTracked: Boolean(row.is_batch_tracked),
      isSerialized: Boolean(row.is_serialized),
      hasExpiry: Boolean(row.has_expiry),
    };
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
      const compTracking = await batchSerialService.getItemTracking(
        institutionId,
        c.component_item_id
      );
      let avail = p ? Number(p.quantity_available) : 0;
      if (compTracking.isBatchTracked) {
        const batchAvail = await batchSerialService.getBatchStockTotal(
          institutionId,
          c.component_item_id,
          warehouseId
        );
        avail = Math.min(avail, batchAvail);
      }
      const req = Number(c.quantity_required);
      componentDetails.push({
        componentItemId: c.component_item_id,
        sku: c.sku,
        name: c.component_name,
        unit: c.unit,
        quantityRequiredPerKit: req,
        consumptionTiming: c.consumption_timing || 'shipment',
        available: avail,
        averageCost: p ? Number(p.average_cost) : 0,
        kitsSupportable: req > 0 ? Math.floor(avail / req) : 0,
        isBatchTracked: compTracking.isBatchTracked,
        isSerialized: compTracking.isSerialized,
      });
    }

    const estimatedUnitCost = componentDetails.reduce(
      (sum, row) => sum + (Number(row.quantityRequiredPerKit) || 0) * (Number(row.averageCost) || 0),
      0
    );

    const anyBatchTrackedComponent = componentDetails.some((c) => c.isBatchTracked);

    return {
      compositeItemId,
      warehouseId,
      fulfillmentMode: this.normalizeFulfillmentMode(row.kit_fulfillment_mode),
      kitOnHand,
      kitAvailable,
      buildableFromComponents,
      kitTracking,
      suggestedOutputBatchNumber,
      batchRule,
      requiresKitBatch: true,
      anyBatchTrackedComponent,
      estimatedUnitCost,
      componentDetails
    };
  }

  async previewDisassembly(institutionId, compositeItemId, warehouseId, quantity) {
    const row = await this.getItemRow(institutionId, compositeItemId);
    if (String(row.type || '').toLowerCase() !== 'composite') {
      throw new Error('Item is not a composite kit');
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('quantity must be a positive number');
    }

    const kitProj = await projectionService.getInventoryProjection(
      institutionId,
      compositeItemId,
      warehouseId
    );
    const kitAvailable = kitProj ? Number(kitProj.quantity_available) : 0;
    const kitTracking = await batchSerialService.getItemTracking(institutionId, compositeItemId);

    let kitBatchAllocations = [];
    let kitBatchSufficient = true;
    let kitBatchError = null;

    if (kitTracking.isBatchTracked) {
      try {
        kitBatchAllocations = await batchSerialService.previewFefoAllocations(
          institutionId,
          compositeItemId,
          warehouseId,
          qty
        );
      } catch (err) {
        kitBatchSufficient = false;
        kitBatchError = err.message;
      }
    }

    const components = await itemService.getCompositeComponents(institutionId, compositeItemId);
    const componentPreview = [];
    for (const c of components) {
      const lineQty = qty * Number(c.quantity_required);
      const compTracking = await batchSerialService.getItemTracking(
        institutionId,
        c.component_item_id
      );
      componentPreview.push({
        componentItemId: c.component_item_id,
        sku: c.sku,
        name: c.component_name,
        quantityPerKit: Number(c.quantity_required),
        quantityReturned: lineQty,
        willCreateBatch: compTracking.isBatchTracked,
      });
    }

    return {
      compositeItemId,
      warehouseId,
      quantity: qty,
      kitAvailable,
      kitSufficient: kitAvailable >= qty,
      kitBatchAllocations,
      kitBatchSufficient,
      kitBatchError,
      componentPreview,
    };
  }

  async assembleKit(institutionId, payload, userId) {
    const {
      compositeItemId,
      warehouseId,
      quantity,
      notes,
      outputBatchNumber,
      outputManufactureDate,
      outputExpiryDate,
      componentBatchAllocations = {},
      batchRuleId,
    } = payload;
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

    const buildable = await this.calculateBuildableWithBatches(
      institutionId,
      compositeItemId,
      warehouseId
    );
    if (qty > buildable) {
      throw new Error(
        `Insufficient components to assemble ${qty} kit(s). Maximum buildable from parts: ${buildable}`
      );
    }

    const assemblyRefId = `ASM-${Date.now()}-${uuidv4().slice(0, 8)}`;
    const reason = notes ? `KIT_ASSEMBLY: ${notes}` : 'KIT_ASSEMBLY';
    let totalUnitCost = 0;
    const decreased = [];
    let kitIncreased = false;
    const batchOps = { componentAllocations: [], outputBatch: null };

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
      await inventoryService.adjustStock(
        institutionId,
        {
          itemId: compositeItemId,
          warehouseId,
          quantityChange: qty,
          adjustmentType: 'increase',
          reason,
          lossType: 'MANUAL'
        },
        userId
      );
      kitIncreased = true;
      await this.applyKitAssemblyCost(
        institutionId,
        compositeItemId,
        warehouseId,
        qty,
        unitKitCost
      );

      for (const c of components) {
        const lineQty = qty * Number(c.quantity_required);
        const customAlloc = componentBatchAllocations[c.component_item_id]
          || componentBatchAllocations[String(c.component_item_id)];
        const { allocations } = await batchSerialService.consumeForKitAssembly(
          institutionId,
          {
            itemId: c.component_item_id,
            warehouseId,
            quantity: lineQty,
            batchAllocations: customAlloc,
            assemblyRefId,
          },
          userId
        );
        for (const alloc of allocations) {
          batchOps.componentAllocations.push({
            ...alloc,
            itemId: c.component_item_id,
            itemName: c.component_name,
            itemSku: c.sku,
          });
        }
      }

      const outputBatch = await batchSerialService.receiveForKitAssembly(
        institutionId,
        {
          itemId: compositeItemId,
          warehouseId,
          quantity: qty,
          unitCost: unitKitCost,
          batchNumber: outputBatchNumber,
          manufactureDate: outputManufactureDate,
          expiryDate: outputExpiryDate,
          assemblyRefId,
          batchRuleId,
        },
        userId
      );
      batchOps.outputBatch = outputBatch;

      logger.info('Kit assembled', {
        institutionId,
        compositeItemId,
        warehouseId,
        quantity: qty,
        userId,
        assemblyRefId,
        outputBatchNumber: outputBatch.batchNumber,
      });

      return {
        batchRef: assemblyRefId,
        quantity: qty,
        unitKitCost,
        outputBatchNumber: outputBatch.batchNumber,
        outputBatchId: outputBatch.batchId,
        componentBatchAllocations: batchOps.componentAllocations,
      };
    } catch (err) {
      try {
        await batchSerialService.rollbackKitAssemblyBatches(
          institutionId,
          batchOps,
          userId
        );
      } catch (rollbackBatchErr) {
        logger.error('Kit assembly batch rollback failed', {
          institutionId,
          compositeItemId,
          error: rollbackBatchErr.message,
        });
      }
      if (kitIncreased) {
        try {
          await inventoryService.adjustStock(
            institutionId,
            {
              itemId: compositeItemId,
              warehouseId,
              quantityChange: qty,
              adjustmentType: 'decrease',
              reason: `KIT_ASSEMBLY_ROLLBACK:${assemblyRefId}`,
              lossType: 'MANUAL'
            },
            userId
          );
        } catch (rollbackErr) {
          logger.error('Kit assembly kit-stock rollback failed', {
            institutionId,
            compositeItemId,
            error: rollbackErr.message
          });
        }
      }
      for (const row of decreased) {
        try {
          await inventoryService.adjustStock(
            institutionId,
            {
              itemId: row.itemId,
              warehouseId,
              quantityChange: row.quantity,
              adjustmentType: 'increase',
              reason: `KIT_ASSEMBLY_ROLLBACK:${assemblyRefId}`,
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

  async disassembleKit(institutionId, payload, userId) {
    const { compositeItemId, warehouseId, quantity, notes } = payload;
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

    const kitTracking = await batchSerialService.getItemTracking(institutionId, compositeItemId);
    if (kitTracking.isBatchTracked) {
      const batchAvail = await batchSerialService.getBatchStockTotal(
        institutionId,
        compositeItemId,
        warehouseId
      );
      if (batchAvail < qty) {
        throw new Error(
          `Insufficient kit batch stock to disassemble. Batch available: ${batchAvail}, requested: ${qty}. ` +
            'Assemble kits with batch tracking or reconcile batch quantities.'
        );
      }
    }

    const disassemblyRefId = `DSM-${Date.now()}-${uuidv4().slice(0, 8)}`;
    const reason = notes ? `KIT_DISASSEMBLY: ${notes}` : 'KIT_DISASSEMBLY';

    try {
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

      const componentUnitCosts = {};
      for (const c of components) {
        const lineQty = qty * Number(c.quantity_required);
        const proj = await projectionService.getInventoryProjection(
          institutionId,
          c.component_item_id,
          warehouseId
        );
        componentUnitCosts[c.component_item_id] = proj ? Number(proj.average_cost) : 0;

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

      const batchResult = await batchSerialService.processKitDisassemblyBatches(
        institutionId,
        {
          compositeItemId,
          warehouseId,
          quantity: qty,
          components,
          disassemblyRefId,
          componentUnitCosts,
        },
        userId
      );

      logger.info('Kit disassembled', {
        institutionId,
        compositeItemId,
        warehouseId,
        quantity: qty,
        userId,
        disassemblyRefId
      });

      return {
        batchRef: disassemblyRefId,
        quantity: qty,
        kitBatchAllocations: batchResult.kitAllocations,
        componentBatches: batchResult.componentBatches,
      };
    } catch (err) {
      try {
        await inventoryService.adjustStock(
          institutionId,
          {
            itemId: compositeItemId,
            warehouseId,
            quantityChange: qty,
            adjustmentType: 'increase',
            reason: `KIT_DISASSEMBLY_ROLLBACK:${disassemblyRefId}`,
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
              adjustmentType: 'decrease',
              reason: `KIT_DISASSEMBLY_ROLLBACK:${disassemblyRefId}`,
              lossType: 'MANUAL'
            },
            userId
          );
        }
      } catch (rollbackErr) {
        logger.error('Kit disassembly stock rollback failed', {
          institutionId,
          compositeItemId,
          error: rollbackErr.message,
        });
      }
      throw err;
    }
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
