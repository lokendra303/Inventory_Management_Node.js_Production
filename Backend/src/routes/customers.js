const express = require('express');
const customerController = require('../controllers/customerController');
const { requirePermission, validateTenantConsistency, auditLog } = require('../middleware/auth');

const router = express.Router();

// GET /api/customers
router.get('/',
  requirePermission('customer_view'),
  customerController.getCustomers
);

// POST /api/customers
router.post('/',
  requirePermission('customer_management'),
  validateTenantConsistency,
  auditLog('customer_created'),
  customerController.createCustomer
);

// GET /api/customers/:id
router.get('/:id',
  requirePermission('customer_view'),
  customerController.getCustomer
);

// PUT /api/customers/:id
router.put('/:id',
  requirePermission('customer_management'),
  validateTenantConsistency,
  auditLog('customer_updated'),
  customerController.updateCustomer
);

// GET /api/customers/:id/performance
router.get('/:id/performance',
  requirePermission('customer_view'),
  customerController.getCustomerPerformance
);

// POST /api/customers/:customerId/bank-details
router.post('/:customerId/bank-details',
  requirePermission('customer_management'),
  validateTenantConsistency,
  auditLog('customer_bank_details_added'),
  customerController.addBankDetails
);

// GET /api/customers/:customerId/bank-details
router.get('/:customerId/bank-details',
  requirePermission('customer_view'),
  customerController.getBankDetails
);

// PUT /api/customers/:customerId/bank-details/:bankDetailId
router.put('/:customerId/bank-details/:bankDetailId',
  requirePermission('customer_management'),
  validateTenantConsistency,
  auditLog('customer_bank_details_updated'),
  customerController.updateBankDetails
);

// DELETE /api/customers/:customerId/bank-details/:bankDetailId
router.delete('/:customerId/bank-details/:bankDetailId',
  requirePermission('customer_management'),
  validateTenantConsistency,
  auditLog('customer_bank_details_deleted'),
  customerController.deleteBankDetails
);

module.exports = router;