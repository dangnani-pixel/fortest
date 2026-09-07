// 마라톤 대회 정적 스냅샷 (2026-09-07 기준).
// 앞 18건: 문화체육관광부_국내마라톤대회 정보(공공데이터포털, api.odcloud.kr)에서 확인.
//   이 API는 인증키가 필요해 브라우저에 직접 노출할 수 없으므로, 정적 데이터로 담아 둔다.
// 뒤 7건(2026-09 이후): 공공데이터포털에 아직 2026년분이 없어, 마라톤 정보 사이트·공식
//   홈페이지를 교차 확인해 수동으로 추가했다. 새 대회가 API에 등록되거나 일정이 바뀌면
//   이 배열을 갱신하면 된다.
const RACE_DATA = [
  { title: '2024 머니투데이방송 3.1절 기념 마라톤대회', date: '2024-03-01', place: '뚝섬한강공원 수변마당', distances: '5km, 10km, Half, Full', host: '머니투데이방송' },
  { title: '2024 서울마라톤대회', date: '2024-03-17', place: '광화문광장', distances: '10km, Full', host: '동아일보' },
  { title: '제18회 반기문마라톤대회', date: '2024-04-28', place: '음성종합운동장', distances: '5km, 10km, Half, Full', host: '음성군청' },
  { title: '2024 서울하프마라톤대회', date: '2024-04-28', place: '광화문광장', distances: '10km, Half', host: '조선일보' },
  { title: '제24회 여성마라톤대회', date: '2024-05-04', place: '서울 마포구 월드컵공원 평화광장 일대', distances: '10km, Half', host: '여성신문사' },
  { title: '제18회 그린리본 희망 페스티벌', date: '2024-09-28', place: '상암 평화의공원 평화광장', distances: '5km, 10km', host: '이데일리' },
  { title: '제21회 국제평화마라톤대회', date: '2024-10-03', place: '삼성1동주민센터 앞 봉은사로', distances: '5km, 10km, Half, Full', host: '강남구청' },
  { title: '2024 국제국민마라톤대회', date: '2024-10-03', place: '여의도 문화의광장 일원', distances: '3.6km, 10km, Half', host: '국민일보' },
  { title: '2024 DMZ 평화 마라톤 대회', date: '2024-10-06', place: '경기도 파주시 임진각 DMZ 일원', distances: '10km, Half', host: '경기도청' },
  { title: '2024 자유민주마라톤대회', date: '2024-11-10', place: '서울시청 광장', distances: '6.10km, 10km', host: '민주화운동기념사업회' },
  { title: '2024 손기정평화마라톤대회', date: '2024-11-17', place: '상암월드컵공원 평화광장', distances: '5km, 10km, Half, Full', host: '손기정기념재단' },
  { title: '2025 머니투데이방송 3.1절 기념 마라톤대회', date: '2025-03-01', place: '뚝섬한강공원 수변마당', distances: '5km, 10km, Half, Full', host: '머니투데이방송' },
  { title: '제19회 반기문마라톤대회', date: '2025-04-27', place: '음성종합운동장', distances: '5km, 10km, Half, Full', host: '음성군청' },
  { title: '제25회 여성마라톤대회', date: '2025-05-03', place: '서울 마포구 월드컵공원 평화광장 일대', distances: '10km, 5km, 3km', host: '여성신문사' },
  { title: '제22회 강남 국제평화마라톤대회', date: '2025-10-03', place: '삼성1동주민센터 앞 봉은사로', distances: '5km, 10km, Half, Full', host: '강남구청' },
  { title: '2025 DMZ 평화 마라톤 대회', date: '2025-11-02', place: '경기도 파주시 임진각 DMZ 일원', distances: '10km, Half', host: '경기도청' },
  { title: '2025 자유민주마라톤대회', date: '2025-11-09', place: '서울시청 광장', distances: '6.10km, 10km', host: '민주화운동기념사업회' },
  { title: '2025 손기정평화마라톤대회', date: '2025-11-16', place: '고양종합운동장', distances: '10km, Half, Full', host: '손기정기념재단' },

  // 2026년 9월 이후 대회 — 공공데이터포털에는 아직 2026년분이 등록되어 있지 않아,
  // 마라톤 전문 정보 사이트(마라톤GO·KorMarathon·러닝위키 등)와 각 대회 공식 홈페이지·보도자료를
  // 교차 확인해 수동으로 추가했다(확인 시점: 2026-09-07). 접수 마감·일정은 주최 측 사정으로
  // 바뀔 수 있으니, 참가 신청 전에는 반드시 대회 공식 홈페이지에서 최신 정보를 다시 확인할 것.
  { title: '제19회 가평자라섬 전국마라톤', date: '2026-09-20', place: '가평종합운동장(경기 가평)', distances: '5km, 10km, Half', host: '가평군체육회·세계일보' },
  { title: '2026 춘천마라톤 (전국마라톤선수권대회 겸 조선일보 춘천마라톤대회)', date: '2026-10-25', place: '춘천 공지천(의암호 순환코스)', distances: '10km, Full', host: '조선일보·스포츠조선·대한육상연맹' },
  { title: '제21회 사천노을마라톤대회', date: '2026-10-31', place: '경남 사천 선진거북선공원', distances: '5km, 10km, Half', host: '경남일보' },
  { title: '2026 오티즘 레이스', date: '2026-10-31', place: '서울 월드컵공원 평화의 광장', distances: '4.2km, 10km, Half', host: '한국자폐인사랑협회·서울특별시' },
  { title: '26서울동행마라톤대회', date: '2026-11-01', place: '서울 목동종합운동장 주경기장', distances: '5km, 10km, Half', host: '서울동행마라톤조직위원회' },
  { title: '제2회 대전 신채호 마라톤대회', date: '2026-11-01', place: '대전 뿌리공원 잔디광장', distances: '5km, 10km, Half', host: '대전시 중구 육상연맹' },
  { title: '2026 김천전국마라톤대회', date: '2026-11-01', place: '경북 김천종합스포츠타운', distances: '5km, 10km, Half', host: '김천시체육회·매일신문' },
];

