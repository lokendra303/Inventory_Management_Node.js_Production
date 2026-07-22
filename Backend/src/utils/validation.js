const Joi = require('joi');

// Common schemas
const institutionId = Joi.string().uuid().required();
const itemId = Joi.string().uuid().required();
const warehouseId = Joi.string().uuid().required();
const quantity = Joi.number().positive().required();
const unitCost = Joi.number().min(0).required();
const unitPrice = Joi.number().positive().required();

// Auth schemas
const registerinstitutionSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  email: Joi.string().max(255).optional(),
  mobile: Joi.string().pattern(/^[0-9+\-\s()]{10,20}$/).optional(),
  address: Joi.string().max(500).optional(),
  city: Joi.string().max(100).optional(),
  state: Joi.string().max(100).optional(),
  country: Joi.string().max(100).optional(),
  postalCode: Joi.string().max(20).optional(),
  institutionType: Joi.string().max(100).optional(),
  registrationNumber: Joi.string().max(100).optional(),
  taxId: Joi.string().max(100).optional(),
  website: Joi.string().max(255).optional(),
  contactPerson: Joi.string().max(255).optional(),
  adminEmail: Joi.string().email().required(),
  adminMobile: Joi.string().pattern(/^[0-9+\-\s()]{10,20}$/).optional(),
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
}).unknown(true);

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  institutionId: Joi.string().optional()
}).unknown(true);

// Item schemas
const createItemSchema = Joi.object({
  sku: Joi.string().max(100).required(),
  name: Joi.string().max(255).required(),
  description: Joi.string().optional(),
  type: Joi.string().valid('simple', 'variant', 'service').default('simple'),
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
  maxStockLevel: Joi.number().min(0).optional(),
  isSellable: Joi.boolean().default(true),
  isBreakable: Joi.boolean().default(true),
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
  maxStockLevel: Joi.number().min(0).optional(),
  isSellable: Joi.boolean().optional(),
  isPurchasable: Joi.boolean().optional(),
  isManufacturable: Joi.boolean().optional(),
  isBreakable: Joi.boolean().optional(),
}).unknown(true);

const bomComponentSchema = Joi.object({
  itemId: Joi.string().uuid().required(),
  quantityRequired: Joi.number().positive().required(),
  consumptionTiming: Joi.string().valid('order', 'shipment').default('shipment'),
  consumptionUnitId: Joi.string().uuid().allow(null, '').optional(),
  consumeFullPack: Joi.boolean().optional(),
}).unknown(true);

const createBomItemSchema = Joi.object({
  sku: Joi.string().max(100).required(),
  name: Joi.string().max(255).required(),
  description: Joi.string().max(500).allow('', null).optional(),
  category: Joi.string().max(255).allow('', null).optional(),
  unit: Joi.string().max(50).default('pcs'),
  barcode: Joi.string().max(255).allow('', null).optional(),
  hsnCode: Joi.string().max(50).allow('', null).optional(),
  kitFulfillmentMode: Joi.string().valid('prebuilt', 'explode_on_ship').default('prebuilt'),
  components: Joi.array().items(bomComponentSchema).min(1).required(),
  valuationMethod: Joi.string().valid('fifo', 'weighted_average').default('fifo'),
  allowNegativeStock: Joi.boolean().default(false),
  costPrice: Joi.number().min(0).allow(null).optional(),
  sellingPrice: Joi.number().min(0).allow(null).optional(),
  mrp: Joi.number().min(0).allow(null).optional(),
  taxRate: Joi.number().min(0).max(100).allow(null).optional(),
  minStockLevel: Joi.number().min(0).allow(null).optional(),
  maxStockLevel: Joi.number().min(0).allow(null).optional(),
  isSerialized: Joi.boolean().optional(),
  isBatchTracked: Joi.boolean().optional(),
  hasExpiry: Joi.boolean().optional(),
  shelfLifeDays: Joi.number().min(0).allow(null).optional(),
  isSellable: Joi.boolean().optional(),
  isPurchasable: Joi.boolean().optional(),
  isManufacturable: Joi.boolean().optional(),
  isBreakable: Joi.boolean().optional(),
  warehouseId: Joi.string().uuid().allow(null, '').optional(),
  openingStock: Joi.number().min(0).allow(null).optional(),
  openingBatchNumber: Joi.string().max(100).allow('', null).optional(),
  openingManufactureDate: Joi.string().max(30).allow('', null).optional(),
  openingExpiryDate: Joi.string().max(30).allow('', null).optional(),
  openingBatchRuleId: Joi.string().uuid().allow(null, '').optional(),
  openingStockMode: Joi.string().valid('physical', 'assemble').default('physical').optional(),
}).unknown(true);

