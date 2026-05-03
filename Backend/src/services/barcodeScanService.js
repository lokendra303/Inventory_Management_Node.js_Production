const { v4: uuidv4 } = require('uuid');

// sessionId -> { barcode: string | null, createdAt: Date }
const sessions = new Map();
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Clean up expired sessions every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}, 60_000);

function createSession() {
  const sessionId = uuidv4();
  sessions.set(sessionId, { barcode: null, createdAt: Date.now() });
  return sessionId;
}

function pushBarcode(sessionId, barcode) {
  if (!sessions.has(sessionId)) return false;
  sessions.get(sessionId).barcode = barcode;
  return true;
}

function sessionExists(sessionId) {
  return sessions.has(sessionId);
}

/** For desktop polling: unknown session → ok: false; else current barcode (may be null). */
function pollSession(sessionId) {
  if (!sessions.has(sessionId)) return { ok: false };
  const session = sessions.get(sessionId);
  return { ok: true, barcode: session.barcode };
}

module.exports = { createSession, pushBarcode, sessionExists, pollSession };
