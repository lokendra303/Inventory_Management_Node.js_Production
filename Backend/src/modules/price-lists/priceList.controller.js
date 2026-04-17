const svc = require('./priceList.service');

const wrap = fn => async (req, res) => {
  try { res.json({ success: true, data: await fn(req) }); }
  catch (e) { res.status(400).json({ success: false, error: e.message }); }
};

module.exports = {
  getAll:      wrap(req => svc.getAll(req.institutionId)),
  getOne:      wrap(req => svc.getOne(req.institutionId, req.params.id)),
  create:      wrap(req => svc.create(req.institutionId, req.body)),
  update:      wrap(req => svc.update(req.institutionId, req.params.id, req.body)),
  delete:      wrap(req => svc.delete(req.institutionId, req.params.id)),
  upsertItem:  wrap(req => svc.upsertItem(req.params.id, req.body)),
  removeItem:  wrap(req => svc.removeItem(req.params.id, req.params.itemId)),
  getItemPrice:wrap(req => svc.getPriceForItem(req.institutionId, req.params.id, req.params.itemId)),
};
