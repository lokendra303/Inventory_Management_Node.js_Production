const db = require('../../database/connection');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

let tablesReady = false;

async function ensureTables() {
  if (tablesReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      price_monthly DECIMAL(10,2) DEFAULT 0,
      price_yearly DECIMAL(10,2) DEFAULT 0,
      max_users INT DEFAULT 5,
      max_warehouses INT DEFAULT 2,
      max_items INT DEFAULT 500,
      features JSON DEFAULT ('[]'),
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS institution_subscriptions (
      id VARCHAR(36) PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL UNIQUE,
      plan_id VARCHAR(36) NOT NULL,
      billing_cycle ENUM('monthly','yearly','trial') DEFAULT 'trial',
      status ENUM('active','expired','cancelled','trial') DEFAULT 'trial',
      trial_ends_at TIMESTAMP NULL,
      current_period_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      current_period_end TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
    )
  `);

  // Seed default plans
  const plans = [
    ['plan-starter', 'Starter', 'Perfect for small businesses', 0, 0, 3, 1, 100,
     JSON.stringify(['inventory', 'sales', 'purchases'])],
    ['plan-pro', 'Professional', 'For growing businesses', 29, 290, 10, 5, 2000,
     JSON.stringify(['inventory', 'sales', 'purchases', 'reports', 'workflows', 'price_lists'])],
    ['plan-enterprise', 'Enterprise', 'Unlimited everything', 99, 990, -1, -1, -1,
     JSON.stringify(['all'])],
  ];
  for (const [id, name, desc, pm, py, mu, mw, mi, feat] of plans) {
    await db.query(
      `INSERT IGNORE INTO subscription_plans (id,name,description,price_monthly,price_yearly,max_users,max_warehouses,max_items,features)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, name, desc, pm, py, mu, mw, mi, feat]
    );
  }
  tablesReady = true;
}

class SubscriptionService {
  async getPlans() {
    await ensureTables();
    return db.query('SELECT * FROM subscription_plans WHERE is_active=1 ORDER BY price_monthly');
  }

  async getSubscription(institutionId) {
    await ensureTables();
    const rows = await db.query(
      `SELECT s.*, p.name as plan_name, p.description as plan_description,
              p.price_monthly, p.price_yearly, p.max_users, p.max_warehouses,
              p.max_items, p.features
       FROM institution_subscriptions s
       JOIN subscription_plans p ON s.plan_id = p.id
       WHERE s.institution_id = ?`,
      [institutionId]
    );
    if (rows.length === 0) return this.createTrialSubscription(institutionId);
    const sub = rows[0];
    sub.features = typeof sub.features === 'string' ? JSON.parse(sub.features) : sub.features;
    sub.days_remaining = sub.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at) - new Date()) / 86400000))
      : null;
    return sub;
  }

  async createTrialSubscription(institutionId) {
    await ensureTables();
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    const id = uuidv4();
    await db.query(
      `INSERT IGNORE INTO institution_subscriptions
       (id, institution_id, plan_id, billing_cycle, status, trial_ends_at, current_period_end)
       VALUES (?, ?, 'plan-starter', 'trial', 'trial', ?, ?)`,
      [id, institutionId, trialEnd, trialEnd]
    );
    return this.getSubscription(institutionId);
  }

  async getUsage(institutionId) {
    await ensureTables();
    const [users, warehouses, items] = await Promise.all([
      db.query('SELECT COUNT(*) as c FROM institution_users WHERE institution_id=?', [institutionId]),
      db.query('SELECT COUNT(*) as c FROM warehouses WHERE institution_id=? AND status="active"', [institutionId]),
      db.query('SELECT COUNT(*) as c FROM items WHERE institution_id=? AND status="active"', [institutionId]),
    ]);
    return {
      users: users[0].c,
      warehouses: warehouses[0].c,
      items: items[0].c,
    };
  }

  async upgradePlan(institutionId, { planId, billingCycle }) {
    await ensureTables();
    const [plan] = await db.query('SELECT * FROM subscription_plans WHERE id=? AND is_active=1', [planId]);
    if (!plan) throw new Error('Plan not found');
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === 'yearly' ? 12 : 1));
    await db.query(
      `INSERT INTO institution_subscriptions (id, institution_id, plan_id, billing_cycle, status, current_period_start, current_period_end)
       VALUES (?, ?, ?, ?, 'active', NOW(), ?)
       ON DUPLICATE KEY UPDATE plan_id=VALUES(plan_id), billing_cycle=VALUES(billing_cycle),
         status='active', current_period_start=NOW(), current_period_end=VALUES(current_period_end), updated_at=NOW()`,
      [uuidv4(), institutionId, planId, billingCycle || 'monthly', periodEnd]
    );
    logger.info('Plan upgraded', { institutionId, planId, billingCycle });
    return this.getSubscription(institutionId);
  }
}

module.exports = new SubscriptionService();
