const db = require('../../database/connection');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

let tablesReady = false;

async function ensureTables() {
  if (tablesReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS workflow_rules (
      id VARCHAR(36) PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL,
      name VARCHAR(150) NOT NULL,
      description VARCHAR(255),
      module ENUM('inventory','sales_order','purchase_order','invoice','item') NOT NULL,
      trigger_event VARCHAR(100) NOT NULL,
      conditions JSON DEFAULT ('[]'),
      actions JSON DEFAULT ('[]'),
      is_active TINYINT(1) DEFAULT 1,
      execution_count INT DEFAULT 0,
      last_executed_at TIMESTAMP NULL,
      created_by VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS workflow_logs (
      id VARCHAR(36) PRIMARY KEY,
      rule_id VARCHAR(36) NOT NULL,
      institution_id VARCHAR(36) NOT NULL,
      trigger_data JSON,
      actions_executed JSON,
      status ENUM('success','failed','partial') DEFAULT 'success',
      error_message TEXT,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rule_id) REFERENCES workflow_rules(id) ON DELETE CASCADE
    )
  `);
  tablesReady = true;
}

class WorkflowService {
  async getRules(institutionId) {
    await ensureTables();
    const rows = await db.query(
      `SELECT wr.*, CONCAT(u.first_name,' ',COALESCE(u.last_name,'')) as created_by_name
       FROM workflow_rules wr
       LEFT JOIN institution_users u ON wr.created_by = u.id
       WHERE wr.institution_id = ?
       ORDER BY wr.created_at DESC`,
      [institutionId]
    );
    return rows.map(r => ({
      ...r,
      conditions: typeof r.conditions === 'string' ? JSON.parse(r.conditions) : r.conditions,
      actions: typeof r.actions === 'string' ? JSON.parse(r.actions) : r.actions,
    }));
  }

  async getRule(institutionId, id) {
    await ensureTables();
    const [row] = await db.query(
      'SELECT * FROM workflow_rules WHERE institution_id=? AND id=?',
      [institutionId, id]
    );
    if (!row) throw new Error('Workflow rule not found');
    return {
      ...row,
      conditions: typeof row.conditions === 'string' ? JSON.parse(row.conditions) : row.conditions,
      actions: typeof row.actions === 'string' ? JSON.parse(row.actions) : row.actions,
    };
  }

  async createRule(institutionId, userId, { name, description, module, triggerEvent, conditions, actions }) {
    await ensureTables();
    const id = uuidv4();
    await db.query(
      `INSERT INTO workflow_rules (id, institution_id, name, description, module, trigger_event, conditions, actions, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, institutionId, name, description || null, module, triggerEvent,
       JSON.stringify(conditions || []), JSON.stringify(actions || []), userId]
    );
    logger.info('Workflow rule created', { id, institutionId, name });
    return id;
  }

  async updateRule(institutionId, id, data) {
    await ensureTables();
    const fields = [], vals = [];
    const map = { name: 'name', description: 'description', module: 'module',
                  triggerEvent: 'trigger_event', isActive: 'is_active' };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) { fields.push(`${col}=?`); vals.push(data[k]); }
    }
    if (data.conditions !== undefined) { fields.push('conditions=?'); vals.push(JSON.stringify(data.conditions)); }
    if (data.actions !== undefined)    { fields.push('actions=?');    vals.push(JSON.stringify(data.actions)); }
    if (!fields.length) throw new Error('Nothing to update');
    fields.push('updated_at=NOW()');
    vals.push(institutionId, id);
    await db.query(`UPDATE workflow_rules SET ${fields.join(',')} WHERE institution_id=? AND id=?`, vals);
    return true;
  }

  async deleteRule(institutionId, id) {
    await ensureTables();
    await db.query('DELETE FROM workflow_rules WHERE institution_id=? AND id=?', [institutionId, id]);
    return true;
  }

  async toggleRule(institutionId, id) {
    await ensureTables();
    await db.query(
      'UPDATE workflow_rules SET is_active = NOT is_active, updated_at=NOW() WHERE institution_id=? AND id=?',
      [institutionId, id]
    );
    return true;
  }

  async getLogs(institutionId, ruleId = null) {
    await ensureTables();
    let q = `SELECT wl.*, wr.name as rule_name
             FROM workflow_logs wl
             JOIN workflow_rules wr ON wl.rule_id = wr.id
             WHERE wl.institution_id = ?`;
    const p = [institutionId];
    if (ruleId) { q += ' AND wl.rule_id = ?'; p.push(ruleId); }
    q += ' ORDER BY wl.executed_at DESC LIMIT 200';
    return db.query(q, p);
  }

  // Called by other modules to trigger workflows
  async trigger(institutionId, event, triggerData) {
    await ensureTables();
    const rules = await db.query(
      `SELECT * FROM workflow_rules WHERE institution_id=? AND trigger_event=? AND is_active=1`,
      [institutionId, event]
    );
    for (const rule of rules) {
      const conditions = typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions;
      const actions = typeof rule.actions === 'string' ? JSON.parse(rule.actions) : rule.actions;
      if (!this._checkConditions(conditions, triggerData)) continue;
      const executed = [];
      let status = 'success';
      let errorMsg = null;
      try {
        for (const action of actions) {
          await this._executeAction(institutionId, action, triggerData);
          executed.push(action);
        }
      } catch (e) {
        status = 'partial';
        errorMsg = e.message;
        logger.warn('Workflow action failed', { ruleId: rule.id, error: e.message });
      }
      await db.query(
        `INSERT INTO workflow_logs (id, rule_id, institution_id, trigger_data, actions_executed, status, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), rule.id, institutionId, JSON.stringify(triggerData), JSON.stringify(executed), status, errorMsg]
      );
      await db.query(
        'UPDATE workflow_rules SET execution_count=execution_count+1, last_executed_at=NOW() WHERE id=?',
        [rule.id]
      );
    }
  }

  _checkConditions(conditions, data) {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every(cond => {
      const val = data[cond.field];
      switch (cond.operator) {
        case 'equals':           return String(val) === String(cond.value);
        case 'not_equals':       return String(val) !== String(cond.value);
        case 'greater_than':     return parseFloat(val) > parseFloat(cond.value);
        case 'less_than':        return parseFloat(val) < parseFloat(cond.value);
        case 'contains':         return String(val).includes(cond.value);
        default:                 return true;
      }
    });
  }

  async _executeAction(institutionId, action, triggerData) {
    switch (action.type) {
      case 'send_notification': {
        const notifSvc = require('../notification/notification.service');
        await notifSvc.broadcast(
          institutionId,
          'workflow',
          action.title || 'Workflow Alert',
          action.message || `Workflow triggered for ${triggerData.module || 'item'}`,
          triggerData.module || null,
          triggerData.itemId || triggerData.orderId || null
        );
        break;
      }
      case 'update_status': {
        if (action.module === 'item' && triggerData.itemId) {
          await db.query('UPDATE items SET status=? WHERE institution_id=? AND id=?',
            [action.value, institutionId, triggerData.itemId]);
        }
        break;
      }
      default:
        logger.info('Workflow action type not implemented', { type: action.type });
    }
  }
}

module.exports = new WorkflowService();
