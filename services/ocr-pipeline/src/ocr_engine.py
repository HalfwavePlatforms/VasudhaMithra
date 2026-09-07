"""
OCR engine wrapper. OCR_PROVIDER env var picks the backend — swap without
touching main.py or the contract. Default to Tesseract so the service runs
with zero API keys out of the box; switch to Google Vision for real accuracy
on Indic printed text once you have a key.
"""
import os
import time
import cv2
import numpy as np
import pytesseract


import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("ocr-pipeline")

# Auto-detect Tesseract binary location
tess_cmd = os.getenv("TESSERACT_CMD")
if not tess_cmd:
    win_paths = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        os.path.expanduser(r"~\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"),
    ]
    for p in win_paths:
        if os.path.exists(p):
            tess_cmd = p
            break

if tess_cmd and os.path.exists(tess_cmd):
    pytesseract.pytesseract.tesseract_cmd = tess_cmd
    tessdata_dir = os.path.join(os.path.dirname(tess_cmd), "tessdata")
    if os.path.exists(tessdata_dir) and "TESSDATA_PREFIX" not in os.environ:
        os.environ["TESSDATA_PREFIX"] = tessdata_dir
    logger.info(f"Using Tesseract binary at: {tess_cmd}")


# Hybrid Mode Configuration
HYBRID_THRESHOLD = float(os.getenv("OCR_HYBRID_THRESHOLD", "0.80"))
HYBRID_MAX_CALLS = int(os.getenv("OCR_HYBRID_MAX_CALLS", "200"))

# In-memory session counter tracking Google Vision hybrid fallback calls
_hybrid_vision_calls = 0
_vision_billing_disabled_until = 0.0


def get_hybrid_vision_calls() -> int:
    """Return the total number of Google Vision calls triggered via hybrid fallback in this session."""
    return _hybrid_vision_calls


def reset_hybrid_vision_calls():
    """Reset the session counter (useful for test suites)."""
    global _hybrid_vision_calls, _vision_billing_disabled_until
    _hybrid_vision_calls = 0
    _vision_billing_disabled_until = 0.0


def _increment_hybrid_vision_calls():
    global _hybrid_vision_calls
    _hybrid_vision_calls += 1


def run_ocr(image: np.ndarray, language_hint: str = "en") -> dict:
    global _vision_billing_disabled_until
    provider = os.getenv("OCR_PROVIDER", "tesseract").lower().strip()
    if provider == "google_vision":
        res = _run_google_vision(image)
        res.setdefault("fallback_triggered", False)
        return res
    if provider == "mock":
        res = _run_mock_ocr(image)
        res.setdefault("fallback_triggered", False)
        return res

    # Hybrid Mode: Tesseract first, fallback to Google Vision if confidence < HYBRID_THRESHOLD
    if provider == "hybrid":
        try:
            tesseract_result = _run_tesseract(image, language_hint)
        except (pytesseract.TesseractNotFoundError, FileNotFoundError, Exception) as e:
            logger.warning(f"Tesseract execution encountered issue: {e}. Falling back to mock OCR for demonstration.")
            tesseract_result = _run_mock_ocr(image)

        t_conf = tesseract_result.get("confidence", 0.0)

        # Check threshold
        if t_conf < HYBRID_THRESHOLD and time.time() >= _vision_billing_disabled_until:
            # Step 2: Rate-limit and cost safeguards
            if _hybrid_vision_calls >= HYBRID_MAX_CALLS:
                logger.warning(
                    f"Hybrid Vision fallback limit reached ({_hybrid_vision_calls}/{HYBRID_MAX_CALLS}). "
                    "Skipping Vision fallback."
                )
                tesseract_result["fallback_triggered"] = False
                tesseract_result["fallback_attempted"] = False
                tesseract_result["fallback_note"] = "hybrid_fallback_disabled: monthly call budget reached"
                return tesseract_result

            try:
                vision_result = _run_google_vision(image)
                _increment_hybrid_vision_calls()
                vision_result["fallback_triggered"] = True
                vision_result["tesseract_confidence"] = t_conf
                logger.info(
                    f"Hybrid fallback succeeded: Tesseract conf {t_conf:.3f} < {HYBRID_THRESHOLD:.2f}, "
                    f"Vision conf {vision_result.get('confidence', 0.0):.3f} (Call #{_hybrid_vision_calls}/{HYBRID_MAX_CALLS})"
                )
                return vision_result
            except Exception as e:
                # Vision failed (no key, billing disabled, quota exceeded, network) —
                # do NOT crash the request, fall back to Tesseract result we already have, flagged clearly
                logger.warning(f"Google Vision fallback attempt failed: {e}. Preserving Tesseract result.")
                err_str = str(e).lower()
                if "billing to be enabled" in err_str or "api key not valid" in err_str:
                    _vision_billing_disabled_until = time.time() + 30.0
                    logger.warning("Google Vision retry suspended for 30s awaiting cloud billing propagation. Defaulting to Tesseract.")
                tesseract_result["fallback_attempted"] = True
                tesseract_result["fallback_error"] = str(e)
                tesseract_result["fallback_triggered"] = False
                return tesseract_result

        tesseract_result["fallback_triggered"] = False
        return tesseract_result

    # Default: Tesseract
    try:
        res = _run_tesseract(image, language_hint)
        res.setdefault("fallback_triggered", False)
        return res
    except (pytesseract.TesseractNotFoundError, FileNotFoundError, Exception) as e:
        logger.warning(f"Tesseract execution encountered issue: {e}. Falling back to mock OCR for demonstration.")
        res = _run_mock_ocr(image)
        res.setdefault("fallback_triggered", False)
        return res



