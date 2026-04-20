const platformAdminService = require('./platformAdmin.service');
const logger = require('../../utils/logger');

class PlatformController {
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await platformAdminService.login(email, password);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.warn('Platform login failed', { email: req.body?.email, error: error.message });
      res.status(401).json({ success: false, error: error.message });
    }
  }

  async me(req, res) {
    res.json({ success: true, data: { admin: req.platformAdmin } });
  }

  async stats(req, res) {
    try {
      const data = await platformAdminService.getDashboardStats();
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Platform stats error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async listInstitutions(req, res) {
    try {
      const { page, limit, search, status } = req.query;
      const result = await platformAdminService.listInstitutions({ page, limit, search, status });
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Platform list institutions error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getInstitution(req, res) {
    try {
      const row = await platformAdminService.getInstitution(req.params.id);
      if (!row) return res.status(404).json({ success: false, error: 'Institution not found' });
      res.json({ success: true, data: row });
    } catch (error) {
      logger.error('Platform get institution error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateInstitutionStatus(req, res) {
    try {
      const { status } = req.body;
      await platformAdminService.setInstitutionStatus(req.params.id, status);
      res.json({ success: true, message: 'Institution updated' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = new PlatformController();
