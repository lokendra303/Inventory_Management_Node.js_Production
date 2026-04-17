const svc = require('./workflow.service');

const wrap = fn => async (req, res) => {
  try { res.json({ success: true, data: await fn(req) }); }
  catch (e) { res.status(400).json({ success: false, error: e.message }); }
};

module.exports = {
  getRules:   wrap(req => svc.getRules(req.institutionId)),
  getRule:    wrap(req => svc.getRule(req.institutionId, req.params.id)),
  createRule: wrap(req => svc.createRule(req.institutionId, req.user.userId, req.body)),
  updateRule: wrap(req => svc.updateRule(req.institutionId, req.params.id, req.body)),
  deleteRule: wrap(req => svc.deleteRule(req.institutionId, req.params.id)),
  toggleRule: wrap(req => svc.toggleRule(req.institutionId, req.params.id)),
  getLogs:    wrap(req => svc.getLogs(req.institutionId, req.query.ruleId)),
};
