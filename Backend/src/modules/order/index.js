const router = require('express').Router();

router.use('/purchase-orders', require('./purchaseOrder.routes'));
router.use('/sales-orders', require('./salesOrder.routes'));
router.use('/delivery-challans', require('./deliveryChallan.routes'));
router.use('/purchase-returns', require('./purchaseReturn.routes'));
router.use('/grn', require('./grn.routes'));

module.exports = router;
