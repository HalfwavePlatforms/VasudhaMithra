"""
Validation: format rules (from field_rules.yaml) + duplicate detection + consistency checking.
Produces explainable validation outputs, risk levels, and status decisions.
"""
import re
from pathlib import Path
from typing import Callable, Optional
import yaml

RULES_PATH = Path(__file__).parent.parent / "rules" / "field_rules.yaml"


def _load_rules() -> dict:
    with open(RULES_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def validate_fields(
    fields: dict,
    record_id: str,
    confidence_per_field: Optional[dict] = None,
    duplicate_lookup: Optional[Callable[[str, str, str], Optional[str]]] = None,
) -> dict:
    """
    Validates extracted fields, performs duplicate detection, assesses risk,
    and returns a structured, explainable validation result.
    """
    rules = _load_rules()
    violations = []
    issues = []
    conf_dict = confidence_per_field or {}

    for field_name, cfg in rules["fields"].items():
        value = fields.get(field_name)
        field_conf = conf_dict.get(field_name, 0.85)

        # 1. Required field check
        if cfg.get("required") and not value:
            issue_text = f"Required field '{field_name}' could not be extracted from document."
            violations.append(
                {
                    "field": field_name,
                    "rule": "required",
                    "severity": "HIGH",
                    "message": issue_text,
                }
            )
            issues.append(issue_text)
            continue

        # 2. Pattern format check
        if value and cfg.get("pattern"):
            if not re.search(cfg["pattern"], value.strip(), re.IGNORECASE):
                issue_text = f"{field_name} value '{value}' does not conform to standard format rule ({cfg['pattern']})."
                violations.append(
                    {
                        "field": field_name,
                        "rule": "format",
                        "severity": "MEDIUM",
                        "message": issue_text,
                    }
                )
                issues.append(issue_text)

        # 3. Confidence threshold check
        threshold = rules.get("confidence_review_threshold", 0.75)
        if value and field_conf < threshold:
            issue_text = f"{field_name} extracted with low optical confidence ({round(field_conf * 100, 1)}% < {int(threshold * 100)}%)."
            violations.append(
                {
                    "field": field_name,
                    "rule": "low_confidence",
                    "severity": "LOW",
                    "message": issue_text,
                }
            )
            issues.append(issue_text)

        # 4. Duplicate lookup check
        if value and duplicate_lookup:
            existing = duplicate_lookup(field_name, value, record_id)
            if existing:
                issue_text = f"Potential duplicate: {field_name} '{value}' matches prior registered record {existing}."
                violations.append(
                    {
                        "field": field_name,
                        "rule": "duplicate",
                        "severity": "HIGH",
                        "message": issue_text,
                    }
                )
                issues.append(issue_text)

    # Calculate overall confidence & risk level
    if conf_dict:
        overall_conf = round(sum(conf_dict.values()) / max(1, len(conf_dict)), 3)
    else:
        overall_conf = 0.90

    high_sev_count = sum(1 for v in violations if v.get("severity") == "HIGH")
    med_sev_count = sum(1 for v in violations if v.get("severity") == "MEDIUM")

    if high_sev_count > 0:
        risk_level = "HIGH"
        status = "REVIEW_REQUIRED"
    elif med_sev_count > 0 or overall_conf < 0.75:
        risk_level = "MEDIUM"
        status = "REVIEW_REQUIRED"
    elif len(violations) > 0:
        risk_level = "LOW"
        status = "REVIEW_REQUIRED"
    else:
        risk_level = "LOW"
        status = "VERIFIED"

    return {
        "valid": len(violations) == 0,
        "status": status,
        "risk_level": risk_level,
        "confidence": overall_conf,
        "issues": issues,
        "violations": violations,
    }