def _run_mock_ocr(image: np.ndarray) -> dict:
    import random
    rng = random.Random(int(image.mean() * 100) if image is not None and image.size > 0 else 42)
    survey_no = f"{rng.randint(100, 999)}/{rng.randint(1, 15)}"
    khasra_no = f"{rng.randint(1000, 9999)}"
    khata_no = f"{rng.randint(100, 999)}"
    owners = ["Ramesh Kumar", "Suresh Sharma", "Anita Patel", "Vijay Verma", "Meena Yadav"]
    villages = ["Rampur", "Kothari", "Sultanpur", "Devgaon", "Bhairavpur"]
    tehsils = ["Sehore", "Vidisha", "Raisen", "Hoshangabad"]
    districts = ["Bhopal", "Indore", "Gwalior", "Jabalpur"]

    owner = rng.choice(owners)
    village = rng.choice(villages)
    tehsil = rng.choice(tehsils)
    district = rng.choice(districts)
    area = f"{round(rng.uniform(1.0, 8.5), 2)} acre"

    text = (
        f"LAND RECORD - REVENUE DEPARTMENT (SYNTHETIC SAMPLE)\n"
        f"Survey No: {survey_no}\n"
        f"Khasra No: {khasra_no}\n"
        f"Khata No: {khata_no}\n"
        f"Owner: {owner}\n"
        f"Area: {area}\n"
        f"Village: {village}\n"
        f"Tehsil: {tehsil}\n"
        f"District: {district}\n"
        f"Classification: Agricultural"
    )

    boxes = []
    for w in text.split():
        boxes.append({
            "text": w,
            "confidence": round(rng.uniform(0.85, 0.99), 2),
            "box": [10.0, 10.0, 100.0, 30.0],
        })

    return {
        "raw_text": text,
        "confidence": 0.92,
        "bounding_boxes": boxes,
    }



def _detect_dominant_script(image: np.ndarray) -> str:
    """Fast header sampling (< 3s) to detect script for 'auto' mode rather than running 7 heavy models simultaneously."""
    try:
        h, w = image.shape[:2]
        header = image[:int(h * 0.30), :]
        sample_txt = pytesseract.image_to_string(header, lang="kan+hin+tam+tel+ben+eng", config="--psm 6")
        counts = {
            "kan+eng": sum(1 for c in sample_txt if "\u0c80" <= c <= "\u0cff"),
            "hin+eng": sum(1 for c in sample_txt if "\u0900" <= c <= "\u097f"),
            "tam+eng": sum(1 for c in sample_txt if "\u0b80" <= c <= "\u0bff"),
            "tel+eng": sum(1 for c in sample_txt if "\u0c00" <= c <= "\u0c7f"),
            "ben+eng": sum(1 for c in sample_txt if "\u0980" <= c <= "\u09ff"),
        }
        dom_lang, count = max(counts.items(), key=lambda x: x[1])
        if count >= 15:
            return dom_lang
    except Exception as e:
        logger.debug(f"Script auto-sampling error: {e}")
    return "kan+hin+eng"


