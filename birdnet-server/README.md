---
title: BirdNET Server
emoji: 🐦
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# BirdNET 서버 (Meliorism용)

Meliorism 사이트의 "자연과 교감 → 새소리 인식" 기능이 호출하는 아주 작은
서버입니다. [birdnet-team/birdnet](https://github.com/birdnet-team/birdnet)
파이썬 패키지(BirdNET v2.4 모델)를 REST API 한 개로 감싼 것뿐입니다.

## 배포 방법 (Hugging Face Spaces, 무료)

1. [huggingface.co](https://huggingface.co/)에서 무료 계정을 만듭니다.
2. 오른쪽 위 프로필 → **New Space** 클릭
   - SDK: **Docker** 선택
   - Space hardware: 기본값(CPU basic, 무료)으로 충분합니다
3. 생성된 Space의 "Files" 탭에서 이 폴더 안의 4개 파일
   (`Dockerfile`, `app.py`, `requirements.txt`, `README.md`)을 그대로 업로드합니다.
   (웹에서 파일을 하나씩 드래그해서 올리거나, `git clone`한 뒤 파일을 복사해서
   `git push`해도 됩니다.)
4. 잠시 기다리면 Space가 빌드되고(첫 빌드는 모델 다운로드 때문에 몇 분 걸릴 수
   있어요) "Running" 상태가 됩니다.
5. Space 상단의 공개 URL을 확인합니다. 보통
   `https://<계정명>-<space이름>.hf.space` 형태입니다.

## Meliorism 쪽 설정

Vercel 프로젝트의 Environment Variables에 아래 값을 등록하세요.

- `BIRDNET_SERVER_URL` = `https://<계정명>-<space이름>.hf.space/analyze`
  (반드시 끝에 `/analyze`를 붙여야 합니다)

등록하고 재배포하면 "자연과 교감" 페이지의 새소리 인식이 실제로 동작합니다.

## (선택) 접근 제한

아무나 이 서버를 호출하지 못하게 하려면:

1. 이 Space의 **Settings → Repository secrets**에 `BIRDNET_API_TOKEN`이라는
   이름으로 원하는 비밀 문자열을 하나 등록합니다.
2. Meliorism(Vercel) 쪽에도 똑같은 값을 `BIRDNET_API_TOKEN` 환경변수로 등록합니다.

두 값이 일치해야만 요청이 통과합니다. 둘 다 비워두면(기본값) 인증 없이 열려
있는 상태로 동작합니다.

## 로컬에서 직접 테스트하기

```bash
docker build -t birdnet-server .
docker run -p 7860:7860 birdnet-server

curl -X POST http://localhost:7860/analyze \
  -F "audio=@/path/to/clip.wav"
```

## 참고

- Hugging Face Spaces 무료(CPU basic) 티어는 일정 시간 요청이 없으면 컨테이너가
  잠들었다가, 다음 요청이 오면 다시 깨어나는 데 몇~수십 초 걸릴 수 있습니다.
  개인 프로젝트에서 가끔 쓰는 용도로는 충분하지만, 항상 빠른 응답이 필요하면
  유료 Space나 별도 서버(Render, Railway 등)를 고려하세요.
- 모델과 라이선스에 대한 자세한 내용은 원본 저장소
  [birdnet-team/birdnet](https://github.com/birdnet-team/birdnet),
  [birdnet-team/BirdNET-Analyzer](https://github.com/birdnet-team/BirdNET-Analyzer)를
  참고하세요.
