const path = require('node:path');
const fs = require('node:fs');

const configPath = path.join(__dirname, '..', 'config.json');
const loginPagePath = path.join(__dirname, '..', 'public', 'login.html');
const errorSlot = '<!--LOGIN_ERROR-->';

function loginPageWithError(message) {
  return fs.readFileSync(loginPagePath, 'utf8').replace(errorSlot, `<p class="login-error">${message}</p>`);
}

function readConfig() {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function requireOwner(req, res, next) {
  if (req.session.owner) return next();
  return res.redirect('/');
}

function login(req, res) {
  const { username, password } = req.body;
  const config = readConfig();

  if (username === config.username && password === config.password) {
    req.session.owner = true;
    return res.redirect('/dashboard.html');
  }

  return res
    .status(401)
    .type('html')
    .send(loginPageWithError('That owner ID or passphrase is not right. Please try again.'));
}

module.exports = { login, requireOwner };
