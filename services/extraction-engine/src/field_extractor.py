"""
Rule-based field extraction: for each configured field, look for its keyword(s)
near candidate text, then apply the field's regex (if any) to the nearby text.
Extracts structured land-record schema with explainable confidence scores.
"""
import re
from pathlib import Path
import yaml

RULES_PATH = Path(__file__).parent.parent / "rules" / "field_rules.yaml"


def _load_rules() -> dict:
    with open(RULES_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def parse_area_to_acres(area_str: str | None) -> tuple[float | None, str | None]:
    """
    Normalizes different land area measurement units to standard Acres.
    1 Hectare = 2.47105 Acres
    1 Guntha = 0.025 Acres (1/40th acre)
    1 Sq Meter = 0.000247105 Acres
    1 Sq Foot = 0.0000229568 Acres
    """
    if not area_str:
        return None, None

    clean = area_str.lower().strip()
    match = re.search(r"(\d+(\.\d+)?)", clean)
    if not match:
        return None, None

    val = float(match.group(1))

    if "hectare" in clean:
        return round(val * 2.47105, 3), "hectare"
    elif "guntha" in clean or "gunta" in clean:
        return round(val * 0.025, 3), "guntha"
    elif "sq.ft" in clean or "sq ft" in clean or "sqft" in clean:
        return round(val * 0.0000229568, 3), "sq_ft"
    elif "sq.m" in clean or "sq m" in clean or "sqm" in clean:
        return round(val * 0.000247105, 3), "sq_m"
    else:
        return round(val, 3), "acre"


def extract_fields(raw_text: str, bounding_boxes: list[dict]) -> dict:
    rules = _load_rules()
    fields = {}
    confidence_per_field = {}
    structured_record = {}
    needs_review = []

    threshold = rules.get("confidence_review_threshold", 0.75)

    for field_name, cfg in rules["fields"].items():
        value, confidence = _extract_one_field(raw_text, bounding_boxes, cfg)
        fields[field_name] = value
        confidence_per_field[field_name] = round(confidence, 3)

        field_obj = {
            "value": value,
            "confidence": round(confidence, 3),
        }

        if field_name == "plot_area" and value:
            acres, unit = parse_area_to_acres(value)
            field_obj["area_acres"] = acres
            field_obj["unit"] = unit

        structured_record[field_name] = field_obj

        if confidence < threshold or (cfg.get("required") and not value):
            needs_review.append(field_name)

    area_acres = None
    if fields.get("plot_area"):
        area_acres, _ = parse_area_to_acres(fields["plot_area"])

    return {
        "fields": fields,
        "structured_record": structured_record,
        "area_acres": area_acres,
        "confidence_per_field": confidence_per_field,
        "needs_review": needs_review,
    }


def _extract_one_field(raw_text: str, bounding_boxes: list[dict], cfg: dict):
    keywords = cfg.get("keywords", [])
    pattern = cfg.get("pattern")

    for kw in keywords:
        idx = raw_text.lower().find(kw.lower())
        if idx == -1:
            continue

        window = raw_text[idx : idx + len(kw) + 75]

        if pattern:
            match = re.search(pattern, window, re.IGNORECASE)
            if match:
                val = match.group(0).strip()
                conf = _confidence_for_text(val, bounding_boxes)
                return val, conf
        else:
            after_kw = window[len(kw) :].strip(" :–-\t")
            candidate = after_kw.split("\n")[0][:45].strip()
            if candidate:
                conf = _confidence_for_text(candidate, bounding_boxes)
                return candidate, conf

    return None, 0.0


def _confidence_for_text(text: str, bounding_boxes: list[dict]) -> float:
    if not bounding_boxes:
        return 0.88  # baseline confidence when no boxes supplied

    matches = [b["confidence"] for b in bounding_boxes if b.get("text") and b["text"] in text]
    if matches:
        return float(sum(matches) / len(matches))
    return 0.78  # text found by keyword proximity

