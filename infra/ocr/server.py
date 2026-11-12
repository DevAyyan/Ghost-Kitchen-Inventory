"""Tesseract OCR HTTP service for receipts.

POST /ocr (multipart field 'file') -> {"text": str, "lines": [{"text": str, "confidence": 0..1}]}
"""
import io
import os
from collections import defaultdict

import pytesseract
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, ImageFilter, ImageOps

MAX_BYTES = int(os.environ.get("MAX_UPLOAD_MB", "10")) * 1024 * 1024
LANGS = os.environ.get("OCR_LANGS", "eng")
MIN_WIDTH = 1400  # Tesseract reads small print poorly; upscale thin receipts
MAX_PIXELS = 40_000_000  # guard against decompression bombs

Image.MAX_IMAGE_PIXELS = MAX_PIXELS
app = FastAPI(title="receipt-ocr")


@app.get("/health")
def health():
    return {"ok": True, "langs": LANGS}


def prepare(data: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(data))
    img.load()
    img = ImageOps.exif_transpose(img).convert("L")  # honour phone rotation, grayscale
    if img.width < MIN_WIDTH:
        scale = MIN_WIDTH / img.width
        img = img.resize((MIN_WIDTH, int(img.height * scale)), Image.LANCZOS)
    img = ImageOps.autocontrast(img, cutoff=1)
    return img.filter(ImageFilter.SHARPEN)


@app.post("/ocr")
async def ocr(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Image too large")
    try:
        img = prepare(data)
    except Exception:
        raise HTTPException(400, "Not a valid image")

    # psm 6 = one uniform block of text, which suits receipts. image_to_data gives per-word confidence.
    d = pytesseract.image_to_data(img, lang=LANGS, config="--oem 1 --psm 6", output_type=pytesseract.Output.DICT)
    rows = defaultdict(list)
    for i, word in enumerate(d["text"]):
        word = word.strip()
        if not word:
            continue
        key = (d["block_num"][i], d["par_num"][i], d["line_num"][i])
        rows[key].append((d["left"][i], word, float(d["conf"][i])))

    lines = []
    for key in sorted(rows):
        words = sorted(rows[key])  # left to right
        confs = [c for _, _, c in words if c >= 0]
        lines.append({
            "text": " ".join(w for _, w, _ in words),
            "confidence": round((sum(confs) / len(confs) if confs else 0) / 100, 3),
        })
    return {"text": "\n".join(l["text"] for l in lines), "lines": lines}
