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
               CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,'')) as user_name,
               u.email as user_email
        FROM audit_logs al
        LEFT JOIN institution_users u ON al.user_id = u.id
        WHERE al.institution_id = ?`;
      const params = [req.institutionId];

      if (entityType) { query += ' AND al.entity_type = ?'; params.push(entityType); }
      if (action)     { query += ' AND al.action = ?';      params.push(action); }
      if (userId)     { query += ' AND al.user_id = ?';     params.push(userId); }
      if (startDate)  { query += ' AND DATE(al.created_at) >= ?'; params.push(startDate); }
      if (endDate)    { query += ' AND DATE(al.created_at) <= ?'; params.push(endDate); }

      query += ` ORDER BY al.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

      const logs = await db.query(query, params);
      const data = logs.map(l => ({
        ...l,
        changes: l.changes ? (typeof l.changes === 'object' ? l.changes : JSON.parse(l.changes)) : null
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
}

module.exports = new AuditController();
