const express = require('express');
const router = express.Router();
const unitsController = require('../../controllers/unitsController');
const { requireAuth } = require('../../middleware/auth');

router.use(requireAuth);

router.get('/', unitsController.getAll);
router.get('/:id', unitsController.getById);
router.post('/', unitsController.create);
router.put('/:id', unitsController.update);
router.delete('/:id', unitsController.delete);

module.exports = router;