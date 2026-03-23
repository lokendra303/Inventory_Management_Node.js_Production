const express = require('express');
const transferApprovalController = require('../../controllers/inventory/transferApprovalController');
const { requirePermission, validateInstitutionConsistency, auditLog } = require('../../middleware/auth');

const router = express.Router();

router.post('/',
  requirePermission('inventory_transfer'),
  validateInstitutionConsistency,
  auditLog('transfer_requested'),
  transferApprovalController.requestTransfer
);

router.get('/',
  requirePermission('inventory_view'),
  transferApprovalController.getTransferRequests
);

router.post('/:requestId/approve',
  requirePermission('inventory_management'),
  validateInstitutionConsistency,
  auditLog('transfer_approved'),
  transferApprovalController.approveTransfer
);

router.post('/:requestId/reject',
  requirePermission('inventory_management'),
  validateInstitutionConsistency,
  auditLog('transfer_rejected'),
  transferApprovalController.rejectTransfer
);

router.post('/:requestId/cancel',
  requirePermission('inventory_transfer'),
  validateInstitutionConsistency,
  auditLog('transfer_cancelled'),
  transferApprovalController.cancelTransferRequest
);

module.exports = router;
