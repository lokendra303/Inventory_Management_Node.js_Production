const router = require('express').Router();

router.use('/invoices', require('./invoice.routes'));
router.use('/purchase-invoices', require('./purchaseInvoice.routes'));
router.use('/sales-invoices', require('./salesInvoice.routes'));

module.exports = router;
