const express = require('express');
const categoryController = require('../controllers/categoryController');
const { requirePermission, validateTenantConsistency, auditLog } = require('../middleware/auth');

const router = express.Router();

// GET /api/categories
router.get('/',
  requirePermission('category_view'),
  categoryController.getCategories
);

// POST /api/categories
router.post('/',
  requirePermission('category_management'),
  validateTenantConsistency,
  auditLog('category_created'),
  categoryController.createCategory
);

// GET /api/categories/tree
router.get('/tree',
  requirePermission('category_view'),
  categoryController.getCategoryTree
);

// GET /api/categories/:id
router.get('/:id',
  requirePermission('category_view'),
  categoryController.getCategory
);

// PUT /api/categories/:id
router.put('/:id',
  requirePermission('category_management'),
  validateTenantConsistency,
  auditLog('category_updated'),
  categoryController.updateCategory
);

// DELETE /api/categories/:id
router.delete('/:id',
  requirePermission('category_management'),
  auditLog('category_deleted'),
  categoryController.deleteCategory
);

module.exports = router;