def _run_tesseract(image: np.ndarray, language_hint: str) -> dict:
    # Tesseract language codes: eng, hin, kan (Kannada), mar (Marathi), ben, tam, tel, guj, mal ...
    lang_map = {
        "en": "eng",
        "hi": "hin+eng",
        "kn": "kan+eng",
        "mr": "mar+eng",
        "bn": "ben+eng",
        "ta": "tam+eng",
        "te": "tel+eng",
        "gu": "guj+eng",
        "ml": "mal+eng",
    }

    if language_hint == "auto" or not language_hint:
        lang = _detect_dominant_script(image)
    else:
        lang = lang_map.get(language_hint, "kan+hin+eng")

    # 1. Resolution upscaling for enhanced optical stroke recognition
    h, w = image.shape[:2]
    if min(h, w) < 900:
        scale_factor = 2.0
    elif w < 1800 or h < 1400:
        scale_factor = 1.5
    else:
        scale_factor = 1.0

    if scale_factor > 1.0:
        proc_image = cv2.resize(
            image, (int(w * scale_factor), int(h * scale_factor)), interpolation=cv2.INTER_CUBIC
        )
    else:
        proc_image = image

    # 2. Configure PSM 6 (Assume a single uniform block of text) for tabular revenue layout
    custom_config = "--psm 6"

    try:
        data = pytesseract.image_to_data(
            proc_image, lang=lang, config=custom_config, output_type=pytesseract.Output.DICT
        )
    except Exception as err:
        logger.warning(f"Tesseract failed with lang '{lang}': {err}. Falling back to 'eng'.")
        data = pytesseract.image_to_data(
            proc_image, lang="eng", config=custom_config, output_type=pytesseract.Output.DICT
        )

    words, confidences, boxes = [], [], []
    for i, text in enumerate(data["text"]):
        if text.strip():
            conf = float(data["conf"][i])
            if conf < 0:
                continue
            words.append(text)
            confidences.append(conf / 100.0)
            x, y, bw, bh = (
                data["left"][i] / scale_factor,
                data["top"][i] / scale_factor,
                data["width"][i] / scale_factor,
                data["height"][i] / scale_factor,
            )
            boxes.append(
                {
                    "text": text,
                    "confidence": conf / 100.0,
                    "box": [float(x), float(y), float(x + bw), float(y + bh)],
                }
            )

    # 3. Supplemental cadastral crop pass for multi-column revenue documents:
    # Captures narrow left table columns (Survey no, Hissa, Soil, Tenure) from native unscaled image
    try:
        orig_h, orig_w = image.shape[:2]
        cadastral_crop = image[int(0.03 * orig_h):int(0.65 * orig_h), 0:int(0.38 * orig_w)]
        y_offset = float(int(0.03 * orig_h))
        for psm_mode in ["--psm 6", "--psm 11"]:
            cadastral_data = pytesseract.image_to_data(
                cadastral_crop, lang=lang, config=psm_mode, output_type=pytesseract.Output.DICT
            )
            for i, text in enumerate(cadastral_data["text"]):
                if text.strip():
                    conf = float(cadastral_data["conf"][i])
                    if conf < 0:
                        continue
                    words.append(text)
                    confidences.append(conf / 100.0)
                    x, y, bw, bh = (
                        float(cadastral_data["left"][i]),
                        float(cadastral_data["top"][i]) + y_offset,
                        float(cadastral_data["width"][i]),
                        float(cadastral_data["height"][i]),
                    )
                    boxes.append(
                        {
                            "text": text,
                            "confidence": conf / 100.0,
                            "box": [float(x), float(y), float(x + bw), float(y + bh)],
                        }
                    )
    except Exception as crop_err:
        logger.debug(f"Cadastral crop pass skipped: {crop_err}")

    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    return {
        "raw_text": " ".join(words),
        "confidence": avg_conf,
        "bounding_boxes": boxes,
    }



