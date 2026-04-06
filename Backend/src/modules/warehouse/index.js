const router = require('express').Router();

router.use('/warehouses', require('./warehouse.routes'));
router.use('/warehouse-types', require('./warehouseType.routes'));

module.exports = router;