const updateBomItemSchema = Joi.object({
  sku: Joi.string().max(100).optional(),
  name: Joi.string().max(255).optional(),
  description: Joi.string().max(500).allow('', null).optional(),
  category: Joi.string().max(255).allow('', null).optional(),
  unit: Joi.string().max(50).optional(),
  barcode: Joi.string().max(255).allow('', null).optional(),
  hsnCode: Joi.string().max(50).allow('', null).optional(),
  kitFulfillmentMode: Joi.string().valid('prebuilt', 'explode_on_ship').optional(),
  components: Joi.array().items(bomComponentSchema).min(1).optional(),
  valuationMethod: Joi.string().valid('fifo', 'weighted_average').optional(),
  allowNegativeStock: Joi.boolean().optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  costPrice: Joi.number().min(0).allow(null).optional(),
  sellingPrice: Joi.number().min(0).allow(null).optional(),
  mrp: Joi.number().min(0).allow(null).optional(),
  taxRate: Joi.number().min(0).max(100).allow(null).optional(),
  minStockLevel: Joi.number().min(0).allow(null).optional(),
  maxStockLevel: Joi.number().min(0).allow(null).optional(),
  isSerialized: Joi.boolean().optional(),
  isBatchTracked: Joi.boolean().optional(),
  hasExpiry: Joi.boolean().optional(),
  shelfLifeDays: Joi.number().min(0).allow(null).optional(),
  isSellable: Joi.boolean().optional(),
  isPurchasable: Joi.boolean().optional(),
  isManufacturable: Joi.boolean().optional(),
  isBreakable: Joi.boolean().optional(),
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

const itemVariantIdOpt = Joi.string().uuid().optional().allow(null, '');

const reserveStockSchema = Joi.object({
  itemId,
  warehouseId,
  quantity,
  unitPrice,
  soId: Joi.string().uuid().optional(),
  soLineId: Joi.string().uuid().optional(),
  itemVariantId: itemVariantIdOpt
});

const shipStockSchema = Joi.object({
  itemId,
  warehouseId,
  quantity,
  unitPrice,
  soId: Joi.string().uuid().optional(),
  soLineId: Joi.string().uuid().optional(),
  shipmentNumber: Joi.string().max(100).optional(),
  itemVariantId: itemVariantIdOpt
});

const adjustStockSchema = Joi.object({
  itemId,
  warehouseId,
  quantityChange: Joi.number().not(0).required().messages({
    'number.base': 'Quantity change must be a number',
    'any.invalid': 'Quantity change cannot be zero'
  }),
  reason: Joi.string().min(1).max(255).required(),
  adjustmentType: Joi.string().valid('increase', 'decrease').required(),
  itemVariantId: itemVariantIdOpt
}).unknown(true);

const batchAllocationSchema = Joi.array().items(
  Joi.object({
    batchId: Joi.string().uuid().required(),
    quantity: Joi.number().positive().required(),
  })
);

const assembleKitSchema = Joi.object({
  compositeItemId: itemId,
  warehouseId,
  quantity,
  notes: Joi.string().max(500).optional(),
  outputBatchNumber: Joi.string().max(100).optional(),
  outputManufactureDate: Joi.string().max(30).optional(),
  outputExpiryDate: Joi.string().max(30).optional(),
  batchRuleId: Joi.string().uuid().optional(),
  componentBatchAllocations: Joi.object().pattern(
    Joi.string().uuid(),
    batchAllocationSchema
  ).optional(),
}).unknown(true);

const disassembleKitSchema = Joi.object({
  compositeItemId: itemId,
  warehouseId,
  quantity,
  notes: Joi.string().max(500).optional()
}).unknown(true);

const productionOperationDraftSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  operationType: Joi.string().valid('assemble', 'disassemble').required(),
  compositeItemId: itemId,
  warehouseId,
  quantity,
  notes: Joi.string().max(500).optional(),
  estimatedUnitCost: Joi.number().min(0).optional(),
  outputBatchNumber: Joi.string().max(100).optional(),
  outputManufactureDate: Joi.string().max(30).optional(),
  outputExpiryDate: Joi.string().max(30).optional(),
  batchRuleId: Joi.string().uuid().optional(),
  componentBatchAllocations: Joi.object().pattern(
    Joi.string().uuid(),
    batchAllocationSchema
  ).optional(),
}).unknown(true);

