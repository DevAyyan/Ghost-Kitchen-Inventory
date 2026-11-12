FROM python:3.12-slim

# Extra languages: docker compose build --build-arg OCR_LANG_PACKS="tesseract-ocr-eng tesseract-ocr-deu" ocr
# then set OCR_LANGS=eng+deu. English only keeps the image small.
ARG OCR_LANG_PACKS="tesseract-ocr-eng"

RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr ${OCR_LANG_PACKS} wget \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --no-create-home --uid 10001 ocr

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py .

# Single-threaded Tesseract keeps memory small on tiny hosts.
ENV OMP_THREAD_LIMIT=1 PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 OCR_LANGS=eng MAX_UPLOAD_MB=10
USER ocr
EXPOSE 8080
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
