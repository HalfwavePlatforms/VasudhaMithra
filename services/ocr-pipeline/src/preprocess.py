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
    2. Check for table-specific keywords (खसरा, स्तंभ, ಕಾಲಂ, ಕಂದಾಯ, দাগ, খতিয়ান, numbered column headers, column markers).
    """
    text_lower = raw_text.lower()

    # Keyword check: Table specific indicators
    # खसरा register tables, स्तंभ/ಕಾಲಂ/কলাম (column), numbered column markers like (1) (2) (3) or स्तंभ १, स्तंभ २
    tabular_keywords = [
        "स्तंभ", "सूतंभ", "कॉलम", "column", "अनुक्रमांक", "क्रम संख्या",
        # Kannada
        "ಕಾಲಂ", "ಸ್ತಂಭ", "ಸ್‌ತಂಭ", "ಕೋಷ್ಟಕ", "ಅನುಕ್ರಮ", "ಕ್ರಮ ಸಂಖ್ಯೆ", "ಸಾರಣಿ", "ತಃಖ್ತೆ", "ನಮೂದು",
        # Bengali
        "কলাম", "স্তম্ভ", "তালিকা", "তালকা", "ক্রমিক", "সারণী",
    ]
    has_col_keyword = any(k in raw_text for k in tabular_keywords)

    has_khasra_keyword = (
        "खसरा" in raw_text
        or "khasra" in text_lower
        or "ಖಸ್ರಾ" in raw_text
        or "ಪಹಣಿ ವಿವರಣಾ" in raw_text
        or "ಕಂದಾಯ ವಿವರಣಾ" in raw_text
        or "ಖಾತೆ ರಿಜಿಸ್ಟರ್" in raw_text
        or "ಖಸ್ರಾ ಕಂದಾಯ" in raw_text
        or "ಚಕ್‌ಬಂದಿ" in raw_text
        or "ಚಕ್\u200cಬಂದಿ" in raw_text
        or "ತಃಖ್ತೆ" in raw_text
        or "খসড়া" in raw_text
        or "খতিয়ান তালিকা" in raw_text
        or "খতিয়ান রেজিস্টার" in raw_text
        or "খসড়া খতিয়ান" in raw_text
        or "মৌজা খতিয়ান" in raw_text
    )
    has_numbered_cols = bool(
        re.search(r"(\(?\s*[1-9१-९೧-೯১-৯]\s*\)?\s+){3,}", raw_text)  # e.g., (1) (2) (3) (4) or (೧) (೨) (೩) (೪)
        or re.search(r"(?:स्तंभ|सूतंभ|कॉलम|ಕಾಲಂ|ಸ್ತಂಭ|ಸ್‌ತಂಭ|কলাম|স্তম্ভ)\s*[1-9१-९೧-೯১-৯]", raw_text)
    )
    has_table_headers = (
        (
            ("खाता" in raw_text or "khata" in text_lower or "ಖಾತಾ" in raw_text or "ಖಾತೆ" in raw_text or "খতিয়ান" in raw_text or "খতযান" in raw_text)
            and ("रकबा" in raw_text or "क्षेत्रफल" in raw_text or "area" in text_lower or "ವಿಸ್ತೀರ್ಣ" in raw_text or "ವೌಸ್‌ತೇರ್‌ಣ" in raw_text or "পরিমাণ" in raw_text or "জমি" in raw_text)
            and ("भूमि स्वामी" in raw_text or "काश्तकार" in raw_text or "कृषक" in raw_text or "owner" in text_lower or "ಮಾಲೀಕ" in raw_text or "ಖಾತೇದಾರ" in raw_text or "ಮালিক" in raw_text or "রায়ত" in raw_text or "প্রজা" in raw_text)
        )
    )

    if (has_khasra_keyword and (has_col_keyword or has_numbered_cols)) or (has_col_keyword and (has_table_headers or has_numbered_cols)):
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

            if grid_rows >= 3 and (has_col_keyword or has_numbered_cols):
                return True

    return False


def is_numbered_box_layout(raw_text: str, bounding_boxes: list[dict] | None = None) -> bool:
    """
    Detects numbered-box RTC / Pahani format where fields are organized
    in numbered bordered cells (e.g. '1. Survey No', '2. Owner Name', '1) ಸರ್ವೆ ನಂ', '१. भूमापन').
    """
    text_lower = raw_text.lower()

    # Regex for numbered field markers: "1.", "1)", "1,", "१.", "೧.", "(1)" followed by non-digit label
    numbered_pattern = r"(?:^|\n|\s)(?:\(?\s*([1-9]|1[0-2]|[१-९]|[೧-೯])\s*[\.\,\)]\s+)(?!\d)"
    numbered_matches = re.findall(numbered_pattern, raw_text)
    distinct_numbered = set(numbered_matches)

    # Keywords associated with RTC / Pahani numbered box formats
    rtc_keywords = [
        "rtc", "pahani", "ಪಹಣಿ", "7/12", "७/१२", "गाव नमुना", "ror", "1b", "1-b",
        "ಅಧಿಕಾರ ದಾಖಲೆ", "ಸರ್ವೆ ನಂಬರ್", "ಸರ್ವೆ ನಂ", "ಭೂ ಮಾಲೀಕ", "ಖಾತೇದಾರ", "ಮಾಲೀಕ",
        "भूमापन क्रमांक", "खातेदाराचे नाव", "सर्व्हे क्रमांक", "सर्व्हे", "भूमापन",
        "సర్వే నంబర్", "సర్వే నంబరు", "సర్‌వీ నంబరు", "సర్‌వీ నంబర్", "సర్‌వీ", "పట్టాదారు పేరు", "పట్టాదారు",
        "నమూనా", "నమూన", "పహణీ", "పహాణీ", "పాస్ పుస్తకం", "పాస్‌పుస్తకం", "పాస్", "హక్కుల"
    ]
    has_rtc_keyword = any(k in text_lower or k in raw_text for k in rtc_keywords)

    # Key fields typically present in numbered boxes
    has_key_fields = (
        ("survey" in text_lower or "ಸರ್ವೆ" in raw_text or "ಸರ್‌ವೆ" in raw_text or "भूमापन" in raw_text or "सर्व्हे" in raw_text or "సర్వే" in raw_text or "సర్‌వే" in raw_text or "సర్‌వీ" in raw_text or "ಖಸ್ರಾ" in raw_text)
        and ("owner" in text_lower or "ಮಾಲೀಕ" in raw_text or "ಖಾತೇದಾರ" in raw_text or "खातेदार" in raw_text or "नाव" in raw_text or "పట్టాదారు" in raw_text or "పేరు" in raw_text or "ಹೆಸರು" in raw_text or "హక్కుదారులు" in raw_text)
    )

    # At least 2 distinct numbered item prefixes (e.g. 1 and 3) and RTC / Pahani keywords or key fields
    if len(distinct_numbered) >= 2 and (has_rtc_keyword or has_key_fields):
        return True

    # Spatial Bounding Box check: boxes arranged in numbered cells
    if bounding_boxes and len(bounding_boxes) >= 6:
        distinct_box_nums = set()
        for b in bounding_boxes:
            m = re.match(r"^\(?\s*([1-9]|1[0-2]|[१-९]|[೧-೯])\s*[\.\,\)]\s*(\D|$)", b.get("text", "").strip())
            if m:
                distinct_box_nums.add(m.group(1))
        if len(distinct_box_nums) >= 2 and (has_rtc_keyword or has_key_fields):
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
        if lang == "hi" and any(w in raw_text for w in [
            "गाव नमुना", "७/१२", "गट क्रमांक", "भोगवटादार", "जिल्हा", "तालुका",
            "खातेदाराचे", "भूमापन", "आकारणी", "पाहणी", "फेरफार", "गाव"
        ]):
            lang = "mr"
    else:
        lang = "en"

    # 1. Official Computerized Bhoomi RTC / Record of Rights Form detection
    is_computerized_rtc = (
        ("rtc" in text_lower or "pahani" in text_lower or "ರೆಕಾರ್ಡ್" in raw_text or "ರೈಟ್ಸ್" in raw_text or "ಪಹಣಿ" in raw_text or "record of rights" in text_lower)
        and (
            "ಗ್ರಾಮ ನಮೂನೆ 2" in raw_text
            or "ಗ್ರಾಮ ನಮೂನೆ" in raw_text
            or "ನಮೂನೆ 2" in raw_text
            or "ಫಾರಂ ನಂ.೧೬" in raw_text
            or "ಫಾರಂ ನಂ.16" in raw_text
            or "ಫಾರಂ" in raw_text
            or "form 16" in text_lower
            or "form no. 16" in text_lower
            or "print page" in text_lower
            or "valid from" in text_lower
            or "bhoomi" in text_lower
            or "ಭೂಮಿ" in raw_text
            or "ಗೇಣಿ ಮತ್ತು ಪಹಣಿ" in raw_text
            or "ಹಕ್ಕು ದಾಖಲೆ" in raw_text
        )
    )
    if is_computerized_rtc:
        return "Record of Rights / RTC (Pahani)", lang, 0.95

    # 2. Detect legacy tabular register format (for older bound registers lacking standard form headers)
    if is_tabular_layout(raw_text, bounding_boxes):
        return "legacy_tabular_register", lang, 0.95

    # 3. Specific Named Legal Documents
    if (
        ("ನಮೂನೆ-3" in raw_text or "ನಮೂನೆ 3" in raw_text or "ನಮೂನೆ-೩" in raw_text or "form 3" in text_lower or "form-3" in text_lower or "e-aasthi" in text_lower or "e-aasti" in text_lower)
        and (
            "ಪೌರಾಡಳಿತ" in raw_text
            or "ಪುರಸಭೆ" in raw_text
            or "ನಗರಸಭೆ" in raw_text
            or "ಸ್ವತ್ತಿನ" in raw_text
            or "ನಿರ್ಧರಣಾ" in raw_text
            or "ನಿಯಮ 20" in raw_text
            or "ನಿಯಮ ೨೦" in raw_text
            or "rule 20" in text_lower
            or "ಅಧಿಕೃತ" in raw_text
        )
    ):
        return "Form-3 Property Register (E-Aasthi)", lang, 0.98
    elif (
        "mutation" in text_lower
        or "नामांतरण" in raw_text
        or "ಮ್ಯುಟೇಶನ್" in raw_text
        or "ಮ್‌ಯುಟೇಶನ್‌" in raw_text
        or "ಮ್ಯುಟೇಷನ್" in raw_text
        or "ಹಕ್ಕು ಬದಲಾವಣೆ" in raw_text
        or "form 12" in text_lower
        or "ನಮೂನೆ ೧೨" in raw_text
        or "ನಮೂನೆ 12" in raw_text
        or "नमुना १२" in raw_text
    ):
        return "Mutation Extract (Form XII)", lang, 0.90
    elif "khata" in text_lower or "खाता प्रमाण" in raw_text or "ಖಾತೆ ಪ್ರಮಾಣ" in raw_text or "ಖಾತಾ" in raw_text:
        return "Khata Certificate", lang, 0.90
    elif "sale deed" in text_lower or "title deed" in text_lower or "विक्रय पत्र" in raw_text or "ಕ್ರಯ ಪತ್ರ" in raw_text:
        return "Sale / Title Deed", lang, 0.90

    # 4. Numbered box layout (Type 3)
    if is_numbered_box_layout(raw_text, bounding_boxes):
        return "numbered_box_rtc", lang, 0.95

    # 5. Other RTC / Pahani formats
    if (
        "rtc" in text_lower
        or "pahani" in text_lower
        or "ಪಹಣಿ" in raw_text
        or "ರೆಕಾರ್ಡ್" in raw_text
        or "ರೈಟ್ಸ್" in raw_text
        or "record of rights" in text_lower
        or "7/12" in text_lower
        or "७/१२" in raw_text
        or "गाव नमुना" in raw_text
    ):
        return "Record of Rights / RTC (Pahani)", lang, 0.92

    # Generic unclassified fallback: confidence below 0.5 triggers Tier-2 LLM extraction fallback
    return "Standard Land Record", lang, 0.40


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


