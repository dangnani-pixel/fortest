// /api/notice.js
// 특정 휴양림의 "공지사항" 최신 글을 가져온다.
// 예약 오픈 규칙은 사용자가 직접 입력해야 하므로(정형 데이터가 없음),
// 그 판단에 참고할 수 있도록 원문 공지를 그대로 보여주는 용도.

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

function absolutize(href) {
  if (!href) return '';
  if (/^https?:\/\//.test(href)) return href;
  return BASE + (href.startsWith('/') ? href : `/${href}`);
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
      res.status(200).json({ notices: [], sourceUrl: homepage, note: '공지사항 위치를 찾지 못했어요. 홈페이지에서 직접 확인해 주세요.' });
      return;
    }

    const pageUrl = `${BASE}/indvz/main.do?hmpgId=${encodeURIComponent(hmpgId)}`;
    const resp = await fetch(pageUrl, { headers: { 'User-Agent': UA } });
    if (!resp.ok) {
      res.status(200).json({ notices: [], sourceUrl: pageUrl, note: '공지사항을 가져오지 못했어요.' });
      return;
    }

    const html = await resp.text();
    const $ = cheerio.load(html);
    const notices = [];

    // 패턴 A: 구형 슬라이더 스타일 (제목 + 본문 미리보기)
    $('.notice_slider .noticeItem a').each((_, el) => {
      if (notices.length >= 3) return;
      const $el = $(el);
      const title = $el.find('strong').text().trim();
      const preview = $el.find('p').first().text().trim().slice(0, 140);
      const href = absolutize($el.attr('href'));
      if (title) notices.push({ title, preview, date: '', href });
    });

    // 패턴 B: 신형 숏컷 스타일 (제목 + 날짜만)
    if (!notices.length) {
      $('.ms_shortcut.notice .msh_pt a').each((_, el) => {
        if (notices.length >= 3) return;
        const $el = $(el);
        const title = $el.find('.mp_txt').text().trim();
        const date = $el.find('.mp_date').text().trim();
        const href = absolutize($el.attr('href'));
        if (title) notices.push({ title, preview: '', date, href });
      });
    }

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json({
      notices,
      sourceUrl: pageUrl,
      note: notices.length ? '' : '현재 등록된 공지사항이 없어요.',
    });
  } catch (err) {
    res.status(200).json({ notices: [], sourceUrl: '', note: '공지사항을 가져오는 중 오류가 발생했어요.' });
  }
};
