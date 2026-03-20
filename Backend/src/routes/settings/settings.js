const express = require('express');
const settingsController = require('../../controllers/settings/settingsController');
const { extractInstitutionContext, auditLog } = require('../../middleware/auth');

const router = express.Router();

// GET /api/settings
router.get('/',
  extractInstitutionContext,
  settingsController.getInstitutionSettings
);

// PUT /api/settings
router.put('/',
  extractInstitutionContext,
  auditLog('settings_updated'),
  settingsController.updateInstitutionSettings
);

module.exports = router;