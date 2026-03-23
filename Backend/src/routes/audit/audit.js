const express = require('express');
const auditController = require('../../controllers/audit/auditController');
const { requirePermission } = require('../../middleware/auth');

const router = express.Router();

router.get('/trail',
  requirePermission('audit_view'),
  auditController.getAuditTrail
);

router.get('/summary',
  requirePermission('audit_view'),
  auditController.getAuditSummary
);

router.get('/:entityType/:entityId',
  requirePermission('audit_view'),
  auditController.getEntityAuditLog
);

module.exports = router;
