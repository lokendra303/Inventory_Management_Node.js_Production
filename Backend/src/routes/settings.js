const express = require('express');
const settingsController = require('../controllers/settingsController');
const { auditLog } = require('../middleware/auth');

const router = express.Router();

// GET /api/settings
router.get('/',
  settingsController.getInstitutionSettings
);

// PUT /api/settings
router.put('/',
  auditLog('settings_updated'),
  settingsController.updateInstitutionSettings
);

module.exports = router;