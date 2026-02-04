const express = require('express');
const router = express.Router();
const manufacturerController = require('../controllers/manufacturerController');
const { requireAuth } = require('../middleware/auth');

// All routes require authentication
router.use(requireAuth);

// GET /api/manufacturers - Get all manufacturers
router.get('/', manufacturerController.getAll);

// GET /api/manufacturers/:id - Get manufacturer by ID
router.get('/:id', manufacturerController.getById);

// POST /api/manufacturers - Create new manufacturer
router.post('/', manufacturerController.create);

// PUT /api/manufacturers/:id - Update manufacturer
router.put('/:id', manufacturerController.update);

// DELETE /api/manufacturers/:id - Delete manufacturer
router.delete('/:id', manufacturerController.delete);

module.exports = router;