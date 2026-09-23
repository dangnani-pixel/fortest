// 학명으로 한국어 이름을 찾는다. (api/ 아래라도 _로 시작하는 경로는 Vercel이 라우트로 만들지 않는다.)
// 1) 위키데이터(한 번에 여러 종 조회) → 2) 못 찾은 종만 국가생물종지식정보시스템(국립수목원) 조회.
// 실패해도 예외를 던지지 않고, 찾은 이름(map)과 문제가 있었던 경우의 원인(status)을 돌려준다.
const cheerio = require('cheerio');

const TIMEOUT_MS = 4000;

const hasHangul = (s) => /[가-힣]/.test(s || '');

// "Jynx torquilla Linnaeus, 1758" → "jynx torquilla" (명명자·연도·변종 표기 등을 떼고 속명+종소명만 비교)
const binomial = (s) => String(s || '').trim().split(/\s+/).slice(0, 2).join(' ').toLowerCase();

const errorText = (err) => (err.name === 'TimeoutError' ? '시간 초과' : err.message || '알 수 없는 오류');

async function lookupWikidata(names) {
  const values = names.map((n) => `"${n.replace(/["\\]/g, '')}"`).join(' ');
  const query = `SELECT ?name ?label WHERE {
    VALUES ?name { ${values} }
    ?item wdt:P225 ?name ; rdfs:label ?label .
    FILTER(LANG(?label) = "ko")
  }`;

  const resp = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': 'Meliorism/1.0 (https://github.com/dangnani-pixel/fortest)',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  const map = {};
  for (const b of data.results?.bindings || []) {
    const name = b.name?.value;
    const label = b.label?.value;
    // 한국어 라벨 자리에 학명을 그대로 넣어둔 항목은 번역이 아니므로 건너뛴다.
    if (name && label && label !== name && !map[name]) map[name] = label;
  }
  return map;
}

// 국가생물종지식정보시스템 API 설정. kind별로 요청주소·검색 파라미터·응답 필드 이름이 다르다.
const NATURE_SERVICES = {
  plant: {
    url: 'https://apis.data.go.kr/1400119/KpniService/scnmSearch',
    params: (name) => ({ reqScnm: name }),
    sciField: 'plantSpecsScnm',
    koField: 'plantGnrlNm',
    preferField: 'stpltScnmRltnCdNm', // 정명/이명 구분 — 정명을 우선한다
  },
  bird: {
    url: 'https://apis.data.go.kr/1400119/BirdService/birdIlstrSearch',
    // st=2(학명 부분 검색): API 쪽 학명에는 명명자·연도가 붙어 있어 st=4(학명일치)로는 안 맞을 수 있다.
    params: (name) => ({ st: '2', sw: name }),
    sciField: 'anmlScnm',
    koField: 'anmlGnrlNm',
  },
};

async function lookupNatureOne(name, service, serviceKey) {
  const params = new URLSearchParams({ serviceKey, pageNo: '1', numOfRows: '20', ...service.params(name) });
  const resp = await fetch(`${service.url}?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  const xml = await resp.text();
  const $ = cheerio.load(xml, { xmlMode: true });

  // 인증키 오류 등은 <OpenAPI_ServiceResponse>…<returnAuthMsg> 형태로 온다.
  const authMsg = $('returnAuthMsg').first().text().trim();
  if (authMsg) throw new Error(authMsg);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const resultCode = $('resultCode').first().text().trim();
  if (resultCode && !/^0+$/.test(resultCode)) throw new Error($('resultMsg').first().text().trim() || `resultCode ${resultCode}`);

  const target = binomial(name);
  const matches = $('item')
    .toArray()
    .map((el) => ({
      sci: $(el).find(service.sciField).first().text().trim(),
      ko: $(el).find(service.koField).first().text().trim(),
      prefer: service.preferField ? $(el).find(service.preferField).first().text().includes('정명') : false,
    }))
    .filter((m) => m.ko && binomial(m.sci) === target);
  const best = matches.find((m) => m.prefer) || matches[0];
  return best ? best.ko : '';
}

async function lookupNature(names, kind) {
  const serviceKey = process.env.TOUR_API_KEY;
  if (!serviceKey) throw new Error('TOUR_API_KEY 미설정');
  const service = NATURE_SERVICES[kind];

  const settled = await Promise.allSettled(names.map((n) => lookupNatureOne(n, service, serviceKey)));
  const map = {};
  let firstError = null;
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      if (r.value) map[names[i]] = r.value;
    } else if (!firstError) {
      firstError = r.reason;
    }
  });
  return { map, error: firstError };
}

// kind: 'plant' | 'bird'
async function findKoreanNames(scientificNames, kind) {
  const names = [...new Set(scientificNames.filter(Boolean))];
  const map = {};
  const problems = [];
  if (!names.length) return { map, status: 'ok' };

  try {
    Object.assign(map, await lookupWikidata(names));
  } catch (err) {
    problems.push(`위키데이터 ${errorText(err)}`);
  }

  const missing = names.filter((n) => !map[n]);
  if (missing.length) {
    try {
      const nature = await lookupNature(missing, kind);
      Object.assign(map, nature.map);
      if (nature.error) problems.push(`국가생물종지식정보 ${errorText(nature.error)}`);
    } catch (err) {
      problems.push(`국가생물종지식정보 ${errorText(err)}`);
    }
  }

  return { map, status: problems.length ? problems.join(', ') : 'ok' };
}

module.exports = { findKoreanNames, hasHangul };
