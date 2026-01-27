const express = require('express');
const salesOrderController = require('../controllers/salesOrderController');
const { requirePermission, validateTenantConsistency, auditLog } = require('../middleware/auth');
const { validate, schemas } = require('../utils/validation');

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
  validateTenantConsistency,
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
  validateTenantConsistency,
  auditLog('sales_order_status_updated'),
  salesOrderController.updateSOStatus
);

module.exports = router;