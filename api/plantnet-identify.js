// /api/plantnet-identify.js
// Pl@ntNet 식물 인식 API(https://plantnet.org) 프록시.
// 인증키(PLANTNET_API_KEY)를 브라우저에 노출하지 않기 위해 서버에서 대신 호출한다.
//
// 클라이언트 → 서버: JSON { image: "data:image/jpeg;base64,...", organ: "leaf"|"flower"|"fruit"|"bark"|"habit"|"other" }
// 서버 → Pl@ntNet: multipart/form-data (images, organs)
// 발급: https://my.plantnet.org/ 에서 무료 계정 생성 후 API 키 발급

const { findKoreanNames } = require('./_lib/korean-names');

const VALID_ORGANS = ['leaf', 'flower', 'fruit', 'bark', 'habit', 'other'];
const PROJECT = 'all'; // 특정 지역/분류군으로 좁히고 싶으면 Pl@ntNet 프로젝트 코드로 변경 가능

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 요청만 지원합니다.' });
    return;
  }

  const apiKey = process.env.PLANTNET_API_KEY;
  if (!apiKey) {
    res.status(501).json({
      error:
        '서버에 PLANTNET_API_KEY가 설정되어 있지 않아요. https://my.plantnet.org/ 에서 무료 API 키를 발급받아 Vercel 환경변수에 등록해 주세요.',
    });
    return;
  }

  try {
    const body = req.body || {};
    const organ = VALID_ORGANS.includes(body.organ) ? body.organ : 'leaf';
    const parsed = parseDataUrl(body.image);
    if (!parsed) {
      res.status(400).json({ error: '이미지 데이터가 올바르지 않아요.' });
      return;
    }
    if (parsed.buffer.length > 3.5 * 1024 * 1024) {
      res.status(400).json({ error: '이미지 용량이 너무 커요 (조금 더 작은 사진으로 다시 시도해 주세요).' });
      return;
    }

    const form = new FormData();
    const ext = parsed.mime.includes('png') ? 'png' : 'jpg';
    form.append('images', new Blob([parsed.buffer], { type: parsed.mime }), `photo.${ext}`);
    form.append('organs', organ);

    // lang=ko는 Pl@ntNet이 지원하지 않아 "No localization available for ko" 오류가 나므로 기본값(영어)을 쓴다.
    const params = new URLSearchParams({
      'api-key': apiKey,
      'include-related-images': 'true',
    });

    const resp = await fetch(`https://my-api.plantnet.org/v2/identify/${PROJECT}?${params.toString()}`, {
      method: 'POST',
      body: form,
    });
    const data = await resp.json();

    if (!resp.ok) {
      const msg = data?.message || data?.error || `Pl@ntNet API 오류 (HTTP ${resp.status})`;
      res.status(resp.status === 429 ? 429 : 502).json({ error: msg });
      return;
    }

    const results = (data.results || []).slice(0, 5).map((r) => ({
      score: r.score,
      scientificName: r.species?.scientificNameWithoutAuthor || '',
      family: r.species?.family?.scientificNameWithoutAuthor || '',
      commonNames: r.species?.commonNames || [],
      image: r.images?.[0]?.url?.m || r.images?.[0]?.url?.s || '',
    }));

    const korean = await findKoreanNames(results.map((r) => r.scientificName), 'plant');
    for (const r of results) r.koreanName = korean.map[r.scientificName] || '';

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ results, koreanLookup: korean.status });
  } catch (err) {
    res.status(500).json({ error: err.message || '식물 인식 중 오류가 발생했어요.' });
  }
};
