const form = document.getElementById('searchForm');
const submitBtn = document.getElementById('submitBtn');
const statusLine = document.getElementById('statusLine');
const grid = document.getElementById('grid');

const startInput = document.getElementById('start');
const endInput = document.getElementById('end');

// 기본값: 입실일 = 오늘, 퇴실일 = 내일
function toYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
(function initDates() {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  startInput.value = toYmd(today);
  endInput.value = toYmd(tomorrow);
  startInput.min = toYmd(today);
})();

startInput.addEventListener('change', () => {
  endInput.min = startInput.value;
  if (endInput.value && endInput.value <= startInput.value) {
    const d = new Date(startInput.value);
    d.setDate(d.getDate() + 1);
    endInput.value = toYmd(d);
  }
});

function ymdToApi(v) {
  return v.replaceAll('-', '');
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function renderItems(items) {
  if (!items.length) {
    grid.innerHTML = '';
    statusLine.insertAdjacentHTML('afterend', '');
    grid.innerHTML = '<div class="empty">조건에 맞는 휴양림을 찾지 못했어요.</div>';
    return;
  }

  grid.innerHTML = items.map((item) => {
    // 예약가능 = 빈자리 있음 / 그 외 = 대기(마감)
    const statusClass = item.available ? 'ok' : 'wait';
    const statusLabel = item.available ? '빈자리' : '대기';
    const img = item.image || '';
    // 잔여 건수는 실제 빈자리가 있을 때만 표시 (마감/대기 상태에서는 0건이라 의미가 없음)
    const roomText = item.available && item.roomCount !== null && item.roomCount !== undefined
      ? `잔여 ${item.roomCount}건`
      : '';

    return `
      <div class="card">
        ${img ? `<img class="thumb" src="${escapeHtml(img)}" alt="${escapeHtml(item.name)}" onerror="this.style.display='none'">` : ''}
        <div class="body">
          <div class="badge-row">
            ${item.type ? `<span class="badge type">${escapeHtml(item.type)}</span>` : ''}
            <span class="badge ${statusClass}">${escapeHtml(statusLabel)}</span>
          </div>
          <div class="name">${escapeHtml(item.name)}</div>
          <div class="meta">${escapeHtml(item.regionName || '')}${item.address ? ' · ' + escapeHtml(item.address) : ''}</div>
          ${item.facilities ? `<div class="meta">${escapeHtml(item.facilities)}</div>` : ''}
          ${roomText ? `<div class="roomcount ok">${roomText}</div>` : ''}
          ${item.homepage ? `<div class="links"><a href="${escapeHtml(item.homepage)}" target="_blank" rel="noopener">홈페이지</a></div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const region = document.getElementById('region').value;
  const start = ymdToApi(startInput.value);
  const end = ymdToApi(endInput.value);
  const people = document.getElementById('people').value || '2';

  if (!start || !end) {
    statusLine.textContent = '입실일과 퇴실일을 선택해 주세요.';
    return;
  }
  if (end <= start) {
    statusLine.textContent = '퇴실일은 입실일보다 늦어야 합니다.';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '조회 중…';
  statusLine.textContent = region === 'all'
    ? '전국 9개 권역을 순서대로 조회하고 있어요. 잠시만 기다려 주세요…'
    : '조회 중…';
  grid.innerHTML = '';

  try {
    const url = `/api/search?region=${encodeURIComponent(region)}&start=${start}&end=${end}&people=${encodeURIComponent(people)}`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || `조회 실패 (HTTP ${resp.status})`);
    }

    statusLine.textContent = `총 ${data.count}곳 중 빈자리 ${data.availableCount}곳`;
    renderItems(data.items);
  } catch (err) {
    statusLine.textContent = '';
    grid.innerHTML = `<div class="error">조회 중 오류가 발생했어요: ${escapeHtml(err.message)}</div>`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '빈자리 조회';
  }
});

// 첫 진입 시 자동 조회
form.dispatchEvent(new Event('submit'));