const productionOperationExecuteSchema = productionOperationDraftSchema.keys({
  execute: Joi.boolean().optional(),
});

const transferStockSchema = Joi.object({
  itemId,
  fromWarehouseId: Joi.string().uuid().required(),
  toWarehouseId: Joi.string().uuid().required(),
  quantity,
  transferId: Joi.string().uuid().optional(),
  itemVariantId: itemVariantIdOpt
}).unknown(true);

// Purchase Order schemas
const createPurchaseOrderSchema = Joi.object({
  poNumber: Joi.string().max(100).required(),
  vendorId: Joi.string().uuid().optional(),
  vendorName: Joi.string().max(255).required(),
  warehouseId: Joi.string().uuid().optional(),
  currency: Joi.string().length(3).default('USD'),
  exchangeRate: Joi.number().positive().default(1.0),
  orderDate: Joi.date().required(),
  expectedDate: Joi.date().optional(),
  notes: Joi.string().optional(),
  lines: Joi.array().items(Joi.object({
    itemId,
    warehouseId,
    quantity: quantity,
    unitCost: Joi.number().min(0).required(),
    taxRate: Joi.number().min(0).max(100).default(0),
    taxRateId: Joi.string().uuid().optional().allow(null),
    discountRate: Joi.number().min(0).max(100).default(0),
    expectedDate: Joi.date().optional()
  }).unknown(true)).min(1).required()
}).unknown(true);

// Sales Order schemas
const createSalesOrderSchema = Joi.object({
  soNumber: Joi.string().max(100).optional().allow('', null),
  customerId: Joi.string().uuid().optional(),
  customerName: Joi.string().max(255).required(),
  warehouseId: Joi.string().uuid().optional(),
  channel: Joi.string().max(100).default('direct'),
  currency: Joi.string().length(3).default('USD'),
  exchangeRate: Joi.number().positive().default(1.0),
  orderDate: Joi.alternatives().try(
    Joi.date(),
    Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)
  ).required(),
  expectedShipDate: Joi.alternatives().try(
    Joi.date(),
    Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)
  ).optional().allow(null),
  notes: Joi.string().optional(),
  customerAddress: Joi.object({
    street: Joi.string().optional(),
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    zip: Joi.string().optional(),
    country: Joi.string().optional(),
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional()
  }).optional(),
  shippingMethod: Joi.string().valid('standard', 'express', 'overnight').default('standard'),
  lines: Joi.array().items(Joi.object({
    itemId,
    warehouseId,
    quantity: quantity,
    unitPrice: Joi.number().min(0).required(),
    taxRate: Joi.number().min(0).max(100).default(0),
    taxRateId: Joi.string().uuid().optional().allow(null),
    weight: Joi.number().positive().optional()
  }).unknown(true)).min(1).required()
}).unknown(true);

// User management schemas
const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  mobile: Joi.string().pattern(/^[0-9+\-\s()]{10,20}$/).optional(),
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
  role: Joi.string().max(100).default('user'),
  permissions: Joi.object().optional(),
  warehouseAccess: Joi.array().items(Joi.string().uuid()).optional()
}).unknown(true);

const updateUserStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive').required()
});

const updateUserPermissionsSchema = Joi.object({
  permissions: Joi.object().required(),
  warehouseAccess: Joi.array().items(Joi.string().uuid()).optional(),
  role: Joi.string().max(100).optional()
}).unknown(true);

