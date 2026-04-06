const express = require('express');
const deliveryChallanController = require('./deliveryChallan.controller');
const { requirePermission, validateInstitutionConsistency, auditLog } = require('../auth/auth.middleware');

const router = express.Router();

router.post('/',
  requirePermission('sales_management'),
  validateInstitutionConsistency,
  auditLog('delivery_challan_created'),
  deliveryChallanController.createChallan
);

router.get('/',
  requirePermission('sales_view'),
  deliveryChallanController.getChallans
);

router.get('/:challanId',
  requirePermission('sales_view'),
  deliveryChallanController.getChallan
);

router.put('/:challanId/status',
  requirePermission('sales_management'),
  validateInstitutionConsistency,
  auditLog('delivery_challan_status_updated'),
  deliveryChallanController.updateStatus
);

router.post('/:challanId/convert-to-invoice',
  requirePermission('sales_management'),
  validateInstitutionConsistency,
  auditLog('challan_converted_to_invoice'),
  deliveryChallanController.convertToInvoice
);

module.exports = router;
