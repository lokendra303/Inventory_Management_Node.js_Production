const db = require('../database/connection');
const logger = require('../utils/logger');

class WarehouseOptimizationService {
  /**
   * Calculate shipping cost based on distance and weight
   */
  calculateShippingCost(distance, weight, shippingMethod = 'standard') {
    const rates = {
      standard: { baseRate: 5, perKm: 0.5, perKg: 0.3 },
      express: { baseRate: 15, perKm: 1.2, perKg: 0.5 },
      overnight: { baseRate: 30, perKm: 2.0, perKg: 0.8 }
    };

    const rate = rates[shippingMethod] || rates.standard;
    const distanceCost = distance * rate.perKm;
    const weightCost = weight * rate.perKg;
    
    return rate.baseRate + distanceCost + weightCost;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get optimal warehouse for order based on stock availability, proximity, and cost
   */
  async getOptimalWarehouse(institutionId, orderData) {
    const { customerId, items, customerAddress } = orderData;

    try {
      // Get all active warehouses
      const warehouses = await db.query(
        `SELECT w.*, 
                JSON_EXTRACT(w.address, '$.latitude') as latitude,
                JSON_EXTRACT(w.address, '$.longitude') as longitude,
                JSON_EXTRACT(w.capacity_constraints, '$.operatingCost') as operating_cost
         FROM warehouses w
         WHERE w.institution_id = ? AND w.status = 'active'`,
        [institutionId]
      );

      if (warehouses.length === 0) {
        throw new Error('No active warehouses available');
      }

      const warehouseScores = [];

      for (const warehouse of warehouses) {
        let score = 0;
        let hasAllStock = true;
        let totalDistance = 0;
        let estimatedShippingCost = 0;

        // Check stock availability for all items
        for (const item of items) {
          const [stock] = await db.query(
            `SELECT quantity_available 
             FROM inventory_projections 
             WHERE institution_id = ? AND warehouse_id = ? AND item_id = ?`,
            [institutionId, warehouse.id, item.itemId]
          );

          if (!stock || stock.quantity_available < item.quantity) {
            hasAllStock = false;
            score -= 1000; // Heavy penalty for insufficient stock
          } else {
            score += 100; // Bonus for having stock
          }
        }

        // Calculate distance if coordinates available
        if (warehouse.latitude && warehouse.longitude && 
            customerAddress?.latitude && customerAddress?.longitude) {
          totalDistance = this.calculateDistance(
            parseFloat(warehouse.latitude),
            parseFloat(warehouse.longitude),
            parseFloat(customerAddress.latitude),
            parseFloat(customerAddress.longitude)
          );

          // Calculate estimated shipping cost
          const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1) * item.quantity, 0);
          estimatedShippingCost = this.calculateShippingCost(totalDistance, totalWeight);

          // Score based on distance (closer is better)
          score += Math.max(0, 500 - totalDistance);
        }

        // Factor in operating cost
        const operatingCost = parseFloat(warehouse.operating_cost) || 0;
        score -= operatingCost * 0.1;

        warehouseScores.push({
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          warehouseAddress: warehouse.address,
          hasAllStock,
          distance: totalDistance,
          estimatedShippingCost,
          operatingCost,
          score
        });
      }

      // Sort by score (highest first)
      warehouseScores.sort((a, b) => b.score - a.score);

      return {
        recommended: warehouseScores[0],
        alternatives: warehouseScores.slice(1, 3),
        allOptions: warehouseScores
      };
    } catch (error) {
      logger.error('Failed to get optimal warehouse', { institutionId, error: error.message });
      throw error;
    }
  }

  /**
   * Validate stock availability across warehouses
   */
  async validateStockAvailability(institutionId, warehouseId, items) {
    const unavailableItems = [];

    for (const item of items) {
      const [stock] = await db.query(
        `SELECT ip.quantity_available, i.name, i.sku
         FROM inventory_projections ip
         JOIN items i ON ip.item_id = i.id
         WHERE ip.institution_id = ? AND ip.warehouse_id = ? AND ip.item_id = ?`,
        [institutionId, warehouseId, item.itemId]
      );

      if (!stock || stock.quantity_available < item.quantity) {
        unavailableItems.push({
          itemId: item.itemId,
          itemName: stock?.name || 'Unknown',
          sku: stock?.sku || 'N/A',
          requested: item.quantity,
          available: stock?.quantity_available || 0,
          shortage: item.quantity - (stock?.quantity_available || 0)
        });
      }
    }

    return {
      isAvailable: unavailableItems.length === 0,
      unavailableItems
    };
  }

  /**
   * Get warehouse cost structure
   */
  async getWarehouseCostStructure(institutionId, warehouseId) {
    const [warehouse] = await db.query(
      `SELECT w.*,
              JSON_EXTRACT(w.capacity_constraints, '$.operatingCost') as operating_cost,
              JSON_EXTRACT(w.capacity_constraints, '$.storageCostPerUnit') as storage_cost_per_unit,
              JSON_EXTRACT(w.capacity_constraints, '$.handlingCostPerOrder') as handling_cost_per_order
       FROM warehouses w
       WHERE w.institution_id = ? AND w.id = ?`,
      [institutionId, warehouseId]
    );

    if (!warehouse) {
      throw new Error('Warehouse not found');
    }

    return {
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      operatingCost: parseFloat(warehouse.operating_cost) || 0,
      storageCostPerUnit: parseFloat(warehouse.storage_cost_per_unit) || 0,
      handlingCostPerOrder: parseFloat(warehouse.handling_cost_per_order) || 0
    };
  }

  /**
   * Calculate total fulfillment cost for an order
   */
  async calculateFulfillmentCost(institutionId, warehouseId, orderData) {
    const { items, customerAddress, shippingMethod = 'standard' } = orderData;

    try {
      // Get warehouse cost structure
      const costStructure = await this.getWarehouseCostStructure(institutionId, warehouseId);

      // Get warehouse location
      const [warehouse] = await db.query(
        `SELECT JSON_EXTRACT(address, '$.latitude') as latitude,
                JSON_EXTRACT(address, '$.longitude') as longitude
         FROM warehouses
         WHERE institution_id = ? AND id = ?`,
        [institutionId, warehouseId]
      );

      let shippingCost = 0;
      let distance = 0;

      // Calculate shipping cost if coordinates available
      if (warehouse?.latitude && warehouse?.longitude && 
          customerAddress?.latitude && customerAddress?.longitude) {
        distance = this.calculateDistance(
          parseFloat(warehouse.latitude),
          parseFloat(warehouse.longitude),
          parseFloat(customerAddress.latitude),
          parseFloat(customerAddress.longitude)
        );

        const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1) * item.quantity, 0);
        shippingCost = this.calculateShippingCost(distance, totalWeight, shippingMethod);
      }

      // Calculate storage cost
      const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
      const storageCost = totalUnits * costStructure.storageCostPerUnit;

      // Total fulfillment cost
      const totalCost = costStructure.handlingCostPerOrder + storageCost + shippingCost;

      return {
        warehouseId,
        warehouseName: costStructure.warehouseName,
        breakdown: {
          handlingCost: costStructure.handlingCostPerOrder,
          storageCost,
          shippingCost,
          distance
        },
        totalCost,
        shippingMethod
      };
    } catch (error) {
      logger.error('Failed to calculate fulfillment cost', { institutionId, warehouseId, error: error.message });
      throw error;
    }
  }

  /**
   * Get multi-warehouse stock availability for items
   */
  async getMultiWarehouseAvailability(institutionId, items) {
    const availability = [];

    for (const item of items) {
      const warehouses = await db.query(
        `SELECT ip.warehouse_id, w.name as warehouse_name, 
                ip.quantity_available, ip.quantity_on_hand, ip.quantity_reserved,
                i.name as item_name, i.sku
         FROM inventory_projections ip
         JOIN warehouses w ON ip.warehouse_id = w.id
         JOIN items i ON ip.item_id = i.id
         WHERE ip.institution_id = ? AND ip.item_id = ? AND ip.quantity_available > 0
         ORDER BY ip.quantity_available DESC`,
        [institutionId, item.itemId]
      );

      availability.push({
        itemId: item.itemId,
        itemName: warehouses[0]?.item_name || 'Unknown',
        sku: warehouses[0]?.sku || 'N/A',
        requestedQuantity: item.quantity,
        warehouses: warehouses.map(wh => ({
          warehouseId: wh.warehouse_id,
          warehouseName: wh.warehouse_name,
          available: wh.quantity_available,
          onHand: wh.quantity_on_hand,
          reserved: wh.quantity_reserved,
          canFulfill: wh.quantity_available >= item.quantity
        }))
      });
    }

    return availability;
  }
}

module.exports = new WarehouseOptimizationService();
