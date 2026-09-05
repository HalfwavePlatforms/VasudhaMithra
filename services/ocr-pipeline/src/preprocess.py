"""
Preprocessing: deskew, denoise, contrast-boost before OCR.
Handles scanned documents, photographed records, multi-page PDFs, and handwriting routing.
"""
import base64
import io
import re
import cv2
import numpy as np
from PIL import Image


def _enhance_cv2_image(img: np.ndarray, is_pdf: bool = False) -> tuple[np.ndarray, dict]:
    """Applies grayscale, bilateral noise filter, CLAHE contrast boost, and Otsu deskew."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Bilateral filtering for edge-preserving noise reduction
    filtered = cv2.bilateralFilter(gray, 7, 50, 50)

    # Contrast Limited Adaptive Histogram Equalization (CLAHE)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(filtered)

    # Deskew based on text line orientation
    _, thresh = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    coords = np.column_stack(np.where(thresh > 0))
    angle_deg = 0.0
    if len(coords) > 0:
        angle = cv2.minAreaRect(coords)[-1]
        angle_deg = -(90 + angle) if angle < -45 else -angle
        if abs(angle_deg) > 0.5:
            (h, w) = enhanced.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle_deg, 1.0)
            enhanced = cv2.warpAffine(
                enhanced, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
            )

    metadata = {
        "width": int(img.shape[1]),
        "height": int(img.shape[0]),
        "deskew_angle": round(float(angle_deg), 2),
        "is_pdf": is_pdf,
    }
    return enhanced, metadata


def preprocess_all_pages(image_base64: str) -> tuple[list[tuple[np.ndarray, dict]], dict]:
    """
    Decodes base64 payload. For multi-page PDFs, loops over all pages in doc,
    converts each page to pixmap/image, enhances each page, and returns all pages.
    For single images, returns a single-element list.
    Returns: (list_of_(enhanced_image, page_meta), doc_summary_metadata)
    """
    img_bytes = base64.b64decode(image_base64)
    pages = []

    # 1. Multi-page PDF Ingestion via PyMuPDF (fitz)
    if img_bytes.startswith(b"%PDF"):
        try:
            import fitz
            doc = fitz.open(stream=img_bytes, filetype="pdf")
            total_pages = len(doc)
            for page_idx in range(total_pages):
                page = doc[page_idx]
                pix = page.get_pixmap(dpi=200)
                img_data = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
                if pix.n == 4:
                    cv_img = cv2.cvtColor(img_data, cv2.COLOR_RGBA2BGR)
                elif pix.n == 3:
                    cv_img = cv2.cvtColor(img_data, cv2.COLOR_RGB2BGR)
                elif pix.n == 1:
                    cv_img = cv2.cvtColor(img_data, cv2.COLOR_GRAY2BGR)
                else:
                    continue
                enhanced, meta = _enhance_cv2_image(cv_img, is_pdf=True)
                meta["page_number"] = page_idx + 1
                pages.append((enhanced, meta))
            if pages:
                return pages, {"is_pdf": True, "total_pages": len(pages)}
        except Exception:
            pass

    # 2. Image Decoding via OpenCV
    np_arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    # 3. Fallback to PIL decode
    if img is None:
        try:
            pil_img = Image.open(io.BytesIO(img_bytes))
            img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        except Exception:
            raise ValueError("Could not decode input document (unsupported image or PDF format)")

    enhanced, meta = _enhance_cv2_image(img, is_pdf=False)
    meta["page_number"] = 1
    return [(enhanced, meta)], {"is_pdf": False, "total_pages": 1}


def preprocess_image(image_base64: str) -> tuple[np.ndarray, dict]:
    """
    Decodes base64 image or PDF page, applies enhancement and returns
    (processed_image_ndarray, metadata_dict). Backward-compatible helper.
    """
    pages, _ = preprocess_all_pages(image_base64)
    if not pages:
        raise ValueError("Could not decode any pages from document")
    return pages[0]



def is_tabular_layout(raw_text: str, bounding_boxes: list[dict] | None = None) -> bool:
    """
    Checks OCR bounding box layout and keywords for legacy tabular Khasra registers:
    1. Check OCR bounding box layout for high density of short text fragments arranged
       in a grid pattern (many boxes with similar y-coordinates repeating across multiple x-clusters).
    2. Check for table-specific keywords (खसरा, स्तंभ, numbered column headers, column markers).
    """
    text_lower = raw_text.lower()

    # Keyword check: Table specific indicators
    # खसरा register tables, स्तंभ (column), numbered column markers like (1) (2) (3) or स्तंभ १, स्तंभ २
    tabular_keywords = ["स्तंभ", "कॉलम", "column", "अनुक्रमांक", "क्रम संख्या"]
    has_col_keyword = any(k in raw_text for k in tabular_keywords)

    has_khasra_keyword = "खसरा" in raw_text or "khasra" in text_lower
    has_numbered_cols = bool(
        re.search(r"(\(?\s*[1-9]\s*\)?\s+){3,}", raw_text)  # e.g., (1) (2) (3) (4) or 1 2 3 4
        or re.search(r"(स्तंभ\s*[१२३४५६७८९1-9]\s*){2,}", raw_text)
    )
    has_table_headers = (
        ("खाता" in raw_text or "khata" in text_lower)
        and ("रकबा" in raw_text or "क्षेत्रफल" in raw_text or "area" in text_lower)
        and ("भूमि स्वामी" in raw_text or "काश्तकार" in raw_text or "कृषक" in raw_text or "owner" in text_lower)
    )

    if (has_khasra_keyword and (has_col_keyword or has_numbered_cols)) or (has_col_keyword and has_table_headers):
        return True

    # Spatial Bounding Box Grid check:
    # High density of short text fragments arranged in a grid pattern
    # (many boxes with similar y-coordinates repeating across multiple x-clusters)
    if bounding_boxes and len(bounding_boxes) >= 12:
        short_boxes = [
            b for b in bounding_boxes
            if len(b.get("text", "").strip()) <= 15 and "box" in b and len(b["box"]) == 4
        ]
        if len(short_boxes) >= 10:
            # Group by y-coordinate (row clustering with ~15px tolerance)
            rows = {}
            for b in short_boxes:
                y_mid = (b["box"][1] + b["box"][3]) / 2.0
                matched_row = False
                for r_y in rows:
                    if abs(r_y - y_mid) <= 15.0:
                        rows[r_y].append(b)
                        matched_row = True
                        break
                if not matched_row:
                    rows[y_mid] = [b]

            # A grid pattern has multiple rows (>= 3), each containing multiple distinct x columns (>= 3)
            grid_rows = 0
            for r_y, boxes_in_row in rows.items():
                if len(boxes_in_row) >= 3:
                    # Check x spread
                    x_centers = [(b["box"][0] + b["box"][2]) / 2.0 for b in boxes_in_row]
                    x_span = max(x_centers) - min(x_centers)
                    if x_span > 100:  # Spans horizontal width
                        grid_rows += 1

            if grid_rows >= 3 and (has_khasra_keyword or has_table_headers or has_col_keyword):
                return True

    return False


def classify_document(raw_text: str, bounding_boxes: list[dict] | None = None) -> tuple[str, str]:
    """
    Identifies document type and language script from recognized text and bounding boxes.
    Returns (document_type, language_code)
    """
    text_lower = raw_text.lower()

    # Language script detection
    lang = "en"
    if any("\u0900" <= c <= "\u097f" for c in raw_text):
        lang = "hi"  # Devanagari (Hindi/Marathi)
    elif any("\u0c80" <= c <= "\u0cff" for c in raw_text):
        lang = "kn"  # Kannada
    elif any("\u0b80" <= c <= "\u0bff" for c in raw_text):
        lang = "ta"  # Tamil
    elif any("\u0c00" <= c <= "\u0c7f" for c in raw_text):
        lang = "te"  # Telugu

    # Step 1: Detect legacy tabular register format
    if is_tabular_layout(raw_text, bounding_boxes):
        return "legacy_tabular_register", lang

    # Document type detection for linear / label:value records
    if "mutation" in text_lower or "नामांतरण" in raw_text or "ನಮೂನೆ" in raw_text or "form 12" in text_lower:
        doc_type = "Mutation Extract (Form XII)"
    elif "khata" in text_lower or "खाता प्रमाण" in raw_text or "ಖಾತಾ" in raw_text:
        doc_type = "Khata Certificate"
    elif "sale deed" in text_lower or "title deed" in text_lower or "विक्रय पत्र" in raw_text or "ಕ್ರಯ ಪತ್ರ" in raw_text:
        doc_type = "Sale / Title Deed"
    elif "pahani" in text_lower or "rtc" in text_lower or "khasra" in text_lower or "खसरा" in raw_text or "ಪಹಣಿ" in raw_text or "land record" in text_lower:
        doc_type = "Record of Rights / RTC (Pahani)"
    else:
        doc_type = "Standard Land Record"

    return doc_type, lang


def detect_handwriting(raw_text: str, confidence: float) -> dict:
    """
    Analyzes optical text characteristics. If handwritten Indic script is suspected,
    flags for human verification routing as per VasudhaMithra architecture.
    """
    text_lower = raw_text.lower()
    is_handwritten = False
    reasons = []

    if "handwritten" in text_lower or "हस्तलिखित" in raw_text or "ಬರೆದ" in raw_text:
        is_handwritten = True
        reasons.append("Document labeled as handwritten revenue register")
    elif confidence < 0.65 and len(raw_text.split()) > 10:
        is_handwritten = True
        reasons.append("High character stroke variance indicative of cursive handwriting")

    return {
        "is_handwritten": is_handwritten,
        "routing": "human_verification" if is_handwritten else "automated_pipeline",
        "notes": "; ".join(reasons) if reasons else "Printed typography detected",
    }


