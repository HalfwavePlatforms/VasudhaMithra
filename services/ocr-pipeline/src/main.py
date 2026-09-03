import uuid
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from preprocess import preprocess_image, classify_document, detect_handwriting
from ocr_engine import run_ocr

app = FastAPI(title="OCR Pipeline (Member 1)")


class OCRRequest(BaseModel):
    image_base64: str
    language_hint: str = "en"
    document_id: str | None = None


class BoundingBox(BaseModel):
    text: str
    confidence: float
    box: list[float]


class OCRResponse(BaseModel):
    document_id: str
    language: str
    document_type: str
    pages: int = 1
    raw_text: str
    confidence: float
    bounding_boxes: list[BoundingBox]
    handwriting: dict = {}
    metadata: dict = {}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr/extract", response_model=OCRResponse)
def extract(req: OCRRequest):
    try:
        processed, meta = preprocess_image(req.image_base64)
        result = run_ocr(processed, language_hint=req.language_hint)
        doc_type, detected_lang = classify_document(result["raw_text"])
        hw_analysis = detect_handwriting(result["raw_text"], result["confidence"])
        doc_id = req.document_id or f"DOC-{uuid.uuid4().hex[:8].upper()}"

        return {
            "document_id": doc_id,
            "language": detected_lang or req.language_hint,
            "document_type": doc_type,
            "pages": 1,
            "raw_text": result["raw_text"],
            "confidence": result["confidence"],
            "bounding_boxes": result["bounding_boxes"],
            "handwriting": hw_analysis,
            "metadata": meta,
        }
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"OCR failed: {e}")


