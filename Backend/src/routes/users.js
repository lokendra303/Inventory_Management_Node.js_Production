const express = require('express');
const authController = require('../controllers/authController');
const { requirePermission, auditLog } = require('../middleware/auth');
const { validate, schemas } = require('../utils/validation');

const router = express.Router();

// GET /api/users
router.get('/', 
  requirePermission('user_management'),
  authController.getUsers
);

// POST /api/users/create (PROTECTED - Create user within existing tenant)
router.post('/create', 
  requirePermission('user_management'),
  validate(schemas.createUserSchema),
  auditLog('user_creation'),
  authController.createUser
);

// POST /api/users (PROTECTED - Create user within existing tenant)
router.post('/', 
  requirePermission('user_management'),
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