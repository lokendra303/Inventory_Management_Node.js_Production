const router = require('express').Router();

router.use('/inventory', require('./inventory.routes'));
router.use('/inventory', require('./batchSerial.routes'));
router.use('/reorder-levels', require('./reorderLevel.routes'));
router.use('/stock-counts', require('./stockCount.routes'));
router.use('/transfer-approvals', require('./transferApproval.routes'));

module.exports = router;
