import os
import glob
import json
import base64
import sys

sys.path.insert(0, "services/ocr-pipeline/src")
from preprocess import preprocess_image, classify_document
from ocr_engine import run_ocr

files = sorted(glob.glob("data/sample-documents/*.png"))
gt_files = sorted(glob.glob("data/ground-truth/*.json"))

print("=" * 60)
print(f"BENCHMARK ACCURACY EVALUATION ON {len(files)} DOCUMENTS")
print("=" * 60)

total_fields = 0
matched_fields = 0
ocr_confidences = []

for img_path in files:
    base = os.path.splitext(os.path.basename(img_path))[0]
    gt_path = os.path.join("data/ground-truth", f"{base}.json")
    if not os.path.exists(gt_path):
        continue

    with open(gt_path, "r", encoding="utf-8") as f:
        gt = json.load(f)

    with open(img_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    thresh, meta = preprocess_image(b64)
    res = run_ocr(thresh, language_hint="en")
    ocr_confidences.append(res["confidence"])

    raw_lower = res["raw_text"].lower()

    # Compare key ground truth fields
    for k, v in gt.get("fields", {}).items():
        if not v:
            continue
        total_fields += 1
        if str(v).lower() in raw_lower or any(part.lower() in raw_lower for part in str(v).split() if len(part) > 3):
            matched_fields += 1

field_acc = (matched_fields / total_fields) * 100 if total_fields else 0
avg_conf = (sum(ocr_confidences) / len(ocr_confidences)) * 100 if ocr_confidences else 0

print(f"Total Evaluated Fields:   {total_fields}")
print(f"Field Recognition Match:  {matched_fields}/{total_fields} ({field_acc:.1f}%)")
print(f"Average Optical Confidence: {avg_conf:.1f}%")
print("=" * 60)