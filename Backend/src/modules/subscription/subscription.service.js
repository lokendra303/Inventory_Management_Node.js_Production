const db = require('../../database/connection');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const config = require('../../config');
const logger = require('../../utils/logger');

const razorpay = new Razorpay({
  key_id:     config.razorpay.keyId,
  key_secret: config.razorpay.keySecret,
});

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

  // Seed plans — INR pricing
  const plans = [
    ['plan-free',         'Free',         'Get started for free. Core inventory features with basic limits.',
      0,      0,       2,   1,    100,   JSON.stringify(['inventory', 'sales', 'purchases', 'price_lists']), 1],
    ['plan-standard',     'Standard',     'For small teams. More capacity and reporting tools.',
      999,    9990,    5,   3,    1000,  JSON.stringify(['inventory', 'sales', 'purchases', 'reports']), 2],
    ['plan-professional', 'Professional', 'For growing businesses. Advanced features and higher limits.',
      2499,   24990,   15,  10,   5000,  JSON.stringify(['inventory', 'sales', 'purchases', 'reports', 'workflows', 'price_lists']), 3],
    ['plan-premium',      'Premium',      'For large teams. Maximum limits with priority support.',
      4999,   49990,   50,  25,   25000, JSON.stringify(['inventory', 'sales', 'purchases', 'reports', 'workflows', 'price_lists']), 4],
    ['plan-enterprise',   'Enterprise',   'Unlimited everything. Full feature access with dedicated support.',
      9999,   99990,   -1,  -1,   -1,    JSON.stringify(['all']), 5],
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

  tablesReady = true;
}

class SubscriptionService {
  async getPlanById(planId) {
    const [plan] = await db.query('SELECT * FROM subscription_plans WHERE id=? AND is_active=1', [planId]);
    if (!plan) throw new Error('Plan not found');
    return plan;
  }

  buildLimitConflicts(plan, usage) {
    const conflicts = [];
    if (plan.max_users !== -1 && usage.users > plan.max_users) {
      conflicts.push({ resource: 'users', current: usage.users, allowed: plan.max_users, path: '/users' });
    }
    if (plan.max_warehouses !== -1 && usage.warehouses > plan.max_warehouses) {
      conflicts.push({ resource: 'warehouses', current: usage.warehouses, allowed: plan.max_warehouses, path: '/warehouses' });
    }
    if (plan.max_items !== -1 && usage.items > plan.max_items) {
      conflicts.push({ resource: 'items', current: usage.items, allowed: plan.max_items, path: '/items' });
    }
    return conflicts;
  }

  async applyResourceDeactivations(institutionId, deactivations = {}) {
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
  }

  pickAutoDeactivations(conflicts = []) {
    const deactivations = { warehouses: [], users: [], items: [] };
    for (const conflict of conflicts) {
      const deactivateCount = Math.max(0, Number(conflict.current) - Number(conflict.allowed));
      const ids = (conflict.records || [])
        .slice(-deactivateCount)
        .map(record => record.id)
        .filter(Boolean);
      if (ids.length) {
        deactivations[conflict.resource] = ids;
      }
    }
    return deactivations;
  }

  async switchToFreePlan(institutionId, { reason, markCancelled = false, deactivations = null, autoDeactivate = false }) {
    const freePlan = await this.getPlanById('plan-free');
    const usage = await this.getUsage(institutionId);
    const conflicts = this.buildLimitConflicts(freePlan, usage);

    if (conflicts.length > 0) {
      let finalDeactivations = deactivations || null;
      if (!finalDeactivations && autoDeactivate) {
        const preview = await this.getDowngradePreview(institutionId, 'plan-free');
        finalDeactivations = this.pickAutoDeactivations(preview.conflicts || []);
      }
      if (finalDeactivations) {
        await this.applyResourceDeactivations(institutionId, finalDeactivations);
      } else {
        const err = new Error('DOWNGRADE_BLOCKED');
        err.code = 'DOWNGRADE_BLOCKED';
        err.conflicts = conflicts;
        err.planName = freePlan.name;
        throw err;
      }
    }

    await db.query(
      `UPDATE institution_subscriptions
       SET plan_id='plan-free', billing_cycle='monthly', status='active',
           cancelled_at=${markCancelled ? 'NOW()' : 'NULL'}, cancel_reason=?,
           current_period_start=NOW(), current_period_end=NULL,
           trial_ends_at=NULL, updated_at=NOW()
       WHERE institution_id=?`,
      [reason || null, institutionId]
    );
  }

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

