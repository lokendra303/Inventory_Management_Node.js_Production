const auditLogService = require('../../services/audit/auditLogService');
const logger = require('../../utils/logger');

class AuditController {
  async getEntityAuditLog(req, res) {
    try {
      const { entityType, entityId } = req.params;
      const limit = parseInt(req.query.limit) || 50;
      
      const logs = await auditLogService.getEntityLogs(
        req.institutionId,
        entityType,
        entityId,
        limit
      );
      
      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      logger.error('Failed to get audit logs', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

module.exports = new AuditController();
