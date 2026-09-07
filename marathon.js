// 마라톤 대회 정적 스냅샷 (2026-09-07 기준, 지난 대회는 제외하고 예정 대회만 담아 둔다).
// 문화체육관광부_국내마라톤대회 정보(공공데이터포털, api.odcloud.kr) 오픈API는 인증키가
// 필요해 브라우저에 직접 노출할 수 없어서, 정적 데이터로 담아 관리한다.
const RACE_DATA = [
  // 2026년 9월 이후 대회 — 공공데이터포털에는 아직 2026년분이 등록되어 있지 않아,
  // 마라톤 전문 정보 사이트(마라톤GO·KorMarathon·러닝위키 등)와 각 대회 공식 홈페이지·보도자료를
  // 교차 확인해 수동으로 추가했다(확인 시점: 2026-09-07). 접수 마감·일정은 주최 측 사정으로
  // 바뀔 수 있으니, 참가 신청 전에는 반드시 대회 공식 홈페이지에서 최신 정보를 다시 확인할 것.
  { title: '제19회 가평자라섬 전국마라톤', date: '2026-09-20', place: '가평종합운동장(경기 가평)', distances: '5km, 10km, Half', host: '가평군체육회·세계일보', regPeriod: '2026.04.14 ~ 05.30', url: 'https://gprun.com/' },
  { title: '2026 Run Your Way 서울 10K (뉴발란스)', date: '2026-10-04', place: '서울 여의도공원 일대(한강 순환 10km 코스)', distances: '10km', host: '이랜드 뉴발란스(New Balance Korea)', regPeriod: '2026.07.31 ~ 08.02 (기본 패키지 래플, 마감) · 이후 오프라인 패키지 순차 판매', url: 'https://www.nbkorea.com/collection/RUNYOURWAY.action' },
  { title: '2026 춘천마라톤 (전국마라톤선수권대회 겸 조선일보 춘천마라톤대회)', date: '2026-10-25', place: '춘천 공지천(의암호 순환코스)', distances: '10km, Full', host: '조선일보·스포츠조선·대한육상연맹', regPeriod: '2026.06.16 ~ 07.23', url: 'https://www.chuncheonmarathon.com/' },
  { title: '제21회 사천노을마라톤대회', date: '2026-10-31', place: '경남 사천 선진거북선공원', distances: '5km, 10km, Half', host: '경남일보', regPeriod: '선착순 마감 (정확한 접수 시작일 미확인)', url: 'https://www.sunset.or.kr/' },
  { title: '2026 오티즘 레이스', date: '2026-10-31', place: '서울 월드컵공원 평화의 광장', distances: '4.2km, 10km, Half', host: '한국자폐인사랑협회·서울특별시', regPeriod: '2026.07.08 ~ 09.30', url: 'https://autismrace.com/' },
  { title: '26서울동행마라톤대회', date: '2026-11-01', place: '서울 목동종합운동장 주경기장', distances: '5km, 10km, Half', host: '서울동행마라톤조직위원회', regPeriod: '2026.08.10 ~ 10.02', url: 'https://runningwikii.com/entry/seoul-donghaeng-marathon/' },
  { title: '제2회 대전 신채호 마라톤대회', date: '2026-11-01', place: '대전 뿌리공원 잔디광장', distances: '5km, 10km, Half', host: '대전시 중구 육상연맹', regPeriod: '2026.07.10 ~ 07.31', url: 'https://www.djjsc.or.kr/' },
  { title: '2026 김천전국마라톤대회', date: '2026-11-01', place: '경북 김천종합스포츠타운', distances: '5km, 10km, Half', host: '김천시체육회·매일신문', regPeriod: '~ 2026.09.25', url: 'http://gcmarathon.co.kr/' },

  // 2026년 12월 ~ 2027년 5월: 위와 같은 방식으로 교차 확인했지만, 2027년 4~5월 대회는
  // 확인 시점(2026-09-07) 기준 대부분 아직 날짜가 공식 발표되지 않아 목록에 넣지 못했다.
  // (국내 마라톤은 통상 개최 6~9개월 전에 날짜가 확정된다.) 아래는 확정 발표된 대회만 추가.
  // 이 3개 대회는 신청 기간이 아직 공지되지 않아 regPeriod를 비워 둔다.
  { title: '2027 대구마라톤', date: '2027-02-28', place: '대구스타디움', distances: '5km, 10km, Half, Full', host: '대구광역시·대한육상연맹', regPeriod: '', url: 'https://daegumarathon.daegu.go.kr/' },
  { title: '2027 제주국제관광마라톤축제', date: '2027-03-20', place: '제주 구좌종합경기장 일대(김녕해변 인근)', distances: '10km, Half, Full', host: '제주특별자치도', regPeriod: '', url: 'https://jejumarathon.com/' },
  { title: '2027 서울마라톤 (제97회 동아마라톤)', date: '2027-03-21', place: '광화문광장(집결)~잠실종합운동장', distances: '10km, Full', host: '동아일보사·대한육상연맹', regPeriod: '', url: 'https://seoul-marathon.com/' },
];

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

function daysUntil(dateStr) {
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
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

    const regPeriodHtml = item.regPeriod
      ? `<div class="reg-period"><b>신청기간</b> ${escapeHtml(item.regPeriod)}</div>`
      : '<div class="reg-period muted">신청기간 추후 공지 (공식 홈페이지 확인)</div>';

    const applyBtnHtml = item.url
      ? `<a class="apply-btn" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">신청 홈페이지 →</a>`
      : '';

    return `
      <div class="card">
        <div class="body">
          <div class="badge-row">${badgeHtml}</div>
          <div class="name">${escapeHtml(item.title)}</div>
          <div class="dates">${formatDate(item.date)}</div>
          <div class="meta">${escapeHtml(item.place)}</div>
          <div class="dist-row">${distsHtml}</div>
          <div class="host">주최 <b>${escapeHtml(item.host)}</b></div>
          ${regPeriodHtml}
          ${applyBtnHtml}
        </div>
      </div>
    `;
  }).join('');
}

// 날짜 빠른순으로 고정 정렬해 렌더링
const rows = [...RACE_DATA].sort((a, b) => new Date(a.date) - new Date(b.date));
statusLine.textContent = `총 ${rows.length}개 대회`;
renderItems(rows);
