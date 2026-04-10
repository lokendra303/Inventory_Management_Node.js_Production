const auditLogService = require('../modules/audit/auditLog.service');
const logger = require('./logger');

/**
 * Audit utility functions for manual audit logging in business operations
 */
class AuditUtils {
  /**
   * Log a business operation with user context
   */
  static async logBusinessOperation(req, entityType, entityId, action, changes = {}, description = null) {
    try {
      if (!req.institutionId) {
        logger.warn('Audit log skipped - no institution context');
        return;
      }

      await auditLogService.logUserAction({
        institutionId: req.institutionId,
        userId: req.user?.userId || null,
        serviceAccountId: req.serviceAccount?.jti || null,
        entityType,
        entityId,
        action,
        method: req.method,
        path: req.path,
        changes,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
        statusCode: 200,
        duration: null,
        requestBody: req.body ? JSON.stringify(req.body) : null,
        description: description || `${action} ${entityType} ${entityId}`
      });
    } catch (error) {
      logger.error('Manual audit logging failed', { 
        error: error.message,
        entityType,
        entityId,
        action
      });
    }
  }

  /**
   * Log inventory movement
   */
  static async logInventoryMovement(req, itemId, warehouseId, movementType, quantity, reason, fromLocation = null, toLocation = null) {
    const changes = {
      movementType,
      quantity,
      reason,
      fromLocation,
      toLocation,
      warehouseId
    };

    await this.logBusinessOperation(
      req,
      'inventory_movement',
      `${itemId}_${Date.now()}`,
      movementType,
      changes,
      `${movementType} ${quantity} units of item ${itemId} - ${reason}`
    );
  }

  /**
   * Log financial transaction
   */
  static async logFinancialTransaction(req, transactionType, amount, entityType, entityId, details = {}) {
    const changes = {
      transactionType,
      amount,
      currency: details.currency || 'USD',
      ...details
    };

    await this.logBusinessOperation(
      req,
      'financial_transaction',
      `${entityType}_${entityId}_${Date.now()}`,
      transactionType,
      changes,
      `${transactionType} of ${amount} for ${entityType} ${entityId}`
    );
  }

  /**
   * Log approval workflow
   */
  static async logApprovalAction(req, entityType, entityId, action, approverComments = null, previousStatus = null, newStatus = null) {
    const changes = {
      action,
      approverComments,
      previousStatus,
      newStatus,
      approvedBy: req.user?.userId,
      approvedAt: new Date().toISOString()
    };

    await this.logBusinessOperation(
      req,
      entityType,
      entityId,
      action,
      changes,
      `${action} ${entityType} ${entityId} - Status changed from ${previousStatus} to ${newStatus}`
    );
  }

  /**
   * Log data export/import operations
   */
  static async logDataOperation(req, operation, entityType, recordCount, fileName = null, filters = {}) {
    const changes = {
      operation,
      entityType,
      recordCount,
      fileName,
      filters,
      timestamp: new Date().toISOString()
    };

    await this.logBusinessOperation(
      req,
      'data_operation',
      `${operation}_${entityType}_${Date.now()}`,
      operation,
      changes,
      `${operation} ${recordCount} ${entityType} records${fileName ? ` to/from ${fileName}` : ''}`
    );
  }

  /**
   * Log system configuration changes
   */
  static async logConfigurationChange(req, configType, configKey, oldValue, newValue, description = null) {
    const changes = {
      configType,
      configKey,
      oldValue,
      newValue,
      changedBy: req.user?.userId,
      changedAt: new Date().toISOString()
    };

    await this.logBusinessOperation(
      req,
      'system_configuration',
      `${configType}_${configKey}`,
      'update',
      changes,
      description || `Changed ${configType}.${configKey} from ${oldValue} to ${newValue}`
    );
  }

  /**
   * Log user access events
   */
  static async logUserAccess(req, accessType, targetUserId = null, details = {}) {
    const changes = {
      accessType,
      targetUserId,
      sessionId: req.sessionID,
      ...details
    };

    await this.logBusinessOperation(
      req,
      'user_access',
      targetUserId || req.user?.userId,
      accessType,
      changes,
      `User ${accessType} event${targetUserId ? ` for user ${targetUserId}` : ''}`
    );
  }

  /**
   * Log security events
   */
  static async logSecurityEvent(req, eventType, severity = 'medium', details = {}) {
    const changes = {
      eventType,
      severity,
      timestamp: new Date().toISOString(),
      ...details
    };

    await this.logBusinessOperation(
      req,
      'security_event',
      `${eventType}_${Date.now()}`,
      eventType,
      changes,
      `Security event: ${eventType} (${severity} severity)`
    );
  }

  /**
   * Log bulk operations
   */
  static async logBulkOperation(req, operation, entityType, affectedIds, summary = {}) {
    const changes = {
      operation,
      entityType,
      affectedCount: affectedIds.length,
      affectedIds: affectedIds.slice(0, 100), // Limit to first 100 IDs
      summary,
      timestamp: new Date().toISOString()
    };

    await this.logBusinessOperation(
      req,
      'bulk_operation',
      `${operation}_${entityType}_${Date.now()}`,
      operation,
      changes,
      `Bulk ${operation} on ${affectedIds.length} ${entityType} records`
    );
  }

  /**
   * Log report generation
   */
  static async logReportGeneration(req, reportType, parameters = {}, recordCount = null, fileName = null) {
    const changes = {
      reportType,
      parameters,
      recordCount,
      fileName,
      generatedAt: new Date().toISOString()
    };

    await this.logBusinessOperation(
      req,
      'report_generation',
      `${reportType}_${Date.now()}`,
      'generate',
      changes,
      `Generated ${reportType} report${recordCount ? ` with ${recordCount} records` : ''}${fileName ? ` saved as ${fileName}` : ''}`
    );
  }

  /**
   * Create audit context for service operations (when no req object available)
   */
  static createServiceContext(institutionId, userId = null, serviceAccountId = null, ipAddress = null) {
    return {
      institutionId,
      user: userId ? { userId } : null,
      serviceAccount: serviceAccountId ? { jti: serviceAccountId } : null,
      ip: ipAddress,
      method: 'SERVICE',
      path: '/service',
      body: {},
      get: () => null
    };
  }
}

module.exports = AuditUtils;