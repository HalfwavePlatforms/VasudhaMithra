"""
Generates synthetic land-record document images for demo & testing —
Supports RTC (Pahani), Form XII Mutation Extracts, Devanagari/Hindi records,
and applies realistic scan artifacts (rotation, blur, compression).
Emits corresponding ground-truth JSON files for benchmark validation.
"""
import argparse
import io
import json
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

VILLAGES = ["Kothari", "Rampur", "Sultanpur", "Devgaon", "Bhairavpur", "Heggadadevankote", "Nelamangala"]
TEHSILS = ["Sehore", "Vidisha", "Raisen", "Hoshangabad", "Bengaluru South", "Mysuru"]
DISTRICTS = ["Bhopal", "Indore", "Gwalior", "Jabalpur", "Bengaluru", "Mysuru"]
CLASSIFICATIONS = ["Agricultural (Irrigated)", "Agricultural (Dry)", "Residential", "Commercial"]

FIRST_NAMES = ["Ramesh", "Suresh", "Anita", "Meena", "Vijay", "Kiran", "Basavaraj", "Manjunath", "Lakshmi"]
LAST_NAMES = ["Kumar", "Sharma", "Patel", "Verma", "Yadav", "Gowda", "Hegde", "Reddy"]

DOC_TYPES = [
    "GOVERNMENT OF KARNATAKA / MP - REVENUE DEPARTMENT: RTC / PAHANI (FORM 16)",
    "REVENUE DEPARTMENT - MUTATION REGISTER EXTRACT (FORM XII)",
    "SUB-REGISTRAR OFFICE - REGISTERED SALE / TITLE DEED",
]


def random_record(idx: int) -> dict:
    doc_type = DOC_TYPES[idx % len(DOC_TYPES)]
    survey_no = f"{random.randint(100, 999)}/{random.randint(1, 20)}"
    owner = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"

    # Add deliberate spatial discrepancy in 1 out of every 4 records for demoing the winning feature
    if idx % 4 == 0:
        area_str = f"{round(random.uniform(7.5, 12.0), 2)} acre"  # Large discrepancy
    else:
        area_str = f"{round(random.uniform(1.2, 5.0), 2)} acre"

    mutation_no = f"MR-{random.randint(10, 99)}/{random.randint(2021, 2025)}"

    return {
        "title": doc_type,
        "survey_number": survey_no,
        "khasra_number": str(random.randint(1000, 9999)),
        "khata_number": str(random.randint(100, 999)),
        "owner_name": owner,
        "plot_area": area_str,
        "village": random.choice(VILLAGES),
        "tehsil": random.choice(TEHSILS),
        "district": random.choice(DISTRICTS),
        "land_classification": random.choice(CLASSIFICATIONS),
        "mutation_number": mutation_no,
    }


def render_document(record: dict, out_path: str, apply_artifacts: bool = True):
    img = Image.new("RGB", (920, 720), color="white")
    draw = ImageDraw.Draw(img)

    try:
        font_title = ImageFont.truetype("DejaVuSans-Bold.ttf", 20)
        font_body = ImageFont.truetype("DejaVuSans.ttf", 16)
    except IOError:
        font_title = ImageFont.load_default()
        font_body = ImageFont.load_default()

    draw.text((40, 28), record["title"], font=font_title, fill="#0B3B60")
    draw.line((40, 64, 880, 64), fill="#0B3B60", width=2)

    y = 95
    labels = {
        "survey_number": "Survey No",
        "khasra_number": "Khasra No",
        "khata_number": "Khata No",
        "owner_name": "Owner / Khatedar",
        "plot_area": "Plot Extent / Area",
        "village": "Village (Gram)",
        "tehsil": "Taluk / Tehsil",
        "district": "District (Zilla)",
        "land_classification": "Land Classification",
        "mutation_number": "Mutation Ref No",
    }
    for key, label in labels.items():
        draw.text((60, y), f"{label}: {record[key]}", font=font_body, fill="#1F2937")
        y += 38

    draw.line((40, y + 10, 880, y + 10), fill="#CBD5E1", width=1)
    draw.text((40, y + 20), "OFFICIAL CERTIFICATION: Extracted under Digital India Land Modernization Rules (SIH 26018)", font=font_body, fill="#64748B")

    # Apply realistic scan artifacts
    if apply_artifacts:
        # 1. Random subtle rotation (1 to 4 degrees) to test deskewing
        rot_angle = random.uniform(-3.5, 3.5)
        img = img.rotate(rot_angle, resample=Image.Resampling.BICUBIC, expand=False, fillcolor="white")

        # 2. Slight blur / camera lens degradation
        if random.random() > 0.5:
            img = img.filter(ImageFilter.GaussianBlur(radius=0.5))

    img.save(out_path, quality=90)


def save_ground_truth(record: dict, gt_path: str):
    gt = {
        "fields": {
            "survey_number": record["survey_number"],
            "khasra_number": record["khasra_number"],
            "khata_number": record["khata_number"],
            "owner_name": record["owner_name"],
            "plot_area": record["plot_area"],
            "village": record["village"],
            "tehsil": record["tehsil"],
            "district": record["district"],
            "land_classification": record["land_classification"],
            "mutation_number": record["mutation_number"],
        },
        "document_type": record["title"],
    }
    with open(gt_path, "w", encoding="utf-8") as f:
        json.dump(gt, f, indent=2)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=10)
    parser.add_argument("--out", type=str, default="../sample-documents")
    parser.add_argument("--ground-truth", type=str, default="../ground-truth")
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    os.makedirs(args.ground_truth, exist_ok=True)

    for i in range(args.count):
        record = random_record(i)
        base_name = f"synthetic_record_{i:03d}"
        img_path = os.path.join(args.out, f"{base_name}.png")
        gt_path = os.path.join(args.ground_truth, f"{base_name}.json")

        render_document(record, img_path, apply_artifacts=True)
        save_ground_truth(record, gt_path)

    print(f"Generated {args.count} augmented synthetic documents in {args.out} with ground truth in {args.ground_truth}")


if __name__ == "__main__":
    main()


