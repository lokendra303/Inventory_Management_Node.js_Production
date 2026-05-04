const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const config = require('../../config');
const logger = require('../../utils/logger');
const subscriptionService = require('../subscription/subscription.service');

/** Feature keys stored in subscription_plans.features JSON; `all` grants every module. */
const PLAN_FEATURE_OPTIONS = [
  { key: 'inventory', label: 'Inventory' },
  { key: 'sales', label: 'Sales' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'reports', label: 'Reports' },
  { key: 'workflows', label: 'Workflows' },
  { key: 'price_lists', label: 'Price lists' },
  { key: 'all', label: 'All features (unlimited modules)' },
];

let schemaReady = false;

/** Institutions use active/inactive in most DBs; API uses suspended for clarity. */
function institutionStatusToDb(apiStatus) {
  if (apiStatus === 'suspended') return 'inactive';
  if (apiStatus === 'active') return 'active';
  if (apiStatus === 'inactive') return 'inactive';
  return null;
}

async function ensureSchema() {
  if (schemaReady) return;

  // platform_admins DDL: migrations / 000_initial_schema — not created at runtime

  const { bootstrapEmail, bootstrapPassword, bootstrapName } = config.platform || {};
  if (bootstrapEmail && bootstrapPassword) {
    const existing = await db.query('SELECT id FROM platform_admins WHERE email = ?', [bootstrapEmail.trim().toLowerCase()]);
    if (existing.length === 0) {
      const hash = await bcrypt.hash(bootstrapPassword, 12);
      const id = uuidv4();
      await db.query(
        `INSERT INTO platform_admins (id, email, password_hash, name, status) VALUES (?, ?, ?, ?, 'active')`,
        [id, bootstrapEmail.trim().toLowerCase(), hash, bootstrapName || 'Platform Admin']
      );
      logger.info('Bootstrap platform admin created', { email: bootstrapEmail.trim().toLowerCase() });
    }
  }

  schemaReady = true;
}

function signPlatformToken(admin) {
  if (!config.jwt?.secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(
    {
      type: 'platform_admin',
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
    },
    config.jwt.secret,
    { expiresIn: config.platform?.jwtExpiresIn || '8h' }
  );
}

async function verifyPlatformToken(token) {
  const decoded = jwt.verify(token, config.jwt.secret);
  if (!decoded || decoded.type !== 'platform_admin' || !decoded.adminId) {
    throw new Error('Invalid platform token');
  }
  const rows = await db.query(
    'SELECT id, email, name, status FROM platform_admins WHERE id = ? AND status = ?',
    [decoded.adminId, 'active']
  );
  if (rows.length === 0) throw new Error('Platform admin not found or inactive');
  return { ...decoded, admin: rows[0] };
}

async function login(email, password) {
  await ensureSchema();
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized || !password) throw new Error('Email and password are required');

  const rows = await db.query(
    'SELECT id, email, password_hash, name, status FROM platform_admins WHERE email = ?',
    [normalized]
  );
  if (rows.length === 0) throw new Error('Invalid email or password');
  const admin = rows[0];
  if (admin.status !== 'active') throw new Error('Account is disabled');

  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok) throw new Error('Invalid email or password');

  await db.query('UPDATE platform_admins SET last_login = NOW() WHERE id = ?', [admin.id]);

  const token = signPlatformToken(admin);
  return {
    token,
    admin: { id: admin.id, email: admin.email, name: admin.name },
  };
}

