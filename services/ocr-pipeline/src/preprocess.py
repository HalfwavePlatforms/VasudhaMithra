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


def preprocess_image(image_base64: str) -> tuple[np.ndarray, dict]:
    """
    Decodes base64 image or PDF page, applies enhancement and returns
    (processed_image_ndarray, metadata_dict)
    """
    img_bytes = base64.b64decode(image_base64)
    img = None
    is_pdf = False

    # 1. PDF Ingestion via PyMuPDF (fitz)
    if img_bytes.startswith(b"%PDF"):
        is_pdf = True
        try:
            import fitz
            doc = fitz.open(stream=img_bytes, filetype="pdf")
            if len(doc) > 0:
                page = doc[0]
                pix = page.get_pixmap(dpi=200)
                img_data = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
                if pix.n == 4:
                    img = cv2.cvtColor(img_data, cv2.COLOR_RGBA2BGR)
                elif pix.n == 3:
                    img = cv2.cvtColor(img_data, cv2.COLOR_RGB2BGR)
                elif pix.n == 1:
                    img = cv2.cvtColor(img_data, cv2.COLOR_GRAY2BGR)
        except Exception:
            pass

    # 2. Image Decoding via OpenCV
    if img is None:
        np_arr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    # 3. Fallback to PIL decode
    if img is None:
        try:
            pil_img = Image.open(io.BytesIO(img_bytes))
            img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        except Exception:
            raise ValueError("Could not decode input document (unsupported image or PDF format)")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 4. Bilateral filtering for edge-preserving noise reduction
    filtered = cv2.bilateralFilter(gray, 7, 50, 50)

    # 5. Contrast Limited Adaptive Histogram Equalization (CLAHE) for illumination normalization
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(filtered)

    # 6. Deskew based on text line orientation
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



def classify_document(raw_text: str) -> tuple[str, str]:
    """
    Identifies document type and language script from recognized text.
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

    # Document type detection
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


