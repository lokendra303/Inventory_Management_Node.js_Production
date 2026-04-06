const router = require('express').Router();

router.use('/reports', require('./reports.routes'));
router.use('/analytics', require('./analytics.routes'));
router.use('/profit-loss', require('./profitLoss.routes'));

module.exports = router;
