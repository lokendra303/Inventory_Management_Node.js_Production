const express = require('express');
const putawayController = require('./putaway.controller');
const { requirePermission, validateInstitutionConsistency, auditLog } = require('../auth/auth.middleware');
const { validate, schemas } = require('../../utils/validation');

const router = express.Router();

// GET /api/putaways/pending
router.get('/pending',
  requirePermission('inventory_view'),
  putawayController.getPendingPutaways
);

// GET /api/putaways/history
router.get('/history',
  requirePermission('inventory_view'),
  putawayController.getPutawayHistory
);

// POST /api/putaways
router.post('/',
  validate(schemas.createPutawaySchema),
  requirePermission('inventory_receive'),
  validateInstitutionConsistency,
  auditLog('putaway_completed'),
  putawayController.completePutaway
);

module.exports = router;
