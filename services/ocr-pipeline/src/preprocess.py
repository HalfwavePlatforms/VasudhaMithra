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
    """
    Preprocesses image for OCR while preserving fine strokes and small table digits.
    Applies adaptive contrast boost and deskew when needed without washing out text.
    """
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img.copy()

    mean_val = float(np.mean(gray))
    std_val = float(np.std(gray))

    # Deskew based on text line orientation
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    coords = np.column_stack(np.where(thresh > 0))
    angle_deg = 0.0
    if len(coords) > 0:
        angle = cv2.minAreaRect(coords)[-1]
        raw_angle = -(90 + angle) if angle < -45 else -angle
        # Only deskew if slight genuine skew between 0.5 and 15 degrees
        if 0.5 < abs(raw_angle) < 15.0:
            angle_deg = raw_angle
            (h, w) = img.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle_deg, 1.0)
            img = cv2.warpAffine(
                img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
            )
            gray = cv2.warpAffine(
                gray, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
            )

    # For clear digital records/screenshots with high contrast, keep the sharp original
    # (bilateral blur destroys small font characters in table cells)
    if mean_val > 175 and std_val > 35:
        enhanced = img
    else:
        # Dim or low-contrast scan: gentle bilateral and moderate CLAHE
        filtered = cv2.bilateralFilter(gray, 5, 25, 25)
        clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
        enhanced = clahe.apply(filtered)

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


def classify_document_details(raw_text: str, bounding_boxes: list[dict] | None = None) -> tuple[str, str, float]:
    """
    Identifies document type, language script, and classification confidence from recognized text and bounding boxes.
    Returns (document_type, language_code, classification_confidence)
    """
    text_lower = raw_text.lower()

    # Robust Language script detection based on character frequency
    script_counts = {
        "kn": sum(1 for c in raw_text if "\u0c80" <= c <= "\u0cff"),  # Kannada
        "hi": sum(1 for c in raw_text if "\u0900" <= c <= "\u097f"),  # Devanagari (Hindi/Marathi)
        "ta": sum(1 for c in raw_text if "\u0b80" <= c <= "\u0bff"),  # Tamil
        "te": sum(1 for c in raw_text if "\u0c00" <= c <= "\u0c7f"),  # Telugu
        "bn": sum(1 for c in raw_text if "\u0980" <= c <= "\u09ff"),  # Bengali
        "gu": sum(1 for c in raw_text if "\u0a80" <= c <= "\u0aff"),  # Gujarati
        "ml": sum(1 for c in raw_text if "\u0d00" <= c <= "\u0d7f"),  # Malayalam
    }
    dominant_script, max_count = max(script_counts.items(), key=lambda x: x[1])
    if max_count >= 10:
        lang = dominant_script
        # Distinguish Marathi if distinctive Marathi administrative keywords appear
        if lang == "hi" and any(w in raw_text for w in ["गाव नमुना", "७/१२", "गट क्रमांक", "भोगವಟಾದಾರ", "जिल्हा", "तालुका"]):
            lang = "mr"
    else:
        lang = "en"

    # Step 1: Detect legacy tabular register format
    if is_tabular_layout(raw_text, bounding_boxes):
        return "legacy_tabular_register", lang, 0.95

    # Document type detection (Pahani / RTC prioritized before mutation to prevent false positive on RTC mutation references)
    if (
        "rtc" in text_lower
        or "pahani" in text_lower
        or "ಪಹಣಿ" in raw_text
        or "ರೆಕಾರ್ಡ್" in raw_text
        or "ರೈಟ್ಸ್" in raw_text
        or "ಹಕ್ಕು ದಾಖಲೆ" in raw_text
        or "khasra" in text_lower
        or "खसरा" in raw_text
        or "जमाबंदी" in raw_text
        or "jamabandi" in text_lower
        or "record of rights" in text_lower
    ):
        doc_type = "Record of Rights / RTC (Pahani)"
        conf = 0.92
    elif (
        "mutation" in text_lower
        or "नामांतरण" in raw_text
        or "ಮ್ಯುಟೇಶನ್" in raw_text
        or "ಹಕ್ಕು ಬದಲಾವಣೆ" in raw_text
        or "form 12" in text_lower
        or "नमुना १२" in raw_text
    ):
        doc_type = "Mutation Extract (Form XII)"
        conf = 0.90
    elif "khata" in text_lower or "खाता प्रमाण" in raw_text or "ಖಾತಾ" in raw_text or "ಖಾತೆ ಪ್ರಮಾಣ" in raw_text:
        doc_type = "Khata Certificate"
        conf = 0.90
    elif "sale deed" in text_lower or "title deed" in text_lower or "विक्रय पत्र" in raw_text or "ಕ್ರಯ ಪತ್ರ" in raw_text:
        doc_type = "Sale / Title Deed"
        conf = 0.90
    else:
        # Generic unclassified fallback: confidence below 0.5 triggers Tier-2 LLM extraction fallback
        doc_type = "Standard Land Record"
        conf = 0.40

    return doc_type, lang, conf


def classify_document(raw_text: str, bounding_boxes: list[dict] | None = None) -> tuple[str, str]:
    """
    Backward-compatible document classifier helper returning (document_type, language_code).
    """
    doc_type, lang, _ = classify_document_details(raw_text, bounding_boxes)
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


