const express = require('express');
const platformController = require('./platform.controller');
const { requirePlatformAuth } = require('./platform.middleware');

const router = express.Router();

router.get('/auth/setup-status', platformController.setupStatus.bind(platformController));
router.post('/auth/setup', platformController.setup.bind(platformController));
router.post('/auth/login', platformController.login.bind(platformController));
router.post('/auth/verify-login-otp', platformController.verifyLoginOtp.bind(platformController));
router.post('/auth/forgot-password', platformController.forgotPassword.bind(platformController));
router.post('/auth/verify-reset-otp', platformController.verifyResetOtp.bind(platformController));
router.post('/auth/reset-password', platformController.resetPassword.bind(platformController));

router.get('/me', requirePlatformAuth, platformController.me.bind(platformController));
router.patch('/profile', requirePlatformAuth, platformController.updateProfile.bind(platformController));
router.post('/profile/change-password', requirePlatformAuth, platformController.changePassword.bind(platformController));
router.post('/profile/two-factor/send-enable-otp', requirePlatformAuth, platformController.sendTwoFactorEnableOtp.bind(platformController));
router.post('/profile/two-factor/verify-enable', requirePlatformAuth, platformController.verifyTwoFactorEnable.bind(platformController));
router.post('/profile/two-factor/send-disable-otp', requirePlatformAuth, platformController.sendTwoFactorDisableOtp.bind(platformController));
router.post('/profile/two-factor/verify-disable', requirePlatformAuth, platformController.verifyTwoFactorDisable.bind(platformController));
router.get('/stats', requirePlatformAuth, platformController.stats.bind(platformController));
router.get('/institutions/export', requirePlatformAuth, platformController.exportInstitutions.bind(platformController));
router.get('/institutions', requirePlatformAuth, platformController.listInstitutions.bind(platformController));
router.get('/institutions/:id', requirePlatformAuth, platformController.getInstitution.bind(platformController));
router.get('/institutions/:id/audit', requirePlatformAuth, platformController.getInstitutionAudit.bind(platformController));
router.patch('/institutions/:id', requirePlatformAuth, platformController.updateInstitution.bind(platformController));
router.patch('/institutions/:id/subscription', requirePlatformAuth, platformController.assignInstitutionSubscription.bind(platformController));
router.patch('/institutions/:id/status', requirePlatformAuth, platformController.updateInstitutionStatus.bind(platformController));

router.get('/plans/feature-options', requirePlatformAuth, platformController.planFeatureOptions.bind(platformController));
router.get('/plans', requirePlatformAuth, platformController.listPlans.bind(platformController));
router.post('/plans', requirePlatformAuth, platformController.createPlan.bind(platformController));
router.patch('/plans/:planId', requirePlatformAuth, platformController.updatePlan.bind(platformController));
router.get('/activity/recent-logins', requirePlatformAuth, platformController.recentLogins.bind(platformController));
router.get('/activity/active-sessions', requirePlatformAuth, platformController.activeSessions.bind(platformController));
router.post('/activity/sessions/:sessionId/revoke', requirePlatformAuth, platformController.revokeSession.bind(platformController));
router.post('/activity/users/:userId/revoke-sessions', requirePlatformAuth, platformController.revokeUserSessions.bind(platformController));
router.post('/activity/institutions/:id/revoke-sessions', requirePlatformAuth, platformController.revokeInstitutionSessions.bind(platformController));

router.get('/subscription-requests', requirePlatformAuth, platformController.listSubscriptionRequests.bind(platformController));
router.post('/subscription-requests/:id/approve', requirePlatformAuth, platformController.approveSubscriptionRequest.bind(platformController));
router.post('/subscription-requests/:id/reject', requirePlatformAuth, platformController.rejectSubscriptionRequest.bind(platformController));

module.exports = router;
