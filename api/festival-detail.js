// /api/festival-detail.js
// 축제 하나의 상세 정보(장소/시간/요금/예약 안내 등)를 가져온다.
// 카드마다 자동으로 부르지 않고, 사용자가 "상세보기"를 눌렀을 때만 호출해서
// TourAPI 하루 트래픽 한도를 아낀다.

const BASE = 'https://apis.data.go.kr/B551011/KorService2';

module.exports = async (req, res) => {
  try {
    const key = process.env.TOUR_API_KEY;
    if (!key) {
      res.status(500).json({ error: '서버에 TOUR_API_KEY가 설정되어 있지 않아요.' });
      return;
    }

    const { contentId } = req.query;
    if (!contentId) {
      res.status(400).json({ error: 'contentId 파라미터가 필요합니다.' });
      return;
    }

    const params = new URLSearchParams({
      serviceKey: key,
      numOfRows: '1',
      pageNo: '1',
      MobileOS: 'ETC',
      MobileApp: 'ForestVacancy',
      _type: 'json',
      contentId,
      contentTypeId: '15',
    });

    const resp = await fetch(`${BASE}/detailIntro2?${params.toString()}`);
    const data = await resp.json();

    const header = data?.response?.header;
    if (!resp.ok || !header || header.resultCode !== '0000') {
      res.status(502).json({ error: `상세 정보를 가져오지 못했어요: ${header?.resultMsg || 'API 오류'}` });
      return;
    }

    const it = data.response.body?.items?.item?.[0] || {};

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({
      eventPlace: it.eventplace || '',
      playtime: it.playtime || '',
      useFee: it.usetimefestival || '',
      discountInfo: it.discountinfofestival || '',
      bookingPlace: it.bookingplace || '', // 비어있지 않으면 "예약 필요"로 간주
      program: it.program || '',
      subEvent: it.subevent || '',
      ageLimit: it.agelimit || '',
      sponsor: it.sponsor1 || '',
      sponsorTel: it.sponsor1tel || it.tel || '',
      homepage: (it.eventhomepage || '').replace(/<[^>]*>/g, '').trim(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || '서버 오류가 발생했어요.' });
  }
};
