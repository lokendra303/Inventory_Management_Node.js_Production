const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');
const reorderLevelService = require('../inventory/reorderLevelService');
const purchaseOrderService = require('../order/purchaseOrderService');

class AutoPOService {
  /**
   * Generate draft POs from all active reorder suggestions.
   * Groups suggestions by preferred vendor so one PO is created per vendor.
   */
  async generatePOsFromReorderSuggestions(institutionId, userId, options = {}) {
    const { warehouseId, dryRun = false } = options;

    const suggestions = await reorderLevelService.generateReorderSuggestions(institutionId);

    if (!suggestions.length) {
      return { created: 0, pos: [] };
    }

    // Filter by warehouse if requested
    const filtered = warehouseId
      ? suggestions.filter(s => s.warehouse_id === warehouseId)
      : suggestions;

    // Group by vendor (use 'NO_VENDOR' key for items without a preferred vendor)
    const byVendor = {};
    for (const s of filtered) {
      const vendorKey = s.vendor_id || 'NO_VENDOR';
      if (!byVendor[vendorKey]) {
        byVendor[vendorKey] = {
          vendorId: s.vendor_id || null,
          vendorName: s.preferred_vendor || 'Unknown Vendor',
          lines: []
        };
      }
      byVendor[vendorKey].lines.push({
        itemId: s.item_id,
        warehouseId: s.warehouse_id,
        quantity: parseFloat(s.suggested_quantity) || parseFloat(s.reorder_quantity),
        unitCost: parseFloat(s.last_purchase_cost) || 0,
        itemName: s.item_name,
        sku: s.sku
      });
    }

    if (dryRun) {
      return { created: 0, preview: byVendor, suggestions: filtered };
    }

    const createdPOs = [];
    for (const [vendorKey, group] of Object.entries(byVendor)) {
      try {
        const poNumber = `AUTO-PO-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        const poId = await purchaseOrderService.createPurchaseOrder(institutionId, {
          poNumber,
          vendorId: group.vendorId,
          vendorName: group.vendorName,
          orderDate: new Date().toISOString().split('T')[0],
          notes: 'Auto-generated from reorder suggestions',
          lines: group.lines.map((l, idx) => ({
            itemId: l.itemId,
            warehouseId: l.warehouseId,
            quantity: l.quantity,
            unitCost: l.unitCost,
            lineNumber: idx + 1
          }))
        }, userId);

        createdPOs.push({ poId, poNumber, vendorName: group.vendorName, lineCount: group.lines.length });
        logger.info('Auto-PO created', { poId, institutionId, vendorName: group.vendorName, userId });
      } catch (err) {
        logger.error('Failed to create auto-PO for vendor', {
          vendorKey, institutionId, error: err.message
        });
      }
    }

    return { created: createdPOs.length, pos: createdPOs };
  }

  /**
   * Preview what POs would be created without actually creating them.
   */
  async previewAutoPOs(institutionId, warehouseId) {
    return this.generatePOsFromReorderSuggestions(
      institutionId, null, { warehouseId, dryRun: true }
    );
  }
}

module.exports = new AutoPOService();
