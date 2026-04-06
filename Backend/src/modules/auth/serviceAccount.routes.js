const express = require('express');
const serviceAccountService = require('./serviceAccount.service');
const { requireAuth, requirePermission } = require('./auth.middleware');

const router = express.Router();

// GET /api/service-accounts - Get all service accounts for institution
router.get('/',
  requireAuth,
  requirePermission('api_key_management'),
  async (req, res) => {
    try {
      const accounts = await serviceAccountService.getServiceAccounts(req.institutionId);

      res.json({
        success: true,
        data: accounts
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch service accounts'
      });
    }
  }
);

// POST /api/service-accounts - Create new service account
router.post('/',
  requireAuth,
  requirePermission('api_key_management'),
  async (req, res) => {
    try {
      const { name, permissions = {}, expiresInDays = 365 } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Service account name is required'
        });
      }

      const account = await serviceAccountService.createServiceAccount(
        req.institutionId,
        { name, permissions, expiresInDays },
        req.user.userId
      );

      res.status(201).json({
        success: true,
        message: 'Service account created successfully',
        data: account
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// PUT /api/service-accounts/:id/revoke - Revoke service account
router.put('/:id/revoke',
  requireAuth,
  requirePermission('api_key_management'),
  async (req, res) => {
    try {
      const { id } = req.params;

      await serviceAccountService.revokeServiceAccount(req.institutionId, id);

      res.json({
        success: true,
        message: 'Service account revoked successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// POST /api/service-accounts/:id/rotate - Rotate service account token
router.post('/:id/rotate',
  requireAuth,
  requirePermission('api_key_management'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const account = await serviceAccountService.rotateServiceAccount(req.institutionId, id);

      res.json({
        success: true,
        message: 'Service account token rotated successfully',
        data: account
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// DELETE /api/service-accounts/:id - Delete service account
router.delete('/:id',
  requireAuth,
  requirePermission('api_key_management'),
  async (req, res) => {
    try {
      const { id } = req.params;

      await serviceAccountService.deleteServiceAccount(req.institutionId, id);

      res.json({
        success: true,
        message: 'Service account deleted successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

module.exports = router;
