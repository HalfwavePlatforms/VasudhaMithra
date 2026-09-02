"""
Rule-based field extraction: for each configured field, look for its keyword(s)
near candidate text, then apply the field's regex (if any) to the nearby text.
This beats a generic NER model for structured government-form text, where field
labels are predictable even if handwriting/scan quality isn't.
"""
import re
import yaml
from pathlib import Path

RULES_PATH = Path(__file__).parent.parent / "rules" / "field_rules.yaml"


def _load_rules() -> dict:
    with open(RULES_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def extract_fields(raw_text: str, bounding_boxes: list[dict]) -> dict:
    rules = _load_rules()
    fields = {}
    confidence_per_field = {}
    needs_review = []

    threshold = rules.get("confidence_review_threshold", 0.75)

    for field_name, cfg in rules["fields"].items():
        value, confidence = _extract_one_field(raw_text, bounding_boxes, cfg)
        fields[field_name] = value
        confidence_per_field[field_name] = confidence
        if confidence < threshold or (cfg.get("required") and not value):
            needs_review.append(field_name)

    return {
        "fields": fields,
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

        window = raw_text[idx : idx + len(kw) + 60]

        if pattern:
            match = re.search(pattern, window)
            if match:
                # crude confidence: average of any bounding boxes overlapping the match text
                conf = _confidence_for_text(match.group(0), bounding_boxes)
                return match.group(0), conf
        else:
            after_kw = window[len(kw):].strip(" :–-")
            candidate = after_kw.split("\n")[0][:40].strip()
            if candidate:
                conf = _confidence_for_text(candidate, bounding_boxes)
                return candidate, conf

    return None, 0.0


def _confidence_for_text(text: str, bounding_boxes: list[dict]) -> float:
    matches = [b["confidence"] for b in bounding_boxes if b.get("text") and b["text"] in text]
    if matches:
        return sum(matches) / len(matches)
    return 0.5  # no bounding-box match found — neutral confidence, not zero
