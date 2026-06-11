const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');

const ACTIVE_WINDOW_MINUTES = parseInt(process.env.SESSION_ACTIVE_WINDOW_MINUTES, 10) || 30;

async function createSession({ userId, institutionId, ipAddress, userAgent }) {
  const id = uuidv4();
  await db.query(
    `INSERT INTO user_sessions (id, user_id, institution_id, ip_address, user_agent, created_at, last_activity_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      id,
      userId,
      institutionId,
      ipAddress || null,
      userAgent ? String(userAgent).slice(0, 512) : null,
    ]
  );
  return id;
}

async function touchSession(sessionId) {
  if (!sessionId) return;
  await db.query(
    `UPDATE user_sessions SET last_activity_at = NOW() WHERE id = ? AND revoked_at IS NULL`,
    [sessionId]
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

module.exports = {
  createSession,
  touchSession,
  assertSessionValid,
  revokeSession,
  revokeUserSessions,
  revokeInstitutionSessions,
  listActiveSessions,
};
