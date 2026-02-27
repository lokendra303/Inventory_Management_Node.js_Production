const db = require('../../database/connection');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

class AuditLogService {
  async log(institutionId, entityType, entityId, action, changes = {}, userId = null, ipAddress = null, description = null) {
    try {
      const auditId = uuidv4();
      
      await db.query(
        `INSERT INTO audit_logs 
         (id, institution_id, entity_type, entity_id, action, changes, user_id, ip_address, description, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [auditId, institutionId, entityType, entityId, action, JSON.stringify(changes), userId, ipAddress, description]
      );

      return auditId;
    } catch (error) {
      logger.error('Audit log failed', { error: error.message });
    }
  }

  async getEntityLogs(institutionId, entityType, entityId, limit = 50) {
    try {
      const logs = await db.query(
        `SELECT al.*, u.name as user_name, u.email as user_email
         FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.id
         WHERE al.institution_id = ? AND al.entity_type = ? AND al.entity_id = ?
         ORDER BY al.created_at DESC LIMIT ?`,
        [institutionId, entityType, entityId, limit]
      );

      return logs.map(log => ({
        ...log,
        changes: log.changes ? JSON.parse(log.changes) : null
      }));
    } catch (error) {
      logger.error('Failed to get audit logs', { error: error.message });
      return [];
    }
  }
}

module.exports = new AuditLogService();
