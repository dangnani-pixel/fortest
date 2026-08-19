// /api/remind.js
// 사용자가 입력한 "예약 오픈 요일/시간" 규칙으로 다음 오픈 시점을 계산해
// 구글 캘린더에 일정을 등록한다.
//
// 규칙은 사용자가 직접 입력한다 (휴양림마다 오픈 규칙이 다르고,
// 이를 100% 신뢰성 있게 자동으로 알아낼 방법이 없어서 안전하게 수동 입력으로 처리).

const { verify, getValidAccessToken } = require('./_lib/session');

const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// Vercel 서버리스 함수는 UTC로 돈다. 사용자가 입력한 "오전 9시" 등은
// 항상 한국시간(KST) 기준으로 해석해야 하므로, 서버 로컬 타임존에
// 의존하지 않고 직접 KST <-> UTC epoch 변환을 한다.
function seoulNow() {
  const shifted = new Date(Date.now() + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(), // 0-based
    date: shifted.getUTCDate(),
    day: shifted.getUTCDay(), // 0=일요일
  };
}

// (year, month(0-based), date, hh, mm)을 "한국시간 기준"으로 보고 실제 UTC epoch(ms)로 변환.
// Date.UTC가 범위를 벗어난 날짜(예: 32일)도 알아서 다음달로 정규화해준다.
function seoulToEpoch(year, month, date, hh, mm) {
  return Date.UTC(year, month, date, hh, mm, 0, 0) - KST_OFFSET_MS;
}

function nextOccurrence({ type, dayOfWeek, dayOfMonth, time, date }) {
  const [hh, mm] = String(time || '09:00').split(':').map(Number);
  const nowEpoch = Date.now();
  const now = seoulNow();

  if (type === 'once') {
    const [y, m, d] = String(date).split('-').map(Number);
    return new Date(seoulToEpoch(y, m - 1, d, hh, mm));
  }

  if (type === 'monthly') {
    let epoch = seoulToEpoch(now.year, now.month, Number(dayOfMonth), hh, mm);
    if (epoch <= nowEpoch) {
      epoch = seoulToEpoch(now.year, now.month + 1, Number(dayOfMonth), hh, mm);
    }
    return new Date(epoch);
  }

  // weekly (기본값)
  const diff = (Number(dayOfWeek) - now.day + 7) % 7;
  let epoch = seoulToEpoch(now.year, now.month, now.date + diff, hh, mm);
  if (epoch <= nowEpoch) {
    epoch = seoulToEpoch(now.year, now.month, now.date + diff + 7, hh, mm);
  }
  return new Date(epoch);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 요청만 지원합니다.' });
    return;
  }

  const session = verify(req.headers.cookie);
  if (!session) {
    res.status(401).json({ error: '먼저 구글 로그인이 필요해요.' });
    return;
  }

  try {
    const body = req.body || {};
    const { name, homepage, type, dayOfWeek, dayOfMonth, time, date } = body;

    if (!name || !type || !time) {
      res.status(400).json({ error: '필수 정보가 빠졌어요.' });
      return;
    }
    if (type === 'weekly' && (dayOfWeek === undefined || dayOfWeek === null || dayOfWeek === '')) {
      res.status(400).json({ error: '요일을 선택해 주세요.' });
      return;
    }
    if (type === 'monthly' && !dayOfMonth) {
      res.status(400).json({ error: '날짜(일)를 선택해 주세요.' });
      return;
    }
    if (type === 'once' && !date) {
      res.status(400).json({ error: '날짜를 선택해 주세요.' });
      return;
    }

    const openAt = nextOccurrence({
      type,
      dayOfWeek: dayOfWeek === undefined ? undefined : Number(dayOfWeek),
      dayOfMonth: dayOfMonth ? Number(dayOfMonth) : undefined,
      time,
      date,
    });
    const endAt = new Date(openAt.getTime() + 30 * 60 * 1000);

    const accessToken = await getValidAccessToken(session, res);

    const ruleText =
      type === 'weekly'
        ? `매주 ${DOW_KO[Number(dayOfWeek)]}요일 ${time}`
        : type === 'monthly'
        ? `매월 ${dayOfMonth}일 ${time}`
        : `${date} ${time}`;

    const event = {
      summary: `🌲 ${name} 예약 오픈`,
      description: [
        '자연휴양림 빈자리 조회에서 등록한 예약 알림입니다.',
        `등록한 규칙: ${ruleText}`,
        homepage ? `홈페이지: ${homepage}` : '',
        '숲나들e: https://www.foresttrip.go.kr',
      ]
        .filter(Boolean)
        .join('\n'),
      start: { dateTime: openAt.toISOString(), timeZone: 'Asia/Seoul' },
      end: { dateTime: endAt.toISOString(), timeZone: 'Asia/Seoul' },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'popup', minutes: 0 },
        ],
      },
    };

    const calResp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });
    const calData = await calResp.json();

    if (!calResp.ok) {
      res.status(502).json({ error: '캘린더 등록 실패: ' + (calData.error?.message || 'Google Calendar API 오류') });
      return;
    }

    res.status(200).json({
      ok: true,
      htmlLink: calData.htmlLink,
      openAt: openAt.toISOString(),
      ruleText,
    });
  } catch (err) {
    const status = /로그인/.test(err.message) ? 401 : 500;
    res.status(status).json({ error: err.message || '서버 오류가 발생했어요.' });
  }
};
