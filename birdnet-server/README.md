# BirdNET 서버 (Meliorism용)

Meliorism 사이트의 "자연과 교감 → 새소리 인식" 기능이 호출하는 아주 작은 서버입니다. birdnet-team/birdnet (https://github.com/birdnet-team/birdnet) 파이썬 패키지(BirdNET v2.4 모델)를 REST API 한 개로 감싼 것뿐입니다.

## 배포 방법 (Render.com, 무료)

Hugging Face Spaces는 2026년 중반부터 Docker SDK가 유료 플랜 전용으로 바뀌었습니다. 신용카드 없이 쓸 수 있는 대안으로 Render.com을 사용합니다.

Render.com (https://render.com/) 에서 GitHub 계정으로 로그인/가입합니다. 신용카드는 필요 없습니다.

대시보드에서 New 버튼 옆 메뉴에서 Web Service를 클릭합니다. 소스로는 Public Git Repository 탭을 선택하고 이 저장소 URL인 https://github.com/dangnani-pixel/fortest 를 입력해 연결합니다.

이후 설정 화면에서 다음과 같이 지정합니다. Name은 birdnet-server(원하는 이름), Language는 Docker(자동 감지됨), Dockerfile Path는 birdnet-server/Dockerfile, Advanced 항목 안의 Docker Build Context Directory는 birdnet-server, Instance Type은 Free ($0/month, 512MB RAM)로 선택합니다.

Deploy web service를 클릭하면 보통 1~2분 안에 빌드가 끝납니다. "Your service is live"가 뜨면 상단에 표시되는 공개 URL을 확인합니다. 보통 https://서비스이름-xxxx.onrender.com 형태입니다.

## Meliorism 쪽 설정

Vercel 프로젝트의 Environment Variables에 아래 값을 등록하세요.

BIRDNET_SERVER_URL 값으로 https://서비스이름-xxxx.onrender.com/analyze 를 등록합니다. 반드시 끝에 /analyze를 붙여야 합니다.

등록하고 재배포하면 "자연과 교감" 페이지의 새소리 인식이 실제로 동작합니다.

## (선택이지만 추천) 접근 제한

아무나 이 서버를 호출하지 못하게 하려면 두 곳에 같은 비밀 값을 등록하면 됩니다.

먼저 Render 대시보드에서 이 서비스의 Environment 탭에 BIRDNET_API_TOKEN이라는 이름으로 원하는 비밀 문자열을 등록하고 저장(재배포)합니다. 그 다음 Meliorism(Vercel) 쪽에도 똑같은 값을 BIRDNET_API_TOKEN 환경변수로 등록합니다.

두 값이 일치해야만 요청이 통과합니다. 둘 다 비워두면(기본값) 인증 없이 열려 있는 상태로 동작합니다.

## 로컬에서 직접 테스트하기

docker build -t birdnet-server . 로 이미지를 빌드하고, docker run -p 7860:7860 birdnet-server 로 실행한 뒤, curl -X POST http://localhost:7860/analyze -F "audio=@/path/to/clip.wav" 명령으로 테스트할 수 있습니다.

## 참고

Render 무료(Free) 인스턴스는 15분 정도 요청이 없으면 슬립 상태가 되고, 다음 요청이 오면 다시 깨어나는 데 약 50초 이상 걸릴 수 있습니다. 개인 프로젝트에서 가끔 쓰는 용도로는 충분하지만, 항상 빠른 응답이 필요하면 유료 플랜(월 $7~)이나 다른 호스팅을 고려하세요.

모델과 라이선스에 대한 자세한 내용은 원본 저장소 birdnet-team/birdnet (https://github.com/birdnet-team/birdnet) 와 birdnet-team/BirdNET-Analyzer (https://github.com/birdnet-team/BirdNET-Analyzer) 를 참고하세요.
