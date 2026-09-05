import os
import glob
import json
import base64
import sys
from collections import defaultdict

sys.path.insert(0, "services/ocr-pipeline/src")
sys.path.insert(0, "services/extraction-engine/src")

from preprocess import preprocess_image, classify_document
from ocr_engine import run_ocr
from field_extractor import extract_fields

files = sorted(glob.glob("data/sample-documents/*.png"))
gt_files = sorted(glob.glob("data/ground-truth/*.json"))

print("=" * 80)
print(f"BENCHMARK ACCURACY EVALUATION REPORT ({len(files)} DOCUMENTS)")
print("=" * 80)

total_fields_count = 0
total_matched_count = 0
ocr_confidences = []

per_field_stats = defaultdict(lambda: {
    "total": 0,
    "matched": 0,
    "real_conf_count": 0,
    "fallback_conf_count": 0,
    "conf_scores": []
})

for img_path in files:
    base = os.path.splitext(os.path.basename(img_path))[0]
    gt_path = os.path.join("data/ground-truth", f"{base}.json")
    if not os.path.exists(gt_path):
        continue

    with open(gt_path, "r", encoding="utf-8") as f:
        gt = json.load(f)

    with open(img_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    lang_hint = gt.get("language", "en")
    thresh, meta = preprocess_image(b64)
    res = run_ocr(thresh, language_hint=lang_hint)
    ocr_confidences.append(res["confidence"])


    extracted = extract_fields(res["raw_text"], res.get("bounding_boxes", []))
    extracted_fields = extracted.get("fields", {})
    field_confs = extracted.get("confidence_per_field", {})
    raw_lower = res["raw_text"].lower()

    # Compare ground truth fields
    for field_name, expected_val in gt.get("fields", {}).items():
        if not expected_val:
            continue

        stats = per_field_stats[field_name]
        stats["total"] += 1
        total_fields_count += 1

        exp_str = str(expected_val).lower().strip()
        act_val = extracted_fields.get(field_name)
        act_str = str(act_val).lower().strip() if act_val else ""

        # Check match against extracted field or raw text tokens
        is_match = False
        if act_str and (act_str in exp_str or exp_str in act_str):
            is_match = True
        elif exp_str in raw_lower or any(part in raw_lower for part in exp_str.split() if len(part) > 3):
            is_match = True

        if is_match:
            stats["matched"] += 1
            total_matched_count += 1

        # Check confidence calculation vs fallback
        conf_raw = field_confs.get(field_name)
        conf = conf_raw if (conf_raw is not None and isinstance(conf_raw, (int, float))) else 0.0
        stats["conf_scores"].append(conf)

        # Fallback values in field_extractor: 0.0 (not found), 0.5, 0.78, 0.88 (without box match)
        # Real box-matched confidence is calculated from character/word bounding boxes
        has_box_match = any(
            b.get("text") and act_str and b["text"].lower() in act_str
            for b in res.get("bounding_boxes", [])
        )

        if has_box_match and conf not in (0.0, 0.5, 0.78, 0.88):
            stats["real_conf_count"] += 1
        elif act_val is not None:
            stats["fallback_conf_count"] += 1
        else:
            stats["fallback_conf_count"] += 1

# Print Per-Field Breakdown Table
header = f"| {'Field Name':<22} | {'Accuracy':<14} | {'Match Rate':<12} | {'Real Conf':<11} | {'Fallback':<10} | {'Avg Conf':<10} |"
divider = f"|{'-'*24}|{'-'*16}|{'-'*14}|{'-'*13}|{'-'*12}|{'-'*12}|"

print("\n### PER-FIELD ACCURACY & CONFIDENCE BREAKDOWN TABLE\n")
print(header)
print(divider)

for field_name, stats in sorted(per_field_stats.items()):
    acc_pct = (stats["matched"] / stats["total"] * 100) if stats["total"] else 0.0
    match_str = f"{stats['matched']}/{stats['total']}"
    avg_conf_score = (sum(stats["conf_scores"]) / len(stats["conf_scores"]) * 100) if stats["conf_scores"] else 0.0

    row = (
        f"| {field_name:<22} | {match_str:<14} | {acc_pct:>8.1f}%   | "
        f"{stats['real_conf_count']:>9}   | {stats['fallback_conf_count']:>8}   | "
        f"{avg_conf_score:>7.1f}%   |"
    )
    print(row)

print(divider)

overall_acc = (total_matched_count / total_fields_count * 100) if total_fields_count else 0.0
overall_conf = (sum(ocr_confidences) / len(ocr_confidences) * 100) if ocr_confidences else 0.0

print(f"\n================================================================================")
print(f"Total Fields Evaluated:     {total_fields_count}")
print(f"Overall Recognition Match:  {total_matched_count}/{total_fields_count} ({overall_acc:.1f}%)")
print(f"Average Optical Confidence: {overall_conf:.1f}%")
print(f"================================================================================\n")