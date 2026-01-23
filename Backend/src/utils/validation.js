const Joi = require('joi');

// Common schemas
const tenantId = Joi.string().uuid().required();
const itemId = Joi.string().uuid().required();
const warehouseId = Joi.string().uuid().required();
const quantity = Joi.number().positive().required();
const unitCost = Joi.number().positive().required();
const unitPrice = Joi.number().positive().required();

// Auth schemas
const registerTenantSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  adminEmail: Joi.string().email().required(),
  adminMobile: Joi.string().pattern(/^[0-9+\-\s()]{10,20}$/).required(),
  adminPassword: Joi.string().min(8).required(),
  adminFirstName: Joi.string().min(1).max(100).required(),
  adminLastName: Joi.string().min(1).max(100).required(),
  adminAddress: Joi.string().max(500).optional(),
  adminCity: Joi.string().max(100).optional(),
  adminState: Joi.string().max(100).optional(),
  adminCountry: Joi.string().max(100).optional(),
  adminPostalCode: Joi.string().max(20).optional(),
  adminDateOfBirth: Joi.date().optional(),
  adminGender: Joi.string().valid('male', 'female', 'other').optional(),
  adminDepartment: Joi.string().max(100).optional(),
  adminDesignation: Joi.string().max(100).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Item schemas
const createItemSchema = Joi.object({
  sku: Joi.string().max(100).required(),
  name: Joi.string().max(255).required(),
  description: Joi.string().optional(),
  type: Joi.string().valid('simple', 'variant', 'composite', 'service').default('simple'),
  category: Joi.string().max(255).optional(),
  unit: Joi.string().max(50).default('pcs'),
  barcode: Joi.string().max(255).optional(),
  hsnCode: Joi.string().max(50).optional(),
  customFields: Joi.object().optional(),
  valuationMethod: Joi.string().valid('fifo', 'weighted_average').default('fifo'),
  allowNegativeStock: Joi.boolean().default(false),
  costPrice: Joi.number().min(0).optional(),
  sellingPrice: Joi.number().min(0).optional(),
  mrp: Joi.number().min(0).optional(),
  taxRate: Joi.number().min(0).max(100).optional(),
  brand: Joi.string().max(100).optional(),
  manufacturer: Joi.string().max(100).optional(),
  minStockLevel: Joi.number().min(0).optional(),
  maxStockLevel: Joi.number().min(0).optional()
}).unknown(true);

const updateItemSchema = Joi.object({
  sku: Joi.string().max(100).optional(),
  name: Joi.string().max(255).optional(),
  description: Joi.string().optional(),
  category: Joi.string().max(255).optional(),
  unit: Joi.string().max(50).optional(),
  barcode: Joi.string().max(255).optional(),
  hsnCode: Joi.string().max(50).optional(),
  customFields: Joi.object().optional(),
  valuationMethod: Joi.string().valid('fifo', 'weighted_average').optional(),
  allowNegativeStock: Joi.boolean().optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  costPrice: Joi.number().min(0).optional(),
  sellingPrice: Joi.number().min(0).optional(),
  mrp: Joi.number().min(0).optional(),
  taxRate: Joi.number().min(0).max(100).optional(),
  brand: Joi.string().max(100).optional(),
  manufacturer: Joi.string().max(100).optional(),
  minStockLevel: Joi.number().min(0).optional(),
  maxStockLevel: Joi.number().min(0).optional()
}).unknown(true);

// Warehouse schemas
const createWarehouseSchema = Joi.object({
  code: Joi.string().max(50).required(),
  name: Joi.string().max(255).required(),
  address: Joi.string().optional(),
  contactPerson: Joi.string().max(255).optional(),
  phone: Joi.string().max(50).optional(),
  email: Joi.string().email().optional(),
  capacityConstraints: Joi.object().optional()
});

// Inventory operation schemas
const receiveStockSchema = Joi.object({
  itemId,
  warehouseId,
  quantity,
  unitCost,
  poId: Joi.string().uuid().optional(),
  poLineId: Joi.string().uuid().optional(),
  grnNumber: Joi.string().max(100).optional()
}).unknown(true);

const reserveStockSchema = Joi.object({
  itemId,
  warehouseId,
  quantity,
  unitPrice,
  soId: Joi.string().uuid().optional(),
  soLineId: Joi.string().uuid().optional()
});

