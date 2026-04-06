const router = require('express').Router();

router.use('/notifications', require('./notification.routes'));

module.exports = router;
