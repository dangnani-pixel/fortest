// /api/auth/logout.js
const { clearSessionCookie } = require('../_lib/session');

module.exports = (req, res) => {
  clearSessionCookie(res);
  res.writeHead(302, { Location: '/' });
  res.end();
};
