const svc = require('./tax.service');

const wrap = fn => async (req, res) => {
  try { res.json({ success: true, data: await fn(req) }); }
  catch (e) { res.status(400).json({ success: false, error: e.message }); }
};

module.exports = {
  getTaxGroups:   wrap(req => svc.getTaxGroups(req.institutionId)),
  createTaxGroup: wrap(req => svc.createTaxGroup(req.institutionId, req.body)),
  updateTaxGroup: wrap(req => svc.updateTaxGroup(req.institutionId, req.params.id, req.body)),
  deleteTaxGroup: wrap(req => svc.deleteTaxGroup(req.institutionId, req.params.id)),

  getTaxRates:   wrap(req => svc.getTaxRates(req.institutionId, req.query.groupId)),
  getTaxRate:    wrap(req => svc.getTaxRateById(req.institutionId, req.params.id)),
  createTaxRate: wrap(req => svc.createTaxRate(req.institutionId, req.body)),
  updateTaxRate: wrap(req => svc.updateTaxRate(req.institutionId, req.params.id, req.body)),
  deleteTaxRate: wrap(req => svc.deleteTaxRate(req.institutionId, req.params.id)),
};