// GRN schemas
const createGRNSchema = Joi.object({
  grnNumber: Joi.string().max(100).required(),
  poId: Joi.string().uuid().required(),
  receiptDate: Joi.alternatives().try(
    Joi.date(),
    Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)
  ).required(),
  notes: Joi.string().optional(),
  lines: Joi.array().items(Joi.object({
    poLineId: Joi.string().uuid().required(),
    itemId: Joi.string().uuid().required(),
    warehouseId: Joi.string().uuid().required(),
    itemName: Joi.string().optional(),
    warehouseName: Joi.string().optional(),
    quantityOrdered: Joi.number().optional(),
    quantityReceived: Joi.number().positive().required(),
    unitCost: Joi.number().min(0).required(),
    qualityStatus: Joi.string().valid('accepted', 'rejected').default('accepted')
  }).unknown(true)).min(1).required()
}).unknown(true);

const createPutawaySchema = Joi.object({
  grnLineId: Joi.string().uuid().required(),
  binId: Joi.string().uuid().required(),
  quantity: Joi.number().positive().required(),
  notes: Joi.string().max(500).optional().allow('', null),
}).unknown(true);

// Purchase Order status update schema
const updatePOStatusSchema = Joi.object({
  status: Joi.string().valid('draft', 'pending_approval', 'approved', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled').required()
}).unknown(true);

// Sales Order status update schema
const updateSOStatusSchema = Joi.object({
  status: Joi.string().valid('draft', 'confirmed', 'partially_shipped', 'shipped', 'delivered', 'cancelled').required()
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

// Purchase Invoice schemas
const createPurchaseInvoiceSchema = Joi.object({
  invoiceNumber: Joi.string().max(100).allow('', null).optional(),
  vendorId: Joi.string().uuid().optional(),
  vendorName: Joi.string().max(255).required(),
  poId: Joi.string().uuid().optional(),
  grnId: Joi.string().uuid().optional(),
  invoiceDate: Joi.date().required(),
  dueDate: Joi.date().optional(),
  currency: Joi.string().length(3).default('USD'),
  exchangeRate: Joi.number().positive().default(1.0),
  reference: Joi.string().max(255).optional(),
  notes: Joi.string().optional(),
  lines: Joi.array().items(Joi.object({
    poLineId: Joi.string().uuid().optional(),
    grnLineId: Joi.string().uuid().optional(),
    itemId: Joi.string().uuid().allow(null).optional(),
    itemName: Joi.string().max(255).required(),
    quantity: Joi.number().positive().required(),
    unitCost: Joi.number().positive().required(),
    taxRate: Joi.number().min(0).max(100).default(0),
    discountRate: Joi.number().min(0).max(100).default(0)
  })).min(1).required(),
  totals: Joi.object().optional()
}).unknown(true);

// Sales Invoice schemas
const createSalesInvoiceSchema = Joi.object({
  invoiceNumber: Joi.string().max(100).allow('', null).optional(),
  customerId: Joi.string().uuid().required(),
  customerName: Joi.string().max(255).required(),
  soId: Joi.string().uuid().optional(),
  deliveryNoteId: Joi.string().uuid().optional(),
  warehouseId: Joi.string().uuid().optional(),
  invoiceDate: Joi.date().required(),
  dueDate: Joi.date().optional(),
  currency: Joi.string().length(3).default('USD'),
  exchangeRate: Joi.number().positive().default(1.0),
  reference: Joi.string().max(255).optional(),
  notes: Joi.string().optional(),
  lines: Joi.array().items(Joi.object({
    soLineId: Joi.string().uuid().optional(),
    deliveryLineId: Joi.string().uuid().optional(),
    warehouseId: Joi.string().uuid().optional(),
    itemId: Joi.string().uuid().optional().allow(null),
    itemName: Joi.string().max(255).required(),
    quantity: Joi.number().positive().required(),
    unitPrice: Joi.number().min(0).required(),
    taxRate: Joi.number().min(0).max(100).default(0),
    discountRate: Joi.number().min(0).max(100).default(0)
  })).min(1).required()
}).unknown(true);

// Third-party invoice (no inventory impact, manual lines)
const createThirdPartyInvoiceSchema = Joi.object({
  invoiceType: Joi.string().valid('sales', 'purchase', 'proforma').default('sales'),
  invoiceNumber: Joi.string().max(100).allow('', null).optional(),
  partyType: Joi.string().valid('customer', 'vendor', 'other').default('other'),
  partyId: Joi.string().uuid().optional().allow(null, ''),
  partyName: Joi.string().max(255).required(),
  partyGstin: Joi.string().max(20).allow('', null).optional(),
  partyAddress: Joi.string().allow('', null).optional(),
  partyAddresses: Joi.object({
    billingAddressId: Joi.string().allow(null).optional(),
    shippingAddressId: Joi.string().allow(null).optional(),
    billingAddress: Joi.object().optional(),
    shippingAddress: Joi.object().optional(),
    partyAddressSelection: Joi.object().optional(),
    bankDetails: Joi.object({
      bankName: Joi.string().allow('', null).optional(),
      accountHolder: Joi.string().allow('', null).optional(),
      accountNumber: Joi.string().allow('', null).optional(),
      ifscCode: Joi.string().allow('', null).optional(),
      branchName: Joi.string().allow('', null).optional(),
      accountType: Joi.string().allow('', null).optional(),
      swiftCode: Joi.string().allow('', null).optional(),
      iban: Joi.string().allow('', null).optional(),
    }).optional(),
  }).optional(),
  invoiceDate: Joi.alternatives().try(
    Joi.date(),
    Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)
  ).required(),
  dueDate: Joi.alternatives().try(
    Joi.date(),
    Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)
  ).optional().allow(null, ''),
  currency: Joi.string().length(3).default('INR'),
  exchangeRate: Joi.number().positive().default(1.0),
  reference: Joi.string().max(255).optional().allow('', null),
  notes: Joi.string().optional().allow('', null),
  status: Joi.string().valid('draft', 'posted').optional(),
  lines: Joi.array().items(Joi.object({
    description: Joi.string().max(500).allow('', null).optional(),
    itemName: Joi.string().max(500).allow('', null).optional(),
    hsnCode: Joi.string().max(20).allow('', null).optional(),
    unit: Joi.string().max(50).allow('', null).optional(),
    quantity: Joi.number().positive().required(),
    unitPrice: Joi.number().min(0).required(),
    taxRate: Joi.number().min(0).max(100).default(0),
    discountRate: Joi.number().min(0).max(100).default(0),
  }).or('description', 'itemName')).min(1).required(),
  totals: Joi.object().optional(),
  documentMeta: Joi.object().optional(),
}).unknown(true);

const updateThirdPartyInvoiceStatusSchema = Joi.object({
  status: Joi.string().valid('draft', 'posted', 'cancelled').required(),
});

// Invoice status update schemas
const updateInvoiceStatusSchema = Joi.object({
  status: Joi.string().valid('draft', 'posted', 'partially_paid', 'paid', 'cancelled').required()
});

// Invoice payment schemas
const createInvoicePaymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  paymentDate: Joi.alternatives().try(
    Joi.date(),
    Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)
  ).required(),
  paymentMethod: Joi.string().max(50).required(),
  reference: Joi.string().max(255).optional().allow('', null),
  notes: Joi.string().optional().allow('', null)
});

// Validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { stripUnknown: false });
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
    registerInstitutionSchema: registerinstitutionSchema,
    registerinstitutionSchema,
    loginSchema,
    createUserSchema,
    createItemSchema,
    updateItemSchema,
    createBomItemSchema,
    updateBomItemSchema,
    createWarehouseSchema,
    receiveStockSchema,
    reserveStockSchema,
    shipStockSchema,
    adjustStockSchema,
    assembleKitSchema,
    disassembleKitSchema,
    productionOperationDraftSchema,
    productionOperationExecuteSchema,
    transferStockSchema,
    createPurchaseOrderSchema,
    createSalesOrderSchema,
    createGRNSchema,
    createPutawaySchema,
    updatePOStatusSchema,
    updateSOStatusSchema,
    updateUserStatusSchema,
    updateUserPermissionsSchema,
    createAutomationRuleSchema,
    createPurchaseInvoiceSchema,
    createSalesInvoiceSchema,
    createThirdPartyInvoiceSchema,
    updateThirdPartyInvoiceStatusSchema,
    updateInvoiceStatusSchema,
    createInvoicePaymentSchema
  }
};