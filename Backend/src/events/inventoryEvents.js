// Inventory Event Types
const INVENTORY_EVENTS = {
  // Purchase Events
  PURCHASE_RECEIVED: 'PurchaseReceived',
  PURCHASE_RETURNED: 'PurchaseReturned',
  
  // Sales Events
  SALE_RESERVED: 'SaleReserved',
  SALE_SHIPPED: 'SaleShipped',
  SALE_RETURNED: 'SaleReturned',
  SALE_RESERVATION_CANCELLED: 'SaleReservationCancelled',
  
  // Transfer Events
  TRANSFER_OUT: 'TransferOut',
  TRANSFER_IN: 'TransferIn',
  
  // Adjustment Events
  STOCK_ADJUSTED: 'StockAdjusted',
  STOCK_DAMAGED: 'StockDamaged',
  STOCK_EXPIRED: 'StockExpired',
  
  // Item Events
  ITEM_CREATED: 'ItemCreated',
  ITEM_UPDATED: 'ItemUpdated',
  ITEM_DEACTIVATED: 'ItemDeactivated'
};

// Event Schemas for validation
const EVENT_SCHEMAS = {
  [INVENTORY_EVENTS.PURCHASE_RECEIVED]: {
    itemId: 'string',
    warehouseId: 'string',
    quantity: 'number',
    unitCost: 'number',
    poId: 'string',
    poLineId: 'string',
    grnNumber: 'string',
    receivedDate: 'string'
  },
  
  [INVENTORY_EVENTS.SALE_RESERVED]: {
    itemId: 'string',
    warehouseId: 'string',
    quantity: 'number',
    unitPrice: 'number',
    soId: 'string',
    soLineId: 'string',
    reservedDate: 'string'
  },
  
  [INVENTORY_EVENTS.SALE_RESERVATION_CANCELLED]: {
    itemId: 'string',
    warehouseId: 'string',
    quantity: 'number',
    soId: 'string',
    soLineId: 'string',
    cancelledDate: 'string'
  },
  
  [INVENTORY_EVENTS.SALE_SHIPPED]: {
    itemId: 'string',
    warehouseId: 'string',
    quantity: 'number',
    unitPrice: 'number',
    soId: 'string',
    soLineId: 'string',
    shippedDate: 'string',
    shipmentNumber: 'string'
  },

  [INVENTORY_EVENTS.SALE_RETURNED]: {
    itemId: 'string',
    warehouseId: 'string',
    quantity: 'number',
    unitPrice: 'number',
    soId: 'string',
    soLineId: 'string',
    returnedDate: 'string'
  },

  [INVENTORY_EVENTS.PURCHASE_RETURNED]: {
    itemId: 'string',
    warehouseId: 'string',
    quantity: 'number',
    unitCost: 'number',
    poId: 'string',
    poLineId: 'string',
    returnedDate: 'string'
  },
  
  [INVENTORY_EVENTS.STOCK_ADJUSTED]: {
    itemId: 'string',
    warehouseId: 'string',
    quantityChange: 'number',
    reason: 'string',
    adjustmentType: 'string', // 'increase' | 'decrease'
    adjustedDate: 'string'
  },
  
  [INVENTORY_EVENTS.TRANSFER_OUT]: {
    itemId: 'string',
    fromWarehouseId: 'string',
    toWarehouseId: 'string',
    quantity: 'number',
    transferId: 'string',
    transferDate: 'string'
  },
  
  [INVENTORY_EVENTS.TRANSFER_IN]: {
    itemId: 'string',
    fromWarehouseId: 'string',
    toWarehouseId: 'string',
    quantity: 'number',
    transferId: 'string',
    transferDate: 'string'
  },

  [INVENTORY_EVENTS.STOCK_DAMAGED]: {
    itemId: 'string',
    warehouseId: 'string',
    quantity: 'number',
    reason: 'string',
    damagedDate: 'string'
  },

  [INVENTORY_EVENTS.STOCK_EXPIRED]: {
    itemId: 'string',
    warehouseId: 'string',
    quantity: 'number',
    expiryDate: 'string',
    expiredDate: 'string'
  }
};

// Event validation function
function validateEventData(eventType, eventData) {
  const schema = EVENT_SCHEMAS[eventType];
  if (!schema) {
    throw new Error(`Unknown event type: ${eventType}`);
  }

  for (const [field, type] of Object.entries(schema)) {
    if (!(field in eventData)) {
      throw new Error(`Missing required field: ${field}`);
    }
    
    // Convert string numbers to actual numbers
    if (type === 'number' && typeof eventData[field] === 'string') {
      eventData[field] = Number(eventData[field]);
    }
    
    if (typeof eventData[field] !== type) {
      throw new Error(`Invalid type for field ${field}: expected ${type}, got ${typeof eventData[field]}`);
    }
  }

  // Additional validations
  const positiveQuantityEvents = new Set([
    INVENTORY_EVENTS.PURCHASE_RECEIVED,
    INVENTORY_EVENTS.PURCHASE_RETURNED,
    INVENTORY_EVENTS.SALE_RESERVED,
    INVENTORY_EVENTS.SALE_SHIPPED,
    INVENTORY_EVENTS.SALE_RETURNED,
    INVENTORY_EVENTS.SALE_RESERVATION_CANCELLED,
    INVENTORY_EVENTS.TRANSFER_OUT,
    INVENTORY_EVENTS.TRANSFER_IN,
    INVENTORY_EVENTS.STOCK_DAMAGED,
    INVENTORY_EVENTS.STOCK_EXPIRED
  ]);
  if (positiveQuantityEvents.has(eventType)) {
    if (eventData.quantity <= 0) {
      throw new Error('Quantity must be positive');
    }
  }

  return true;
}

// Helper function to create aggregate ID
function createAggregateId(itemId, warehouseId) {
  return `${itemId}:${warehouseId}`;
}

module.exports = {
  INVENTORY_EVENTS,
  EVENT_SCHEMAS,
  validateEventData,
  createAggregateId
};