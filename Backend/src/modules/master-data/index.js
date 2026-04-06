const router = require('express').Router();

router.use('/units', require('./units.routes'));
router.use('/dropdown-options', require('./dropdownOptions.routes'));
router.use('/data', require('./allData.routes'));

module.exports = router;
