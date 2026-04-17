const express = require('express');
const c = require('./subscription.controller');
const router = express.Router();

router.get('/plans',       c.getPlans);
router.get('/',            c.getSubscription);
router.get('/usage',       c.getUsage);
router.post('/upgrade',    c.upgradePlan);

module.exports = router;
