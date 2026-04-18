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
      sort_order INT DEFAULT 0,
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
      cancelled_at TIMESTAMP NULL,
      cancel_reason VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS subscription_billing_history (
      id VARCHAR(36) PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL,
      plan_id VARCHAR(36) NOT NULL,
      plan_name VARCHAR(100) NOT NULL,
      billing_cycle ENUM('monthly','yearly','trial') NOT NULL,
      amount DECIMAL(10,2) DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'INR',
      status ENUM('paid','pending','failed','refunded') DEFAULT 'paid',
      payment_method VARCHAR(50) DEFAULT 'manual',
      payment_reference VARCHAR(100) NULL,
      period_start TIMESTAMP NOT NULL,
      period_end TIMESTAMP NOT NULL,
      invoice_number VARCHAR(50) NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add sort_order column if it doesn't exist (migration for existing tables)
  try {
    await db.query(`ALTER TABLE subscription_plans ADD COLUMN sort_order INT DEFAULT 0`);
  } catch (e) {
    if (e.errno !== 1060) throw e;
  }

  // Add missing columns to institution_subscriptions
  const subMigrations = [
    `ALTER TABLE institution_subscriptions ADD COLUMN cancelled_at TIMESTAMP NULL`,
    `ALTER TABLE institution_subscriptions ADD COLUMN cancel_reason VARCHAR(255) NULL`,
    `ALTER TABLE institution_subscriptions ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ];
  for (const sql of subMigrations) {
    try { await db.query(sql); } catch (e) {
      if (e.errno !== 1060) throw e; // 1060 = Duplicate column name
    }
  }

  // Seed plans — INR pricing (upsert so price/limit changes are always applied)
  // id | name | description | price_monthly | price_yearly | max_users | max_warehouses | max_items | features | sort_order
  const plans = [
    ['plan-free',         'Free',         'Get started for free. Core inventory features with basic limits.',
      0,      0,       2,   1,    100,  JSON.stringify(['inventory', 'sales', 'purchases', 'price_lists']), 1],
    ['plan-standard',     'Standard',     'For small teams. More capacity and reporting tools.',
      999,    9990,    5,   3,    1000, JSON.stringify(['inventory', 'sales', 'purchases', 'reports']), 2],
    ['plan-professional', 'Professional', 'For growing businesses. Advanced features and higher limits.',
      2499,   24990,   15,  10,   5000, JSON.stringify(['inventory', 'sales', 'purchases', 'reports', 'workflows', 'price_lists']), 3],
    ['plan-premium',      'Premium',      'For large teams. Maximum limits with priority support.',
      4999,   49990,   50,  25,   25000, JSON.stringify(['inventory', 'sales', 'purchases', 'reports', 'workflows', 'price_lists']), 4],
    ['plan-enterprise',   'Enterprise',   'Unlimited everything. Full feature access with dedicated support.',
      9999,   99990,   -1,  -1,   -1,   JSON.stringify(['all']), 5],
  ];

  for (const [id, name, desc, pm, py, mu, mw, mi, feat, sort] of plans) {
    await db.query(
      `INSERT INTO subscription_plans
       (id,name,description,price_monthly,price_yearly,max_users,max_warehouses,max_items,features,sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         name=VALUES(name), description=VALUES(description),
         price_monthly=VALUES(price_monthly), price_yearly=VALUES(price_yearly),
         max_users=VALUES(max_users), max_warehouses=VALUES(max_warehouses),
         max_items=VALUES(max_items), features=VALUES(features), sort_order=VALUES(sort_order)`,
      [id, name, desc, pm, py, mu, mw, mi, feat, sort]
    );
  }

  // Migrate any subscriptions still pointing at old plan IDs — move them to plan-free
  await db.query(
    `UPDATE institution_subscriptions
     SET plan_id = 'plan-free'
     WHERE plan_id NOT IN ('plan-free','plan-standard','plan-professional','plan-premium','plan-enterprise')`
  );

  // Now safe to delete old stale plan rows (no FK references remain)
  await db.query(
    `DELETE FROM subscription_plans WHERE id NOT IN ('plan-free','plan-standard','plan-professional','plan-premium','plan-enterprise')`
  );

  tablesReady = true;
}

class SubscriptionService {

  // ─── Plans ───────────────────────────────────────────────────────────────

  async getPlans() {
    await ensureTables();
    return db.query('SELECT * FROM subscription_plans WHERE is_active=1 ORDER BY sort_order, price_monthly');
  }

  // ─── Current Subscription ────────────────────────────────────────────────

  async getSubscription(institutionId) {
    await ensureTables();
    const rows = await db.query(
      `SELECT s.*, p.name as plan_name, p.description as plan_description,
              p.price_monthly, p.price_yearly, p.max_users, p.max_warehouses,
              p.max_items, p.features, p.sort_order
       FROM institution_subscriptions s
       JOIN subscription_plans p ON s.plan_id = p.id
       WHERE s.institution_id = ?`,
      [institutionId]
    );

    if (rows.length === 0) return this.createTrialSubscription(institutionId);

    const sub = rows[0];
    sub.features = typeof sub.features === 'string' ? JSON.parse(sub.features) : sub.features;

    // Days remaining in trial
    sub.days_remaining = sub.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at) - new Date()) / 86400000))
      : null;

    // Auto-expire trial
    if (sub.status === 'trial' && sub.trial_ends_at && new Date(sub.trial_ends_at) < new Date()) {
      await db.query(
        `UPDATE institution_subscriptions SET status='expired', updated_at=NOW() WHERE institution_id=?`,
        [institutionId]
      );
      sub.status = 'expired';
      sub.days_remaining = 0;
    }

    // Auto-expire paid subscription
    if (sub.status === 'active' && sub.current_period_end && new Date(sub.current_period_end) < new Date()) {
      await db.query(
        `UPDATE institution_subscriptions SET status='expired', updated_at=NOW() WHERE institution_id=?`,
        [institutionId]
      );
      sub.status = 'expired';
    }

    return sub;
  }

  async createTrialSubscription(institutionId) {
    await ensureTables();
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    const id = uuidv4();
    // Trial uses plan-starter as the base plan but status='trial'
    // During trial, checkFeature/checkLimit grants full access (see below)
    await db.query(
      `INSERT IGNORE INTO institution_subscriptions
       (id, institution_id, plan_id, billing_cycle, status, trial_ends_at, current_period_end)
       VALUES (?, ?, 'plan-free', 'trial', 'trial', ?, ?)`,
      [id, institutionId, trialEnd, trialEnd]
    );
    logger.info('Trial subscription created', { institutionId, trialEnd });
    return this.getSubscription(institutionId);
  }

  // ─── Usage ───────────────────────────────────────────────────────────────

  async getUsage(institutionId) {
    await ensureTables();
    const [users, warehouses, items] = await Promise.all([
      db.query('SELECT COUNT(*) as c FROM institution_users WHERE institution_id=? AND status="active"', [institutionId]),
      db.query('SELECT COUNT(*) as c FROM warehouses WHERE institution_id=? AND status="active"', [institutionId]),
      db.query('SELECT COUNT(*) as c FROM items WHERE institution_id=? AND status="active"', [institutionId]),
    ]);
    return {
      users:      Number(users[0].c),
      warehouses: Number(warehouses[0].c),
      items:      Number(items[0].c),
    };
  }

  // ─── Feature Gating ──────────────────────────────────────────────────────

  async checkLimit(institutionId, resource) {
    const sub = await this.getSubscription(institutionId);

    if (sub.status === 'expired' || sub.status === 'cancelled') {
      throw new Error(`Your subscription has ${sub.status}. Please renew to continue using this feature.`);
    }

    // Trial gets full unrestricted access
    if (sub.status === 'trial') return true;

    const usage = await this.getUsage(institutionId);
    const limits = { users: sub.max_users, warehouses: sub.max_warehouses, items: sub.max_items };
    const max = limits[resource];

    if (max !== -1 && usage[resource] >= max) {
      throw new Error(
        `You have reached the ${resource} limit (${max}) on your ${sub.plan_name} plan. ` +
        `Please upgrade to add more ${resource}.`
      );
    }

    return true;
  }

  async checkFeature(institutionId, feature) {
    const sub = await this.getSubscription(institutionId);
    if (sub.status === 'expired' || sub.status === 'cancelled') {
      throw new Error(`Your subscription has ${sub.status}. Please renew to continue.`);
    }

    // Trial gets full unrestricted access
    if (sub.status === 'trial') return true;

    // Free plan gets access to price_lists (basic feature)
    if (sub.plan_id === 'plan-free' && feature === 'price_lists') return true;

    const features = sub.features || [];
    if (!features.includes('all') && !features.includes(feature)) {
      throw new Error(
        `The "${feature}" feature is not available on your ${sub.plan_name} plan. Please upgrade to access it.`
      );
    }
    return true;
  }

  // ─── Downgrade Preview ───────────────────────────────────────────────────

  async getDowngradePreview(institutionId, planId) {
    await ensureTables();
    const [plan] = await db.query('SELECT * FROM subscription_plans WHERE id=? AND is_active=1', [planId]);
    if (!plan) throw new Error('Plan not found');

    const result = { planId, planName: plan.name, conflicts: [] };

    if (plan.max_warehouses !== -1) {
      const warehouses = await db.query(
        `SELECT id, name, code, status FROM warehouses WHERE institution_id=? AND status='active' ORDER BY name`,
        [institutionId]
      );
      if (warehouses.length > plan.max_warehouses) {
        result.conflicts.push({
          resource: 'warehouses', current: warehouses.length,
          allowed: plan.max_warehouses, records: warehouses,
          mustDeactivate: warehouses.length - plan.max_warehouses,
        });
      }
    }

    if (plan.max_users !== -1) {
      const users = await db.query(
        `SELECT id, name, email, role, status FROM institution_users WHERE institution_id=? AND status='active' ORDER BY name`,
        [institutionId]
      );
      if (users.length > plan.max_users) {
        result.conflicts.push({
          resource: 'users', current: users.length,
          allowed: plan.max_users, records: users,
          mustDeactivate: users.length - plan.max_users,
        });
      }
    }

    if (plan.max_items !== -1) {
      const items = await db.query(
        `SELECT id, name, sku, status FROM items WHERE institution_id=? AND status='active' ORDER BY name`,
        [institutionId]
      );
      if (items.length > plan.max_items) {
        result.conflicts.push({
          resource: 'items', current: items.length,
          allowed: plan.max_items, records: items,
          mustDeactivate: items.length - plan.max_items,
        });
      }
    }

    return result;
  }

  // ─── Downgrade With Deactivation ─────────────────────────────────────────

  async downgradeWithDeactivation(institutionId, { planId, billingCycle, deactivations }) {
    await ensureTables();
    // deactivations: { warehouses: [id,...], users: [id,...], items: [id,...] }

    if (deactivations.warehouses?.length) {
      const ph = deactivations.warehouses.map(() => '?').join(',');
      await db.query(
        `UPDATE warehouses SET status='inactive', updated_at=NOW() WHERE institution_id=? AND id IN (${ph})`,
        [institutionId, ...deactivations.warehouses]
      );
    }
    if (deactivations.users?.length) {
      const ph = deactivations.users.map(() => '?').join(',');
      await db.query(
        `UPDATE institution_users SET status='inactive', updated_at=NOW() WHERE institution_id=? AND id IN (${ph})`,
        [institutionId, ...deactivations.users]
      );
    }
    if (deactivations.items?.length) {
      const ph = deactivations.items.map(() => '?').join(',');
      await db.query(
        `UPDATE items SET status='inactive', updated_at=NOW() WHERE institution_id=? AND id IN (${ph})`,
        [institutionId, ...deactivations.items]
      );
    }

    logger.info('Downgrade deactivations applied', { institutionId, planId, deactivations });
    return this.upgradePlan(institutionId, { planId, billingCycle: billingCycle || 'monthly', notes: 'Downgrade with deactivation' });
  }


  async upgradePlan(institutionId, { planId, billingCycle, paymentReference, paymentMethod, notes }) {
    await ensureTables();
    const [plan] = await db.query('SELECT * FROM subscription_plans WHERE id=? AND is_active=1', [planId]);
    if (!plan) throw new Error('Plan not found');

    // Check current usage doesn't exceed new plan limits — collect ALL conflicts at once
    const usage = await this.getUsage(institutionId);
    const conflicts = [];
    if (plan.max_users      !== -1 && usage.users      > plan.max_users)
      conflicts.push({ resource: 'users',      current: usage.users,      allowed: plan.max_users,      path: '/users' });
    if (plan.max_warehouses !== -1 && usage.warehouses > plan.max_warehouses)
      conflicts.push({ resource: 'warehouses', current: usage.warehouses, allowed: plan.max_warehouses, path: '/warehouses' });
    if (plan.max_items      !== -1 && usage.items      > plan.max_items)
      conflicts.push({ resource: 'items',      current: usage.items,      allowed: plan.max_items,      path: '/items' });

    if (conflicts.length > 0) {
      const err = new Error('DOWNGRADE_BLOCKED');
      err.code = 'DOWNGRADE_BLOCKED';
      err.conflicts = conflicts;
      err.planName  = plan.name;
      throw err;
    }

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === 'yearly' ? 12 : 1));

    const amount = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
    const invoiceNumber = `INV-SUB-${Date.now()}`;

    await db.query(
      `INSERT INTO institution_subscriptions
       (id, institution_id, plan_id, billing_cycle, status, current_period_start, current_period_end, trial_ends_at, cancelled_at, cancel_reason)
       VALUES (?, ?, ?, ?, 'active', NOW(), ?, NULL, NULL, NULL)
       ON DUPLICATE KEY UPDATE
         plan_id=VALUES(plan_id), billing_cycle=VALUES(billing_cycle),
         status='active', current_period_start=NOW(), current_period_end=VALUES(current_period_end),
         trial_ends_at=NULL, cancelled_at=NULL, cancel_reason=NULL, updated_at=NOW()`,
      [uuidv4(), institutionId, planId, billingCycle || 'monthly', periodEnd]
    );

    // Record billing history
    await db.query(
      `INSERT INTO subscription_billing_history
       (id, institution_id, plan_id, plan_name, billing_cycle, amount, currency, status,
        payment_method, payment_reference, period_start, period_end, invoice_number, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,NOW(),?,?,?)`,
      [uuidv4(), institutionId, planId, plan.name, billingCycle || 'monthly',
       amount, 'INR', 'paid', paymentMethod || 'manual',
       paymentReference || null, periodEnd, invoiceNumber, notes || null]
    );

    logger.info('Plan upgraded', { institutionId, planId, billingCycle, amount });
    return this.getSubscription(institutionId);
  }

  // ─── Cancel ──────────────────────────────────────────────────────────────

  async cancelSubscription(institutionId, { reason }) {
    await ensureTables();
    const sub = await this.getSubscription(institutionId);
    if (sub.status === 'cancelled') throw new Error('Subscription is already cancelled');
    if (sub.status === 'trial') throw new Error('Trial subscriptions cannot be cancelled — they expire automatically');
    if (sub.plan_id === 'plan-free') throw new Error('The Free plan cannot be cancelled');

    await db.query(
      `UPDATE institution_subscriptions
       SET status='cancelled', cancelled_at=NOW(), cancel_reason=?, updated_at=NOW()
       WHERE institution_id=?`,
      [reason || null, institutionId]
    );

    logger.info('Subscription cancelled', { institutionId, reason });
    return { message: 'Subscription cancelled. Access continues until end of current billing period.' };
  }

  // ─── Renew / Reactivate ──────────────────────────────────────────────────

  async renewSubscription(institutionId, { planId, billingCycle, paymentReference, paymentMethod }) {
    return this.upgradePlan(institutionId, { planId, billingCycle, paymentReference, paymentMethod, notes: 'Renewal' });
  }

  // ─── Billing History ─────────────────────────────────────────────────────

  async getBillingHistory(institutionId) {
    await ensureTables();
    return db.query(
      `SELECT * FROM subscription_billing_history
       WHERE institution_id=? ORDER BY created_at DESC`,
      [institutionId]
    );
  }
}

module.exports = new SubscriptionService();
