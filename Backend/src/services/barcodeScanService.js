const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');

// sessionId -> { ws: WebSocket | null, barcode: string | null, createdAt: Date }
const sessions = new Map();
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Clean up expired sessions every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      if (session.ws) session.ws.close();
      sessions.delete(id);
    }
  }
}, 60_000);

function createSession() {
  const sessionId = uuidv4();
  sessions.set(sessionId, { ws: null, barcode: null, createdAt: Date.now() });
  return sessionId;
}

function attachWebSocketServer(server) {
  const wss = new WebSocketServer({ server, path: '/ws/barcode' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId || !sessions.has(sessionId)) {
      ws.close(4001, 'Invalid session');
      return;
    }

    const session = sessions.get(sessionId);
    session.ws = ws;

    // If barcode was already scanned before WS connected, send immediately
    if (session.barcode) {
      ws.send(JSON.stringify({ type: 'barcode', barcode: session.barcode }));
    }

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'barcode' && msg.barcode) {
          session.barcode = msg.barcode;
          ws.send(JSON.stringify({ type: 'ack' }));
        }
      } catch (_) {}
    });

    ws.on('close', () => {
      if (sessions.has(sessionId)) sessions.get(sessionId).ws = null;
    });
  });
}

function pushBarcode(sessionId, barcode) {
  if (!sessions.has(sessionId)) return false;
  const session = sessions.get(sessionId);
  session.barcode = barcode;
  if (session.ws && session.ws.readyState === 1 /* OPEN */) {
    session.ws.send(JSON.stringify({ type: 'barcode', barcode }));
  }
  return true;
}

function sessionExists(sessionId) {
  return sessions.has(sessionId);
}

module.exports = { createSession, attachWebSocketServer, pushBarcode, sessionExists };
