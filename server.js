const path = require('node:path');
const express = require('express');
const session = require('express-session');
const { login, requireOwner } = require('./src/auth');

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
app.use('/vendor/leaflet', express.static(path.join(__dirname, 'node_modules', 'leaflet', 'dist')));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
  console.log(`Rider Watch listening on http://localhost:${port}`);
});
