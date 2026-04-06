const router = require('express').Router();

router.use('/settings', require('./settings.routes'));
router.use('/company-settings', require('./companySettings.routes'));

module.exports = router;
