const express = require('express');
const { generateApiKey } = require('../middleware/apiKey');
const db = require('../database/connection');
const { v4: uuidv4 } = require('uuid');
const { requireAuth, requirePermission } = require('../middleware/auth');

const router = express.Router();

// GET /api/api-keys - Get all API keys for tenant
router.get('/',
  requireAuth,
  requirePermission('api_key_management'),
  async (req, res) => {
    try {
      const keys = await db.query(
        'SELECT id, name, permissions, status, created_at, last_used_at, usage_count FROM api_keys WHERE tenant_id = ? ORDER BY created_at DESC',
        [req.tenantId]
      );

      res.json({
        success: true,
        data: keys
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch API keys'
      });
    }
  }
);

// POST /api/api-keys - Create new API key
router.post('/',
  requireAuth,
  requirePermission('api_key_management'),
  async (req, res) => {
    try {
      const { name, permissions = {} } = req.body;
      const keyId = uuidv4();
      const keyValue = generateApiKey();

      await db.query(
        'INSERT INTO api_keys (id, tenant_id, name, key_value, permissions, status, created_by) VALUES (?, ?, ?, ?, ?, "active", ?)',
        [keyId, req.tenantId, name, keyValue, JSON.stringify(permissions), req.user.userId]
      );

      res.status(201).json({
        success: true,
        message: 'API key created successfully',
        data: {
          id: keyId,
          name,
          key: keyValue,
          permissions
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// PUT /api/api-keys/:id/status - Toggle API key status
router.put('/:id/status',
  requireAuth,
  requirePermission('api_key_management'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      await db.query(
        'UPDATE api_keys SET status = ? WHERE id = ? AND tenant_id = ?',
        [status, id, req.tenantId]
      );

      res.json({
        success: true,
        message: 'API key status updated'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// DELETE /api/api-keys/:id - Delete API key
router.delete('/:id',
  requireAuth,
  requirePermission('api_key_management'),
  async (req, res) => {
    try {
      const { id } = req.params;

      await db.query(
        'DELETE FROM api_keys WHERE id = ? AND tenant_id = ?',
        [id, req.tenantId]
      );

      res.json({
        success: true,
        message: 'API key deleted'
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