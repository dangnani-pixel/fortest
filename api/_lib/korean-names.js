// 학명(P225, taxon name)으로 위키데이터에 등록된 한국어 이름을 찾는다. 실패하면 map은 비고
// status에 원인이 담긴다. (api/ 아래라도 _로 시작하는 경로는 Vercel이 라우트로 만들지 않는다.)
async function lookupKoreanNames(scientificNames) {
  const names = [...new Set(scientificNames.filter(Boolean))];
  if (!names.length) return { map: {}, status: 'ok' };

  const values = names.map((n) => `"${n.replace(/["\\]/g, '')}"`).join(' ');
  const query = `SELECT ?name ?label WHERE {
    VALUES ?name { ${values} }
    ?item wdt:P225 ?name ; rdfs:label ?label .
    FILTER(LANG(?label) = "ko")
  }`;

  try {
    const resp = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, {
      headers: {
        Accept: 'application/sparql-results+json',
        'User-Agent': 'Meliorism/1.0 (https://github.com/dangnani-pixel/fortest)',
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return { map: {}, status: `HTTP ${resp.status}` };
    const data = await resp.json();
    const map = {};
    for (const b of data.results?.bindings || []) {
      const name = b.name?.value;
      const label = b.label?.value;
      // 한국어 라벨 자리에 학명을 그대로 넣어둔 항목은 번역이 아니므로 건너뛴다.
      if (name && label && label !== name && !map[name]) map[name] = label;
    }
    return { map, status: 'ok' };
  } catch (err) {
    return { map: {}, status: err.name === 'TimeoutError' ? '시간 초과' : err.message || '알 수 없는 오류' };
  }
}

const hasHangul = (s) => /[가-힣]/.test(s || '');

module.exports = { lookupKoreanNames, hasHangul };
