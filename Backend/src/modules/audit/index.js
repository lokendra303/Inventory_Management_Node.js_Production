const router = require('express').Router();

router.use('/audit', require('./audit.routes'));

module.exports = router;