async function getDashboardStats() {
  await ensureSchema();

  let instRow = {};
  try {
    const instRows = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_count,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS suspended_count
      FROM institutions
    `);
    instRow = instRows[0] || {};
  } catch (e) {
    logger.warn('Platform stats: institutions aggregate failed', { error: e.message });
  }

  const safeCount = async (label, sql, params = []) => {
    try {
      const rows = await db.query(sql, params);
      return Number(rows[0]?.c || 0);
    } catch (e) {
      logger.warn(`Platform stats: ${label} failed`, { error: e.message });
      return 0;
    }
  };

  const activeUsers = await safeCount('users', `SELECT COUNT(*) AS c FROM institution_users WHERE status = 'active'`);
  const activeItems = await safeCount('items', `SELECT COUNT(*) AS c FROM items WHERE status = 'active'`);
  const activeWarehouses = await safeCount('warehouses', `SELECT COUNT(*) AS c FROM warehouses WHERE status = 'active'`);

  let subByStatus = {};
  try {
    const subRows = await db.query(`
      SELECT s.status, COUNT(*) AS c
      FROM institution_subscriptions s
      GROUP BY s.status
    `);
    (subRows || []).forEach((r) => { subByStatus[r.status] = Number(r.c); });
  } catch (e) {
    logger.warn('Platform stats: subscriptions breakdown skipped', { error: e.message });
  }

  return {
    institutions: {
      total: Number(instRow?.total || 0),
      active: Number(instRow?.active_count ?? 0),
      suspended: Number(instRow?.suspended_count ?? 0),
    },
    activeUsers,
    activeItems,
    activeWarehouses,
    subscriptionsByStatus: subByStatus,
  };
}

async function listInstitutions({ page = 1, limit = 20, search = '', status = '' }) {
  await ensureSchema();
  const pageInt = Math.max(1, parseInt(page, 10) || 1);
  const limitInt = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = Math.max(0, (pageInt - 1) * limitInt);
  // LIMIT/OFFSET as prepared-statement placeholders trigger
  // ER_WRONG_ARGUMENTS / "Incorrect arguments to mysqld_stmt_execute" on some MySQL builds.
  const limitSql = `${Number(limitInt)}`;
  const offsetSql = `${Number(offset)}`;

  let where = 'WHERE 1=1';
  const params = [];
  if (search) {
    where += ' AND (i.name LIKE ? OR i.email LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q);
  }
  if (status === 'suspended') {
    where += " AND i.status = 'inactive'";
  } else if (status) {
    where += ' AND i.status = ?';
    params.push(status);
  }

  const countRows = await db.query(`SELECT COUNT(*) AS c FROM institutions i ${where}`, params);
  const total = Number(countRows[0]?.c || 0);

  const baseSelect = `SELECT i.*,
      (SELECT COUNT(*) FROM institution_users u WHERE u.institution_id = i.id AND u.status = 'active') AS user_count,
      (SELECT COUNT(*) FROM items it WHERE it.institution_id = i.id AND it.status = 'active') AS item_count,
      (SELECT COUNT(*) FROM warehouses w WHERE w.institution_id = i.id AND w.status = 'active') AS warehouse_count`;

  const orderByName = `ORDER BY i.name ASC`;

  let rows;
  try {
    rows = await db.query(
      `${baseSelect},
      (SELECT p.name FROM institution_subscriptions s JOIN subscription_plans p ON s.plan_id = p.id WHERE s.institution_id = i.id LIMIT 1) AS plan_name,
      (SELECT s.status FROM institution_subscriptions s WHERE s.institution_id = i.id LIMIT 1) AS subscription_status
     FROM institutions i
     ${where}
     ${orderByName}
     LIMIT ${limitSql} OFFSET ${offsetSql}`,
      params
    );
  } catch (e) {
    logger.warn('Platform institutions list (with subscription columns) failed, retrying minimal', { error: e.message });
    rows = await db.query(
      `${baseSelect}
     FROM institutions i
     ${where}
     ${orderByName}
     LIMIT ${limitSql} OFFSET ${offsetSql}`,
      params
    );
  }

  return { data: rows, total, page: pageInt, limit: limitInt };
}

async function getInstitution(id) {
  await ensureSchema();
  const rows = await db.query('SELECT * FROM institutions WHERE id = ?', [id]);
  if (rows.length === 0) return null;
  const inst = rows[0];

  let users = [];
  try {
    users = await db.query(
      `SELECT id, email, first_name, last_name, role, status, last_login
       FROM institution_users WHERE institution_id = ? ORDER BY email ASC LIMIT 500`,
      [id]
    );
  } catch (e) {
    logger.warn('Platform getInstitution: users query failed', { error: e.message, id });
  }

  let itemCount = 0;
  try {
    const ir = await db.query(`SELECT COUNT(*) AS c FROM items WHERE institution_id = ? AND status = 'active'`, [id]);
    itemCount = Number(ir[0]?.c || 0);
  } catch (e) {
    logger.warn('Platform getInstitution: items count failed', { error: e.message, id });
  }

  let whCount = 0;
  try {
    const wr = await db.query(`SELECT COUNT(*) AS c FROM warehouses WHERE institution_id = ? AND status = 'active'`, [id]);
    whCount = Number(wr[0]?.c || 0);
  } catch (e) {
    logger.warn('Platform getInstitution: warehouses count failed', { error: e.message, id });
  }

  let subscription = null;
  try {
    const sr = await db.query(
      `SELECT s.*, p.name AS plan_name FROM institution_subscriptions s
       LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE s.institution_id = ? LIMIT 1`,
      [id]
    );
    subscription = sr[0] || null;
  } catch (e) {
    logger.warn('Platform getInstitution: subscription query skipped', { error: e.message, id });
  }

  return {
    institution: inst,
    stats: {
      activeUsers: users.filter((u) => u.status === 'active').length,
      activeItems: itemCount,
      activeWarehouses: whCount,
    },
    subscription,
    users,
  };
}

async function setInstitutionStatus(id, apiStatus) {
  await ensureSchema();
  const dbStatus = institutionStatusToDb(apiStatus);
  if (!dbStatus) {
    throw new Error('status must be active, inactive, or suspended');
  }
  let result;
  try {
    result = await db.query('UPDATE institutions SET status = ?, updated_at = NOW() WHERE id = ?', [dbStatus, id]);
  } catch (e) {
    logger.warn('Platform status update without updated_at', { error: e.message });
    result = await db.query('UPDATE institutions SET status = ? WHERE id = ?', [dbStatus, id]);
  }
  if (!result || result.affectedRows === 0) throw new Error('Institution not found');
  return true;
}

const INSTITUTION_PATCH_FIELDS = [
  'name', 'email', 'mobile', 'address', 'city', 'state', 'country', 'postal_code',
  'website', 'contact_person', 'plan', 'institution_type', 'registration_number', 'tax_id',
];

async function updateInstitutionProfile(id, body) {
  await ensureSchema();
  if (!body || typeof body !== 'object') throw new Error('Invalid body');

  const updates = {};
  for (const k of INSTITUTION_PATCH_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, k) || body[k] === undefined) continue;
    let v = body[k];
    if (k === 'name' || k === 'email') {
      if (typeof v !== 'string' || !v.trim()) {
        throw new Error(k === 'email' ? 'Email cannot be empty' : 'Name cannot be empty');
      }
      updates[k] = v.trim();
      continue;
    }
    if (typeof v === 'string') v = v.trim() || null;
    updates[k] = v;
  }
  if (Object.keys(updates).length === 0) throw new Error('No allowed fields to update');

  if (updates.email) {
    const normalized = String(updates.email).trim().toLowerCase();
    const dup = await db.query(
      'SELECT id FROM institutions WHERE email = ? AND id != ?',
      [normalized, id]
    );
    if (dup.length > 0) throw new Error('Email already in use by another institution');
    updates.email = normalized;
  }

  const keys = Object.keys(updates);
  const setClause = keys.map((col) => `${col} = ?`).join(', ');
  const values = keys.map((col) => updates[col]);
  values.push(id);

  let result;
  try {
    result = await db.query(
      `UPDATE institutions SET ${setClause}, updated_at = NOW() WHERE id = ?`,
      values
    );
  } catch (e) {
    logger.warn('Platform institution patch without updated_at', { error: e.message });
    result = await db.query(`UPDATE institutions SET ${setClause} WHERE id = ?`, values);
  }
  if (!result || result.affectedRows === 0) throw new Error('Institution not found');
  return getInstitution(id);
}

function normalizePlanFeatures(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p.map((x) => String(x).trim()).filter(Boolean);
    } catch (_) {
      /* comma-separated */
    }
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function featuresToJson(arr) {
  const list = normalizePlanFeatures(arr);
  const allowed = new Set(PLAN_FEATURE_OPTIONS.map((f) => f.key));
  for (const k of list) {
    if (!allowed.has(k)) {
      throw new Error(`Unknown feature key: ${k}`);
    }
  }
  if (list.includes('all') && list.length > 1) {
    return JSON.stringify(['all']);
  }
  return JSON.stringify(list);
}

function parseLimit(v, field) {
  if (v === '' || v === null || v === undefined) throw new Error(`${field} is required`);
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`${field} must be a number`);
  if (n < -1) throw new Error(`${field} must be ≥ -1 (-1 = unlimited)`);
  return n;
}

function parseMoney(v, field) {
  const n = v === '' || v == null ? 0 : Number(v);
  if (Number.isNaN(n) || n < 0) throw new Error(`${field} must be a non-negative number`);
  return Math.round(n * 100) / 100;
}

async function listSubscriptionPlans() {
  await ensureSchema();
  await subscriptionService.ensureTablesReady();
  try {
    const rows = await db.query(`
      SELECT id, name, description, price_monthly, price_yearly, max_users, max_warehouses, max_items,
             features, is_active, sort_order, created_at
      FROM subscription_plans
      ORDER BY sort_order ASC, name ASC
    `);
    return (rows || []).map((r) => ({
      ...r,
      features: typeof r.features === 'string' ? normalizePlanFeatures(r.features) : normalizePlanFeatures(r.features),
    }));
  } catch (e) {
    logger.warn('Platform listSubscriptionPlans failed', { error: e.message });
    return [];
  }
}

function getPlanFeatureCatalog() {
  return PLAN_FEATURE_OPTIONS;
}

async function createSubscriptionPlan(body) {
  await ensureSchema();
  await subscriptionService.ensureTablesReady();

  const id = (body.id || '').trim();
  if (!id || !/^[a-z0-9][a-z0-9-]{0,62}$/i.test(id)) {
    throw new Error('Plan id is required (letters, numbers, hyphens; max 63 chars)');
  }
  const name = (body.name || '').trim();
  if (!name) throw new Error('Plan name is required');

  const existing = await db.query('SELECT id FROM subscription_plans WHERE id = ?', [id]);
  if (existing.length) throw new Error('A plan with this id already exists');

  const description = body.description != null ? String(body.description) : '';
  const price_monthly = parseMoney(body.price_monthly, 'price_monthly');
  const price_yearly = parseMoney(body.price_yearly, 'price_yearly');
  const max_users = parseLimit(body.max_users, 'max_users');
  const max_warehouses = parseLimit(body.max_warehouses, 'max_warehouses');
  const max_items = parseLimit(body.max_items, 'max_items');
  const featuresJson = featuresToJson(body.features);
  const is_active = body.is_active === false || body.is_active === 0 ? 0 : 1;
  const sort_order = parseInt(body.sort_order, 10);
  const sort = Number.isNaN(sort_order) ? 99 : sort_order;

  await db.query(
    `INSERT INTO subscription_plans
     (id, name, description, price_monthly, price_yearly, max_users, max_warehouses, max_items, features, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, description, price_monthly, price_yearly, max_users, max_warehouses, max_items, featuresJson, is_active, sort]
  );

  const [row] = await db.query('SELECT * FROM subscription_plans WHERE id = ?', [id]);
  return {
    ...row,
    features: normalizePlanFeatures(row.features),
  };
}

