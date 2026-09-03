import os
import glob
import json
import base64
import requests
from collections import defaultdict

OCR_API_URL = "http://localhost:8001/ocr/extract"
EXTRACTION_API_URL = "http://localhost:8002/extraction/parse"

TARGET_FIELDS = ["survey_number", "khasra_number", "khata_number", "village", "tehsil"]

FIELD_KEYWORDS = {
    "survey_number": ["survey no", "survey number", "s.no", "survey na", "survey", "सर्वे", "ಸರ್ವೆ ನಂ"],
    "khasra_number": ["khasra", "kasra", "खसरा", "ಖಸ್ರಾ"],
    "khata_number": ["khata", "khate", "kata", "खाता", "ಖಾತಾ", "ಖಾತೆ"],
    "village": ["village", "vilage", "gram", "गांव", "ग्राम", "ಗ್ರಾಮ"],
    "tehsil": ["tehsil", "taluk", "taluka", "tansit", "तहसील", "ತಾಲೂಕು"],
}


def find_snippet(raw_text: str, keywords: list[str], expected_val: str) -> str:
    raw_lower = raw_text.lower()
    pos = -1

    # 1. Try finding by expected value in text
    if expected_val and str(expected_val).lower() in raw_lower:
        pos = raw_lower.find(str(expected_val).lower())
    else:
        # 2. Try finding by keyword
        for kw in keywords:
            idx = raw_lower.find(kw.lower())
            if idx != -1:
                pos = idx
                break

    if pos == -1:
        return "<keyword/value not found in raw OCR text>"

    start = max(0, pos - 20)
    end = min(len(raw_text), pos + len(str(expected_val)) + 30)
    snippet = raw_text[start:end].replace("\n", " ").strip()
    return f"...{snippet}..."


def main():
    files = sorted(glob.glob("data/sample-documents/*.png"))
    print("=" * 85)
    print("DIAGNOSTIC REPORT: ISOLATING OCR ERRORS VS EXTRACTION ERRORS")
    print("=" * 85)

    error_counts = defaultdict(lambda: {"OCR_ERROR": 0, "EXTRACTION_ERROR": 0})
    total_evaluated = 0

    for img_path in files:
        base_name = os.path.splitext(os.path.basename(img_path))[0]
        gt_path = os.path.join("data/ground-truth", f"{base_name}.json")
        if not os.path.exists(gt_path):
            continue

        with open(gt_path, "r", encoding="utf-8") as f:
            gt = json.load(f)

        with open(img_path, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode("utf-8")

        # 1. Call OCR HTTP API
        try:
            ocr_resp = requests.post(OCR_API_URL, json={"image_base64": img_b64, "language_hint": "en"}, timeout=15)
            ocr_resp.raise_for_status()
            ocr_data = ocr_resp.json()
        except Exception as e:
            print(f"[ERROR] OCR service call failed for {base_name}: {e}")
            continue

        raw_text = ocr_data.get("raw_text", "")
        bounding_boxes = ocr_data.get("bounding_boxes", [])

        # 2. Call Extraction HTTP API
        try:
            ext_resp = requests.post(
                EXTRACTION_API_URL,
                json={"raw_text": raw_text, "bounding_boxes": bounding_boxes},
                timeout=15,
            )
            ext_resp.raise_for_status()
            ext_data = ext_resp.json()
        except Exception as e:
            print(f"[ERROR] Extraction service call failed for {base_name}: {e}")
            continue

        extracted_fields = ext_data.get("fields", {})

        # 3. Analyze each target field
        print(f"\nDocument: {base_name} ({gt.get('document_type', 'Land Record')})")
        print("-" * 85)

        for field in TARGET_FIELDS:
            expected = gt.get("fields", {}).get(field)
            if not expected:
                continue

            total_evaluated += 1
            actual = extracted_fields.get(field)

            exp_norm = str(expected).lower().strip()
            act_norm = str(actual).lower().strip() if actual else ""

            # Check if match
            if actual and (act_norm == exp_norm or exp_norm in act_norm):
                # Match succeeded
                continue

            # Failure detected - isolate root cause
            keywords = FIELD_KEYWORDS.get(field, [])
            snippet = find_snippet(raw_text, keywords, exp_norm)

            # Determine classification
            raw_text_clean = raw_text.lower().replace(" ", "").replace("\n", "").replace("-", "").replace("/", "")
            exp_clean = exp_norm.replace(" ", "").replace("-", "").replace("/", "")

            if exp_norm in raw_text.lower() or exp_clean in raw_text_clean:
                classification = "EXTRACTION_ERROR"
            else:
                classification = "OCR_ERROR"

            error_counts[field][classification] += 1

            print(f"  Field:          {field}")
            print(f"  Ground Truth:   {expected}")
            print(f"  Extracted:      {actual}")
            print(f"  OCR Snippet:    {snippet}")
            print(f"  Classification: [{classification}]")
            print()

    # 4. Summary Table
    print("\n" + "=" * 85)
    print("SUMMARY: OCR_ERROR VS EXTRACTION_ERROR BREAKDOWN PER FIELD")
    print("=" * 85)
    header = f"| {'Field Name':<20} | {'OCR_ERROR (Image/OCR)':<25} | {'EXTRACTION_ERROR (Regex/Rule)':<30} |"
    divider = f"|{'-'*22}|{'-'*27}|{'-'*32}|"
    print(header)
    print(divider)

    total_ocr_err = 0
    total_ext_err = 0

    for field in TARGET_FIELDS:
        ocr_err = error_counts[field]["OCR_ERROR"]
        ext_err = error_counts[field]["EXTRACTION_ERROR"]
        total_ocr_err += ocr_err
        total_ext_err += ext_err

        row = f"| {field:<20} | {ocr_err:>12}               | {ext_err:>15}                  |"
        print(row)

    print(divider)
    print(f"| {'TOTAL':<20} | {total_ocr_err:>12}               | {total_ext_err:>15}                  |")
    print(divider)
    print(f"\nRoot Cause Breakdown:")
    print(f"  - OCR_ERROR (Fix in ocr_engine / preprocessing):        {total_ocr_err}")
    print(f"  - EXTRACTION_ERROR (Fix in extraction-engine rules):    {total_ext_err}")
    print("=" * 85)


if __name__ == "__main__":
    main()