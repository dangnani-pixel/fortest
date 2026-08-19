// /api/auth/me.js
// 현재 로그인 상태를 프런트엔드에 알려준다.

const { verify } = require('../_lib/session');

module.exports = (req, res) => {
  const session = verify(req.headers.cookie);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    loggedIn: !!session,
    email: session ? session.email || null : null,
  });
};