async function updateSubscriptionPlan(planId, body) {
  await ensureSchema();
  await subscriptionService.ensureTablesReady();

  const id = (planId || '').trim();
  const cur = await db.query('SELECT * FROM subscription_plans WHERE id = ?', [id]);
  if (!cur.length) throw new Error('Plan not found');

  const updates = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) throw new Error('Name cannot be empty');
    updates.name = name;
  }
  if (body.description !== undefined) updates.description = body.description == null ? '' : String(body.description);
  if (body.price_monthly !== undefined) updates.price_monthly = parseMoney(body.price_monthly, 'price_monthly');
  if (body.price_yearly !== undefined) updates.price_yearly = parseMoney(body.price_yearly, 'price_yearly');
  if (body.max_users !== undefined) updates.max_users = parseLimit(body.max_users, 'max_users');
  if (body.max_warehouses !== undefined) updates.max_warehouses = parseLimit(body.max_warehouses, 'max_warehouses');
  if (body.max_items !== undefined) updates.max_items = parseLimit(body.max_items, 'max_items');
  if (body.features !== undefined) {
    updates.features = featuresToJson(body.features);
  }
  if (body.is_active !== undefined) {
    updates.is_active = body.is_active === false || body.is_active === 0 ? 0 : 1;
  }
  if (body.sort_order !== undefined) {
    const s = parseInt(body.sort_order, 10);
    updates.sort_order = Number.isNaN(s) ? 0 : s;
  }

  const keys = Object.keys(updates);
  if (keys.length === 0) throw new Error('No fields to update');

  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => updates[k]);
  values.push(id);

  await db.query(`UPDATE subscription_plans SET ${setClause} WHERE id = ?`, values);

  const [row] = await db.query('SELECT * FROM subscription_plans WHERE id = ?', [id]);
  return {
    ...row,
    features: normalizePlanFeatures(row.features),
  };
}

