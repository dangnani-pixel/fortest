// nature.js — 🌿 식물 인식(Pl@ntNet) + 🐦 새소리 인식(BirdNET) 클라이언트 로직

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---------- 이미지 리사이즈 (업로드 용량을 줄이기 위해 긴 변 1024px로 축소) ----------
function resizeImageToDataUrl(file, maxSize = 1024, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('이미지를 읽지 못했어요.'));
    reader.onload = () => {
      img.onerror = () => reject(new Error('이미지를 열지 못했어요.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const scale = maxSize / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('오디오를 읽지 못했어요.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// ============================================================
// 🌿 식물 인식 (Pl@ntNet)
// ============================================================
(function initPlantTool() {
  const fileInput = document.getElementById('plantFile');
  const uploadLabel = document.getElementById('plantUploadLabel');
  const organSelect = document.getElementById('plantOrgan');
  const preview = document.getElementById('plantPreview');
  const previewImg = document.getElementById('plantPreviewImg');
  const submitBtn = document.getElementById('plantSubmit');
  const statusEl = document.getElementById('plantStatus');
  const resultsEl = document.getElementById('plantResults');

  let currentDataUrl = null;

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    statusEl.textContent = '사진 준비 중…';
    statusEl.className = 'tool-status';
    try {
      currentDataUrl = await resizeImageToDataUrl(file);
      previewImg.src = currentDataUrl;
      preview.hidden = false;
      uploadLabel.textContent = `✅ ${file.name}`;
      submitBtn.disabled = false;
      statusEl.textContent = '';
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'tool-status error';
    }
  });

  submitBtn.addEventListener('click', async () => {
    if (!currentDataUrl) return;
    submitBtn.disabled = true;
    statusEl.textContent = '인식하는 중…';
    statusEl.className = 'tool-status';
    resultsEl.innerHTML = '';

    try {
      const resp = await fetch('/api/plantnet-identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: currentDataUrl, organ: organSelect.value }),
      });
      const data = await resp.json();

      if (resp.status === 501) {
        resultsEl.innerHTML = `<div class="notice-box">${escapeHtml(data.error)} (<a href="https://my.plantnet.org/" target="_blank" rel="noopener">my.plantnet.org</a>에서 무료 발급)</div>`;
        statusEl.textContent = '';
        return;
      }
      if (!resp.ok) throw new Error(data.error || '인식에 실패했어요.');

      if (!data.results?.length) {
        resultsEl.innerHTML = '<div class="tool-status">일치하는 식물을 찾지 못했어요. 다른 부위 사진으로 다시 시도해 보세요.</div>';
      } else {
        resultsEl.innerHTML = data.results.map((r) => {
          const common = r.commonNames?.[0] || '';
          const name = r.koreanName || common || r.scientificName;
          const sub = r.koreanName && common ? `${r.scientificName} · ${common}` : r.scientificName;
          const pct = Math.round((r.score || 0) * 100);
          const img = r.image ? `<img src="${escapeHtml(r.image)}" alt="${escapeHtml(r.scientificName)}">` : '';
          return `
            <div class="result-item">
              ${img}
              <div class="result-body">
                <div class="result-name">${escapeHtml(name)}</div>
                <div class="result-sci">${escapeHtml(sub)}</div>
                <span class="result-score">일치율 ${pct}%</span>
              </div>
            </div>
          `;
        }).join('');
      }
      statusEl.textContent = '';
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'tool-status error';
    } finally {
      submitBtn.disabled = false;
    }
  });
})();

