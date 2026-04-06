const router = require('express').Router();

router.use('/documents', require('./document.routes'));

module.exports = router;