/**
 * Apply a subscription plan to an institution without payment (platform operator only).
 * Used while online billing is unavailable or for enterprise allowlisting.
 */
async function assignInstitutionSubscription(institutionId, body = {}) {
  await ensureSchema();
  await subscriptionService.ensureTablesReady();

  const id = (institutionId || '').trim();
  const inst = await db.query('SELECT id FROM institutions WHERE id = ?', [id]);
  if (!inst.length) throw new Error('Institution not found');

  const planId = (body.planId || body.plan_id || '').trim();
  if (!planId) throw new Error('planId is required');

  let billingCycle = body.billingCycle || body.billing_cycle || 'monthly';
  if (!['monthly', 'yearly'].includes(billingCycle)) billingCycle = 'monthly';

  const notesRaw = body.notes != null ? String(body.notes) : '';
  const notes = notesRaw.trim() ? notesRaw.trim().slice(0, 2000) : 'Assigned by platform administrator';

  await subscriptionService.upgradePlan(
    id,
    {
      planId,
      billingCycle,
      paymentReference: null,
      paymentMethod: 'platform_admin',
      notes,
    },
    { platformAdminGrant: true }
  );

  let planLabel = planId;
  try {
    const pr = await db.query('SELECT name FROM subscription_plans WHERE id = ?', [planId]);
    if (pr.length) planLabel = pr[0].name;
  } catch (e) {
    logger.warn('assignInstitutionSubscription: plan name lookup failed', { error: e.message, planId });
  }

  try {
    await db.query('UPDATE institutions SET plan = ?, updated_at = NOW() WHERE id = ?', [planLabel, id]);
  } catch (e) {
    logger.warn('assignInstitutionSubscription: institutions.plan sync skipped', { error: e.message, id });
  }

  return getInstitution(id);
}

