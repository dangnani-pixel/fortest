FROM python:3.11-slim

# librosa/soundfile가 다양한 오디오 포맷(webm, ogg, mp3 등)을 디코딩하려면 ffmpeg가 필요하다.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

ENV PORT=7860
EXPOSE 7860

# gunicorn 1 worker: 모델을 프로세스당 한 번만 메모리에 올려 쓰는 단순한 개인용 서버 구성.
# 트래픽이 늘면 worker 수를 늘리되, 그만큼 메모리도 더 필요해진다.
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT} --workers 1 --timeout 120 app:app"]
