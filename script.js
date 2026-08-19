const form = document.getElementById('searchForm');
const submitBtn = document.getElementById('submitBtn');
const statusLine = document.getElementById('statusLine');
const grid = document.getElementById('grid');
const authbar = document.getElementById('authbar');

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

// ---------- 구글 로그인 상태 ----------

let authState = { loggedIn: false, email: null };

async function refreshAuth() {
  try {
    const resp = await fetch('/api/auth/me');
    authState = await resp.json();
  } catch {
    authState = { loggedIn: false, email: null };
  }
  renderAuthbar();
}

function renderAuthbar() {
  if (authState.loggedIn) {
    authbar.innerHTML = `
      <span>${escapeHtml(authState.email || '구글 계정')}으로 로그인됨</span>
      <a class="ghost" href="/api/auth/logout" style="text-decoration:none; display:inline-block;">로그아웃</a>
    `;
  } else {
    authbar.innerHTML = `
      <button type="button" class="ghost" id="loginBtn">🔔 예약 알림을 받으려면 구글 로그인</button>
    `;
    const btn = document.getElementById('loginBtn');
    if (btn) btn.addEventListener('click', () => { window.location.href = '/api/auth/google'; });
  }
}

(function handleAuthRedirectMessage() {
  const params = new URLSearchParams(window.location.search);
  const auth = params.get('auth');
  if (!auth) return;
  const messages = {
    ok: '구글 로그인 완료! 이제 예약 알림을 등록할 수 있어요.',
    denied: '구글 로그인이 취소됐어요.',
    norefresh: '로그인에 필요한 권한을 받지 못했어요. 다시 시도해 주세요.',
  };
  if (messages[auth]) {
    statusLine.textContent = messages[auth];
  }
  params.delete('auth');
  const qs = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
})();

refreshAuth();

// ---------- 결과 렌더링 ----------

function renderItems(items) {
  if (!items.length) {
    grid.innerHTML = '<div class="empty">조건에 맞는 휴양림을 찾지 못했어요.</div>';
    return;
  }

  grid.innerHTML = items.map((item, idx) => {
    // 예약가능 = 빈자리 있음 / 그 외 = 대기(마감)
    const statusClass = item.available ? 'ok' : 'wait';
    const statusLabel = item.available ? '빈자리' : '대기';
    const img = item.image || '';
    // 잔여 건수는 숙소/야영장으로 나누어, 실제 빈자리가 있는 쪽만 표시
    const roomParts = [];
    if (item.houseAvailable && item.houseRoomCount) {
      roomParts.push(`숙소 ${item.houseRoomCount}건`);
    }
    if (item.campAvailable && item.campRoomCount) {
      roomParts.push(`야영장 ${item.campRoomCount}건`);
    }
    const roomText = roomParts.length ? `잔여 · ${roomParts.join(' / ')}` : '';
    const panelId = `remind-${idx}`;

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

          <button type="button" class="remind-toggle" data-target="${panelId}">🔔 예약 알림 등록</button>
          <div class="remind-panel" id="${panelId}" data-name="${escapeHtml(item.name)}" data-homepage="${escapeHtml(item.homepage || '')}">
            <div class="remind-row">
              <select class="r-type">
                <option value="weekly">매주 반복</option>
                <option value="monthly">매월 반복</option>
                <option value="once">특정 날짜 한 번만</option>
              </select>
              <input type="time" class="r-time" value="09:00" />
            </div>
            <div class="remind-row r-weekly">
              <select class="r-dow">
                <option value="0">일요일</option>
                <option value="1">월요일</option>
                <option value="2">화요일</option>
                <option value="3" selected>수요일</option>
                <option value="4">목요일</option>
                <option value="5">금요일</option>
                <option value="6">토요일</option>
              </select>
            </div>
            <div class="remind-row r-monthly" style="display:none;">
              <input type="number" class="r-dom" min="1" max="31" placeholder="예: 1 (매월 1일)" />
            </div>
            <div class="remind-row r-once" style="display:none;">
              <input type="date" class="r-date" />
            </div>
            <button type="button" class="remind-submit">이 시각으로 구글 캘린더에 등록</button>
            <div class="remind-msg"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ---------- 알림 패널 동작 (이벤트 위임) ----------

grid.addEventListener('click', async (e) => {
  const toggleBtn = e.target.closest('.remind-toggle');
  if (toggleBtn) {
    const panel = document.getElementById(toggleBtn.dataset.target);
    if (panel) panel.classList.toggle('open');
    return;
  }

  const submitRemindBtn = e.target.closest('.remind-submit');
  if (submitRemindBtn) {
    const panel = submitRemindBtn.closest('.remind-panel');
    const msg = panel.querySelector('.remind-msg');

    if (!authState.loggedIn) {
      msg.textContent = '먼저 구글 로그인을 해주세요 (상단 버튼).';
      msg.className = 'remind-msg err';
      return;
    }

    const type = panel.querySelector('.r-type').value;
    const time = panel.querySelector('.r-time').value || '09:00';
    const dayOfWeek = panel.querySelector('.r-dow').value;
    const dayOfMonth = panel.querySelector('.r-dom').value;
    const date = panel.querySelector('.r-date').value;

    if (type === 'monthly' && !dayOfMonth) {
      msg.textContent = '매월 며칠인지 입력해 주세요.';
      msg.className = 'remind-msg err';
      return;
    }
    if (type === 'once' && !date) {
      msg.textContent = '날짜를 선택해 주세요.';
      msg.className = 'remind-msg err';
      return;
    }

    submitRemindBtn.disabled = true;
    msg.textContent = '등록 중…';
    msg.className = 'remind-msg';

    try {
      const resp = await fetch('/api/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: panel.dataset.name,
          homepage: panel.dataset.homepage,
          type,
          time,
          dayOfWeek,
          dayOfMonth,
          date,
        }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || `등록 실패 (HTTP ${resp.status})`);
      }

      const when = new Date(data.openAt);
      const whenText = when.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
      msg.innerHTML = `${escapeHtml(whenText)}에 알림이 등록됐어요. <a href="${escapeHtml(data.htmlLink)}" target="_blank" rel="noopener">캘린더에서 보기</a>`;
      msg.className = 'remind-msg ok';
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'remind-msg err';
      if (/로그인/.test(err.message)) {
        authState.loggedIn = false;
        renderAuthbar();
      }
    } finally {
      submitRemindBtn.disabled = false;
    }
  }
});

grid.addEventListener('change', (e) => {
  if (!e.target.classList.contains('r-type')) return;
  const panel = e.target.closest('.remind-panel');
  const type = e.target.value;
  panel.querySelector('.r-weekly').style.display = type === 'weekly' ? 'flex' : 'none';
  panel.querySelector('.r-monthly').style.display = type === 'monthly' ? 'flex' : 'none';
  panel.querySelector('.r-once').style.display = type === 'once' ? 'flex' : 'none';
});

// ---------- 검색 ----------

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