/**
 * Platform-admin view of an institution's audit trail. Mirrors audit.controller.getAuditTrail
 * but scoped to an arbitrary institution (read-only, no institution context needed
 * because platform admins operate outside any institution).
 *
 * @param {string} institutionId
 * @param {{ entityType?: string, action?: string, userId?: string, search?: string,
 *   startDate?: string, endDate?: string, page?: number|string, limit?: number|string }} query
 */
async function listInstitutionAuditLogs(institutionId, query = {}) {
  await ensureSchema();
  if (!institutionId) throw new Error('institutionId is required');

  const inst = await db.query('SELECT id FROM institutions WHERE id = ?', [institutionId]);
  if (!inst.length) return null;

  const pageInt = Math.max(1, parseInt(query.page, 10) || 1);
  const limitInt = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));
  const offset = (pageInt - 1) * limitInt;

  const where = ['al.institution_id = ?'];
  const params = [institutionId];
  const joinParams = [institutionId];

  if (query.entityType) { where.push('al.entity_type = ?'); params.push(query.entityType); }
  if (query.action)     { where.push('al.action = ?'); params.push(query.action); }
  if (query.userId)     { where.push('al.user_id = ?'); params.push(query.userId); }
  if (query.startDate)  { where.push('DATE(al.created_at) >= ?'); params.push(query.startDate); }
  if (query.endDate)    { where.push('DATE(al.created_at) <= ?'); params.push(query.endDate); }
  if (query.search) {
    where.push('(al.entity_id LIKE ? OR al.path LIKE ? OR al.description LIKE ? OR al.action LIKE ? OR al.entity_type LIKE ?)');
    const like = `%${query.search}%`;
    params.push(like, like, like, like, like);
  }
  const whereSql = where.join(' AND ');

  let total = 0;
  try {
    const countRows = await db.query(
      `SELECT COUNT(*) AS c FROM audit_logs al WHERE ${whereSql}`,
      params
    );
    total = Number(countRows[0]?.c || 0);
  } catch (e) {
    logger.warn('Platform listInstitutionAuditLogs: count failed', { error: e.message, institutionId });
    return { data: [], total: 0, page: pageInt, limit: limitInt, filters: { entityTypes: [], actions: [] } };
  }

  const rows = await db.query(
    `SELECT al.id, al.institution_id, al.user_id, al.entity_type, al.entity_id,
            al.action, al.method, al.path, al.status_code, al.duration,
            al.ip_address, al.description, al.changes, al.request_body, al.created_at,
            CONCAT(COALESCE(iu.first_name,''), ' ', COALESCE(iu.last_name,'')) AS user_name,
            iu.email AS user_email,
            iu.role  AS user_role
       FROM audit_logs al
       LEFT JOIN institution_users iu
              ON iu.id = al.user_id AND iu.institution_id = ?
      WHERE ${whereSql}
      ORDER BY al.created_at DESC
      LIMIT ${limitInt} OFFSET ${offset}`,
    [...joinParams, ...params]
  );

  const data = rows.map((r) => ({
    ...r,
    user_name: (r.user_name || '').trim() || null,
    changes: safeJson(r.changes),
    request_body: safeJson(r.request_body),
  }));

  let entityTypes = [];
  let actions = [];
  try {
    const et = await db.query(
      `SELECT DISTINCT entity_type FROM audit_logs WHERE institution_id = ? AND entity_type IS NOT NULL AND entity_type <> '' ORDER BY entity_type`,
      [institutionId]
    );
    entityTypes = et.map((r) => r.entity_type);
    const ac = await db.query(
      `SELECT DISTINCT action FROM audit_logs WHERE institution_id = ? AND action IS NOT NULL AND action <> '' ORDER BY action`,
      [institutionId]
    );
    actions = ac.map((r) => r.action);
  } catch (e) {
    logger.warn('Platform listInstitutionAuditLogs: filter options failed', { error: e.message, institutionId });
  }

  return {
    data,
    total,
    page: pageInt,
    limit: limitInt,
    filters: { entityTypes, actions },
  };
}

