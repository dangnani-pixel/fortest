// /api/festivals.js
// 한국관광공사 TourAPI(searchFestival2)로 "오늘부터 6개월 뒤까지" 열리는 축제를
// 지역별로 조회한다.
//
// 데이터 출처: 공공데이터포털 "한국관광공사_국문 관광정보 서비스_GW"
// https://www.data.go.kr/data/15101578/openapi.do

const BASE = 'https://apis.data.go.kr/B551011/KorService2';

// 법정동 시도코드(lDongRegnCd) 기준 16개 권역
const REGIONS = {
  '11': '서울',
  '12': '광주/전남',
  '26': '부산',
  '27': '대구',
  '28': '인천',
  '30': '대전',
  '31': '울산',
  '36110': '세종',
  '41': '경기',
  '43': '충북',
  '44': '충남',
  '47': '경북',
  '48': '경남',
  '50': '제주',
  '51': '강원',
  '52': '전북',
};

function kstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function ymd(d) {
  return (
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0')
  );
}

function addMonthsUtc(d, months) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
}

function toDate(ymdStr) {
  if (!ymdStr || ymdStr.length !== 8) return null;
  return `${ymdStr.slice(0, 4)}-${ymdStr.slice(4, 6)}-${ymdStr.slice(6, 8)}`;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// 시작일~종료일이 이 일수 이상이면 "연중 상시 개최" 축제로 보고 목록에서 제외한다.
const YEAR_ROUND_DAYS_THRESHOLD = 300;

function daySpan(startYmdStr, endYmdStr) {
  if (!startYmdStr || !endYmdStr || startYmdStr.length !== 8 || endYmdStr.length !== 8) return 0;
  const s = Date.UTC(Number(startYmdStr.slice(0, 4)), Number(startYmdStr.slice(4, 6)) - 1, Number(startYmdStr.slice(6, 8)));
  const e = Date.UTC(Number(endYmdStr.slice(0, 4)), Number(endYmdStr.slice(4, 6)) - 1, Number(endYmdStr.slice(6, 8)));
  return Math.round((e - s) / 86400000);
}

// rangeStart~rangeEnd(Date, UTC) 사이에 걸치는 달 목록을 "YYYYMM" 옵션으로 만든다.
function buildMonthOptions(rangeStart, rangeEnd) {
  const months = [];
  let y = rangeStart.getUTCFullYear();
  let m = rangeStart.getUTCMonth(); // 0-based
  const endY = rangeEnd.getUTCFullYear();
  const endM = rangeEnd.getUTCMonth();
  while (y < endY || (y === endY && m <= endM)) {
    months.push({ value: `${y}${pad2(m + 1)}`, label: `${y}년 ${m + 1}월` });
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return months;
}

module.exports = async (req, res) => {
  try {
    const key = process.env.TOUR_API_KEY;
    if (!key) {
      res.status(500).json({ error: '서버에 TOUR_API_KEY가 설정되어 있지 않아요.' });
      return;
    }

    const { region = 'all', month = 'all' } = req.query;
    if (region !== 'all' && !REGIONS[region]) {
      res.status(400).json({ error: `알 수 없는 지역 코드: ${region}` });
      return;
    }

    const now = kstNow();
    const rangeStart = now;
    const rangeEnd = addMonthsUtc(now, 6);
    const monthOptions = buildMonthOptions(rangeStart, rangeEnd);

    let start;
    let end;

    if (month !== 'all') {
      if (!/^\d{6}$/.test(month)) {
        res.status(400).json({ error: `알 수 없는 월 값: ${month}` });
        return;
      }
      const y = Number(month.slice(0, 4));
      const m = Number(month.slice(4, 6));
      const monthStart = new Date(Date.UTC(y, m - 1, 1));
      const monthEnd = new Date(Date.UTC(y, m, 0)); // 해당 월의 마지막 날
      const clampedStart = monthStart < rangeStart ? rangeStart : monthStart;
      const clampedEnd = monthEnd > rangeEnd ? rangeEnd : monthEnd;

      if (clampedStart > clampedEnd) {
        res.status(400).json({ error: '선택한 달은 조회 가능한 기간(오늘부터 6개월)을 벗어났어요.' });
        return;
      }

      start = ymd(clampedStart);
      end = ymd(clampedEnd);
    } else {
      start = ymd(rangeStart);
      end = ymd(rangeEnd);
    }

    const params = new URLSearchParams({
      serviceKey: key,
      numOfRows: '1000',
      pageNo: '1',
      MobileOS: 'ETC',
      MobileApp: 'ForestVacancy',
      _type: 'json',
      eventStartDate: start,
      eventEndDate: end,
      arrange: 'A',
    });
    if (region !== 'all') params.set('lDongRegnCd', region);

    const resp = await fetch(`${BASE}/searchFestival2?${params.toString()}`);
    const data = await resp.json();

    const header = data?.response?.header;
    if (!resp.ok || !header || header.resultCode !== '0000') {
      res.status(502).json({ error: `축제 정보를 가져오지 못했어요: ${header?.resultMsg || 'API 오류'}` });
      return;
    }

    const rawItems = data.response.body?.items?.item || [];
    const nowYmdNum = Number(ymd(rangeStart)); // 진행중/예정 판정은 항상 "오늘" 기준

    // 1년 내내 열리는(상설) 축제는 제외
    const filteredRawItems = rawItems.filter(
      (it) => daySpan(it.eventstartdate, it.eventenddate) < YEAR_ROUND_DAYS_THRESHOLD
    );

    const items = filteredRawItems.map((it) => {
      const s = Number(it.eventstartdate);
      const e = Number(it.eventenddate);
      const status = s > nowYmdNum ? '예정' : e >= nowYmdNum ? '진행중' : '종료';
      return {
        contentId: it.contentid,
        title: it.title,
        image: it.firstimage || it.firstimage2 || '',
        addr: [it.addr1, it.addr2].filter(Boolean).join(' '),
        tel: it.tel || '',
        eventStartDate: toDate(it.eventstartdate),
        eventEndDate: toDate(it.eventenddate),
        status,
        regionCode: it.lDongRegnCd || '',
        regionName: REGIONS[it.lDongRegnCd] || '',
        mapx: it.mapx,
        mapy: it.mapy,
      };
    });

    // 시작일이 빠른 순으로 정렬 (진행중 우선)
    items.sort((a, b) => {
      if (a.status !== b.status) return a.status === '진행중' ? -1 : b.status === '진행중' ? 1 : 0;
      return (a.eventStartDate || '').localeCompare(b.eventStartDate || '');
    });

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json({
      start: toDate(start),
      end: toDate(end),
      region,
      regions: REGIONS,
      month,
      months: monthOptions,
      count: items.length,
      items,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || '서버 오류가 발생했어요.' });
  }
};
