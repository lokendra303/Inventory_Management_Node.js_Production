const express = require('express');
const { generateBearerToken } = require('../middleware/bearerToken');
const db = require('../database/connection');
const { v4: uuidv4 } = require('uuid');
const { requireAuth, requirePermission } = require('../middleware/auth');

const router = express.Router();

// GET /api/bearer-tokens - Get all Bearer tokens for institution
router.get('/',
  requireAuth,
  requirePermission('api_key_management'),
  async (req, res) => {
    try {
      const tokens = await db.query(
        'SELECT id, name, permissions, status, expires_at, created_at, last_used_at, usage_count FROM bearer_tokens WHERE institution_id = ? ORDER BY created_at DESC',
        [req.institutionId]
      );

      res.json({
        success: true,
        data: tokens
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch Bearer tokens'
      });
    }
  }
);

// POST /api/bearer-tokens - Create new Bearer token
router.post('/',
  requireAuth,
  requirePermission('api_key_management'),
  async (req, res) => {
    try {
      const { name, permissions = {}, expiresInDays = null } = req.body;
      const tokenId = uuidv4();
      const tokenValue = generateBearerToken();
      
      let expiresAt = null;
      if (expiresInDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      }

      await db.query(
        'INSERT INTO bearer_tokens (id, institution_id, name, token_value, permissions, status, expires_at, created_by) VALUES (?, ?, ?, ?, ?, "active", ?, ?)',
        [tokenId, req.institutionId, name, tokenValue, JSON.stringify(permissions), expiresAt, req.user.userId]
      );

      res.status(201).json({
        success: true,
        message: 'Bearer token created successfully',
        data: {
          id: tokenId,
          name,
          token: tokenValue,
          permissions,
          expiresAt
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

// PUT /api/bearer-tokens/:id/status - Toggle Bearer token status
router.put('/:id/status',
  requireAuth,
  requirePermission('api_key_management'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      await db.query(
        'UPDATE bearer_tokens SET status = ? WHERE id = ? AND institution_id = ?',
        [status, id, req.institutionId]
      );

      res.json({
        success: true,
        message: 'Bearer token status updated'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// DELETE /api/bearer-tokens/:id - Delete Bearer token
router.delete('/:id',
  requireAuth,
  requirePermission('api_key_management'),
  async (req, res) => {
    try {
      const { id } = req.params;

      await db.query(
        'DELETE FROM bearer_tokens WHERE id = ? AND institution_id = ?',
        [id, req.institutionId]
      );

      res.json({
        success: true,
        message: 'Bearer token deleted'
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