const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');
const ipGeolocation = require('../../services/ipGeolocation.service');

const LOCATION_COLUMNS = `location_city, location_region, location_country, location_country_code, location_label`;

async function saveSessionLocation(sessionId, geo) {
  if (!sessionId || !geo?.label) return;
  try {
    await db.query(
      `UPDATE user_sessions
          SET location_city = ?, location_region = ?, location_country = ?,
              location_country_code = ?, location_label = ?
        WHERE id = ?`,
      [
        geo.city,
        geo.region,
        geo.country,
        geo.country_code,
        geo.label,
        sessionId,
      ]
    );
  } catch (e) {
    logger.warn('saveSessionLocation failed', { sessionId, error: e.message });
  }
}

async function resolveSessionLocation(sessionId, ipAddress) {
  if (!sessionId || !ipAddress) return null;
  try {
    const rows = await db.query(
      `SELECT location_label FROM user_sessions WHERE id = ? LIMIT 1`,
      [sessionId]
    );
    if (rows[0]?.location_label) {
      return rows[0];
    }
  } catch (e) {
    logger.warn('resolveSessionLocation: read failed', { sessionId, error: e.message });
  }

  const geo = await ipGeolocation.lookupIp(ipAddress);
  if (geo) {
    await saveSessionLocation(sessionId, geo);
  }
  return geo;
}

function mapLocationFields(row) {
  return {
    location_city: row.location_city || null,
    location_region: row.location_region || null,
    location_country: row.location_country || null,
    location_country_code: row.location_country_code || null,
    location_label: row.location_label || null,
  };
}

const ACTIVE_WINDOW_MINUTES = parseInt(process.env.SESSION_ACTIVE_WINDOW_MINUTES, 10) || 30;

