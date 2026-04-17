const svc = require('./onboarding.service');

module.exports = {
  async getProgress(req, res) {
    try {
      const data = await svc.autoDetect(req.institutionId);
      res.json({ success: true, data });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  },
  async completeStep(req, res) {
    try {
      const data = await svc.completeStep(req.institutionId, req.body.stepId);
      res.json({ success: true, data });
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
  },
  async dismiss(req, res) {
    try {
      await svc.dismiss(req.institutionId);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  },
};
