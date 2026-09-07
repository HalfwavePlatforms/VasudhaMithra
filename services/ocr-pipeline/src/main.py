import uuid
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from preprocess import preprocess_all_pages, classify_document, classify_document_details, detect_handwriting
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
    classification_confidence: float | None = None
    pages: int = 1
    raw_text: str
    confidence: float
    bounding_boxes: list[BoundingBox]
    handwriting: dict = {}
    metadata: dict = {}
    fallback_triggered: bool = False
    fallback_details: dict = {}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr/extract", response_model=OCRResponse)
def extract(req: OCRRequest):
    try:
        pages_data, doc_meta = preprocess_all_pages(req.image_base64)
        total_pages = len(pages_data)

        raw_text_parts = []
        confidences = []
        all_boxes = []
        page_metas = []
        any_fallback_triggered = False
        fallback_details = {}

        for idx, (processed_img, page_meta) in enumerate(pages_data):
            page_num = idx + 1
            result = run_ocr(processed_img, language_hint=req.language_hint)

            if total_pages > 1:
                page_header = f"--- Page {page_num} ---\n{result['raw_text']}"
                raw_text_parts.append(page_header)
            else:
                raw_text_parts.append(result["raw_text"])

            confidences.append(result.get("confidence", 0.0))
            all_boxes.extend(result.get("bounding_boxes", []))
            page_metas.append(page_meta)

            if result.get("fallback_triggered"):
                any_fallback_triggered = True
                fallback_details[f"page_{page_num}"] = {
                    "fallback_triggered": True,
                    "tesseract_confidence": result.get("tesseract_confidence"),
                }
            elif result.get("fallback_attempted"):
                fallback_details[f"page_{page_num}"] = {
                    "fallback_attempted": True,
                    "fallback_error": result.get("fallback_error"),
                }
            elif result.get("fallback_note"):
                fallback_details[f"page_{page_num}"] = {
                    "fallback_note": result.get("fallback_note"),
                }

        combined_text = "\n\n".join(raw_text_parts) if total_pages > 1 else (raw_text_parts[0] if raw_text_parts else "")
        avg_confidence = round(float(sum(confidences) / len(confidences)), 4) if confidences else 0.0

        doc_type, detected_lang, class_conf = classify_document_details(combined_text, all_boxes)
        hw_analysis = detect_handwriting(combined_text, avg_confidence)
        doc_id = req.document_id or f"DOC-{uuid.uuid4().hex[:8].upper()}"

        return {
            "document_id": doc_id,
            "language": detected_lang or req.language_hint,
            "document_type": doc_type,
            "classification_confidence": class_conf,
            "pages": total_pages,
            "raw_text": combined_text,
            "confidence": avg_confidence,
            "bounding_boxes": all_boxes,
            "handwriting": hw_analysis,
            "fallback_triggered": any_fallback_triggered,
            "fallback_details": fallback_details,
            "metadata": {
                "pages": total_pages,
                "is_pdf": doc_meta.get("is_pdf", False),
                "page_details": page_metas,
                "fallback_triggered": any_fallback_triggered,
                "fallback_details": fallback_details,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"OCR failed: {e}")


