// /api/auth/callback.js
// 구글 OAuth 콜백: 인가 코드를 토큰으로 교환하고, 세션 쿠키에 저장한다.

const { setSessionCookie } = require('../_lib/session');

module.exports = async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    res.writeHead(302, { Location: '/?auth=denied' });
    res.end();
    return;
  }
  if (!code) {
    res.status(400).send('인가 코드가 없습니다.');
    return;
  }

  try {
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenResp.json();
    if (!tokenResp.ok) {
      res.status(502).send('구글 로그인 처리 중 오류가 발생했어요: ' + (tokens.error_description || tokens.error || '알 수 없는 오류'));
      return;
    }

    let email = '';
    try {
      const uiResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (uiResp.ok) {
        const ui = await uiResp.json();
        email = ui.email || '';
      }
    } catch {
      // 이메일 조회 실패는 치명적이지 않음 (표시용일 뿐)
    }

    if (!tokens.refresh_token) {
      // prompt=consent라 보통은 항상 오지만, 혹시 없으면 안내
      res.writeHead(302, { Location: '/?auth=norefresh' });
      res.end();
      return;
    }

    setSessionCookie(res, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry: Date.now() + (tokens.expires_in || 3600) * 1000,
      email,
    });

    res.writeHead(302, { Location: '/?auth=ok' });
    res.end();
  } catch (err) {
    res.status(500).send('로그인 처리 중 오류: ' + err.message);
  }
};
