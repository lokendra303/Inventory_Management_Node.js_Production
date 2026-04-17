const svc = require('./subscription.service');

const wrap = fn => async (req, res) => {
  try { res.json({ success: true, data: await fn(req) }); }
  catch (e) { res.status(400).json({ success: false, error: e.message }); }
};

module.exports = {
  getPlans:       wrap(() => svc.getPlans()),
  getSubscription:wrap(req => svc.getSubscription(req.institutionId)),
  getUsage:       wrap(req => svc.getUsage(req.institutionId)),
  upgradePlan:    wrap(req => svc.upgradePlan(req.institutionId, req.body)),
};
