const express = require('express');
const router = express.Router();
const unitsController = require('./units.controller');
const { requireAuth } = require('../auth/auth.middleware');

router.use(requireAuth);

router.get('/', unitsController.getAll);
router.get('/:id', unitsController.getById);
router.post('/', unitsController.create);
router.put('/:id', unitsController.update);
router.delete('/:id', unitsController.delete);

module.exports = router;