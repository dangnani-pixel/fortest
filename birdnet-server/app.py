"""
BirdNET 새소리 인식 미니 서버.

Meliorism 사이트의 /api/birdnet-identify.js가 호출하는 아주 단순한 REST API 한 개
(POST /analyze)만 제공한다. birdnet-team/birdnet 파이썬 패키지(PyPI: `birdnet`,
BirdNET v2.4 음향 모델)를 그대로 감싸기만 했다.

- 실제로 `pip install birdnet`로 설치해 API를 확인하고 만들었다(모델 로딩 방식,
  predict()의 반환값을 DataFrame으로 바꿨을 때 나오는 컬럼명까지 직접 확인함).
  다만 이 환경 자체에서는 모델 가중치 다운로드 서버(zenodo.org)가 네트워크
  정책으로 막혀 있어, 실제 오디오로 끝까지 인식시켜 결과를 받아보는 것까지는
  확인하지 못했다 — 인터넷이 열려 있는 배포 환경(Hugging Face Spaces 등)에서는
  정상적으로 모델을 내려받는다.
- species_name 컬럼은 BirdNET 특유의 "학명_일반명" 형식(밑줄 구분)일 것으로
  보고 파싱한다. lang="ko"로 로드해서 일반명이 한국어로 나오도록 했다.

요청:  POST /analyze, multipart/form-data, 파일 필드 이름 "audio"
응답:  { "detections": [ { "start", "end", "scientificName", "commonName", "confidence" }, ... ] }
"""

import os
import tempfile

from flask import Flask, request, jsonify

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 6 * 1024 * 1024  # 6MB 제한 (짧은 녹음 기준으로 충분)

# 선택 사항: BIRDNET_API_TOKEN을 설정해두면, 같은 값을 X-Api-Key 헤더로 보낸
# 요청만 허용한다 (미설정 시 인증 없이 열려 있는 API가 된다).
API_TOKEN = os.environ.get("BIRDNET_API_TOKEN", "")

_model = None


def get_model():
    """모델은 프로세스당 한 번만 로드한다(요청마다 로드하면 매우 느려짐)."""
    global _model
    if _model is None:
        import birdnet
        # backend="tf", library="litert": 무거운 TensorFlow 전체 설치 없이
        # 가벼운 LiteRT(TFLite) 런타임만으로 추론한다.
        _model = birdnet.load("acoustic", "2.4", "tf", library="litert", lang="ko")
    return _model


def _guess_suffix(filename, content_type):
    for ext in (".wav", ".mp3", ".ogg", ".webm", ".m4a", ".flac"):
        if filename and filename.lower().endswith(ext):
            return ext
    if content_type:
        if "wav" in content_type:
            return ".wav"
        if "ogg" in content_type:
            return ".ogg"
        if "webm" in content_type:
            return ".webm"
        if "mpeg" in content_type or "mp3" in content_type:
            return ".mp3"
    return ".wav"


@app.get("/")
def health():
    return jsonify({"status": "ok", "service": "birdnet-server", "model_loaded": _model is not None})


@app.post("/analyze")
def analyze():
    if API_TOKEN and request.headers.get("X-Api-Key") != API_TOKEN:
        return jsonify({"error": "인증 실패"}), 401

    if "audio" not in request.files:
        return jsonify({"error": "'audio' 파일 필드가 없어요."}), 400

    audio_file = request.files["audio"]
    suffix = _guess_suffix(audio_file.filename, audio_file.mimetype)

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            audio_file.save(tmp.name)
            tmp_path = tmp.name

        model = get_model()
        result = model.predict(tmp_path, top_k=5, default_confidence_threshold=0.1)
        df = result.to_dataframe()

        detections = []
        for _, row in df.iterrows():
            label = str(row["species_name"])
            sci, _, common = label.partition("_")
            detections.append(
                {
                    "start": float(row["start_time"]),
                    "end": float(row["end_time"]),
                    "scientificName": sci,
                    "commonName": common or sci,
                    "confidence": float(row["confidence"]),
                }
            )

        detections.sort(key=lambda d: d["confidence"], reverse=True)
        return jsonify({"detections": detections[:20]})
    except Exception as err:  # noqa: BLE001 - 클라이언트에게 원인을 보여주기 위해 넓게 잡음
        return jsonify({"error": f"분석 중 오류: {err}"}), 500
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


# 모듈 로드 시점(=워커 시작 시점)에 미리 모델을 받아둔다. 요청이 왔을 때
# 처음으로 수십 MB짜리 모델을 내려받느라 타임아웃 나는 상황을 피하기 위함.
try:
    get_model()
except Exception as exc:  # noqa: BLE001
    app.logger.warning("모델을 미리 불러오지 못했어요(첫 요청 때 다시 시도합니다): %s", exc)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    app.run(host="0.0.0.0", port=port)
