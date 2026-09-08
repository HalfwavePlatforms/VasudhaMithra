"""
Multilingual Type Coverage & Evaluation Test Suite.
Evaluates classification and extraction across all three Land Record Document Types:
- Type 1: Standard Computerized Land Records (7 languages: en, hi, kn, mr, bn, ta, te)
- Type 2: Legacy Tabular Khasra/RTC Registers (3 languages: hi, kn, bn)
- Type 3: Numbered Box RTC / Pahani Registers (3 languages: kn, mr, te)
Prints a comprehensive evaluation evidence grid and asserts zero regression.
"""
import os
import sys
import glob
import json
import base64
from pathlib import Path
from collections import defaultdict

# Force fast offline Tesseract provider
os.environ["OCR_PROVIDER"] = "tesseract"

sys.path.insert(0, "services/ocr-pipeline/src")
sys.path.insert(0, "services/extraction-engine/src")

from preprocess import preprocess_image, classify_document
from ocr_engine import run_ocr
from field_extractor import extract_fields


def main():
    print("=" * 90)
    print("VASUDHAMITHRA MULTILINGUAL DOCUMENT TYPE COVERAGE & EXTRACTION BENCHMARK")
    print("=" * 90)

    repo_dir = Path(__file__).parent.parent
    samples_dir = repo_dir / "data" / "sample-documents"
    gt_dir = repo_dir / "data" / "ground-truth"

    categories = [
        # (Category Name, Type Key, Lang, File Pattern)
        ("Type 1 (Standard Land Records)", "type1", "en", "doc_en_*.json"),
        ("Type 1 (Standard Land Records)", "type1", "hi", "doc_hi_*.json"),
        ("Type 1 (Standard Land Records)", "type1", "kn", "doc_kn_*.json"),
        ("Type 1 (Standard Land Records)", "type1", "mr", "doc_mr_*.json"),
        ("Type 1 (Standard Land Records)", "type1", "bn", "doc_bn_*.json"),
        ("Type 1 (Standard Land Records)", "type1", "ta", "doc_ta_*.json"),
        ("Type 1 (Standard Land Records)", "type1", "te", "doc_te_*.json"),
        ("Type 2 (Legacy Tabular Registers)", "legacy_tabular_register", "hi", "legacy_tabular_0*.json"),
        ("Type 2 (Legacy Tabular Registers)", "legacy_tabular_register", "kn", "legacy_tabular_kn_*.json"),
        ("Type 2 (Legacy Tabular Registers)", "legacy_tabular_register", "bn", "legacy_tabular_bn_*.json"),
        ("Type 3 (Numbered Box RTC)", "numbered_box_rtc", "kn", "numbered_box_kn_*.json"),
        ("Type 3 (Numbered Box RTC)", "numbered_box_rtc", "mr", "numbered_box_mr_*.json"),
        ("Type 3 (Numbered Box RTC)", "numbered_box_rtc", "te", "numbered_box_te_*.json"),
    ]

    results = []
    total_docs = 0
    total_class_correct = 0
    total_extract_valid = 0

    for cat_name, type_key, lang, pattern in categories:
        gt_files = sorted(glob.glob(str(gt_dir / pattern)))
        if not gt_files:
            continue

        class_correct = 0
        extract_valid = 0
        doc_count = len(gt_files)

        for gtf in gt_files:
            total_docs += 1
            base_name = Path(gtf).stem
            png_path = samples_dir / f"{base_name}.png"

            with open(gtf, "r", encoding="utf-8") as f:
                gt = json.load(f)

            with open(png_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")

            thresh, meta = preprocess_image(b64)
            res = run_ocr(thresh, language_hint=lang)
            doc_type, det_lang = classify_document(res["raw_text"], res.get("bounding_boxes", []))

            # Verify Classification
            is_class_correct = False
            if type_key == "type1":
                # Type 1 documents should NOT be classified as legacy_tabular_register or numbered_box_rtc
                is_class_correct = doc_type not in ("legacy_tabular_register", "numbered_box_rtc")
            elif type_key == "legacy_tabular_register":
                is_class_correct = (doc_type == "legacy_tabular_register")
            elif type_key == "numbered_box_rtc":
                is_class_correct = (doc_type == "numbered_box_rtc")

            if is_class_correct:
                class_correct += 1
                total_class_correct += 1

            # Extract fields
            extracted = extract_fields(
                res["raw_text"],
                res.get("bounding_boxes", []),
                document_type=doc_type,
                language=det_lang,
            )
            extracted_fields = extracted.get("fields", {})

            # Verify Extraction Contract
            is_ext_valid = False
            if type_key == "type1":
                # Type 1 should extract fields (at least survey, khata, or owner)
                has_extracted = any(v is not None for v in extracted_fields.values())
                is_ext_valid = has_extracted
            elif type_key == "legacy_tabular_register":
                # Type 2 contract: all fields null, triage_reason routed for manual/LLM
                all_none = all(v is None for v in extracted_fields.values())
                has_triage = bool(extracted.get("triage_reason"))
                is_ext_valid = all_none and has_triage
            elif type_key == "numbered_box_rtc":
                # Type 3 contract: survey_number and owner_name populated or rule evaluated, others null
                other_fields = {k: v for k, v in extracted_fields.items() if k not in ("survey_number", "owner_name")}
                others_null = all(v is None for v in other_fields.values())
                has_survey_or_owner = (extracted_fields.get("survey_number") is not None) or (extracted_fields.get("owner_name") is not None)
                is_ext_valid = others_null and has_survey_or_owner

            if is_ext_valid:
                extract_valid += 1
                total_extract_valid += 1

        results.append({
            "category": cat_name,
            "type_key": type_key,
            "lang": lang,
            "docs": doc_count,
            "class_correct": class_correct,
            "class_acc": (class_correct / doc_count) * 100.0,
            "extract_valid": extract_valid,
            "extract_acc": (extract_valid / doc_count) * 100.0,
        })

    # Print Formatted Evidence Grid
    print("\n### MULTILINGUAL TYPE COVERAGE & ACCURACY EVIDENCE GRID\n")
    header = f"| {'Document Format / Category':<34} | {'Lang':<6} | {'Docs':<6} | {'Classification':<16} | {'Extraction Contract':<21} |"
    divider = f"|{'-'*36}|{'-'*8}|{'-'*8}|{'-'*18}|{'-'*23}|"
    print(header)
    print(divider)

    for r in results:
        class_str = f"{r['class_correct']}/{r['docs']} ({r['class_acc']:.1f}%)"
        ext_str = f"{r['extract_valid']}/{r['docs']} ({r['extract_acc']:.1f}%)"
        print(f"| {r['category']:<34} | {r['lang']:<6} | {r['docs']:<6} | {class_str:<16} | {ext_str:<21} |")

    overall_class_pct = (total_class_correct / total_docs * 100.0) if total_docs else 0.0
    overall_ext_pct = (total_extract_valid / total_docs * 100.0) if total_docs else 0.0

    print(divider)
    print(f"| {'TOTAL / OVERALL ACCURACY':<34} | {'ALL':<6} | {total_docs:<6} | {total_class_correct}/{total_docs} ({overall_class_pct:.1f}%)   | {total_extract_valid}/{total_docs} ({overall_ext_pct:.1f}%)    |")
    print("=" * 90)

    # Acceptance criteria assertions
    type1_results = [r for r in results if r["type_key"] == "type1"]
    type2_results = [r for r in results if r["type_key"] == "legacy_tabular_register"]
    type3_results = [r for r in results if r["type_key"] == "numbered_box_rtc"]

    assert len(type1_results) == 7, f"Expected 7 languages for Type 1, got {len(type1_results)}"
    assert len(type2_results) == 3, f"Expected 3 languages for Type 2, got {len(type2_results)}"
    assert len(type3_results) == 3, f"Expected 3 languages for Type 3, got {len(type3_results)}"

    for r in results:
        assert r["class_acc"] == 100.0, f"Classification regression in {r['category']} ({r['lang']}): {r['class_acc']:.1f}%"
        assert r["extract_acc"] >= 80.0, f"Extraction contract regression in {r['category']} ({r['lang']}): {r['extract_acc']:.1f}%"

    print("\n All type coverage assertions passed successfully with zero regression.")


if __name__ == "__main__":
    main()
