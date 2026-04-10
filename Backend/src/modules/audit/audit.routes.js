const express = require('express');
const auditController = require('./audit.controller');
const { requirePermission, requireAuth } = require('../auth/auth.middleware');

const router = express.Router();

// Audit trail and summary (admin only)
router.get('/trail',
  requirePermission('audit_view'),
  auditController.getAuditTrail
);

router.get('/summary',
  requirePermission('audit_view'),
  auditController.getAuditSummary
);

// Activity dashboard (admin only)
router.get('/dashboard',
  requirePermission('audit_view'),
  auditController.getActivityDashboard
);

// User activity (admin can view any user, users can view their own)
router.get('/users/:userId/activity',
  requirePermission('audit_view'),
  auditController.getUserActivity
);

// Current user's activity (any authenticated user)
router.get('/my-activity',
  requireAuth,
  auditController.getMyActivity
);

// Entity audit logs
router.get('/:entityType/:entityId',
  requirePermission('audit_view'),
  auditController.getEntityAuditLog
);

module.exports = router;
