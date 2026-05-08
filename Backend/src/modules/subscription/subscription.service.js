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

function isMissingTableError(error, tableName = 'subscription_upgrade_requests') {
  const code = String(error?.code || '').toUpperCase();
  const msg = String(error?.message || '').toLowerCase();
  return code === 'ER_NO_SUCH_TABLE' || msg.includes(`.${tableName.toLowerCase()}`) || msg.includes(`'${tableName.toLowerCase()}' doesn't exist`);
}

/**
 * Idempotent seed for default subscription tiers. Table DDL lives in migrations
 * (000_initial_schema / full_install), not in application code.
 */
async function ensureTables() {
  if (tablesReady) return;

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

function planAmount(plan, billingCycle) {
  if (!plan) return 0;
  const y = billingCycle === 'yearly';
  const n = y ? plan.price_yearly : plan.price_monthly;
  return Number(n) || 0;
}

function isPaidPlan(plan, billingCycle) {
  return planAmount(plan, billingCycle) > 0;
}

function paymentGatewayReady() {
  return Boolean(
    config.razorpay.keyId &&
    config.razorpay.keySecret &&
    !String(config.razorpay.keyId).startsWith('rzp_test_xxxx')
  );
}

function attachPaymentMeta(sub) {
  if (!sub) return sub;
  return { ...sub, payment_gateway_ready: paymentGatewayReady() };
}

class SubscriptionService {
  /** Seed default plans if missing; schema must exist (run DB migrations). */
  async ensureTablesReady() {
    await ensureTables();
  }

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

    return attachPaymentMeta(sub);
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

    const amount = planAmount(plan, billingCycle);

    const gatewayReady = paymentGatewayReady();

    if (amount === 0) {
      return { free: true, planId, billingCycle, planName: plan.name, gatewayReady };
    }

    if (!gatewayReady) {
      throw new Error(
        'Online payment is not available. Please contact your platform administrator to upgrade your plan.'
      );
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

  async upgradePlan(institutionId, { planId, billingCycle, paymentReference, paymentMethod, notes }, opts = {}) {
    await ensureTables();
    const plan = await this.getPlanById(planId);

    const amount = planAmount(plan, billingCycle || 'monthly');
    const cycle = billingCycle || 'monthly';

    const targetPaid = isPaidPlan(plan, cycle);
    if (targetPaid && !opts.platformAdminGrant && !paymentReference) {
      const sub = await this.getSubscription(institutionId);
      const currentPlan = await this.getPlanById(sub.plan_id);
      const currentPaid = isPaidPlan(currentPlan, sub.billing_cycle || 'monthly');
      if (!currentPaid) {
        throw new Error(
          'This plan can only be activated by your platform administrator until online billing is enabled.'
        );
      }
    }

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
    periodEnd.setMonth(periodEnd.getMonth() + (cycle === 'yearly' ? 12 : 1));
    const invoiceNumber = `INV-SUB-${Date.now()}`;

    const billingStatus = opts.platformAdminGrant ? 'pending' : 'paid';
    const payMethod = opts.platformAdminGrant ? 'platform_admin' : (paymentMethod || 'manual');

    await db.query(
      `INSERT INTO institution_subscriptions
       (id, institution_id, plan_id, billing_cycle, status, current_period_start, current_period_end, trial_ends_at, cancelled_at, cancel_reason)
       VALUES (?, ?, ?, ?, 'active', NOW(), ?, NULL, NULL, NULL)
       ON DUPLICATE KEY UPDATE
         plan_id=VALUES(plan_id), billing_cycle=VALUES(billing_cycle),
         status='active', current_period_start=NOW(), current_period_end=VALUES(current_period_end),
         trial_ends_at=NULL, cancelled_at=NULL, cancel_reason=NULL, updated_at=NOW()`,
      [uuidv4(), institutionId, planId, cycle, periodEnd]
    );

    await db.query(
      `INSERT INTO subscription_billing_history
       (id, institution_id, plan_id, plan_name, billing_cycle, amount, currency, status,
        payment_method, payment_reference, period_start, period_end, invoice_number, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,NOW(),?,?,?)`,
      [uuidv4(), institutionId, planId, plan.name, cycle,
       amount, 'INR', billingStatus, payMethod,
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

  // ─── Upgrade requests (tenant → platform admin) ──────────────────────────

  async createUpgradeRequest(institutionId, { planId, billingCycle, message }) {
    await ensureTables();
    const pid = (planId || '').trim();
    if (!pid) throw new Error('planId is required');

    let cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const plan = await this.getPlanById(pid);
    const sub = await this.getSubscription(institutionId);

    if (sub.plan_id === pid && sub.billing_cycle === cycle) {
      throw new Error('You are already on this plan and billing cycle.');
    }

    const dup = await db.query(
      `SELECT id FROM subscription_upgrade_requests WHERE institution_id=? AND status='pending' LIMIT 1`,
      [institutionId]
    );
    if (dup.length) {
      throw new Error('You already have a pending upgrade request. Please wait for the platform administrator to review it.');
    }

    const msg = message != null ? String(message).trim().slice(0, 2000) : null;

    const id = uuidv4();
    await db.query(
      `INSERT INTO subscription_upgrade_requests
       (id, institution_id, requested_plan_id, billing_cycle, status, request_message)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [id, institutionId, pid, cycle, msg || null]
    );

    logger.info('Subscription upgrade request created', { institutionId, planId: pid, cycle });
    const [row] = await db.query(
      `SELECT r.*, p.name AS requested_plan_name
       FROM subscription_upgrade_requests r
       JOIN subscription_plans p ON p.id = r.requested_plan_id
       WHERE r.id=?`,
      [id]
    );
    return row;
  }

  async listMyUpgradeRequests(institutionId) {
    await ensureTables();
    try {
      return await db.query(
        `SELECT r.*, p.name AS requested_plan_name
         FROM subscription_upgrade_requests r
         JOIN subscription_plans p ON p.id = r.requested_plan_id
         WHERE r.institution_id=?
         ORDER BY r.created_at DESC`,
        [institutionId]
      );
    } catch (error) {
      if (isMissingTableError(error)) {
        logger.warn('subscription_upgrade_requests table missing; returning empty request list', { institutionId });
        return [];
      }
      throw error;
    }
  }

  async listUpgradeRequestsForPlatform({ status = '', page = 1, limit = 20 }) {
    await ensureTables();
    const pageInt = Math.max(1, parseInt(page, 10) || 1);
    const limitInt = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageInt - 1) * limitInt;
    const limitSql = `${Number(limitInt)}`;
    const offsetSql = `${Number(offset)}`;

    let where = 'WHERE 1=1';
    const params = [];
    if (status === 'pending' || status === 'approved' || status === 'rejected') {
      where += ' AND r.status = ?';
      params.push(status);
    }

    const countRows = await db.query(
      `SELECT COUNT(*) AS c FROM subscription_upgrade_requests r ${where}`,
      params
    );
    const total = Number(countRows[0]?.c || 0);

    const rows = await db.query(
      `SELECT r.*, i.name AS institution_name, i.email AS institution_email,
              p.name AS requested_plan_name
       FROM subscription_upgrade_requests r
       INNER JOIN institutions i ON i.id = r.institution_id
       INNER JOIN subscription_plans p ON p.id = r.requested_plan_id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT ${limitSql} OFFSET ${offsetSql}`,
      params
    );

    return { data: rows, total, page: pageInt, limit: limitInt };
  }

  async approveUpgradeRequest(requestId, platformAdminId, { adminNotes } = {}) {
    await ensureTables();
    const rid = (requestId || '').trim();
    const [reqRow] = await db.query('SELECT * FROM subscription_upgrade_requests WHERE id=?', [rid]);
    if (!reqRow) throw new Error('Request not found');
    if (reqRow.status !== 'pending') throw new Error('Request is no longer pending');

    try {
      await this.upgradePlan(
        reqRow.institution_id,
        {
          planId: reqRow.requested_plan_id,
          billingCycle: reqRow.billing_cycle,
          paymentReference: null,
          paymentMethod: 'platform_admin',
          notes: `Upgrade request ${rid}${adminNotes ? `: ${adminNotes}` : ''}`,
        },
        { platformAdminGrant: true }
      );
    } catch (e) {
      if (e.code === 'DOWNGRADE_BLOCKED') throw e;
      throw e;
    }

    const note = adminNotes != null ? String(adminNotes).trim().slice(0, 2000) : null;
    await db.query(
      `UPDATE subscription_upgrade_requests SET status='approved', reviewed_by=?, reviewed_at=NOW(),
       admin_notes=?, updated_at=NOW() WHERE id=?`,
      [platformAdminId, note || null, rid]
    );

    try {
      const pr = await db.query('SELECT name FROM subscription_plans WHERE id = ?', [reqRow.requested_plan_id]);
      if (pr.length) {
        await db.query('UPDATE institutions SET plan = ?, updated_at = NOW() WHERE id = ?', [
          pr[0].name,
          reqRow.institution_id,
        ]);
      }
    } catch (err) {
      logger.warn('approveUpgradeRequest: institutions.plan sync skipped', { error: err.message });
    }

    logger.info('Subscription upgrade request approved', { requestId: rid, platformAdminId });
    const [out] = await db.query(
      `SELECT r.*, i.name AS institution_name, i.email AS institution_email,
              p.name AS requested_plan_name
       FROM subscription_upgrade_requests r
       INNER JOIN institutions i ON i.id = r.institution_id
       INNER JOIN subscription_plans p ON p.id = r.requested_plan_id
       WHERE r.id=?`,
      [rid]
    );
    return out;
  }

  async rejectUpgradeRequest(requestId, platformAdminId, { adminNotes } = {}) {
    await ensureTables();
    const rid = (requestId || '').trim();
    const [reqRow] = await db.query('SELECT * FROM subscription_upgrade_requests WHERE id=?', [rid]);
    if (!reqRow) throw new Error('Request not found');
    if (reqRow.status !== 'pending') throw new Error('Request is no longer pending');

    const note = adminNotes != null ? String(adminNotes).trim().slice(0, 2000) : null;
    await db.query(
      `UPDATE subscription_upgrade_requests SET status='rejected', reviewed_by=?, reviewed_at=NOW(),
       admin_notes=?, updated_at=NOW() WHERE id=?`,
      [platformAdminId, note || null, rid]
    );

    logger.info('Subscription upgrade request rejected', { requestId: rid, platformAdminId });
    const [out] = await db.query(
      `SELECT r.*, i.name AS institution_name, i.email AS institution_email,
              p.name AS requested_plan_name
       FROM subscription_upgrade_requests r
       INNER JOIN institutions i ON i.id = r.institution_id
       INNER JOIN subscription_plans p ON p.id = r.requested_plan_id
       WHERE r.id=?`,
      [rid]
    );
    return out;
  }
}

module.exports = new SubscriptionService();
