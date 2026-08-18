// /api/search.js
// 숲나들e(foresttrip.go.kr)의 "일반예약" 검색 화면이 내부적으로 호출하는
// 비공식 AJAX 엔드포인트를 대신 호출해, 지역/날짜 기준 자연휴양림 예약가능 현황을 가져온다.
//
// 주의: 이 엔드포인트는 숲나들e가 공식적으로 공개한 API가 아니다.
// 페이지 구조가 바뀌면 언제든 깨질 수 있고, 과도한 호출은 상대 서버에 부담을 줄 수 있으므로
// 캐시(Cache-Control)를 걸어 같은 조건의 반복 조회를 줄인다.

const cheerio = require('cheerio');

const BASE = 'https://www.foresttrip.go.kr';
const SEARCH_PAGE = `${BASE}/rep/or/fcfsRsrvtMain.do?hmpgId=FRIP&menuId=001001`;
const SEARCH_API = `${BASE}/rep/or/innerFcfsRcrfrDtlDetls.do`;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// 숲나들e 지역 코드 (selectSiDoList.do 응답 기준)
const REGIONS = {
  '1': '서울/인천/경기',
  '2': '강원',
  '3': '충북',
  '4': '대전/충남',
  '5': '전북',
  '6': '전남광주',
  '7': '대구/경북',
  '8': '부산/경남',
  '9': '제주',
};

function parseSetCookies(headers) {
  // Node(Vercel) fetch: 여러 Set-Cookie 헤더를 한번에 얻는 방법
  let raw = [];
  if (typeof headers.getSetCookie === 'function') {
    raw = headers.getSetCookie();
  } else {
    const single = headers.get('set-cookie');
    if (single) raw = [single];
  }
  const cookies = {};
  for (const line of raw) {
    const first = line.split(';')[0];
    const idx = first.indexOf('=');
    if (idx > -1) cookies[first.slice(0, idx).trim()] = first.slice(idx + 1).trim();
  }
  return cookies;
}

async function getSession() {
  const resp = await fetch(SEARCH_PAGE, { headers: { 'User-Agent': UA } });
  const html = await resp.text();
  const cookies = parseSetCookies(resp.headers);
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  const csrfMatch = html.match(/name="_csrf"\s+value="([^"]+)"/);
  if (!csrfMatch) throw new Error('세션 토큰(_csrf)을 찾지 못했습니다. 숲나들e 페이지 구조가 변경되었을 수 있습니다.');
  return { cookieHeader, csrf: csrfMatch[1] };
}

async function searchRegion({ cookieHeader, csrf }, { region, start, end, people }) {
  const body = {
    srchInsttArcd: region,
    srchInsttId: '',
    srchRsrvtBgDt: start,
    srchRsrvtEdDt: end,
    srchStngNofpr: String(people || 2),
    srchSthngCnt: '1',
    houseCampSctin: '',
    rsrvtPssblYn: '',
    srchHouseCharg: '',
    srchHouseOver: '',
    srchCampCharg: '',
    srchCampOver: '',
    srchMyLtd: '',
    srchMyLng: '',
    srchDstnc: '',
    srchDstncOver: '',
    srtngOrdr: '',
    goodsClsscHouseCdArr: [],
    goodsClsscCampCdArr: [],
    srchInsttTpcd: [],
    cmdogYn: '',
    bbqYn: '',
    dsprsYn: '',
    otsdWeterYn: '',
    wifiYn: '',
    snowPlaceYn: '',
  };

  const resp = await fetch(`${SEARCH_API}?_csrf=${encodeURIComponent(csrf)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Ajax-call': 'true',
      Cookie: cookieHeader,
      'User-Agent': UA,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    throw new Error(`숲나들e 응답 오류 (지역 ${region}, HTTP ${resp.status})`);
  }

  const html = await resp.text();
  const $ = cheerio.load(html);
  const items = [];

  $('.rc_item').each((_, el) => {
    const $el = $(el);
    const statusText = $el.find('.rc_ti i').text().replace(/[\[\]]/g, '').trim();
    const fullName = $el.find('.rc_ti b').text().trim();
    const typeMatch = fullName.match(/^\[(.+?)\]/);
    const type = typeMatch ? typeMatch[1] : '';
    const name = fullName.replace(/^\[.+?\]/, '').trim();
    const image = $el.find('.st_img img').attr('src') || '';
    const address = $el.find('.lnk_locate').text().replace(/ /g, ' ').trim();
    const homepage = $el.find('.lnk_site').attr('href') || '';
    const roomCountMatch = $el.find('.ut_roomcount').text().match(/(\d+)/);
    const roomCount = roomCountMatch ? Number(roomCountMatch[1]) : null;
    const fcltText = $el.find('.st_tit:contains("시설")').next('.st_txt').text();
    const onclick = $el.find('.ut_button a').attr('onclick') || '';
    const insttIdMatch = onclick.match(/fn_fsfsRsrvtPssblGoodsList\('([^']+)'/);

    items.push({
      insttId: insttIdMatch ? insttIdMatch[1] : '',
      region,
      regionName: REGIONS[region] || region,
      type,
      name,
      status: statusText,
      available: statusText === '예약가능',
      roomCount,
      facilities: fcltText.trim(),
      address,
      image,
      homepage,
    });
  });

  return items;
}

module.exports = async (req, res) => {
  try {
    const { region = 'all', start, end, people } = req.query;

    if (!start || !end) {
      res.status(400).json({ error: 'start, end 파라미터(YYYYMMDD)가 필요합니다.' });
      return;
    }
    if (!/^\d{8}$/.test(start) || !/^\d{8}$/.test(end)) {
      res.status(400).json({ error: 'start/end는 YYYYMMDD 형식이어야 합니다.' });
      return;
    }

    const session = await getSession();
    const regionsToQuery = region === 'all' ? Object.keys(REGIONS) : [region];

    if (region !== 'all' && !REGIONS[region]) {
      res.status(400).json({ error: `알 수 없는 지역 코드: ${region}` });
      return;
    }

    const results = [];
    for (const r of regionsToQuery) {
      const items = await searchRegion(session, { region: r, start, end, people });
      results.push(...items);
    }

    // 예약가능 우선, 그 다음 잔여 객실 많은 순
    results.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return (b.roomCount || 0) - (a.roomCount || 0);
    });

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    res.status(200).json({
      start,
      end,
      region,
      count: results.length,
      availableCount: results.filter((i) => i.available).length,
      items: results,
    });
  } catch (err) {
    res.status(502).json({ error: err.message || '조회 중 오류가 발생했습니다.' });
  }
};
