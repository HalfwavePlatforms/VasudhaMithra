"""
OCR Pipeline service.
Owns: image preprocessing + text extraction. Nothing else.
Contract: see docs/api-contracts.md — section 1.
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from preprocess import preprocess_image
from ocr_engine import run_ocr

app = FastAPI(title="OCR Pipeline")


class OCRRequest(BaseModel):
    image_base64: str
    language_hint: str = "en"


class BoundingBox(BaseModel):
    text: str
    confidence: float
    box: list[float]


class OCRResponse(BaseModel):
    raw_text: str
    confidence: float
    bounding_boxes: list[BoundingBox]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr/extract", response_model=OCRResponse)
def extract(req: OCRRequest):
    try:
        processed = preprocess_image(req.image_base64)
        result = run_ocr(processed, language_hint=req.language_hint)
        return result
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"OCR failed: {e}")
