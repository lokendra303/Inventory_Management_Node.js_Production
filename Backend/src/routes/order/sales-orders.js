const express = require('express');
const salesOrderController = require('../../controllers/salesOrderController');
const { requirePermission, validateInstitutionConsistency, auditLog } = require('../../middleware/auth');
const { validate, schemas } = require('../../utils/validation');

const router = express.Router();

// GET /api/sales-orders
router.get('/',
  requirePermission('sales_view'),
  salesOrderController.getSalesOrders
);

// POST /api/sales-orders
router.post('/',
  validate(schemas.createSalesOrderSchema),
  requirePermission('sales_management'),
  validateInstitutionConsistency,
  auditLog('sales_order_created'),
  salesOrderController.createSalesOrder
);

// GET /api/sales-orders/:id
router.get('/:id',
  requirePermission('sales_view'),
  salesOrderController.getSalesOrder
);

// PUT /api/sales-orders/:id/status
router.put('/:id/status',
  validate(schemas.updateSOStatusSchema),
  requirePermission('sales_management'),
  validateInstitutionConsistency,
  auditLog('sales_order_status_updated'),
  salesOrderController.updateSOStatus
);

// POST /api/sales-orders/:id/confirm - Enhanced confirmation endpoint
router.post('/:id/confirm',
  requirePermission('sales_management'),
  validateInstitutionConsistency,
  auditLog('sales_order_confirmed'),
  salesOrderController.confirmSalesOrder
);

// GET /api/sales-orders/:id/confirmation-summary
router.get('/:id/confirmation-summary',
  requirePermission('sales_view'),
  salesOrderController.getConfirmationSummary
);

// POST /api/sales-orders/warehouse-recommendations
router.post('/warehouse-recommendations',
  requirePermission('sales_view'),
  salesOrderController.getWarehouseRecommendations
);

// POST /api/sales-orders/stock-availability
router.post('/stock-availability',
  requirePermission('sales_view'),
  salesOrderController.getStockAvailability
);

// POST /api/sales-orders/calculate-cost
router.post('/calculate-cost',
  requirePermission('sales_view'),
  salesOrderController.calculateOrderCost
);

// GET /api/sales-orders/:id/pdf
router.get('/:id/pdf',
  requirePermission('sales_view'),
  salesOrderController.downloadSOPDF
);

module.exports = router;