const platformAdminService = require('./platformAdmin.service');
const subscriptionService = require('../subscription/subscription.service');
const logger = require('../../utils/logger');

class PlatformController {
  async setupStatus(req, res) {
    try {
      const data = await platformAdminService.getSetupStatus();
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async setup(req, res) {
    try {
      const { email, password, name } = req.body;
      const result = await platformAdminService.setupInitialAdmin({ email, password, name });
      res.json({ success: true, data: result });
    } catch (error) {
      logger.warn('Platform setup failed', { email: req.body?.email, error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

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

  async verifyLoginOtp(req, res) {
    try {
      const { email, otp } = req.body;
      const result = await platformAdminService.verifyLoginOtp(email, otp);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.warn('Platform login OTP failed', { email: req.body?.email, error: error.message });
      res.status(401).json({ success: false, error: error.message });
    }
  }

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      await platformAdminService.forgotPassword(email);
      res.json({ success: true, message: 'OTP sent to your email.' });
    } catch (error) {
      logger.warn('Platform forgot password failed', { email: req.body?.email, error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async verifyResetOtp(req, res) {
    try {
      const { email, otp } = req.body;
      const data = await platformAdminService.verifyResetOtp(email, otp);
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async resetPassword(req, res) {
    try {
      const { resetToken, newPassword } = req.body;
      await platformAdminService.resetPassword(resetToken, newPassword);
      res.json({ success: true, message: 'Password reset successfully.' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async me(req, res) {
    try {
      const admin = await platformAdminService.getProfile(req.platformAdmin.id);
      res.json({ success: true, data: { admin } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateProfile(req, res) {
    try {
      const admin = await platformAdminService.updateProfile(req.platformAdmin.id, req.body || {});
      res.json({ success: true, data: { admin } });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async sendEmailChangeOtp(req, res) {
    try {
      const { newEmail } = req.body || {};
      const data = await platformAdminService.sendEmailChangeOtp(req.platformAdmin.id, newEmail);
      res.json({ success: true, data, message: 'Verification code sent to the new email address.' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async sendPasswordChangeOtp(req, res) {
    try {
      const { currentPassword } = req.body || {};
      const data = await platformAdminService.sendPasswordChangeOtp(req.platformAdmin.id, currentPassword);
      res.json({ success: true, data, message: 'Verification code sent to your email.' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword, otp } = req.body || {};
      await platformAdminService.changePassword(req.platformAdmin.id, currentPassword, newPassword, otp);
      res.json({ success: true, message: 'Password changed successfully.' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async sendTwoFactorEnableOtp(req, res) {
    try {
      const data = await platformAdminService.sendTwoFactorEnableOtp(req.platformAdmin.id);
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async verifyTwoFactorEnable(req, res) {
    try {
      const { otp } = req.body || {};
      const data = await platformAdminService.verifyAndEnableTwoFactor(req.platformAdmin.id, otp);
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async sendTwoFactorDisableOtp(req, res) {
    try {
      const data = await platformAdminService.sendTwoFactorDisableOtp(req.platformAdmin.id);
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async verifyTwoFactorDisable(req, res) {
    try {
      const { otp } = req.body || {};
      const data = await platformAdminService.verifyAndDisableTwoFactor(req.platformAdmin.id, otp);
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
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

  async activeSessions(req, res) {
    try {
      const { institutionId, search, page, limit } = req.query;
      const result = await platformAdminService.listActiveSessions({
        institutionId,
        search,
        page,
        limit,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Platform active sessions error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getSessionDetail(req, res) {
    try {
      const data = await platformAdminService.getActiveSessionDetail(req.params.sessionId, req.query || {});
      res.json({ success: true, data });
    } catch (error) {
      const status = error.message === 'Session not found' ? 404 : 400;
      res.status(status).json({ success: false, error: error.message });
    }
  }

  async revokeSession(req, res) {
    try {
      const { reason } = req.body || {};
      const data = await platformAdminService.revokeSessionById(
        req.params.sessionId,
        req.platformAdmin.id,
        reason
      );
      res.json({ success: true, message: 'Session ended', data });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async revokeUserSessions(req, res) {
    try {
      const { reason } = req.body || {};
      const data = await platformAdminService.revokeUserSessionsById(
        req.params.userId,
        req.platformAdmin.id,
        reason
      );
      res.json({
        success: true,
        message: data.revokedSessions ? 'User sessions ended' : 'No active sessions for this user',
        data,
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async revokeInstitutionSessions(req, res) {
    try {
      const { reason } = req.body || {};
      const data = await platformAdminService.revokeInstitutionSessionsById(
        req.params.id,
        req.platformAdmin.id,
        reason
      );
      res.json({
        success: true,
        message: data.revokedSessions ? 'Institution sessions ended' : 'No active sessions for this institution',
        data,
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
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
