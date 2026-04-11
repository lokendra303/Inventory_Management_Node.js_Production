const db = require('../../database/connection');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

class AuditLogService {
  constructor() {
    this._schemaEnsured = false;
  }

  // Enhanced audit logging for comprehensive user action tracking
  async logUserAction(auditData) {
    try {
      const auditId = uuidv4();
      
      // Ensure audit_logs table has all required columns (only once)
      if (!this._schemaEnsured) {
        await this.ensureAuditTableSchema();
        this._schemaEnsured = true;
      }
      
      await db.query(
        `INSERT INTO audit_logs 
         (id, institution_id, user_id, service_account_id, entity_type, entity_id, action, method, path, 
          changes, ip_address, user_agent, status_code, duration, request_body, description, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          auditId,
          auditData.institutionId,
          auditData.userId,
          auditData.serviceAccountId,
          auditData.entityType,
          auditData.entityId,
          auditData.action,
          auditData.method,
          auditData.path,
          auditData.changes ? JSON.stringify(auditData.changes) : null,
          auditData.ipAddress,
          auditData.userAgent,
          auditData.statusCode,
          auditData.duration,
          auditData.requestBody ? JSON.stringify(auditData.requestBody) : null,
          auditData.description
        ]
      );

      return auditId;
    } catch (error) {
      logger.error('Enhanced audit log failed', { error: error.message, auditData });
    }
  }

  // Legacy method for backward compatibility
  async log(institutionId, entityType, entityId, action, changes = {}, userId = null, ipAddress = null, description = null) {
    return this.logUserAction({
      institutionId,
      userId,
      serviceAccountId: null,
      entityType,
      entityId,
      action,
      method: null,
      path: null,
      changes,
      ipAddress,
      userAgent: null,
      statusCode: null,
      duration: null,
      requestBody: null,
      description
    });
  }

  // Ensure audit table has all required columns
  async ensureAuditTableSchema() {
    try {
      // First, try to create the table if it doesn't exist
      await db.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id VARCHAR(36) PRIMARY KEY,
          institution_id VARCHAR(36) NOT NULL,
          user_id VARCHAR(36),
          service_account_id VARCHAR(36),
          entity_type VARCHAR(100),
          entity_id VARCHAR(100),
          action VARCHAR(50),
          method VARCHAR(10),
          path VARCHAR(500),
          changes JSON,
          ip_address VARCHAR(45),
          user_agent TEXT,
          status_code INT,
          duration INT,
          request_body JSON,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for better performance
      const indexes = [
        { name: 'idx_audit_logs_institution_id', sql: 'CREATE INDEX idx_audit_logs_institution_id ON audit_logs(institution_id)' },
        { name: 'idx_audit_logs_user_id', sql: 'CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id)' },
        { name: 'idx_audit_logs_entity', sql: 'CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id)' },
        { name: 'idx_audit_logs_action', sql: 'CREATE INDEX idx_audit_logs_action ON audit_logs(action)' },
        { name: 'idx_audit_logs_created_at', sql: 'CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at)' },
        { name: 'idx_audit_logs_institution_created', sql: 'CREATE INDEX idx_audit_logs_institution_created ON audit_logs(institution_id, created_at)' },
        { name: 'idx_audit_logs_user_created', sql: 'CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at)' }
      ];

      for (const index of indexes) {
        try {
          const existing = await db.query(
            `SELECT COUNT(*) as cnt FROM information_schema.statistics 
             WHERE table_schema = DATABASE() AND table_name = 'audit_logs' AND index_name = ?`,
            [index.name]
          );
          if (existing[0].cnt === 0) {
            await db.query(index.sql);
          }
        } catch (error) {
          logger.debug('Audit index creation skipped', { index: index.name, error: error.message });
        }
      }
      
      logger.info('Audit logs table schema ensured successfully');
    } catch (error) {
      logger.error('Failed to ensure audit table schema', { error: error.message });
    }
  }

  async getEntityLogs(institutionId, entityType, entityId, limit = 50) {
    try {
      const logs = await db.query(
        `SELECT al.*, 
                CONCAT(COALESCE(iu.first_name,''), ' ', COALESCE(iu.last_name,'')) as user_name, 
                iu.email as user_email,
                iu.role as user_role
         FROM audit_logs al
         LEFT JOIN institution_users iu ON al.user_id = iu.id AND iu.institution_id = ?
         WHERE al.institution_id = ? AND al.entity_type = ? AND al.entity_id = ?
         ORDER BY al.created_at DESC LIMIT ?`,
        [institutionId, institutionId, entityType, entityId, parseInt(limit)]
      );

      return logs.map(log => {
        try {
          return {
            ...log,
            changes: log.changes ? (typeof log.changes === 'string' ? JSON.parse(log.changes) : log.changes) : null,
            request_body: log.request_body ? (typeof log.request_body === 'string' ? JSON.parse(log.request_body) : log.request_body) : null
          };
        } catch (parseError) {
          logger.warn('Failed to parse JSON in audit log', { logId: log.id, error: parseError.message });
          return {
            ...log,
            changes: null,
            request_body: null
          };
        }
      });
    } catch (error) {
      logger.error('Failed to get audit logs', { error: error.message });
      return [];
    }
  }

  // Get user activity summary
  async getUserActivitySummary(institutionId, userId, days = 30) {
    try {
      const summary = await db.query(
        `SELECT 
           action,
           entity_type,
           COUNT(*) as count,
           MAX(created_at) as last_action
         FROM audit_logs 
         WHERE institution_id = ? AND user_id = ? 
           AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY action, entity_type
         ORDER BY count DESC, last_action DESC`,
        [institutionId, userId, parseInt(days)]
      );
      
      return summary;
    } catch (error) {
      logger.error('Failed to get user activity summary', { error: error.message });
      return [];
    }
  }

  // Get recent user actions
  async getRecentUserActions(institutionId, userId, limit = 20) {
    try {
      const actions = await db.query(
        `SELECT al.*, 
                CONCAT(COALESCE(iu.first_name,''), ' ', COALESCE(iu.last_name,'')) as user_name
         FROM audit_logs al
         LEFT JOIN institution_users iu ON al.user_id = iu.id AND iu.institution_id = ?
         WHERE al.institution_id = ? AND al.user_id = ?
         ORDER BY al.created_at DESC LIMIT ?`,
        [institutionId, institutionId, userId, parseInt(limit)]
      );

      return actions.map(action => {
        try {
          return {
            ...action,
            changes: action.changes ? (typeof action.changes === 'string' ? JSON.parse(action.changes) : action.changes) : null,
            request_body: action.request_body ? (typeof action.request_body === 'string' ? JSON.parse(action.request_body) : action.request_body) : null
          };
        } catch (parseError) {
          logger.warn('Failed to parse JSON in audit action', { actionId: action.id, error: parseError.message });
          return {
            ...action,
            changes: null,
            request_body: null
          };
        }
      });
    } catch (error) {
      logger.error('Failed to get recent user actions', { error: error.message });
      return [];
    }
  }

  // Get system-wide activity dashboard
  async getActivityDashboard(institutionId, hours = 24) {
    try {
      const [totalActions, userActions, entityActions, recentActions] = await Promise.all([
        // Total actions in time period
        db.query(
          `SELECT COUNT(*) as total FROM audit_logs 
           WHERE institution_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
          [institutionId, parseInt(hours)]
        ),
        
        // Actions by user
        db.query(
          `SELECT 
             al.user_id,
             CONCAT(COALESCE(iu.first_name,''), ' ', COALESCE(iu.last_name,'')) as user_name,
             COUNT(*) as action_count
           FROM audit_logs al
           LEFT JOIN institution_users iu ON al.user_id = iu.id AND iu.institution_id = ?
           WHERE al.institution_id = ? AND al.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
           GROUP BY al.user_id, user_name
           ORDER BY action_count DESC LIMIT 10`,
          [institutionId, institutionId, parseInt(hours)]
        ),
        
        // Actions by entity type
        db.query(
          `SELECT entity_type, action, COUNT(*) as count
           FROM audit_logs 
           WHERE institution_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
           GROUP BY entity_type, action
           ORDER BY count DESC LIMIT 15`,
          [institutionId, parseInt(hours)]
        ),
        
        // Recent critical actions
        db.query(
          `SELECT al.*, 
                  CONCAT(COALESCE(iu.first_name,''), ' ', COALESCE(iu.last_name,'')) as user_name
           FROM audit_logs al
           LEFT JOIN institution_users iu ON al.user_id = iu.id AND iu.institution_id = ?
           WHERE al.institution_id = ? 
             AND al.action IN ('delete', 'approve', 'reject', 'payment', 'transfer')
           ORDER BY al.created_at DESC LIMIT 10`,
          [institutionId, institutionId]
        )
      ]);

      return {
        totalActions: totalActions[0]?.total || 0,
        userActions: userActions,
        entityActions: entityActions,
        recentCriticalActions: recentActions.map(action => {
          try {
            return {
              ...action,
              changes: action.changes ? (typeof action.changes === 'string' ? JSON.parse(action.changes) : action.changes) : null
            };
          } catch (parseError) {
            logger.warn('Failed to parse JSON in critical action', { actionId: action.id, error: parseError.message });
            return {
              ...action,
              changes: null
            };
          }
        })
      };
    } catch (error) {
      logger.error('Failed to get activity dashboard', { error: error.message });
      return {
        totalActions: 0,
        userActions: [],
        entityActions: [],
        recentCriticalActions: []
      };
    }
  }
}

module.exports = new AuditLogService();
