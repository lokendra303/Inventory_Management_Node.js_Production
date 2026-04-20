const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const config = require('../../config');
const logger = require('../../utils/logger');

let schemaReady = false;

/** Tenant institutions use active/inactive in most DBs; API uses suspended for clarity. */
function institutionStatusToDb(apiStatus) {
  if (apiStatus === 'suspended') return 'inactive';
  if (apiStatus === 'active') return 'active';
  if (apiStatus === 'inactive') return 'inactive';
  return null;
}

async function ensureSchema() {
  if (schemaReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS platform_admins (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(200) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      last_login TIMESTAMP NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_platform_admins_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

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

module.exports = {
  ensureSchema,
  login,
  verifyPlatformToken,
  getDashboardStats,
  listInstitutions,
  getInstitution,
  setInstitutionStatus,
};