function safeJson(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return value; }
}

async function getRecentTenantLogins(limit = 30) {
  await ensureSchema();
  const n = Math.min(100, Math.max(5, parseInt(limit, 10) || 30));
  const limitSql = `${Number(n)}`;
  try {
    return await db.query(`
      SELECT u.id AS user_id, u.email, u.first_name, u.last_name, u.role, u.last_login, u.status AS user_status,
             i.id AS institution_id, i.name AS institution_name, i.status AS institution_status
      FROM institution_users u
      INNER JOIN institutions i ON i.id = u.institution_id
      WHERE u.last_login IS NOT NULL
      ORDER BY u.last_login DESC
      LIMIT ${limitSql}
    `);
  } catch (e) {
    logger.warn('Platform getRecentTenantLogins failed', { error: e.message });
    return [];
  }
}

async function exportInstitutionsCsv() {
  await ensureSchema();
  const rows = await db.query(`
    SELECT i.id, i.name, i.email, i.mobile, i.status, i.city, i.state, i.country, i.plan, i.contact_person,
           (SELECT COUNT(*) FROM institution_users u WHERE u.institution_id = i.id AND u.status = 'active') AS active_users,
           (SELECT COUNT(*) FROM items it WHERE it.institution_id = i.id AND it.status = 'active') AS active_items
    FROM institutions i
    ORDER BY i.name ASC
  `);

  const headers = [
    'id', 'name', 'email', 'mobile', 'status', 'city', 'state', 'country', 'plan', 'contact_person',
    'active_users', 'active_items',
  ];
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(',')];
  for (const r of rows || []) {
    lines.push(headers.map((h) => esc(r[h])).join(','));
  }
  return lines.join('\r\n');
}

module.exports = {
  ensureSchema,
  login,
  verifyPlatformToken,
  getDashboardStats,
  listInstitutions,
  getInstitution,
  setInstitutionStatus,
  updateInstitutionProfile,
  listSubscriptionPlans,
  getPlanFeatureCatalog,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  getRecentTenantLogins,
  exportInstitutionsCsv,
  listInstitutionAuditLogs,
  assignInstitutionSubscription,
};
