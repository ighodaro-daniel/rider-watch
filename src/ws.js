const { WebSocketServer } = require('ws');

let wss = null;

// Attach the live-update socket to the same HTTP server the pages are served from.
function attach(server) {
  wss = new WebSocketServer({ server });

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
