"""
BirdNET 새소리 인식 미니 서버.

Meliorism 사이트의 /api/birdnet-identify.js가 호출하는 아주 단순한 REST API 한 개
(POST /analyze)만 제공한다. birdnet-team/birdnet 파이썬 패키지(PyPI: `birdnet`,
BirdNET v2.4 음향 모델 + 위치·계절 모델)를 감쌌다.

- birdnet 패키지는 오디오를 soundfile(libsndfile)로만 읽는데, libsndfile은 브라우저 녹음
  형식(크롬 WebM/Opus, 사파리 MP4/AAC)을 읽지 못하고 그 파일을 조용히 건너뛴다. 그래서
  ffmpeg로 48kHz 모노 WAV로 바꾼 뒤 분석한다.
- 지역 필터: 한국 여러 지점에서 이번 주(BirdNET 주차, 1~48)에 나타날 법한 종을 위치·계절
  모델로 구해 합친 목록만 후보로 쓴다. 전 세계 약 6,500종에서 고르면 엉뚱한 외국 새가 잡힌다.

요청:  POST /analyze, multipart/form-data, 파일 필드 이름 "audio"
응답:  { "detections": [ { "start", "end", "scientificName", "commonName", "confidence" }, ... ] }
       (종별로 가장 높은 신뢰도의 구간 하나씩, 신뢰도 높은 순)
"""

import datetime
import os
import subprocess
import tempfile

from flask import Flask, request, jsonify

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 6 * 1024 * 1024  # 6MB 제한 (짧은 녹음 기준으로 충분)

# 선택 사항: BIRDNET_API_TOKEN을 설정해두면, 같은 값을 X-Api-Key 헤더로 보낸
# 요청만 허용한다 (미설정 시 인증 없이 열려 있는 API가 된다).
API_TOKEN = os.environ.get("BIRDNET_API_TOKEN", "")

LANG = "ko"

# 한반도 중앙 한 점만 쓰면 제주·해안 종이 빠질 수 있어 여러 지점의 후보를 합친다.
KOREA_POINTS = [
    (37.57, 126.98),  # 서울
    (37.75, 128.90),  # 강릉
    (36.35, 127.38),  # 대전
    (35.87, 128.60),  # 대구
    (35.16, 126.85),  # 광주
    (35.18, 129.08),  # 부산
    (33.38, 126.55),  # 제주
]
KST = datetime.timezone(datetime.timedelta(hours=9))

_model = None
_geo_model = None
_species_cache = {}


def get_model():
    """모델은 프로세스당 한 번만 로드한다(요청마다 로드하면 매우 느려짐)."""
    global _model
    if _model is None:
        import birdnet
        # backend="tf", library="litert": 무거운 TensorFlow 전체 설치 없이
        # 가벼운 LiteRT(TFLite) 런타임만으로 추론한다.
        _model = birdnet.load("acoustic", "2.4", "tf", library="litert", lang=LANG)
    return _model


def get_geo_model():
    global _geo_model
    if _geo_model is None:
        import birdnet
        _geo_model = birdnet.load("geo", "2.4", "tf", library="litert", lang=LANG)
    return _geo_model


def birdnet_week(date):
    """BirdNET 주차: 한 달을 4주로 나눈 1~48."""
    return (date.month - 1) * 4 + min(4, (date.day - 1) // 7 + 1)


def korea_species(week):
    """이번 주 한국에 있을 법한 종 목록(음향 모델의 종 이름과 같은 형식). 실패하면 None."""
    if week in _species_cache:
        return _species_cache[week]
    try:
        geo = get_geo_model()
        species = set()
        for lat, lon in KOREA_POINTS:
            species |= geo.predict(lat, lon, week=week).to_set()
        # 지역 목록에 음향 모델에 없는 이름이 섞이면 predict가 ValueError를 내므로 교집합만 쓴다.
        species &= set(get_model().species_list)
        result = species or None
    except Exception as exc:  # noqa: BLE001 - 지역 필터 없이라도 분석은 계속한다
        app.logger.warning("지역 필터를 만들지 못해 전체 종으로 분석합니다: %s", exc)
        result = None
    _species_cache[week] = result
    return result


def to_wav(src_path, dst_path):
    """어떤 형식이든 ffmpeg로 48kHz 모노 16bit WAV로 변환한다(BirdNET 입력 샘플레이트)."""
    subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", src_path,
         "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", dst_path],
        check=True,
        capture_output=True,
        timeout=60,
    )


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

    with tempfile.TemporaryDirectory(prefix="birdnet_req") as tmp_dir:
        src_path = os.path.join(tmp_dir, "input")
        wav_path = os.path.join(tmp_dir, "input.wav")
        audio_file.save(src_path)

        try:
            to_wav(src_path, wav_path)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as err:
            detail = getattr(err, "stderr", b"") or b""
            app.logger.warning("오디오 변환 실패: %s", detail.decode(errors="replace")[:300])
            return jsonify({"error": "오디오 파일을 읽지 못했어요. 다른 녹음이나 파일로 다시 시도해 주세요."}), 400

        try:
            model = get_model()
            week = birdnet_week(datetime.datetime.now(KST).date())
            result = model.predict(
                wav_path,
                top_k=5,
                default_confidence_threshold=0.1,
                custom_species_list=korea_species(week),
                # 워커마다 모델을 따로 올리므로, 무료 인스턴스(512MB)에서는 1개로 제한한다.
                n_workers=1,
            )
            df = result.to_dataframe()
        except Exception as err:  # noqa: BLE001 - 클라이언트에게 원인을 보여주기 위해 넓게 잡음
            return jsonify({"error": f"분석 중 오류: {err}"}), 500

    # 3초 구간마다 결과가 나오므로, 같은 종은 가장 신뢰도가 높은 구간 하나만 남긴다.
    best = {}
    for _, row in df.iterrows():
        label = str(row["species_name"])
        confidence = float(row["confidence"])
        if label not in best or confidence > best[label]["confidence"]:
            sci, _, common = label.partition("_")
            best[label] = {
                "start": float(row["start_time"]),
                "end": float(row["end_time"]),
                "scientificName": sci,
                "commonName": common or sci,
                "confidence": confidence,
            }

    detections = sorted(best.values(), key=lambda d: d["confidence"], reverse=True)
    return jsonify({"detections": detections[:10]})


# 모듈 로드 시점(=워커 시작 시점)에 미리 모델을 받아둔다. 요청이 왔을 때
# 처음으로 수십 MB짜리 모델을 내려받느라 타임아웃 나는 상황을 피하기 위함.
try:
    get_model()
    get_geo_model()
except Exception as exc:  # noqa: BLE001
    app.logger.warning("모델을 미리 불러오지 못했어요(첫 요청 때 다시 시도합니다): %s", exc)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    app.run(host="0.0.0.0", port=port)
