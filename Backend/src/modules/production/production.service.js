const itemService = require('../entity/item.service');
const compositeInventoryService = require('../inventory/compositeInventory.service');
const productionOrderService = require('./productionOrder.service');

class ProductionService {
  async listBomItems(institutionId, filters = {}, limit = null, offset = 0) {
    return itemService.getItems(
      institutionId,
      { ...filters, type: 'composite' },
      limit,
      offset
    );
  }

  async getBomItem(institutionId, itemId) {
    const item = await itemService.getItem(institutionId, itemId);
    if (!item) return null;
    if (String(item.type || '').toLowerCase() !== 'composite') {
      throw new Error('Item is not a BOM / composite item');
    }
    return item;
  }

  async createBomItem(institutionId, body, userId) {
    return itemService.createCompositeItem(
      institutionId,
      { itemData: { ...body, type: 'composite' }, components: body.components || [] },
      userId
    );
  }

  async updateBomItem(institutionId, itemId, body, userId) {
    await this.getBomItem(institutionId, itemId);
    await itemService.updateItem(
      institutionId,
      itemId,
      { ...body, type: 'composite' },
      userId,
      { allowComposite: true }
    );
    return itemId;
  }

  async updateBomComponents(institutionId, itemId, components, userId) {
    await this.getBomItem(institutionId, itemId);
    return itemService.updateCompositeComponents(institutionId, itemId, components, userId);
  }

  getAvailability(institutionId, compositeItemId, warehouseId) {
    return compositeInventoryService.getAvailability(institutionId, compositeItemId, warehouseId);
  }

  previewDisassembly(institutionId, compositeItemId, warehouseId, quantity) {
    return compositeInventoryService.previewDisassembly(
      institutionId,
      compositeItemId,
      warehouseId,
      quantity
    );
  }

  async previewKitBatchNumber(institutionId, compositeItemId, warehouseId, ruleId = null) {
    await this.getBomItem(institutionId, compositeItemId);
    if (!warehouseId) {
      throw new Error('Warehouse is required to preview kit batch number');
    }
    const batchGen = require('../settings/batchGenerator.service');
    const ctx = await batchGen.buildContextFromItem(institutionId, compositeItemId, warehouseId);
    ctx.context = 'kit_assembly';
    if (ruleId) ctx.ruleId = ruleId;
    const preview = await batchGen.previewBatch(institutionId, ctx);
    return {
      batchNumber: preview.preview,
      rule: preview.rule,
      preview: preview.preview,
    };
  }

  async assembleKit(institutionId, payload, userId) {
    const result = await compositeInventoryService.assembleKit(institutionId, payload, userId);
    const audit = await productionOrderService.recordCompletedOperation(
      institutionId,
      userId,
      'assemble',
      payload,
      result
    );
    return { ...result, ...audit };
  }

  async disassembleKit(institutionId, payload, userId) {
    const result = await compositeInventoryService.disassembleKit(institutionId, payload, userId);
    const audit = await productionOrderService.recordCompletedOperation(
      institutionId,
      userId,
      'disassemble',
      payload,
      result
    );
    return { ...result, ...audit };
  }

  listOperations(institutionId, filters) {
    return productionOrderService.listOrders(institutionId, filters);
  }

  getOperation(institutionId, orderId) {
    return productionOrderService.getOrder(institutionId, orderId);
  }

  saveOperationDraft(institutionId, userId, body) {
    return productionOrderService.saveDraft(institutionId, userId, body);
  }

  confirmOperation(institutionId, orderId, userId) {
    return productionOrderService.confirmOrder(institutionId, orderId, userId);
  }

  cancelOperationDraft(institutionId, orderId, userId) {
    return productionOrderService.cancelDraft(institutionId, orderId, userId);
  }

  executeOperation(institutionId, userId, body) {
    return productionOrderService.executeImmediate(institutionId, userId, body);
  }

  saveBomDraft(institutionId, userId, draftData) {
    return itemService.saveBomDraft(institutionId, userId, draftData);
  }

  getBomDrafts(institutionId, userId) {
    return itemService.getBomDrafts(institutionId, userId);
  }

  getBomDraft(institutionId, userId) {
    return itemService.getBomDraft(institutionId, userId);
  }

  deleteBomDraft(institutionId, userId, draftId) {
    return itemService.deleteBomDraft(institutionId, userId, draftId);
  }
}

module.exports = new ProductionService();