    sub.days_remaining = sub.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at) - new Date()) / 86400000))
      : null;

    if (sub.status === 'trial' && sub.trial_ends_at && new Date(sub.trial_ends_at) < new Date()) {
      await this.switchToFreePlan(institutionId, {
        reason: 'Trial expired; switched to Free plan',
        markCancelled: false,
        autoDeactivate: true
      });
      return this.getSubscription(institutionId);
    }

    if (sub.status === 'active' && sub.current_period_end && new Date(sub.current_period_end) < new Date()) {
      await this.switchToFreePlan(institutionId, {
        reason: 'Subscription period ended; switched to Free plan',
        markCancelled: false,
        autoDeactivate: true
      });
      return this.getSubscription(institutionId);
    }

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

    if (sub.status === 'trial') return true;

    const usage = await this.getUsage(institutionId);
    const max = { users: sub.max_users, warehouses: sub.max_warehouses, items: sub.max_items }[resource];

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

    if (sub.status === 'trial') return true;

    if (sub.plan_id === 'plan-free' && feature === 'price_lists') return true;

    const features = sub.features || [];
    if (!features.includes('all') && !features.includes(feature)) {
      throw new Error(
        `The "${feature}" feature is not available on your ${sub.plan_name} plan. Please upgrade to access it.`
      );
    }
    return true;
  }

  // ─── Payment (Razorpay) ──────────────────────────────────────────────────

  async createPaymentOrder(institutionId, { planId, billingCycle }) {
    await ensureTables();
    const plan = await this.getPlanById(planId);

    const amount = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;

    // Free plan or dev mode (no Razorpay keys) — activate directly without payment
    const gatewayReady = config.razorpay.keyId &&
                         config.razorpay.keySecret &&
                         !config.razorpay.keyId.startsWith('rzp_test_xxxx');

    if (amount === 0 || !gatewayReady) {
      return { free: true, planId, billingCycle, planName: plan.name, gatewayReady };
    }

    const order = await razorpay.orders.create({
      amount:   Math.round(amount * 100),
      currency: 'INR',
      receipt:  `sub_${institutionId.slice(0, 8)}_${Date.now()}`,
      notes:    { institutionId, planId, billingCycle },
    });

    logger.info('Razorpay order created', { orderId: order.id, institutionId, planId, amount });
    return {
      free:         false,
      planId,
      billingCycle,
      planName:     plan.name,
      amount:       order.amount,
      currency:     order.currency,
      orderId:      order.id,
      keyId:        config.razorpay.keyId,
      gatewayReady: true,
    };
  }

  async verifyAndActivate(institutionId, { planId, billingCycle, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    const expected = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expected !== razorpaySignature) {
      logger.warn('Razorpay signature mismatch', { institutionId, razorpayOrderId, razorpayPaymentId });
      throw new Error('Payment verification failed. Please contact support.');
    }

    logger.info('Razorpay payment verified', { institutionId, razorpayPaymentId, planId });

    return this.upgradePlan(institutionId, {
      planId,
      billingCycle,
      paymentReference: razorpayPaymentId,
      paymentMethod:    'razorpay',
      notes:            `Razorpay Order: ${razorpayOrderId}`,
    });
  }

  // ─── Upgrade ─────────────────────────────────────────────────────────────

  async upgradePlan(institutionId, { planId, billingCycle, paymentReference, paymentMethod, notes }) {
    await ensureTables();
    const plan = await this.getPlanById(planId);

    const amount = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;

    // TODO: Uncomment in production to enforce payment before activation
    // if (amount > 0 && !paymentReference) {
    //   throw new Error('Payment is required to activate this plan. Please use the payment flow.');
    // }

    const usage = await this.getUsage(institutionId);
    const conflicts = this.buildLimitConflicts(plan, usage);

    if (conflicts.length > 0) {
      const err = new Error('DOWNGRADE_BLOCKED');
      err.code      = 'DOWNGRADE_BLOCKED';
      err.conflicts = conflicts;
      err.planName  = plan.name;
      throw err;
    }

    const periodEnd     = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === 'yearly' ? 12 : 1));
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

  // ─── Downgrade Preview ───────────────────────────────────────────────────

  async getDowngradePreview(institutionId, planId) {
    await ensureTables();
    const plan = await this.getPlanById(planId);

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

    await this.applyResourceDeactivations(institutionId, deactivations || {});

    logger.info('Downgrade deactivations applied', { institutionId, planId, deactivations });
    return this.upgradePlan(institutionId, { planId, billingCycle: billingCycle || 'monthly', notes: 'Downgrade with deactivation' });
  }

  // ─── Cancel ──────────────────────────────────────────────────────────────

  async cancelSubscription(institutionId, { reason, deactivations, autoDeactivate = false }) {
    await ensureTables();
    const sub = await this.getSubscription(institutionId);
    if (sub.status === 'cancelled') throw new Error('Subscription is already cancelled');
    if (sub.status === 'trial')     throw new Error('Trial subscriptions cannot be cancelled — they expire automatically');
    if (sub.plan_id === 'plan-free') throw new Error('The Free plan cannot be cancelled');

    await this.switchToFreePlan(institutionId, {
      reason: reason || 'User requested cancellation',
      markCancelled: true,
      deactivations: deactivations || null,
      autoDeactivate: Boolean(autoDeactivate)
    });

    logger.info('Subscription cancelled and switched to Free plan', { institutionId, reason });
    return { message: 'Subscription cancelled. Your account has been switched to the Free plan.' };
  }

  // ─── Renew ───────────────────────────────────────────────────────────────

  async renewSubscription(institutionId, { planId, billingCycle, paymentReference, paymentMethod }) {
    return this.upgradePlan(institutionId, { planId, billingCycle, paymentReference, paymentMethod, notes: 'Renewal' });
  }

  // ─── Billing History ─────────────────────────────────────────────────────

  async getBillingHistory(institutionId) {
    await ensureTables();
    return db.query(
      `SELECT * FROM subscription_billing_history WHERE institution_id=? ORDER BY created_at DESC`,
      [institutionId]
    );
  }
}

module.exports = new SubscriptionService();
