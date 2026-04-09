const express = require('express');
const authController = require('./auth.controller');
const { validate, schemas } = require('../../utils/validation');
const { auditLog, requireAuth, extractInstitutionContext } = require('./auth.middleware');

const router = express.Router();

// POST /api/auth/register-institution (PUBLIC - Creates company + admin user)
router.post('/register-institution', 
  validate(schemas.registerInstitutionSchema),
  auditLog('institution_registration'),
  authController.registerInstitution
);

// POST /api/auth/login
router.post('/login', 
  validate(schemas.loginSchema),
  auditLog('user_login'),
  authController.login
);

// POST /api/auth/verify-otp
router.post('/verify-otp',
  auditLog('otp_verified'),
  authController.verifyOtp
);

// POST /api/auth/temp-login
router.post('/temp-login',
  auditLog('temp_access_login'),
  authController.tempLogin
);

// POST /api/auth/refresh
router.post('/refresh', authController.refreshToken);

// POST /api/auth/heartbeat - called by frontend while user is active to silently refresh token
router.post('/heartbeat', authController.heartbeat);

// GET /api/auth/profile (PROTECTED)
router.get('/profile', extractInstitutionContext, requireAuth, authController.getProfile);

// POST /api/auth/extend-session - accepts near-expired tokens (no requireAuth)
router.post('/extend-session', authController.extendSession);

module.exports = router;