// ============================================================
// 🐦 새소리 인식 (BirdNET)
// ============================================================
(function initBirdTool() {
  const recordBtn = document.getElementById('recordBtn');
  const recTimer = document.getElementById('recTimer');
  const fileInput = document.getElementById('birdFile');
  const uploadLabel = document.getElementById('birdUploadLabel');
  const audioPreview = document.getElementById('birdAudioPreview');
  const submitBtn = document.getElementById('birdSubmit');
  const statusEl = document.getElementById('birdStatus');
  const resultsEl = document.getElementById('birdResults');

  let currentDataUrl = null;
  let currentMime = 'audio/webm';
  let mediaRecorder = null;
  let chunks = [];
  let timerInterval = null;
  let recordSeconds = 0;

  function setPreview(dataUrl, mime) {
    currentDataUrl = dataUrl;
    currentMime = mime;
    audioPreview.src = dataUrl;
    audioPreview.hidden = false;
    submitBtn.disabled = false;
  }

  function formatTimer(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  recordBtn.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      statusEl.textContent = '이 브라우저는 마이크 녹음을 지원하지 않아요. 오디오 파일을 올려주세요.';
      statusEl.className = 'tool-status error';
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(timerInterval);
        recordBtn.textContent = '🎙️ 녹음 시작';
        recordBtn.classList.remove('recording');
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        const dataUrl = await blobToDataUrl(blob);
        setPreview(dataUrl, blob.type);
        uploadLabel.textContent = '🎵 오디오 파일 선택';
        statusEl.textContent = '';
      };
      mediaRecorder.start();
      recordSeconds = 0;
      recTimer.textContent = formatTimer(0);
      timerInterval = setInterval(() => {
        recordSeconds += 1;
        recTimer.textContent = formatTimer(recordSeconds);
        if (recordSeconds >= 15) mediaRecorder.stop(); // 너무 길어지지 않게 15초에서 자동 종료
      }, 1000);
      recordBtn.textContent = '⏹️ 녹음 중지';
      recordBtn.classList.add('recording');
      statusEl.textContent = '녹음 중… (최대 15초)';
      statusEl.className = 'tool-status';
    } catch (err) {
      statusEl.textContent = '마이크 권한을 허용해야 녹음할 수 있어요.';
      statusEl.className = 'tool-status error';
    }
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await blobToDataUrl(file);
      setPreview(dataUrl, file.type || 'audio/mpeg');
      uploadLabel.textContent = `✅ ${file.name}`;
      statusEl.textContent = '';
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'tool-status error';
    }
  });

  submitBtn.addEventListener('click', async () => {
    if (!currentDataUrl) return;
    submitBtn.disabled = true;
    statusEl.textContent = '분석하는 중…';
    statusEl.className = 'tool-status';
    resultsEl.innerHTML = '';

    try {
      const resp = await fetch('/api/birdnet-identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: currentDataUrl, filename: `clip.${currentMime.includes('wav') ? 'wav' : 'webm'}` }),
      });
      const data = await resp.json();

      if (resp.status === 501) {
        resultsEl.innerHTML = `
          <div class="notice-box">
            ${escapeHtml(data.error)}<br><br>
            지금 바로 새소리를 확인하고 싶다면 코넬대 <a href="https://merlin.allaboutbirds.org/" target="_blank" rel="noopener">Merlin Bird ID</a> 앱이나
            <a href="https://birdnet.cornell.edu/" target="_blank" rel="noopener">BirdNET</a> 앱을 이용해 보세요.
          </div>`;
        statusEl.textContent = '';
        return;
      }
      if (!resp.ok) throw new Error(data.error || '분석에 실패했어요.');

      if (data.raw) {
        resultsEl.innerHTML = '<div class="tool-status">서버 응답 형식을 정확히 해석하지 못했어요. BirdNET 서버 설정을 확인해 주세요.</div>';
      } else if (!data.detections?.length) {
        resultsEl.innerHTML = '<div class="tool-status">새소리를 찾지 못했어요. 좀 더 가까이에서 다시 녹음해 보세요.</div>';
      } else {
        resultsEl.innerHTML = data.detections.slice(0, 5).map((d) => {
          const pct = d.confidence != null ? Math.round(d.confidence * 100) : null;
          return `
            <div class="result-item">
              <div class="result-body">
                <div class="result-name">${escapeHtml(d.commonName || d.scientificName)}</div>
                ${d.scientificName ? `<div class="result-sci">${escapeHtml(d.scientificName)}</div>` : ''}
                ${pct != null ? `<span class="result-score">신뢰도 ${pct}%</span>` : ''}
              </div>
            </div>
          `;
        }).join('');
      }
      statusEl.textContent = '';
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'tool-status error';
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
