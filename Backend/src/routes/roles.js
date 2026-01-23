const express = require('express');
const roleController = require('../controllers/roleController');
const { requirePermission, auditLog } = require('../middleware/auth');

const router = express.Router();

// GET /api/roles
router.get('/',
  requirePermission('user_management'),
  roleController.getRoles
);

// POST /api/roles
router.post('/',
  requirePermission('user_management'),
  auditLog('role_created'),
  roleController.createRole
);

// PUT /api/roles/:id
router.put('/:id',
  requirePermission('user_management'),
  auditLog('role_updated'),
  roleController.updateRole
);

// PUT /api/roles/:id/status
router.put('/:id/status',
  requirePermission('user_management'),
  auditLog('role_status_toggled'),
  roleController.toggleRoleStatus
);

module.exports = router;