const express = require('express');
const authController = require('../controllers/authController');
const { validate, schemas } = require('../utils/validation');
const { auditLog, requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register-tenant (PUBLIC - Creates company + admin user)
router.post('/register-tenant', 
  validate(schemas.registerTenantSchema),
  auditLog('tenant_registration'),
  authController.registerTenant
);

// POST /api/auth/login
router.post('/login', 
  validate(schemas.loginSchema),
  auditLog('user_login'),
  authController.login
);

// POST /api/auth/temp-login
router.post('/temp-login',
  auditLog('temp_access_login'),
  authController.tempLogin
);

// POST /api/auth/refresh
router.post('/refresh', authController.refreshToken);

// GET /api/auth/profile (PROTECTED)
router.get('/profile', requireAuth, authController.getProfile);

module.exports = router;