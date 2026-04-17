const db = require('../../database/connection');
const { v4: uuidv4 } = require('uuid');

const STEPS = [
  { id: 'company_profile', label: 'Set up company profile',   path: '/company-settings' },
  { id: 'add_warehouse',   label: 'Add your first warehouse', path: '/warehouses' },
  { id: 'add_item',        label: 'Add your first item',      path: '/items' },
  { id: 'add_customer',    label: 'Add your first customer',  path: '/sales/customers' },
  { id: 'add_vendor',      label: 'Add your first vendor',    path: '/purchases/vendors' },
  { id: 'create_invoice',  label: 'Create your first invoice',path: '/invoices/sales' },
  { id: 'invite_user',     label: 'Invite a team member',     path: '/users' },
];

async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS onboarding_progress (
      id VARCHAR(36) PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL UNIQUE,
      completed_steps JSON NOT NULL DEFAULT ('[]'),
      is_completed TINYINT(1) DEFAULT 0,
      dismissed TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

async function getOrCreate(institutionId) {
  await ensureTable();
  let rows = await db.query('SELECT * FROM onboarding_progress WHERE institution_id = ?', [institutionId]);
  if (rows.length === 0) {
    await db.query(
      'INSERT INTO onboarding_progress (id, institution_id, completed_steps) VALUES (?, ?, ?)',
      [uuidv4(), institutionId, JSON.stringify([])]
    );
    rows = await db.query('SELECT * FROM onboarding_progress WHERE institution_id = ?', [institutionId]);
  }
  return rows[0];
}

function parseSteps(record) {
  const completed = typeof record.completed_steps === 'string'
    ? JSON.parse(record.completed_steps) : (record.completed_steps || []);
  return {
    steps: STEPS.map(s => ({ ...s, completed: completed.includes(s.id) })),
    completedCount: completed.length,
    totalCount: STEPS.length,
    isCompleted: record.is_completed === 1,
    dismissed: record.dismissed === 1,
    percentComplete: Math.round((completed.length / STEPS.length) * 100),
  };
}

class OnboardingService {
  async getProgress(institutionId) {
    const record = await getOrCreate(institutionId);
    return parseSteps(record);
  }

  async completeStep(institutionId, stepId) {
    if (!STEPS.find(s => s.id === stepId)) throw new Error('Invalid step id');
    const record = await getOrCreate(institutionId);
    const completed = typeof record.completed_steps === 'string'
      ? JSON.parse(record.completed_steps) : (record.completed_steps || []);
    if (!completed.includes(stepId)) completed.push(stepId);
    const allDone = completed.length >= STEPS.length;
    await db.query(
      'UPDATE onboarding_progress SET completed_steps=?, is_completed=?, updated_at=NOW() WHERE institution_id=?',
      [JSON.stringify(completed), allDone ? 1 : 0, institutionId]
    );
    return this.getProgress(institutionId);
  }

  async dismiss(institutionId) {
    await getOrCreate(institutionId);
    await db.query(
      'UPDATE onboarding_progress SET dismissed=1, updated_at=NOW() WHERE institution_id=?',
      [institutionId]
    );
    return { dismissed: true };
  }

  // Auto-detect what's already done by checking real data
  async autoDetect(institutionId) {
    const checks = await Promise.allSettled([
      db.query('SELECT COUNT(*) as c FROM warehouses WHERE institution_id=?', [institutionId]),
      db.query('SELECT COUNT(*) as c FROM items WHERE institution_id=? AND status!="draft"', [institutionId]),
      db.query('SELECT COUNT(*) as c FROM customers WHERE institution_id=?', [institutionId]),
      db.query('SELECT COUNT(*) as c FROM vendors WHERE institution_id=?', [institutionId]),
      db.query('SELECT COUNT(*) as c FROM institution_users WHERE institution_id=? AND role!="super_admin"', [institutionId]),
      db.query('SELECT COUNT(*) as c FROM sales_invoices WHERE institution_id=?', [institutionId]).catch(() => [{ c: 0 }]),
      // company_profile: check if company_settings has at least 3 core fields filled
      db.query(
        `SELECT COUNT(*) as c FROM company_settings
         WHERE institution_id=?
           AND company_name IS NOT NULL AND company_name != ""
           AND address IS NOT NULL AND address != ""
           AND phone IS NOT NULL AND phone != ""`,
        [institutionId]
      ).catch(() => [{ c: 0 }]),
    ]);
    const [wh, it, cu, ve, us, inv, co] = checks.map(r => r.status === 'fulfilled' ? (r.value[0]?.c || 0) : 0);
    const map = {
      add_warehouse:  wh,
      add_item:       it,
      add_customer:   cu,
      add_vendor:     ve,
      invite_user:    us,
      create_invoice: inv,
      company_profile: co,
    };
    for (const [stepId, count] of Object.entries(map)) {
      if (count > 0) await this.completeStep(institutionId, stepId).catch(() => {});
    }
    return this.getProgress(institutionId);
  }
}

module.exports = new OnboardingService();