const searchInput = document.getElementById('searchInput');
const distanceSelect = document.getElementById('distance');
const sortSelect = document.getElementById('sort');
const statusLine = document.getElementById('statusLine');
const grid = document.getElementById('grid');

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatDate(d) {
  if (!d) return '';
  return d.replaceAll('-', '.');
}

function parseDistances(str) {
  if (!str) return [];
  return str.split(',').map((s) => s.trim()).filter(Boolean);
}

function normalizeDistanceLabel(d) {
  const low = d.toLowerCase();
  if (low.includes('full')) return 'Full';
  if (low.includes('half')) return 'Half';
  return d;
}

function daysUntil(dateStr) {
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

// ---------- 종목 옵션 채우기 ----------
function fillDistanceOptions() {
  const set = new Set();
  RACE_DATA.forEach((item) => parseDistances(item.distances).forEach((d) => set.add(normalizeDistanceLabel(d))));
  const order = ['5km', '10km', 'Half', 'Full'];
  const known = order.filter((o) => set.has(o));
  const rest = [...set].filter((x) => !order.includes(x)).sort();
  [...known, ...rest].forEach((label) => {
    const opt = document.createElement('option');
    opt.value = label;
    opt.textContent = label;
    distanceSelect.appendChild(opt);
  });
}

// ---------- 결과 렌더링 ----------
function renderItems(items) {
  if (!items.length) {
    grid.innerHTML = '<div class="empty">조건에 맞는 대회를 찾지 못했어요.</div>';
    return;
  }

  grid.innerHTML = items.map((item) => {
    const diff = daysUntil(item.date);
    let badgeHtml;
    if (diff > 0) badgeHtml = `<span class="badge upcoming">D-${diff}</span>`;
    else if (diff === 0) badgeHtml = '<span class="badge today">오늘</span>';
    else badgeHtml = '<span class="badge ended">종료</span>';

    const distsHtml = parseDistances(item.distances)
      .map((d) => `<span class="dist">${escapeHtml(d)}</span>`)
      .join('');

    return `
      <div class="card">
        <div class="body">
          <div class="badge-row">${badgeHtml}</div>
          <div class="name">${escapeHtml(item.title)}</div>
          <div class="dates">${formatDate(item.date)}</div>
          <div class="meta">${escapeHtml(item.place)}</div>
          <div class="dist-row">${distsHtml}</div>
          <div class="host">주최 <b>${escapeHtml(item.host)}</b></div>
        </div>
      </div>
    `;
  }).join('');
}

// ---------- 검색/필터/정렬 ----------
function applyFilters() {
  const term = searchInput.value.trim().toLowerCase();
  const distance = distanceSelect.value;
  const sort = sortSelect.value;

  let rows = RACE_DATA.filter((item) => {
    const matchesDistance = distance === 'all' || parseDistances(item.distances).some((d) => normalizeDistanceLabel(d) === distance);
    const haystack = `${item.title} ${item.place} ${item.host}`.toLowerCase();
    const matchesSearch = !term || haystack.includes(term);
    return matchesDistance && matchesSearch;
  });

  rows.sort((a, b) => {
    if (sort === 'name-asc') return a.title.localeCompare(b.title, 'ko');
    const diff = new Date(a.date) - new Date(b.date);
    return sort === 'date-desc' ? -diff : diff;
  });

  statusLine.textContent = `${rows.length}개 대회 표시 중 (전체 ${RACE_DATA.length}개)`;
  renderItems(rows);
}

searchInput.addEventListener('input', applyFilters);
distanceSelect.addEventListener('change', applyFilters);
sortSelect.addEventListener('change', applyFilters);

fillDistanceOptions();
applyFilters();
