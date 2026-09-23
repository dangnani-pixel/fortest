// /api/birdnet-identify.js
// BirdNET-Analyzer(https://github.com/birdnet-team/BirdNET-Analyzer) "서버 모드" 프록시.
//
// 중요: Pl@ntNet과 달리 BirdNET에는 누구나 호출할 수 있는 공개 호스팅 API가 없다.
// birdnet-team/BirdNET-Analyzer를 직접 서버(예: `python -m birdnet_analyzer.server`)로
// 띄워야 하고, 그 주소를 BIRDNET_SERVER_URL 환경변수로 등록해야 이 라우트가 동작한다.
// 등록 전까지는 501을 반환해 화면에 안내 문구를 보여준다.
//
// 클라이언트 → 서버: JSON { audio: "data:audio/webm;base64,...", filename }
// 서버 → BirdNET 서버: multipart/form-data (audio, meta)

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
}

// BirdNET-Analyzer 서버 모드/버전에 따라 응답 형태가 조금씩 다를 수 있어(정형화된
// 공개 스펙이 없음), 알려진 몇 가지 형태를 최대한 관대하게 파싱한다.
// 정상적으로 해석하지 못하면 원본 응답을 그대로 넘겨 화면에서 보여줄 수 있게 한다.
function normalizeDetections(data) {
  const rows = [];

  const pushRow = (r) => {
    if (Array.isArray(r)) {
      // [start, end, "Scientific name_Common name" 또는 학명, 신뢰도] 형태
      const [start, end, name, conf] = r;
      const [sci, common] = String(name || '').split('_');
      rows.push({ start, end, scientificName: sci || name, commonName: common || '', confidence: conf });
    } else if (r && typeof r === 'object') {
      rows.push({
        start: r.start_time ?? r.start ?? null,
        end: r.end_time ?? r.end ?? null,
        scientificName: r.scientific_name ?? r.sci_name ?? r.label?.split('_')?.[0] ?? '',
        commonName: r.common_name ?? r.label?.split('_')?.[1] ?? '',
        confidence: r.confidence ?? r.score ?? null,
      });
    }
  };

  if (Array.isArray(data)) {
    data.forEach(pushRow);
  } else if (data && Array.isArray(data.results)) {
    data.results.forEach(pushRow);
  } else if (data && data.results && typeof data.results === 'object') {
    Object.values(data.results).forEach((list) => (Array.isArray(list) ? list.forEach(pushRow) : null));
  } else if (data && Array.isArray(data.detections)) {
    data.detections.forEach(pushRow);
  } else if (data && Array.isArray(data.predictions)) {
    data.predictions.forEach(pushRow);
  } else {
    return null; // 알려진 형태가 아님
  }

  return rows;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 요청만 지원합니다.' });
    return;
  }

  const serverUrl = process.env.BIRDNET_SERVER_URL;
  if (!serverUrl) {
    res.status(501).json({
      error:
        '새소리 인식 서버가 아직 연결되지 않았어요. BirdNET-Analyzer(github.com/birdnet-team/BirdNET-Analyzer)를 서버 모드로 직접 호스팅한 뒤, 그 주소를 BIRDNET_SERVER_URL 환경변수로 등록하면 동작해요.',
      notConfigured: true,
    });
    return;
  }

  try {
    const body = req.body || {};
    const parsed = parseDataUrl(body.audio);
    if (!parsed) {
      res.status(400).json({ error: '오디오 데이터가 올바르지 않아요.' });
      return;
    }
    if (parsed.buffer.length > 3.5 * 1024 * 1024) {
      res.status(400).json({ error: '오디오 용량이 너무 커요 (10~15초 정도로 짧게 녹음해서 다시 시도해 주세요).' });
      return;
    }

    const ext = parsed.mime.includes('wav') ? 'wav' : parsed.mime.includes('ogg') ? 'ogg' : 'webm';
    const form = new FormData();
    form.append('audio', new Blob([parsed.buffer], { type: parsed.mime }), body.filename || `clip.${ext}`);
    form.append(
      'meta',
      JSON.stringify({ lat: -1, lon: -1, date: new Date().toISOString().slice(0, 10), min_conf: 0.25 })
    );

    const resp = await fetch(serverUrl, { method: 'POST', body: form });
    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      res.status(502).json({ error: 'BirdNET 서버 응답을 해석하지 못했어요.', raw: text.slice(0, 500) });
      return;
    }

    if (!resp.ok) {
      res.status(502).json({ error: data?.message || data?.error || `BirdNET 서버 오류 (HTTP ${resp.status})` });
      return;
    }

    const detections = normalizeDetections(data);
    res.setHeader('Cache-Control', 'no-store');
    if (detections) {
      res.status(200).json({ detections });
    } else {
      // 알려지지 않은 응답 형태 — 원본을 그대로 내려서 화면에서 확인할 수 있게 한다.
      res.status(200).json({ detections: [], raw: data });
    }
  } catch (err) {
    res.status(500).json({ error: err.message || '새소리 인식 중 오류가 발생했어요.' });
  }
};
