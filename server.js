const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const express = require('express');
const session = require('express-session');
const { login, requireOwner } = require('./src/auth');
const routes = require('./src/routes');
const ws = require('./src/ws');

const app = express();
const port = Number(process.env.PORT || 3000);
const shareMode = process.argv.includes('--share');
const cloudflaredPath = process.env.CLOUDFLARED_BIN || (() => {
  const localBinary = path.join(os.homedir(), '.local', 'bin', 'cloudflared');
  return fs.existsSync(localBinary) ? localBinary : 'cloudflared';
})();
let tunnelProcess = null;
let tunnelUrlReady = false;
let shuttingDown = false;
const sessionSecret = process.env.SESSION_SECRET || (shareMode ? crypto.randomBytes(32).toString('hex') : 'rider-watch-local-session');
const sessionStore = new session.MemoryStore();

if (shareMode) app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(session({
  secret: sessionSecret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false }
}));

// Share mode is reached two ways: the temporary HTTPS tunnel, and plain
// http://localhost for the owner. Mark the login cookie Secure only when the
// request really is HTTPS; otherwise a local sign-in is quietly dropped and the
// dashboard bounces straight back to the login page.
app.use((req, res, next) => {
  if (req.secure) req.session.cookie.secure = true;
  next();
});

app.get('/', (req, res) => {
  if (req.session.owner) return res.redirect('/dashboard.html');
  return res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', login);
app.get('/dashboard.html', requireOwner, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// The page a rider opens from their tracking link. No login: the token in the
// URL identifies the rider.
app.get('/track/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'rider.html'));
});

app.use(routes);
app.use('/vendor/leaflet', express.static(path.join(__dirname, 'node_modules', 'leaflet', 'dist')));
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
ws.attach(server, sessionStore, sessionSecret);

server.listen(port, () => {
  console.log(`Rider Watch listening on http://localhost:${port}`);
  if (!shareMode) return;

  tunnelProcess = spawn(cloudflaredPath, ['tunnel', '--url', `http://127.0.0.1:${port}`], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  for (const stream of [tunnelProcess.stdout, tunnelProcess.stderr]) {
    createInterface({ input: stream }).on('line', (line) => {
      const url = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)?.[0];
      if (url && !tunnelUrlReady) {
        tunnelUrlReady = true;
        app.locals.publicBaseUrl = url;
        console.log(`Phone-test HTTPS link base: ${url}`);
      } else {
        console.log(`[cloudflared] ${line}`);
      }
    });
  }

  tunnelProcess.on('error', (error) => {
    failShare(`Could not start cloudflared: ${error.message}. Install it from https://developers.cloudflare.com/tunnel/downloads/ or set CLOUDFLARED_BIN.`);
  });

  tunnelProcess.on('exit', (code, signal) => {
    if (shuttingDown) return;
    failShare(`The Cloudflare Quick Tunnel stopped (${signal || `exit ${code}`}).`);
  });
});

function failShare(message) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error(message);
  if (tunnelProcess && tunnelProcess.exitCode === null) tunnelProcess.kill('SIGTERM');
  server.close(() => {
    process.exitCode = 1;
  });
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (tunnelProcess && tunnelProcess.exitCode === null) tunnelProcess.kill('SIGTERM');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
