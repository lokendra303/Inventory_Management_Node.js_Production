const express = require('express');
const platformController = require('./platform.controller');
const { requirePlatformAuth } = require('./platform.middleware');

const router = express.Router();

router.post('/auth/login', platformController.login.bind(platformController));

router.get('/me', requirePlatformAuth, platformController.me.bind(platformController));
router.get('/stats', requirePlatformAuth, platformController.stats.bind(platformController));
router.get('/institutions', requirePlatformAuth, platformController.listInstitutions.bind(platformController));
router.get('/institutions/:id', requirePlatformAuth, platformController.getInstitution.bind(platformController));
router.patch('/institutions/:id/status', requirePlatformAuth, platformController.updateInstitutionStatus.bind(platformController));

module.exports = router;