const shipStockSchema = Joi.object({
  itemId,
  warehouseId,
  quantity,
  unitPrice,
  soId: Joi.string().uuid().optional(),
  soLineId: Joi.string().uuid().optional(),
  shipmentNumber: Joi.string().max(100).optional()
});

const adjustStockSchema = Joi.object({
  itemId,
  warehouseId,
  quantityChange: Joi.number().required(),
  reason: Joi.string().max(255).required(),
  adjustmentType: Joi.string().valid('increase', 'decrease').required()
}).unknown(true);

const transferStockSchema = Joi.object({
  itemId,
  fromWarehouseId: Joi.string().uuid().required(),
  toWarehouseId: Joi.string().uuid().required(),
  quantity,
  transferId: Joi.string().uuid().optional()
}).unknown(true);

// Purchase Order schemas
const createPurchaseOrderSchema = Joi.object({
  poNumber: Joi.string().max(100).required(),
  vendorId: Joi.string().uuid().optional(),
  vendorName: Joi.string().max(255).required(),
  warehouseId,
  currency: Joi.string().length(3).default('USD'),
  exchangeRate: Joi.number().positive().default(1.0),
  orderDate: Joi.date().required(),
  expectedDate: Joi.date().optional(),
  notes: Joi.string().optional(),
  lines: Joi.array().items(Joi.object({
    itemId,
    quantity: quantity,
    unitCost: unitCost,
    expectedDate: Joi.date().optional()
  })).min(1).required()
}).unknown(true);

// Sales Order schemas
const createSalesOrderSchema = Joi.object({
  soNumber: Joi.string().max(100).required(),
  customerId: Joi.string().uuid().optional(),
  customerName: Joi.string().max(255).required(),
  warehouseId,
  channel: Joi.string().max(100).default('direct'),
  currency: Joi.string().length(3).default('USD'),
  orderDate: Joi.date().required(),
  expectedShipDate: Joi.date().optional(),
  notes: Joi.string().optional(),
  lines: Joi.array().items(Joi.object({
    itemId,
    quantity: quantity,
    unitPrice: unitPrice
  })).min(1).required()
}).unknown(true);

// User management schemas
const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  mobile: Joi.string().pattern(/^[0-9+\-\s()]{10,20}$/).required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().min(1).max(100).required(),
  lastName: Joi.string().min(1).max(100).required(),
  address: Joi.string().max(500).optional(),
  city: Joi.string().max(100).optional(),
  state: Joi.string().max(100).optional(),
  country: Joi.string().max(100).optional(),
  postalCode: Joi.string().max(20).optional(),
  dateOfBirth: Joi.date().optional(),
  gender: Joi.string().valid('male', 'female', 'other').optional(),
  department: Joi.string().max(100).optional(),
  designation: Joi.string().max(100).optional(),
  role: Joi.string().valid('admin', 'user', 'manager').default('user'),
  permissions: Joi.object().optional(),
  warehouseAccess: Joi.array().items(Joi.string().uuid()).optional()
}).unknown(true);

const updateUserStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive').required()
});

const updateUserPermissionsSchema = Joi.object({
  permissions: Joi.object().required(),
  warehouseAccess: Joi.array().items(Joi.string().uuid()).optional(),
  role: Joi.string().optional()
}).unknown(true);

// Automation Rule schemas
const createAutomationRuleSchema = Joi.object({
  name: Joi.string().max(255).required(),
  description: Joi.string().optional(),
  triggerEvent: Joi.string().max(100).required(),
  conditions: Joi.object().required(),
  actions: Joi.object().required(),
  isActive: Joi.boolean().default(true)
});

// Validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    req.body = value;
    next();
  };
};

module.exports = {
  validate,
  schemas: {
    registerTenantSchema,
    loginSchema,
    createUserSchema,
    createItemSchema,
    updateItemSchema,
    createWarehouseSchema,
    receiveStockSchema,
    reserveStockSchema,
    shipStockSchema,
    adjustStockSchema,
    transferStockSchema,
    createPurchaseOrderSchema,
    createSalesOrderSchema,
    updateUserStatusSchema,
    updateUserPermissionsSchema,
    createAutomationRuleSchema
  }
};