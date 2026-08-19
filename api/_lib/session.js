// 공용 세션 헬퍼: 구글 로그인 토큰을 서명된 쿠키에 저장/검증한다.
// 별도 DB 없이 동작하도록, 쿠키 자체에 access/refresh 토큰을 담고
// HMAC 서명으로 위변조를 막는다. (쿠키 값은 브라우저에만 저장되고
// HttpOnly라 JS로 못 읽는다. 그래도 토큰이 담기니 Secure/HttpOnly 필수.)

const crypto = require('crypto');

const COOKIE_NAME = 'gsess';
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30일

function b64urlEncode(str) {
  return Buffer.from(str, 'utf8').toString('base64url');
}
function b64urlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

function sign(payload) {
  const b64 = b64urlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(b64).digest('hex');
  return `${b64}.${sig}`;
}

function verify(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  const raw = decodeURIComponent(match[1]);
  const idx = raw.lastIndexOf('.');
  if (idx === -1) return null;
  const b64 = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const expected = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(b64).digest('hex');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    return JSON.parse(b64urlDecode(b64));
  } catch {
    return null;
  }
}

function setSessionCookie(res, payload) {
  const value = sign(payload);
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_SEC}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

// 만료됐으면 refresh_token으로 access_token을 갱신한다.
// 갱신이 일어났으면 res에 새 쿠키를 세팅해준다 (res를 넘기지 않으면 세팅 생략).
async function getValidAccessToken(session, res) {
  if (session.expiry && session.expiry > Date.now() + 60_000) {
    return session.access_token;
  }
  if (!session.refresh_token) {
    throw new Error('로그인이 만료됐어요. 다시 로그인해 주세요.');
  }

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: session.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error('로그인이 만료됐어요. 다시 로그인해 주세요.');
  }

  const newSession = {
    ...session,
    access_token: data.access_token,
    expiry: Date.now() + (data.expires_in || 3600) * 1000,
  };
  if (res) setSessionCookie(res, newSession);
  return newSession.access_token;
}

module.exports = {
  COOKIE_NAME,
  sign,
  verify,
  setSessionCookie,
  clearSessionCookie,
  getValidAccessToken,
};
