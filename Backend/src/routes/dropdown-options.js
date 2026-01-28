const express = require('express');
const db = require('../database/connection');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get dropdown options
router.get('/:type', requirePermission('item_view'), async (req, res) => {
  try {
    const { type } = req.params;
    const options = await db.query(
      'SELECT options FROM dropdown_options WHERE tenant_id = ? AND type = ?',
      [req.tenantId, type]
    );
    
    if (options.length > 0) {
      res.json({
        success: true,
        data: JSON.parse(options[0].options)
      });
    } else {
      res.json({
        success: true,
        data: []
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch options'
    });
  }
});

// Save dropdown options
router.post('/:type', requirePermission('item_management'), async (req, res) => {
  try {
    const { type } = req.params;
    const { options } = req.body;
    
    await db.query(
      `INSERT INTO dropdown_options (tenant_id, type, options) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE options = VALUES(options)`,
      [req.tenantId, type, JSON.stringify(options)]
    );
    
    res.json({
      success: true,
      message: 'Options saved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to save options'
    });
  }
});

module.exports = router;