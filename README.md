# 자연휴양림 빈자리 조회

전국 국립 자연휴양림의 야영장/숙소 실시간 예약가능 현황을 지역·날짜별로 모아 보여주는
비공식 조회 도구입니다.

## 동작 원리

산림청 통합예약 플랫폼 **숲나들e**(https://www.foresttrip.go.kr) 의 일반예약 검색 화면이
내부적으로 호출하는 비공식 AJAX 엔드포인트를 서버(Vercel Serverless Function, `api/search.js`)에서
대신 호출하고, 결과 HTML을 파싱해 JSON으로 프런트엔드에 내려줍니다.

- 프런트엔드: `index.html` + `script.js` (정적 파일, 프레임워크 없음)
- 백엔드: `api/search.js` (Node.js, Vercel Serverless Function)

## 중요한 제약사항

- **공식 API가 아닙니다.** 숲나들e가 페이지 구조·엔드포인트를 바꾸면 언제든 동작하지 않을 수 있습니다.
- 현재는 **시설(휴양림) 단위의 예약가능/예약불가 + 잔여 건수**까지만 보여줍니다.
  개별 객실/야영 사이트 단위 상세 현황은 숲나들e의 NetFunnel 대기열을 통과해야 해서 포함하지 않았습니다.
- 실제 예약은 반드시 [숲나들e](https://www.foresttrip.go.kr)에서 진행해야 합니다. 이 도구는 조회 전용입니다.
- 과도한 자동 새로고침/크롤링은 상대 서버에 부담을 줄 수 있으니 자제해 주세요. (`Cache-Control`로 2분 캐시 적용됨)

## 로컬 실행

```bash
npm install
npx vercel dev
```

## 배포 (Vercel)

1. 이 저장소를 GitHub에 push
2. [vercel.com](https://vercel.com)에서 이 저장소를 Import
3. 별도 설정 없이 기본값으로 Deploy (Framework Preset: Other)
