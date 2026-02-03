const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const logger = require('../utils/logger');

class AutomationService {
  async createRule(institutionId, ruleData, userId) {
    const {
      name,
      description,
      triggerEvent,
      conditions,
      actions,
      isActive = true
    } = ruleData;

    // Validate trigger event
    const validTriggerEvents = [
      'PurchaseReceived',
      'SaleReserved',
      'SaleShipped',
      'StockAdjusted',
      'LowStock',
      'ItemCreated',
      'WarehouseCreated'
    ];

    if (!validTriggerEvents.includes(triggerEvent)) {
      throw new Error(`Invalid trigger event: ${triggerEvent}`);
    }

    // Validate conditions structure
    if (!this.validateConditions(conditions)) {
      throw new Error('Invalid conditions structure');
    }

    // Validate actions structure
    if (!this.validateActions(actions)) {
      throw new Error('Invalid actions structure');
    }

    const ruleId = uuidv4();

    await db.query(
      `INSERT INTO automation_rules 
       (id, institution_id, name, description, trigger_event, conditions, actions, is_active, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ruleId,
        institutionId,
        name,
        description,
        triggerEvent,
        JSON.stringify(conditions),
        JSON.stringify(actions),
        isActive,
        userId
      ]
    );

    logger.info('Automation rule created', { ruleId, institutionId, triggerEvent, userId });
    return ruleId;
  }

  validateConditions(conditions) {
    // Basic validation for conditions structure
    if (!conditions || typeof conditions !== 'object') {
      return false;
    }

    // Conditions should have operator and rules
    if (!conditions.operator || !['AND', 'OR'].includes(conditions.operator)) {
      return false;
    }

    if (!Array.isArray(conditions.rules)) {
      return false;
    }

    // Validate each rule
    for (const rule of conditions.rules) {
      if (!rule.field || !rule.operator || rule.value === undefined) {
        return false;
      }

      const validOperators = ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'in'];
      if (!validOperators.includes(rule.operator)) {
        return false;
      }
    }

    return true;
  }

  validateActions(actions) {
    // Basic validation for actions structure
    if (!Array.isArray(actions)) {
      return false;
    }

    for (const action of actions) {
      if (!action.type) {
        return false;
      }

      const validActionTypes = ['email', 'webhook', 'whatsapp', 'create_po', 'adjust_stock'];
      if (!validActionTypes.includes(action.type)) {
        return false;
      }

      // Validate action-specific parameters
      switch (action.type) {
        case 'email':
          if (!action.to || !action.subject || !action.template) {
            return false;
          }
          break;
        case 'webhook':
          if (!action.url || !action.method) {
            return false;
          }
          break;
        case 'whatsapp':
          if (!action.to || !action.template) {
            return false;
          }
          break;
      }
    }

    return true;
  }

  async updateRule(institutionId, ruleId, updateData, userId) {
    const {
      name,
      description,
      conditions,
      actions,
      isActive
    } = updateData;

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (conditions !== undefined) {
      if (!this.validateConditions(conditions)) {
        throw new Error('Invalid conditions structure');
      }
      updateFields.push('conditions = ?');
      updateValues.push(JSON.stringify(conditions));
    }
    if (actions !== undefined) {
      if (!this.validateActions(actions)) {
        throw new Error('Invalid actions structure');
      }
      updateFields.push('actions = ?');
      updateValues.push(JSON.stringify(actions));
    }
    if (isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(isActive);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push('version = version + 1', 'updated_at = NOW()');
    updateValues.push(institutionId, ruleId);

    const result = await db.query(
      `UPDATE automation_rules SET ${updateFields.join(', ')} WHERE institution_id = ? AND id = ?`,
      updateValues
    );

    if (result.affectedRows === 0) {
      throw new Error('Rule not found');
    }

    logger.info('Automation rule updated', { ruleId, institutionId, userId });
    return ruleId;
  }

  async getRule(institutionId, ruleId) {
    const [rules] = await db.query(
      'SELECT * FROM automation_rules WHERE institution_id = ? AND id = ?',
      [institutionId, ruleId]
    );

    if (rules.length === 0) {
      return null;
    }

    const rule = rules[0];
    return {
      ...rule,
      conditions: JSON.parse(rule.conditions),
      actions: JSON.parse(rule.actions)
    };
  }

  async getRules(institutionId, filters = {}, limit = 100, offset = 0) {
    let query = 'SELECT * FROM automation_rules WHERE institution_id = ?';
    const params = [institutionId];

    if (filters.triggerEvent) {
      query += ' AND trigger_event = ?';
      params.push(filters.triggerEvent);
    }

    if (filters.isActive !== undefined) {
      query += ' AND is_active = ?';
      params.push(filters.isActive);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rules = await db.query(query, params);

    return rules.map(rule => ({
      ...rule,
      conditions: JSON.parse(rule.conditions),
      actions: JSON.parse(rule.actions)
    }));
  }

  async executeRules(institutionId, triggerEvent, eventData) {
    // Get all active rules for this trigger event
    const rules = await this.getRules(institutionId, { 
      triggerEvent, 
      isActive: true 
    });

    const executionResults = [];

    for (const rule of rules) {
      try {
        const shouldExecute = this.evaluateConditions(rule.conditions, eventData);
        
        if (shouldExecute) {
          const result = await this.executeActions(institutionId, rule.actions, eventData);
          executionResults.push({
            ruleId: rule.id,
            ruleName: rule.name,
            executed: true,
            result
          });

          logger.info('Automation rule executed', {
            ruleId: rule.id,
            institutionId,
            triggerEvent,
            result
          });
        }
      } catch (error) {
        logger.error('Automation rule execution failed', {
          ruleId: rule.id,
          institutionId,
          triggerEvent,
          error: error.message
        });

        executionResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          executed: false,
          error: error.message
        });
      }
    }

    return executionResults;
  }

  evaluateConditions(conditions, eventData) {
    const { operator, rules } = conditions;

    const results = rules.map(rule => this.evaluateRule(rule, eventData));

    if (operator === 'AND') {
      return results.every(result => result);
    } else if (operator === 'OR') {
      return results.some(result => result);
    }

    return false;
  }

  evaluateRule(rule, eventData) {
    const { field, operator, value } = rule;
    const fieldValue = this.getFieldValue(field, eventData);

    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      case 'less_than':
        return Number(fieldValue) < Number(value);
      case 'contains':
        return String(fieldValue).includes(String(value));
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      default:
        return false;
    }
  }

  getFieldValue(field, eventData) {
    // Support nested field access with dot notation
    const fieldParts = field.split('.');
    let value = eventData;

    for (const part of fieldParts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  async executeActions(institutionId, actions, eventData) {
    const results = [];

    for (const action of actions) {
      try {
        let result;

        switch (action.type) {
          case 'email':
            result = await this.executeEmailAction(institutionId, action, eventData);
            break;
          case 'webhook':
            result = await this.executeWebhookAction(institutionId, action, eventData);
            break;
          case 'whatsapp':
            result = await this.executeWhatsAppAction(institutionId, action, eventData);
            break;
          default:
            result = { success: false, error: `Unknown action type: ${action.type}` };
        }

        results.push({ action: action.type, ...result });
      } catch (error) {
        results.push({ 
          action: action.type, 
          success: false, 
          error: error.message 
        });
      }
    }

    return results;
  }

  async executeEmailAction(institutionId, action, eventData) {
    // Email action implementation would go here
    // For now, just log the action
    logger.info('Email action executed', {
      institutionId,
      to: action.to,
      subject: action.subject,
      template: action.template,
      eventData
    });

    return { success: true, message: 'Email sent' };
  }

  async executeWebhookAction(institutionId, action, eventData) {
    const axios = require('axios');

    try {
      const response = await axios({
        method: action.method,
        url: action.url,
        data: {
          institutionId,
          eventData,
          ...action.payload
        },
        headers: action.headers || {},
        timeout: 10000
      });

      return { 
        success: true, 
        statusCode: response.status,
        response: response.data 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        statusCode: error.response?.status 
      };
    }
  }

  async executeWhatsAppAction(institutionId, action, eventData) {
    // WhatsApp action implementation would go here
    logger.info('WhatsApp action executed', {
      institutionId,
      to: action.to,
      template: action.template,
      eventData
    });

    return { success: true, message: 'WhatsApp message sent' };
  }

  async deleteRule(institutionId, ruleId, userId) {
    const result = await db.query(
      'DELETE FROM automation_rules WHERE institution_id = ? AND id = ?',
      [institutionId, ruleId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Rule not found');
    }

    logger.info('Automation rule deleted', { ruleId, institutionId, userId });
    return true;
  }

  async testRule(institutionId, ruleId, testEventData) {
    const rule = await this.getRule(institutionId, ruleId);
    if (!rule) {
      throw new Error('Rule not found');
    }

    const shouldExecute = this.evaluateConditions(rule.conditions, testEventData);
    
    if (shouldExecute) {
      // Don't actually execute actions in test mode, just return what would happen
      return {
        wouldExecute: true,
        actions: rule.actions.map(action => ({
          type: action.type,
          description: this.getActionDescription(action)
        }))
      };
    }

    return { wouldExecute: false };
  }

  getActionDescription(action) {
    switch (action.type) {
      case 'email':
        return `Send email to ${action.to} with subject "${action.subject}"`;
      case 'webhook':
        return `Send ${action.method} request to ${action.url}`;
      case 'whatsapp':
        return `Send WhatsApp message to ${action.to}`;
      default:
        return `Execute ${action.type} action`;
    }
  }
}

module.exports = new AutomationService();