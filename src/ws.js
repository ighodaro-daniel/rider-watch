const crypto = require('node:crypto');
const { WebSocketServer } = require('ws');

let wss = null;

function sessionIdFromCookie(header, secret) {
  const cookie = (header || '').split(';').map((part) => part.trim()).find((part) => part.startsWith('connect.sid='));
  if (!cookie) return null;

  let value;
  try {
    value = decodeURIComponent(cookie.slice('connect.sid='.length));
  } catch {
    return null;
  }
  if (!value.startsWith('s:')) return null;

  const separator = value.lastIndexOf('.');
  if (separator < 2) return null;
  const sessionId = value.slice(2, separator);
  const provided = Buffer.from(value.slice(separator + 1));
  const expected = Buffer.from(crypto.createHmac('sha256', secret).update(sessionId).digest('base64').replace(/=+$/, ''));
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;
  return sessionId;
}

// Attach the live-update socket to the same HTTP server the pages are served from.
function attach(server, sessionStore, sessionSecret) {
  wss = new WebSocketServer({
    server,
    verifyClient: (info, done) => {
      const sessionId = sessionIdFromCookie(info.req.headers.cookie, sessionSecret);
      if (!sessionId) return done(false, 401, 'Owner session required');

      sessionStore.get(sessionId, (error, data) => {
        if (error) {
          console.error(`Could not validate WebSocket session: ${error.message}`);
          return done(false, 500, 'Session validation failed');
        }
        return done(Boolean(data && data.owner), 401, 'Owner session required');
      });
    }
  });

  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'hello' }));
  });

  return wss;
}

// Send a message to every connected dashboard.
function broadcast(message) {
  if (!wss) return;
  const data = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(data);
  }
}

module.exports = { attach, broadcast };
