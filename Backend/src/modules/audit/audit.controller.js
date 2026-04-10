const auditLogService = require('./auditLog.service');
const db = require('../../database/connection');
const logger = require('../../utils/logger');

class AuditController {
  async getEntityAuditLog(req, res) {
    try {
      const { entityType, entityId } = req.params;
      const limit = parseInt(req.query.limit) || 50;
      const logs = await auditLogService.getEntityLogs(req.institutionId, entityType, entityId, limit);
      res.json({ success: true, data: logs });
    } catch (e) {
      logger.error('getEntityAuditLog failed', { error: e.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getAuditTrail(req, res) {
    try {
      const { entityType, action, userId, startDate, endDate, limit = 100, offset = 0 } = req.query;

      let query = `
        SELECT al.*, 
               CONCAT(COALESCE(iu.first_name,''), ' ', COALESCE(iu.last_name,'')) as user_name,
               iu.email as user_email,
               iu.role as user_role
        FROM audit_logs al
        LEFT JOIN institution_users iu ON al.user_id = iu.id AND iu.institution_id = ?
        WHERE al.institution_id = ?`;
      const params = [req.institutionId, req.institutionId];

      if (entityType) { query += ' AND al.entity_type = ?'; params.push(entityType); }
      if (action)     { query += ' AND al.action = ?';      params.push(action); }
      if (userId)     { query += ' AND al.user_id = ?';     params.push(userId); }
      if (startDate)  { query += ' AND DATE(al.created_at) >= ?'; params.push(startDate); }
      if (endDate)    { query += ' AND DATE(al.created_at) <= ?'; params.push(endDate); }

      query += ` ORDER BY al.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

      const logs = await db.query(query, params);
      const data = logs.map(l => ({
        ...l,
        changes: l.changes ? (typeof l.changes === 'object' ? l.changes : JSON.parse(l.changes)) : null,
        request_body: l.request_body ? (typeof l.request_body === 'object' ? l.request_body : JSON.parse(l.request_body)) : null
      }));

      res.json({ success: true, data });
    } catch (e) {
      logger.error('getAuditTrail failed', { error: e.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getAuditSummary(req, res) {
    try {
      const summary = await db.query(
        `SELECT entity_type, action, COUNT(*) as count, MAX(created_at) as last_occurrence
         FROM audit_logs WHERE institution_id = ?
         GROUP BY entity_type, action ORDER BY count DESC LIMIT 50`,
        [req.institutionId]
      );
      res.json({ success: true, data: summary });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  // Get user activity summary
  async getUserActivity(req, res) {
    try {
      const { userId } = req.params;
      const days = parseInt(req.query.days) || 30;
      
      const [summary, recentActions] = await Promise.all([
        auditLogService.getUserActivitySummary(req.institutionId, userId, days),
        auditLogService.getRecentUserActions(req.institutionId, userId, 20)
      ]);
      
      res.json({ 
        success: true, 
        data: {
          summary,
          recentActions
        }
      });
    } catch (e) {
      logger.error('getUserActivity failed', { error: e.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  // Get activity dashboard
  async getActivityDashboard(req, res) {
    try {
      const hours = parseInt(req.query.hours) || 24;
      const dashboard = await auditLogService.getActivityDashboard(req.institutionId, hours);
      
      res.json({ success: true, data: dashboard });
    } catch (e) {
      logger.error('getActivityDashboard failed', { error: e.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  // Get current user's activity
  async getMyActivity(req, res) {
    try {
      const days = parseInt(req.query.days) || 7;
      const limit = parseInt(req.query.limit) || 50;
      
      const [summary, recentActions] = await Promise.all([
        auditLogService.getUserActivitySummary(req.institutionId, req.user.userId, days),
        auditLogService.getRecentUserActions(req.institutionId, req.user.userId, limit)
      ]);
      
      res.json({ 
        success: true, 
        data: {
          summary,
          recentActions
        }
      });
    } catch (e) {
      logger.error('getMyActivity failed', { error: e.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

module.exports = new AuditController();
