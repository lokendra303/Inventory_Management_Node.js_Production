const express = require('express');
const platformController = require('./platform.controller');
const { requirePlatformAuth } = require('./platform.middleware');

const router = express.Router();

router.post('/auth/login', platformController.login.bind(platformController));

router.get('/me', requirePlatformAuth, platformController.me.bind(platformController));
router.get('/stats', requirePlatformAuth, platformController.stats.bind(platformController));
router.get('/institutions/export', requirePlatformAuth, platformController.exportInstitutions.bind(platformController));
router.get('/institutions', requirePlatformAuth, platformController.listInstitutions.bind(platformController));
router.get('/institutions/:id', requirePlatformAuth, platformController.getInstitution.bind(platformController));
router.patch('/institutions/:id', requirePlatformAuth, platformController.updateInstitution.bind(platformController));
router.patch('/institutions/:id/status', requirePlatformAuth, platformController.updateInstitutionStatus.bind(platformController));

router.get('/plans/feature-options', requirePlatformAuth, platformController.planFeatureOptions.bind(platformController));
router.get('/plans', requirePlatformAuth, platformController.listPlans.bind(platformController));
router.post('/plans', requirePlatformAuth, platformController.createPlan.bind(platformController));
router.patch('/plans/:planId', requirePlatformAuth, platformController.updatePlan.bind(platformController));
router.get('/activity/recent-logins', requirePlatformAuth, platformController.recentLogins.bind(platformController));

module.exports = router;
