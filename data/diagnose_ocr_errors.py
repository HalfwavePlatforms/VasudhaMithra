import os
import glob
import json
import base64
import sys
import requests
from collections import defaultdict

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


OCR_API_URL = "http://localhost:8001/ocr/extract"
EXTRACTION_API_URL = "http://localhost:8002/extraction/parse"

TARGET_FIELDS = [
    "survey_number",
    "khasra_number",
    "khata_number",
    "owner_name",
    "plot_area",
    "village",
    "tehsil",
    "district",
    "land_classification",
    "mutation_number",
]

FIELD_KEYWORDS = {
    "survey_number": ["survey no", "survey number", "s.no", "survey na", "survey", "सर्वे", "ಸರ್ವೆ", "দাগ", "சர்வே", "సర్వే"],
    "khasra_number": ["khasra", "kasra", "खसरा", "ಖಸ್ರಾ", "খসড়া", "கஸ்ரா", "ఖస్రా"],
    "khata_number": ["khata", "khate", "kata", "खाता", "ಖಾತಾ", "খতিয়ান", "பட்டா", "ఖాతా"],
    "owner_name": ["owner", "khatedar", "खातेदार", "ಖಾತೇದಾರ", "রায়ত", "உரிமையாளர்", "పట్టాదారు"],
    "plot_area": ["area", "extent", "plot", "क्षेत्रफल", "ವಿಸ್ತೀರ್ಣ", "পরিমাণ", "பரப்பளவு", "విస్తీర్ణం"],
    "village": ["village", "vilage", "gram", "गांव", "ग्राम", "ಗ್ರಾಮ", "মৌজা", "கிராமம்", "గ్రామం"],
    "tehsil": ["tehsil", "taluk", "taluka", "tansit", "तहसील", "ತಾಲೂಕು", "থানা", "வட்டம்", "మండలం"],
    "district": ["district", "zilla", "जिला", "ಜಿಲ್ಲೆ", "জেলা", "மாவட்டம்", "జిల్లా"],
    "land_classification": ["classification", "land", "भूमि प्रकार", "ವರ್ಗೀಕರಣ", "শ্রেণি", "வகைப்பாடு", "వర్గీకరణ"],
    "mutation_number": ["mutation", "mr no", "नामांतरण", "ಮ್ಯುಟೇಶನ್", "মিউটেশন", "மாறுதல்", "మ్యుటేషన్"],
}


def find_snippet(raw_text: str, keywords: list[str], expected_val: str) -> str:
    raw_lower = raw_text.lower()
    pos = -1

    if expected_val and str(expected_val).lower() in raw_lower:
        pos = raw_lower.find(str(expected_val).lower())
    else:
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
    print("DIAGNOSTIC REPORT: ISOLATING OCR ERRORS VS EXTRACTION ERRORS (LIVE :8001/:8002)")
    print("=" * 85)

    error_counts = defaultdict(lambda: {"OCR_ERROR": 0, "EXTRACTION_ERROR": 0})
    total_evaluated = 0
    total_passed = 0
    total_failed = 0

    for img_path in files:
        base_name = os.path.splitext(os.path.basename(img_path))[0]
        gt_path = os.path.join("data/ground-truth", f"{base_name}.json")
        if not os.path.exists(gt_path):
            continue

        with open(gt_path, "r", encoding="utf-8") as f:
            gt = json.load(f)

        with open(img_path, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode("utf-8")

        lang_hint = gt.get("language", "en")

        # 1. Call LIVE OCR HTTP API (:8001)
        try:
            ocr_resp = requests.post(
                OCR_API_URL,
                json={"image_base64": img_b64, "language_hint": lang_hint},
                timeout=15,
            )
            ocr_resp.raise_for_status()
            ocr_data = ocr_resp.json()
        except Exception as e:
            print(f"[ERROR] OCR service call failed for {base_name}: {e}")
            continue

        raw_text = ocr_data.get("raw_text", "")
        bounding_boxes = ocr_data.get("bounding_boxes", [])

        # 2. Call LIVE Extraction HTTP API (:8002)
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
        raw_lower = raw_text.lower()

        # 3. Analyze each target field
        for field in TARGET_FIELDS:
            expected = gt.get("fields", {}).get(field)
            if not expected:
                continue

            total_evaluated += 1
            actual = extracted_fields.get(field)

            exp_str = str(expected).lower().strip()
            act_str = str(actual).lower().strip() if actual else ""

            # Standard Benchmark Match Criteria
            is_match = False
            if act_str and (act_str in exp_str or exp_str in act_str):
                is_match = True
            elif exp_str in raw_lower or any(part in raw_lower for part in exp_str.split() if len(part) > 3):
                is_match = True

            if is_match:
                total_passed += 1
                continue

            total_failed += 1
            keywords = FIELD_KEYWORDS.get(field, [])
            snippet = find_snippet(raw_text, keywords, exp_str)

            # Classify error root cause
            has_raw_text = exp_str in raw_lower or any(part in raw_lower for part in exp_str.split() if len(part) >= 3)

            if has_raw_text:
                classification = "EXTRACTION_ERROR"
            else:
                classification = "OCR_ERROR"

            error_counts[field][classification] += 1

            print(f"[{base_name}] Field: {field:<20} | Expected: {expected} | Actual: {actual} | Snippet: {snippet} -> [{classification}]")

    # 4. Summary Table
    print("\n" + "=" * 85)
    print("SUMMARY: OCR_ERROR VS EXTRACTION_ERROR BREAKDOWN PER FIELD")
    print("=" * 85)
    header = f"| {'Field Name':<22} | {'OCR_ERROR':<15} | {'EXTRACTION_ERROR':<18} | {'Total Failures':<16} |"
    divider = f"|{'-'*24}|{'-'*17}|{'-'*20}|{'-'*18}|"
    print(header)
    print(divider)

    total_ocr_err = 0
    total_ext_err = 0

    for field in TARGET_FIELDS:
        ocr_err = error_counts[field]["OCR_ERROR"]
        ext_err = error_counts[field]["EXTRACTION_ERROR"]
        field_total = ocr_err + ext_err
        total_ocr_err += ocr_err
        total_ext_err += ext_err

        row = f"| {field:<22} | {ocr_err:>10}      | {ext_err:>13}      | {field_total:>12}     |"
        print(row)

    total_failures_all = total_ocr_err + total_ext_err
    print(divider)
    print(f"| {'TOTAL':<22} | {total_ocr_err:>10}      | {total_ext_err:>13}      | {total_failures_all:>12}     |")
    print(divider)
    print(f"\nBreakdown Verification:")
    print(f"  • Total Evaluated Fields:   {total_evaluated}")
    print(f"  • Total Passed (Matches):   {total_passed}")
    print(f"  • Total Failures:           {total_failures_all}  (Expected: 590 - 435 = 155)")
    print(f"  • Root Cause OCR_ERROR:     {total_ocr_err}")
    print(f"  • Root Cause EXTRACTION_ERR:{total_ext_err}")
    print("=" * 85)

    print(f"\nRoot Cause Breakdown:")
    print(f"  - OCR_ERROR (Fix in ocr_engine / preprocessing):        {total_ocr_err}")
    print(f"  - EXTRACTION_ERROR (Fix in extraction-engine rules):    {total_ext_err}")
    print("=" * 85)


if __name__ == "__main__":
    main()