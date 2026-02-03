const express = require('express');
const authController = require('../controllers/authController');
const { validate, schemas } = require('../utils/validation');
const { auditLog, requireAuth } = require('../middleware/auth');

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

// POST /api/auth/temp-login
router.post('/temp-login',
  auditLog('temp_access_login'),
  authController.tempLogin
);

// POST /api/auth/refresh
router.post('/refresh', authController.refreshToken);

// GET /api/auth/profile (PROTECTED)
router.get('/profile', requireAuth, authController.getProfile);

// POST /api/auth/extend-session (PROTECTED)
router.post('/extend-session', requireAuth, authController.extendSession);

module.exports = router;