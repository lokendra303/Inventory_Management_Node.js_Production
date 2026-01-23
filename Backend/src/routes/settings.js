const express = require('express');
const settingsController = require('../controllers/settingsController');
const { auditLog } = require('../middleware/auth');

const router = express.Router();

// GET /api/settings
router.get('/',
  settingsController.getTenantSettings
);

// PUT /api/settings
router.put('/',
  auditLog('settings_updated'),
  settingsController.updateTenantSettings
);

module.exports = router;