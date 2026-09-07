const form = document.getElementById('searchForm');
const submitBtn = document.getElementById('submitBtn');
const statusLine = document.getElementById('statusLine');
const grid = document.getElementById('grid');
const regionSelect = document.getElementById('region');

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatDate(d) {
  if (!d) return '';
  return d.replaceAll('-', '.');
}

// ---------- 지역 옵션 채우기 (첫 조회 응답에 담겨온 지역 목록 사용) ----------
let regionsLoaded = false;
function fillRegions(regions) {
  if (regionsLoaded) return;
  regionsLoaded = true;
  Object.entries(regions).forEach(([code, name]) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    regionSelect.appendChild(opt);
  });
}

// ---------- 결과 렌더링 ----------

function renderItems(items) {
  if (!items.length) {
    grid.innerHTML = '<div class="empty">조건에 맞는 축제를 찾지 못했어요.</div>';
    return;
  }

  grid.innerHTML = items.map((item, idx) => {
    const statusClass = item.status === '진행중' ? 'ongoing' : 'upcoming';
    const img = item.image || '';
    const panelId = `detail-${idx}`;
    const dateRange = item.eventStartDate === item.eventEndDate
      ? formatDate(item.eventStartDate)
      : `${formatDate(item.eventStartDate)} ~ ${formatDate(item.eventEndDate)}`;

    return `
      <div class="card">
        ${img ? `<img class="thumb" src="${escapeHtml(img)}" alt="${escapeHtml(item.title)}" onerror="this.style.display='none'">` : ''}
        <div class="body">
          <div class="badge-row">
            ${item.regionName ? `<span class="badge region">${escapeHtml(item.regionName)}</span>` : ''}
            <span class="badge ${statusClass}">${item.status}</span>
          </div>
          <div class="name">${escapeHtml(item.title)}</div>
          <div class="dates">${escapeHtml(dateRange)}</div>
          ${item.addr ? `<div class="meta">${escapeHtml(item.addr)}</div>` : ''}

          <button type="button" class="detail-toggle" data-target="${panelId}" data-content-id="${escapeHtml(item.contentId)}">상세보기 (장소·요금·예약)</button>
          <div class="detail-panel" id="${panelId}">
            <div class="detail-empty">불러오는 중…</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderDetail(panel, d) {
  if (!d) {
    panel.innerHTML = '<div class="detail-empty">상세 정보를 가져오지 못했어요.</div>';
    return;
  }

  const rows = [];

  if (d.bookingPlace) {
    rows.push(`<div class="booking-box"><b>🔖 예약 안내</b>${escapeHtml(d.bookingPlace)}</div>`);
  }
  if (d.eventPlace) {
    rows.push(`<div class="detail-row"><b>장소</b>${escapeHtml(d.eventPlace)}</div>`);
  }
  if (d.playtime) {
    rows.push(`<div class="detail-row"><b>운영 시간</b>${escapeHtml(d.playtime)}</div>`);
  }
  if (d.useFee) {
    rows.push(`<div class="detail-row"><b>이용 요금</b>${escapeHtml(d.useFee)}</div>`);
  }
  if (d.ageLimit) {
    rows.push(`<div class="detail-row"><b>관람 제한</b>${escapeHtml(d.ageLimit)}</div>`);
  }
  if (d.program) {
    rows.push(`<div class="detail-row"><b>프로그램</b>${escapeHtml(d.program).replace(/\n/g, '<br>')}</div>`);
  }
  if (d.sponsor || d.sponsorTel) {
    rows.push(`<div class="detail-row"><b>문의처</b>${escapeHtml([d.sponsor, d.sponsorTel].filter(Boolean).join(' · '))}</div>`);
  }
  if (d.homepage) {
    rows.push(`<div class="detail-row"><b>홈페이지</b><a href="${escapeHtml(d.homepage)}" target="_blank" rel="noopener">${escapeHtml(d.homepage)}</a></div>`);
  }

  panel.innerHTML = rows.length ? rows.join('') : '<div class="detail-empty">등록된 상세 정보가 없어요.</div>';
}

grid.addEventListener('click', async (e) => {
  const toggleBtn = e.target.closest('.detail-toggle');
  if (!toggleBtn) return;

  const panel = document.getElementById(toggleBtn.dataset.target);
  panel.classList.toggle('open');
  if (!panel.classList.contains('open') || panel.dataset.loaded) return;

  panel.dataset.loaded = '1';
  try {
    const resp = await fetch(`/api/festival-detail?contentId=${encodeURIComponent(toggleBtn.dataset.contentId)}`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || '조회 실패');
    renderDetail(panel, data);
  } catch (err) {
    panel.innerHTML = `<div class="detail-empty">${escapeHtml(err.message)}</div>`;
  }
});

// ---------- 검색 ----------

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const region = regionSelect.value;

  submitBtn.disabled = true;
  submitBtn.textContent = '조회 중…';
  statusLine.textContent = '조회 중…';
  grid.innerHTML = '';

  try {
    const resp = await fetch(`/api/festivals?region=${encodeURIComponent(region)}`);
    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || `조회 실패 (HTTP ${resp.status})`);
    }

    fillRegions(data.regions);
    statusLine.textContent = `${formatDate(data.start)} ~ ${formatDate(data.end)} · 총 ${data.count}건`;
    renderItems(data.items);
  } catch (err) {
    statusLine.textContent = '';
    grid.innerHTML = `<div class="error">조회 중 오류가 발생했어요: ${escapeHtml(err.message)}</div>`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '축제 조회';
  }
});

// 첫 진입 시 자동 조회 (전국 전체)
form.dispatchEvent(new Event('submit'));
