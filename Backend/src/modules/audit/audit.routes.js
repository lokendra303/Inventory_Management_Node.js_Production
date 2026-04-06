const express = require('express');
const auditController = require('./audit.controller');
const { requirePermission } = require('../auth/auth.middleware');

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
