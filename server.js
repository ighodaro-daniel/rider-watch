const path = require('node:path');
const http = require('node:http');
const express = require('express');
const session = require('express-session');
const { login, requireOwner } = require('./src/auth');
const routes = require('./src/routes');
const ws = require('./src/ws');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'rider-watch-local-session',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' }
}));

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
ws.attach(server);

server.listen(port, () => {
  console.log(`Rider Watch listening on http://localhost:${port}`);
});
