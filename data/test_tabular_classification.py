import base64
import json
import os
import sys

sys.path.insert(0, "services/ocr-pipeline/src")
sys.path.insert(0, "services/extraction-engine/src")

from preprocess import preprocess_image, classify_document
from ocr_engine import run_ocr
from field_extractor import extract_fields

def main():
    print("Testing classification and fallback path for legacy tabular registers:")
    correct = 0
    total = 4
    for i in range(1, 5):
        fname = f"legacy_tabular_0{i}"
        png_path = f"data/sample-documents/{fname}.png"
        gt_path = f"data/ground-truth/{fname}.json"
        with open(gt_path, "r", encoding="utf-8") as f:
            gt = json.load(f)

        with open(png_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")

        thresh, meta = preprocess_image(b64)
        res = run_ocr(thresh, language_hint="hi")
        doc_type, lang = classify_document(res["raw_text"], res.get("bounding_boxes", []))

        print(f"[{fname}] Classified doc_type: '{doc_type}', Expected: '{gt['document_type']}', Detected lang: '{lang}'")
        if doc_type == gt["document_type"]:
            correct += 1

        # Test extraction engine fallback behavior
        extracted = extract_fields(res["raw_text"], res.get("bounding_boxes", []), document_type=doc_type)
        print(f"  Fallback triage_reason: {extracted.get('triage_reason')}")
        print(f"  Field values all None: {all(v is None for v in extracted.get('fields', {}).values())}")
        print(f"  Field confs all None: {all(v is None for v in extracted.get('confidence_per_field', {}).values())}")

    accuracy = (correct / total) * 100
    print(f"\nLegacy Tabular Classification Accuracy: {correct}/{total} ({accuracy:.1f}%)")
    assert correct == total, f"Expected {total}/{total} classified as legacy_tabular_register, got {correct}"

if __name__ == "__main__":
    main()
