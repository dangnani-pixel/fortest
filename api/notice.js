// /api/notice.js
// 특정 휴양림의 "선착순 예약정책" 안내 원문을 가져온다.
// 예약 오픈 규칙(요일/시간 등)은 사용자가 직접 입력해야 하므로(정형 데이터가 없음),
// 그 판단에 참고할 수 있도록 공식 정책 원문을 그대로 보여주는 용도.
//
// 숲나들e는 시설마다 hmpgId만 다르고 나머지 URL(menuId=004001001&ruleId=101)은
// 공통이라, 이 조합으로 "선착순 예약정책" 페이지를 바로 찾을 수 있다.

const cheerio = require('cheerio');

const BASE = 'https://www.foresttrip.go.kr';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// 숲나들e 홈페이지 URL 패턴에서 hmpgId를 뽑아낸다.
// - https://www.foresttrip.go.kr/indvz/main.do?hmpgId=ID0203xxxx (쿼리 파라미터)
// - http://www.foresttrip.go.kr/0102 (경로 끝이 숫자 코드)
function extractHmpgIdFromUrl(homepage) {
  try {
    const u = new URL(homepage);
    const q = u.searchParams.get('hmpgId');
    if (q) return q;
    const seg = u.pathname.replace(/\/$/, '').split('/').pop();
    if (seg && /^\d+$/.test(seg)) return seg;
  } catch {
    // homepage가 URL이 아니면 무시
  }
  return null;
}

// 사립/공립 휴양림은 자체 서브도메인(예: hsrf.foresttrip.go.kr)을 쓰는데,
// 실제로는 <meta http-equiv="refresh" ...> 로 공통 페이지(hmpgId=...)로 넘어간다.
async function resolveHmpgId(homepage) {
  const direct = extractHmpgIdFromUrl(homepage);
  if (direct) return direct;

  const resp = await fetch(homepage, { headers: { 'User-Agent': UA } });
  const html = await resp.text();
  const m = html.match(/hmpgId=([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

module.exports = async (req, res) => {
  try {
    const { homepage } = req.query;
    if (!homepage) {
      res.status(400).json({ error: 'homepage 파라미터가 필요합니다.' });
      return;
    }

    const hmpgId = await resolveHmpgId(homepage);
    if (!hmpgId) {
      res.status(200).json({ paragraphs: [], sourceUrl: homepage, note: '예약정책 페이지 위치를 찾지 못했어요. 홈페이지에서 직접 확인해 주세요.' });
      return;
    }

    const pageUrl = `${BASE}/pot/rm/ug/selectRsrvtGdncView.do?hmpgId=${encodeURIComponent(hmpgId)}&menuId=004001001&ruleId=101`;
    const resp = await fetch(pageUrl, { headers: { 'User-Agent': UA } });
    if (!resp.ok) {
      res.status(200).json({ paragraphs: [], sourceUrl: pageUrl, note: '선착순 예약정책 안내를 가져오지 못했어요.' });
      return;
    }

    const html = await resp.text();
    const $ = cheerio.load(html);

    const title = $('h3').first().text().trim();
    const paragraphs = [];
    $('.wd_txt p').each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t) paragraphs.push(t);
    });

    const looksValid = /선착순/.test(title) || paragraphs.length > 0;

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({
      title: title || '선착순 예약정책',
      paragraphs: paragraphs.slice(0, 30),
      sourceUrl: pageUrl,
      note: looksValid ? '' : '이 휴양림은 선착순 예약정책 안내가 없어요. 홈페이지에서 직접 확인해 주세요.',
    });
  } catch (err) {
    res.status(200).json({ paragraphs: [], sourceUrl: '', note: '예약정책을 가져오는 중 오류가 발생했어요.' });
  }
};
