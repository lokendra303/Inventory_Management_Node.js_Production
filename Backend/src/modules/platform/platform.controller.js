const platformAdminService = require('./platformAdmin.service');
const subscriptionService = require('../subscription/subscription.service');
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
      const { status, notifyTo, notificationMessage, suspensionReason } = req.body || {};
      const extra = await platformAdminService.setInstitutionStatus(req.params.id, status, {
        notifyTo,
        notificationMessage: notificationMessage ?? suspensionReason,
      });
      res.json({ success: true, message: 'Institution updated', ...extra });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async updateInstitution(req, res) {
    try {
      const data = await platformAdminService.updateInstitutionProfile(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async assignInstitutionSubscription(req, res) {
    try {
      const data = await platformAdminService.assignInstitutionSubscription(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (error) {
      if (error.code === 'DOWNGRADE_BLOCKED') {
        return res.status(422).json({
          success: false,
          error: 'DOWNGRADE_BLOCKED',
          conflicts: error.conflicts,
          planName: error.planName,
        });
      }
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async listPlans(req, res) {
    try {
      const data = await platformAdminService.listSubscriptionPlans();
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Platform list plans error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async planFeatureOptions(req, res) {
    try {
      const data = platformAdminService.getPlanFeatureCatalog();
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async createPlan(req, res) {
    try {
      const data = await platformAdminService.createSubscriptionPlan(req.body);
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async updatePlan(req, res) {
    try {
      const data = await platformAdminService.updateSubscriptionPlan(req.params.planId, req.body);
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async recentLogins(req, res) {
    try {
      const limit = req.query.limit;
      const data = await platformAdminService.getRecentTenantLogins(limit);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Platform recent logins error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getInstitutionAudit(req, res) {
    try {
      const result = await platformAdminService.listInstitutionAuditLogs(req.params.id, req.query || {});
      if (result === null) return res.status(404).json({ success: false, error: 'Institution not found' });
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Platform institution audit error', { error: error.message, id: req.params?.id });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async exportInstitutions(req, res) {
    try {
      const csv = await platformAdminService.exportInstitutionsCsv();
      res.json({
        success: true,
        filename: `institutions-${new Date().toISOString().slice(0, 10)}.csv`,
        csv,
      });
    } catch (error) {
      logger.error('Platform export institutions error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async listSubscriptionRequests(req, res) {
    try {
      const { status, page, limit } = req.query;
      const result = await subscriptionService.listUpgradeRequestsForPlatform({ status, page, limit });
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Platform list subscription requests error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async approveSubscriptionRequest(req, res) {
    try {
      const data = await subscriptionService.approveUpgradeRequest(req.params.id, req.platformAdmin.id, {
        adminNotes: req.body?.adminNotes,
      });
      res.json({ success: true, data });
    } catch (error) {
      if (error.code === 'DOWNGRADE_BLOCKED') {
        return res.status(422).json({
          success: false,
          error: 'DOWNGRADE_BLOCKED',
          conflicts: error.conflicts,
          planName: error.planName,
        });
      }
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async rejectSubscriptionRequest(req, res) {
    try {
      const data = await subscriptionService.rejectUpgradeRequest(req.params.id, req.platformAdmin.id, {
        adminNotes: req.body?.adminNotes,
      });
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = new PlatformController();
