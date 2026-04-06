const router = require('express').Router();

router.use('/items', require('./item.routes'));
router.use('/categories', require('./category.routes'));
router.use('/brands', require('./brand.routes'));
router.use('/manufacturers', require('./manufacturer.routes'));
router.use('/vendors', require('./vendor.routes'));
router.use('/customers', require('./customer.routes'));

module.exports = router;
