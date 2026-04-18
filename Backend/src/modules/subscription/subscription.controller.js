const svc = require('./subscription.service');

const wrap = fn => async (req, res) => {
  try { res.json({ success: true, data: await fn(req) }); }
  catch (e) {
    if (e.code === 'DOWNGRADE_BLOCKED') {
      return res.status(422).json({
        success: false,
        error: 'DOWNGRADE_BLOCKED',
        conflicts: e.conflicts,
        planName: e.planName,
      });
    }
    res.status(400).json({ success: false, error: e.message });
  }
};

module.exports = {
  getPlans:                  wrap(() => svc.getPlans()),
  getSubscription:           wrap(req => svc.getSubscription(req.institutionId)),
  getUsage:                  wrap(req => svc.getUsage(req.institutionId)),
  createPaymentOrder:        wrap(req => svc.createPaymentOrder(req.institutionId, req.body)),
  verifyAndActivate:         wrap(req => svc.verifyAndActivate(req.institutionId, req.body)),
  upgradePlan:               wrap(req => svc.upgradePlan(req.institutionId, req.body)),
  cancelSubscription:        wrap(req => svc.cancelSubscription(req.institutionId, req.body)),
  renewSubscription:         wrap(req => svc.renewSubscription(req.institutionId, req.body)),
  getBillingHistory:         wrap(req => svc.getBillingHistory(req.institutionId)),
  checkLimit:                wrap(req => svc.checkLimit(req.institutionId, req.params.resource)),
  checkFeature:              wrap(req => svc.checkFeature(req.institutionId, req.params.feature)),
  getDowngradePreview:       wrap(req => svc.getDowngradePreview(req.institutionId, req.params.planId)),
  downgradeWithDeactivation: wrap(req => svc.downgradeWithDeactivation(req.institutionId, req.body)),
};
