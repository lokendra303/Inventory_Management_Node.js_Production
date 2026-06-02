const express = require('express');
const authController = require('./auth.controller');
const { requirePermission, auditLog } = require('./auth.middleware');
const { validate, schemas } = require('../../utils/validation');
const { checkLimit } = require('../../middleware/subscriptionGate');

const router = express.Router();

// GET /api/users
router.get('/', 
  requirePermission('user_management'),
  authController.getUsers
);

// POST /api/users/create
router.post('/create',
  requirePermission('user_management'),
  checkLimit('users'),
  validate(schemas.createUserSchema),
  auditLog('user_creation'),
  authController.createUser
);

// POST /api/users
router.post('/',
  requirePermission('user_management'),
  checkLimit('users'),
  validate(schemas.createUserSchema),
  auditLog('user_creation'),
  authController.createUser
);

// GET /api/users/profile
router.get('/profile', authController.getProfile);

// PUT /api/users/profile
router.put('/profile', 
  auditLog('profile_updated'),
  authController.updateProfile
);

// PUT /api/users/change-password
router.put('/change-password',
  auditLog('password_changed'),
  authController.changePassword
);

// PUT /api/users/account-settings
router.put('/account-settings',
  auditLog('account_settings_updated'),
  authController.updateAccountSettings
);

// POST /api/users/two-factor/send-otp — email OTP before enabling 2FA
router.post('/two-factor/send-otp',
  auditLog('two_factor_enable_otp_sent'),
  authController.sendTwoFactorEnableOtp
);

// POST /api/users/two-factor/verify-enable — confirm OTP and enable 2FA
router.post('/two-factor/verify-enable',
  auditLog('two_factor_enabled'),
  authController.verifyTwoFactorEnable
);

// POST /api/users/two-factor/send-disable-otp — email OTP before disabling 2FA
router.post('/two-factor/send-disable-otp',
  auditLog('two_factor_disable_otp_sent'),
  authController.sendTwoFactorDisableOtp
);

// POST /api/users/two-factor/verify-disable — confirm OTP and disable 2FA
router.post('/two-factor/verify-disable',
  auditLog('two_factor_disabled'),
  authController.verifyTwoFactorDisable
);

// PUT /api/users/:userId/permissions
router.put('/:userId/permissions', 
  requirePermission('user_management'),
  validate(schemas.updateUserPermissionsSchema),
  auditLog('user_permission_update'),
  authController.updateUserPermissions
);

// PUT /api/users/:userId/status
router.put('/:userId/status',
  validate(schemas.updateUserStatusSchema),
  requirePermission('user_management'),
  checkLimit('users'),
  auditLog('user_status_update'),
  authController.updateUserStatus
);

// POST /api/users/:userId/temp-access
router.post('/:userId/temp-access',
  requirePermission('user_management'),
  auditLog('temp_access_generated'),
  authController.generateTempAccess
);

module.exports = router;