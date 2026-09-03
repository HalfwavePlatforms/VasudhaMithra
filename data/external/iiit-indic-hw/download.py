"""
Downloads the IIIT-Indic handwritten word dataset for OCR training/testing.
Run once, from the data/ folder, with the venv activated:

    cd data
    source venv/bin/activate
    python external/iiit-indic-hw/download.py

Saves images + labels under data/external/iiit-indic-hw/<language>/.
This is a RESEARCH dataset (IIIT Hyderabad CVIT lab) — cite it if you use
it in your pitch deck. Do not commit the downloaded files themselves;
they're gitignored (see data/.gitignore) — this script is what's checked
in, so anyone on the team can regenerate the data locally.
"""
import os
from datasets import load_dataset

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "hindi")

# Hugging Face currently mirrors the Hindi (Devanagari) subset directly.
# For other scripts (Kannada, Telugu, etc.) see the note at the bottom —
# the full multi-script release is request-based, not a pip-installable dataset.
DATASET_NAME = "c3rl/IIIT-INDIC-HW-WORDS-Hindi"


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"Downloading {DATASET_NAME} ...")
    ds = load_dataset(DATASET_NAME)
    print(ds)

    # Save a small sample locally as PNGs + a labels.jsonl file, so the
    # OCR pipeline can be tested against real handwritten Devanagari
    # without needing the huggingface `datasets` library at OCR-runtime.
    split = "train" if "train" in ds else list(ds.keys())[0]
    sample_size = min(200, len(ds[split]))  # 200 is plenty for a hackathon test set

    labels_path = os.path.join(OUTPUT_DIR, "labels.jsonl")
    with open(labels_path, "w", encoding="utf-8") as labels_file:
        for i in range(sample_size):
            row = ds[split][i]
            image = row["image"]  # PIL image, per HF dataset card
            text_label = row.get("text") or row.get("label") or ""

            img_filename = f"hi_{i:04d}.png"
            image.save(os.path.join(OUTPUT_DIR, img_filename))
            labels_file.write(f'{{"file": "{img_filename}", "text": "{text_label}"}}\n')

    print(f"Saved {sample_size} images + labels to {OUTPUT_DIR}")
    print("\nFor other Indic scripts (Kannada, Telugu, Tamil, etc.):")
    print("the full multi-script IIIT-Indic-HW-Words release is request-based,")
    print("not available via `datasets`. Request access at:")
    print("https://cvit.iiit.ac.in/research/projects/cvit-projects/iiit-indic-hw-words")


if __name__ == "__main__":
    main()
