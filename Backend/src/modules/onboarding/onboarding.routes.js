const express = require('express');
const ctrl = require('./onboarding.controller');
const router = express.Router();

router.get('/',             ctrl.getProgress);
router.post('/complete',    ctrl.completeStep);
router.post('/dismiss',     ctrl.dismiss);

module.exports = router;