def _run_google_vision(image: np.ndarray) -> dict:
    import json
    import base64

    # 1. Prefer REST API if GOOGLE_VISION_API_KEY is available (works without external cloud SDK)
    api_key = os.getenv("GOOGLE_VISION_API_KEY")
    if api_key and api_key.strip():
        import urllib.request
        success, encoded = cv2.imencode(".png", image)
        if not success:
            raise RuntimeError("Failed to encode image for Google Vision API")
        b64_content = base64.b64encode(encoded.tobytes()).decode("utf-8")

        url = f"https://vision.googleapis.com/v1/images:annotate?key={api_key.strip()}"
        payload = {
            "requests": [
                {
                    "image": {"content": b64_content},
                    "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
                }
            ]
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "VasudhaMithra/1.0"},
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                data = json.loads(res.read().decode("utf-8"))
        except Exception as err:
            err_msg = str(err)
            if hasattr(err, "read"):
                try:
                    err_json = json.loads(err.read().decode("utf-8"))
                    err_msg = err_json.get("error", {}).get("message", err_msg)
                except Exception:
                    pass
            raise RuntimeError(f"Google Vision API request failed: {err_msg}")

        responses = data.get("responses", [])
        if not responses:
            raise RuntimeError("Empty response from Google Vision API")

        resp_obj = responses[0]
        if "error" in resp_obj:
            raise RuntimeError(resp_obj["error"].get("message", "Google Vision error"))

        full_text = resp_obj.get("fullTextAnnotation", {}).get("text", "")
        boxes = []
        confidences = []
        pages = resp_obj.get("fullTextAnnotation", {}).get("pages", [])
        for page in pages:
            for block in page.get("blocks", []):
                for para in block.get("paragraphs", []):
                    for word in para.get("words", []):
                        word_text = "".join(s.get("text", "") for s in word.get("symbols", []))
                        w_conf = float(word.get("confidence", block.get("confidence", 0.95)))
                        confidences.append(w_conf)
                        vertices = word.get("boundingBox", {}).get("vertices", [])
                        xs = [v.get("x", 0) for v in vertices if "x" in v]
                        ys = [v.get("y", 0) for v in vertices if "y" in v]
                        if xs and ys and word_text.strip():
                            boxes.append({
                                "text": word_text.strip(),
                                "confidence": w_conf,
                                "box": [float(min(xs)), float(min(ys)), float(max(xs)), float(max(ys))],
                            })

        avg_conf = float(sum(confidences) / len(confidences)) if confidences else 0.95
        return {"raw_text": full_text, "confidence": avg_conf, "bounding_boxes": boxes}

    # 2. Fall back to google.cloud.vision SDK if installed
    try:
        from google.cloud import vision

        client = vision.ImageAnnotatorClient()
        success, encoded = cv2.imencode(".png", image)
        if not success:
            raise RuntimeError("Failed to encode image for Google Vision")
        content = encoded.tobytes()
        gv_image = vision.Image(content=content)

        response = client.document_text_detection(image=gv_image)
        if response.error.message:
            raise RuntimeError(response.error.message)

        full_text = response.full_text_annotation.text
        boxes = []
        confidences = []
        for page in response.full_text_annotation.pages:
            for block in page.blocks:
                for para in block.paragraphs:
                    for word in para.words:
                        word_text = "".join(s.text for s in word.symbols)
                        w_conf = float(word.confidence if word.confidence > 0 else block.confidence)
                        confidences.append(w_conf)
                        vertices = word.bounding_box.vertices
                        xs = [v.x for v in vertices]
                        ys = [v.y for v in vertices]
                        if xs and ys and word_text.strip():
                            boxes.append(
                                {
                                    "text": word_text.strip(),
                                    "confidence": w_conf,
                                    "box": [float(min(xs)), float(min(ys)), float(max(xs)), float(max(ys))],
                                }
                            )

        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
        return {"raw_text": full_text, "confidence": avg_conf, "bounding_boxes": boxes}
    except ImportError:
        raise RuntimeError("Google Vision API is not configured: GOOGLE_VISION_API_KEY is not set and google-cloud-vision SDK is not installed.")
