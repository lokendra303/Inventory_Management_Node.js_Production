const express = require('express');
const c = require('./subscription.controller');
const router = express.Router();

router.get('/plans',                        c.getPlans);
router.get('/',                             c.getSubscription);
router.get('/usage',                        c.getUsage);
router.get('/billing-history',              c.getBillingHistory);
router.get('/upgrade-requests',             c.listMyUpgradeRequests);
router.post('/upgrade-requests',            c.createUpgradeRequest);
router.post('/payment/create-order',        c.createPaymentOrder);
router.post('/payment/verify',              c.verifyAndActivate);
router.post('/upgrade',                     c.upgradePlan);
router.post('/cancel',                      c.cancelSubscription);
router.post('/renew',                       c.renewSubscription);
router.get('/downgrade-preview/:planId',    c.getDowngradePreview);
router.post('/downgrade-with-deactivation', c.downgradeWithDeactivation);
router.get('/check/limit/:resource',        c.checkLimit);
router.get('/check/feature/:feature',       c.checkFeature);

module.exports = router;