async function createSession({ userId, institutionId, ipAddress, userAgent }) {
  const id = uuidv4();
  const normalizedIp = ipGeolocation.normalizeIp(ipAddress);
  await db.query(
    `INSERT INTO user_sessions (id, user_id, institution_id, ip_address, user_agent, created_at, last_activity_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      id,
      userId,
      institutionId,
      normalizedIp,
      userAgent ? String(userAgent).slice(0, 512) : null,
    ]
  );
  setImmediate(() => {
    resolveSessionLocation(id, normalizedIp).catch((err) => {
      logger.debug('Background session geolocation failed', { sessionId: id, error: err.message });
    });
  });
  return id;
}

const SESSION_TOUCH_INTERVAL_SEC = parseInt(process.env.SESSION_TOUCH_INTERVAL_SEC, 10) || 60;

async function touchSession(sessionId) {
  if (!sessionId) return;
  // Throttle writes — at most one UPDATE per session per interval
  await db.query(
    `UPDATE user_sessions SET last_activity_at = NOW()
     WHERE id = ? AND revoked_at IS NULL
       AND (last_activity_at IS NULL OR last_activity_at < DATE_SUB(NOW(), INTERVAL ? SECOND))`,
    [sessionId, SESSION_TOUCH_INTERVAL_SEC]
  );
}

async function assertSessionValid(sessionId) {
  if (!sessionId) return;
  const rows = await db.query(
    `SELECT id, revoked_at FROM user_sessions WHERE id = ? LIMIT 1`,
    [sessionId]
  );
  if (rows.length === 0 || rows[0].revoked_at) {
    const err = new Error('Session has been revoked');
    err.code = 'SESSION_REVOKED';
    throw err;
  }
}

async function revokeSession(sessionId, revokedBy = null, reason = null) {
  const result = await db.query(
    `UPDATE user_sessions
        SET revoked_at = NOW(), revoked_by = ?, revoke_reason = ?
      WHERE id = ? AND revoked_at IS NULL`,
    [revokedBy, reason, sessionId]
  );
  return result.affectedRows || 0;
}

async function revokeUserSessions(userId, revokedBy = null, reason = null) {
  const result = await db.query(
    `UPDATE user_sessions
        SET revoked_at = NOW(), revoked_by = ?, revoke_reason = ?
      WHERE user_id = ? AND revoked_at IS NULL`,
    [revokedBy, reason, userId]
  );
  return result.affectedRows || 0;
}

async function revokeInstitutionSessions(institutionId, revokedBy = null, reason = null) {
  const result = await db.query(
    `UPDATE user_sessions
        SET revoked_at = NOW(), revoked_by = ?, revoke_reason = ?
      WHERE institution_id = ? AND revoked_at IS NULL`,
    [revokedBy, reason, institutionId]
  );
  return result.affectedRows || 0;
}

async function listActiveSessions({ institutionId, search, page = 1, limit = 50 } = {}) {
  const pageInt = Math.max(1, parseInt(page, 10) || 1);
  const limitInt = Math.min(100, Math.max(5, parseInt(limit, 10) || 50));
  const offset = (pageInt - 1) * limitInt;

  const where = [
    's.revoked_at IS NULL',
    `s.last_activity_at >= DATE_SUB(NOW(), INTERVAL ${Number(ACTIVE_WINDOW_MINUTES)} MINUTE)`,
  ];
  const params = [];

  if (institutionId) {
    where.push('s.institution_id = ?');
    params.push(institutionId);
  }

  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    where.push('(u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR i.name LIKE ?)');
    params.push(q, q, q, q);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countRows = await db.query(
    `SELECT COUNT(*) AS total
       FROM user_sessions s
       INNER JOIN institution_users u ON u.id = s.user_id
       INNER JOIN institutions i ON i.id = s.institution_id
     ${whereSql}`,
    params
  );
  const total = countRows[0]?.total || 0;

  const limitSql = `${Number(limitInt)}`;
  const offsetSql = `${Number(offset)}`;

  const data = await db.query(
    `SELECT s.id AS session_id, s.user_id, s.institution_id, s.ip_address, s.user_agent,
            s.created_at, s.last_activity_at,
            s.location_city, s.location_region, s.location_country,
            s.location_country_code, s.location_label,
            u.email, u.first_name, u.last_name, u.role, u.status AS user_status,
            i.name AS institution_name, i.status AS institution_status
       FROM user_sessions s
       INNER JOIN institution_users u ON u.id = s.user_id
       INNER JOIN institutions i ON i.id = s.institution_id
     ${whereSql}
      ORDER BY s.last_activity_at DESC
      LIMIT ${limitSql} OFFSET ${offsetSql}`,
    params
  );

  return { data, total, page: pageInt, limit: limitInt, activeWindowMinutes: ACTIVE_WINDOW_MINUTES };
}

async function getSessionDetail(sessionId, { operationsLimit = 50 } = {}) {
  if (!sessionId) throw new Error('sessionId is required');

  const rows = await db.query(
    `SELECT s.id AS session_id, s.user_id, s.institution_id, s.ip_address, s.user_agent,
            s.created_at, s.last_activity_at, s.revoked_at, s.revoke_reason,
            s.location_city, s.location_region, s.location_country,
            s.location_country_code, s.location_label,
            UNIX_TIMESTAMP(s.created_at) AS created_unix,
            UNIX_TIMESTAMP(s.last_activity_at) AS last_activity_unix,
            UNIX_TIMESTAMP(s.revoked_at) AS revoked_unix,
            u.email, u.first_name, u.last_name, u.role, u.status AS user_status,
            u.mobile, u.department, u.designation, u.employee_id, u.last_login,
            u.two_factor_enabled,
            i.name AS institution_name, i.status AS institution_status, i.email AS institution_email,
            i.plan AS institution_plan, i.city AS institution_city, i.country AS institution_country
       FROM user_sessions s
       INNER JOIN institution_users u ON u.id = s.user_id
       INNER JOIN institutions i ON i.id = s.institution_id
      WHERE s.id = ?
      LIMIT 1`,
    [sessionId]
  );

  if (!rows.length) return null;

  const row = rows[0];
  if (!row.location_label && row.ip_address) {
    await resolveSessionLocation(sessionId, row.ip_address);
    const refreshed = await db.query(
      `SELECT ${LOCATION_COLUMNS} FROM user_sessions WHERE id = ? LIMIT 1`,
      [sessionId]
    );
    if (refreshed[0]) {
      Object.assign(row, refreshed[0]);
    }
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const createdSec = Number(row.created_unix) || 0;
  const lastActiveSec = Number(row.last_activity_unix) || createdSec;
  const revokedSec = row.revoked_unix != null ? Number(row.revoked_unix) : null;
  const activeCutoffSec = nowSec - ACTIVE_WINDOW_MINUTES * 60;
  const isActive = !row.revoked_at && lastActiveSec >= activeCutoffSec;
  const endSec = revokedSec ?? nowSec;

  const opLimit = Math.min(100, Math.max(5, parseInt(operationsLimit, 10) || 50));

  let recentOperations = [];
  let operationCount = 0;
  try {
    const countRows = await db.query(
      `SELECT COUNT(*) AS c
         FROM audit_logs
        WHERE user_id = ? AND institution_id = ? AND created_at >= ?`,
      [row.user_id, row.institution_id, row.created_at]
    );
    operationCount = Number(countRows[0]?.c || 0);

    recentOperations = await db.query(
      `SELECT id, action, entity_type, entity_id, method, path, status_code,
              description, ip_address, created_at, duration
         FROM audit_logs
        WHERE user_id = ? AND institution_id = ? AND created_at >= ?
        ORDER BY created_at DESC
        LIMIT ${Number(opLimit)}`,
      [row.user_id, row.institution_id, row.created_at]
    );
  } catch (e) {
    logger.warn('getSessionDetail: audit logs failed', { error: e.message, sessionId });
  }

  let otherActiveSessions = 0;
  try {
    const otherRows = await db.query(
      `SELECT COUNT(*) AS c
         FROM user_sessions
        WHERE user_id = ? AND id <> ? AND revoked_at IS NULL
          AND last_activity_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [row.user_id, sessionId, ACTIVE_WINDOW_MINUTES]
    );
    otherActiveSessions = Number(otherRows[0]?.c || 0);
  } catch (e) {
    logger.warn('getSessionDetail: other sessions count failed', { error: e.message, sessionId });
  }

  return {
    session: {
      session_id: row.session_id,
      created_at: row.created_at,
      last_activity_at: row.last_activity_at,
      revoked_at: row.revoked_at,
      revoke_reason: row.revoke_reason,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      ...mapLocationFields(row),
      is_active: isActive,
      active_window_minutes: ACTIVE_WINDOW_MINUTES,
      created_unix: createdSec,
      last_activity_unix: lastActiveSec,
      revoked_unix: revokedSec,
      duration_seconds: Math.max(0, endSec - createdSec),
      idle_seconds: Math.max(0, endSec - lastActiveSec),
    },
    user: {
      user_id: row.user_id,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      role: row.role,
      status: row.user_status,
      mobile: row.mobile,
      department: row.department,
      designation: row.designation,
      employee_id: row.employee_id,
      last_login: row.last_login,
      two_factor_enabled: Boolean(row.two_factor_enabled),
    },
    institution: {
      institution_id: row.institution_id,
      name: row.institution_name,
      status: row.institution_status,
      email: row.institution_email,
      plan: row.institution_plan,
      city: row.institution_city,
      country: row.institution_country,
    },
    stats: {
      operations_in_session: operationCount,
      other_active_sessions: otherActiveSessions,
    },
    recent_operations: recentOperations,
  };
}

module.exports = {
  createSession,
  touchSession,
  assertSessionValid,
  revokeSession,
  revokeUserSessions,
  revokeInstitutionSessions,
  listActiveSessions,
  getSessionDetail,
};
