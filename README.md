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

## 예약 알림(구글 캘린더) 기능

구글로 로그인하면, 관심 있는 휴양림 카드에서 "🔔 예약 알림 등록"을 눌러
예약이 열리는 요일/시간(또는 특정 날짜)을 직접 입력해 구글 캘린더에 일정으로 등록할 수 있습니다.

- 휴양림마다 예약 오픈 규칙이 제각각이고, 이를 웹사이트에서 100% 신뢰성 있게
  자동으로 알아내는 방법이 없어서(공지사항 게시판만 있고 정형 데이터가 없음),
  **규칙은 사용자가 직접 입력**합니다. (예: "매주 수요일 09:00")
- 입력을 돕기 위해 "🔔 예약 알림 등록" 패널을 열면 해당 휴양림의 **최근 공지사항**(제목/날짜/미리보기,
  `api/notice.js`)을 자동으로 가져와 보여줍니다. 공지가 항상 예약 관련이라는 보장은 없어서 참고용입니다.
- 필요한 환경변수: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `SESSION_SECRET`
  (Vercel 프로젝트의 Environment Variables에 설정되어 있어야 합니다.)
- 로그인 세션은 서버 DB 없이, 서명된 HttpOnly 쿠키에 저장됩니다.

## 로컬 실행

```bash
npm install
npx vercel dev
```

## 배포 (Vercel)

1. 이 저장소를 GitHub에 push
2. [vercel.com](https://vercel.com)에서 이 저장소를 Import
3. 별도 설정 없이 기본값으로 Deploy (Framework Preset: Other)
