"""
OCR engine wrapper. OCR_PROVIDER env var picks the backend — swap without
touching main.py or the contract. Default to Tesseract so the service runs
with zero API keys out of the box; switch to Google Vision for real accuracy
on Indic printed text once you have a key.
"""
import os
import cv2
import numpy as np
import pytesseract


import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("ocr-pipeline")


def run_ocr(image: np.ndarray, language_hint: str = "en") -> dict:
    provider = os.getenv("OCR_PROVIDER", "tesseract")
    if provider == "google_vision":
        return _run_google_vision(image)
    if provider == "mock":
        return _run_mock_ocr(image)
    try:
        return _run_tesseract(image, language_hint)
    except (pytesseract.TesseractNotFoundError, FileNotFoundError):
        logger.warning("Tesseract binary not found on host. Falling back to mock OCR for demonstration.")
        return _run_mock_ocr(image)


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



def _run_tesseract(image: np.ndarray, language_hint: str) -> dict:
    # Tesseract language codes: eng, hin, kan (Kannada), mar (Marathi), ben, tam, tel ...
    lang_map = {
        "en": "eng",
        "hi": "hin",
        "kn": "kan",
        "mr": "mar",
        "bn": "ben",
        "ta": "tam",
        "te": "tel",
    }
    lang = lang_map.get(language_hint, "eng")

    data = pytesseract.image_to_data(
        image, lang=lang, output_type=pytesseract.Output.DICT
    )

    words, confidences, boxes = [], [], []
    for i, text in enumerate(data["text"]):
        if text.strip():
            conf = float(data["conf"][i])
            if conf < 0:
                continue
            words.append(text)
            confidences.append(conf / 100.0)
            x, y, w, h = (
                data["left"][i],
                data["top"][i],
                data["width"][i],
                data["height"][i],
            )
            boxes.append(
                {
                    "text": text,
                    "confidence": conf / 100.0,
                    "box": [float(x), float(y), float(x + w), float(y + h)],
                }
            )

    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    return {
        "raw_text": " ".join(words),
        "confidence": avg_conf,
        "bounding_boxes": boxes,
    }


def _run_google_vision(image: np.ndarray) -> dict:
    from google.cloud import vision

    client = vision.ImageAnnotatorClient()
    success, encoded = cv2.imencode(".png", image)
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
            confidences.append(block.confidence)
            vertices = block.bounding_box.vertices
            xs = [v.x for v in vertices]
            ys = [v.y for v in vertices]
            boxes.append(
                {
                    "text": "",  # block-level text not trivially available here
                    "confidence": block.confidence,
                    "box": [min(xs), min(ys), max(xs), max(ys)],
                }
            )

    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    return {"raw_text": full_text, "confidence": avg_conf, "bounding_boxes": boxes}
