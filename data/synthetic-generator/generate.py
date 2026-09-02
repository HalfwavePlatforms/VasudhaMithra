"""
Generates synthetic land-record document images for the demo — since we don't
have access to real government land records. Disclose this openly in the pitch:
judges respect disclosed synthetic data far more than an implied-real dataset.

Usage: python generate.py --count 20 --out ../sample-documents
"""
import argparse
import os
import random
from PIL import Image, ImageDraw, ImageFont

VILLAGES = ["Kothari", "Rampur", "Sultanpur", "Devgaon", "Bhairavpur"]
TEHSILS = ["Sehore", "Vidisha", "Raisen", "Hoshangabad"]
DISTRICTS = ["Bhopal", "Indore", "Gwalior", "Jabalpur"]
CLASSIFICATIONS = ["Agricultural", "Residential", "Barren", "Irrigated"]

FIRST_NAMES = ["Ramesh", "Suresh", "Anita", "Meena", "Vijay", "Kiran"]
LAST_NAMES = ["Kumar", "Sharma", "Patel", "Verma", "Yadav"]


def random_record(idx: int) -> dict:
    return {
        "survey_number": f"{random.randint(1, 999)}/{random.randint(1, 20)}",
        "khasra_number": str(random.randint(1000, 9999)),
        "khata_number": str(random.randint(100, 999)),
        "owner_name": f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
        "plot_area": f"{round(random.uniform(0.5, 10.0), 2)} acre",
        "village": random.choice(VILLAGES),
        "tehsil": random.choice(TEHSILS),
        "district": random.choice(DISTRICTS),
        "land_classification": random.choice(CLASSIFICATIONS),
    }


def render_document(record: dict, out_path: str):
    img = Image.new("RGB", (900, 700), color="white")
    draw = ImageDraw.Draw(img)

    try:
        font_title = ImageFont.truetype("DejaVuSans-Bold.ttf", 24)
        font_body = ImageFont.truetype("DejaVuSans.ttf", 18)
    except IOError:
        font_title = ImageFont.load_default()
        font_body = ImageFont.load_default()

    draw.text((40, 30), "LAND RECORD - REVENUE DEPARTMENT (SYNTHETIC SAMPLE)", font=font_title, fill="black")
    draw.line((40, 70, 860, 70), fill="black", width=2)

    y = 110
    labels = {
        "survey_number": "Survey No",
        "khasra_number": "Khasra No",
        "khata_number": "Khata No",
        "owner_name": "Owner",
        "plot_area": "Area",
        "village": "Village",
        "tehsil": "Tehsil",
        "district": "District",
        "land_classification": "Classification",
    }
    for key, label in labels.items():
        draw.text((60, y), f"{label}: {record[key]}", font=font_body, fill="black")
        y += 40

    img.save(out_path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=20)
    parser.add_argument("--out", type=str, default="../sample-documents")
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    for i in range(args.count):
        record = random_record(i)
        out_path = os.path.join(args.out, f"synthetic_record_{i:03d}.png")
        render_document(record, out_path)
    print(f"Generated {args.count} synthetic documents in {args.out}")


if __name__ == "__main__":
    main()
