const express = require('express');
const router = express.Router();
const brandController = require('../../controllers/brandController');
const { requireAuth } = require('../../middleware/auth');

// All routes require authentication
router.use(requireAuth);

// GET /api/brands - Get all brands
router.get('/', brandController.getAll);

// GET /api/brands/:id - Get brand by ID
router.get('/:id', brandController.getById);

// POST /api/brands - Create new brand
router.post('/', brandController.create);

// PUT /api/brands/:id - Update brand
router.put('/:id', brandController.update);

// DELETE /api/brands/:id - Delete brand
router.delete('/:id', brandController.delete);

module.exports = router;