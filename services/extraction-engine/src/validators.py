"""
Validation: format rules (from field_rules.yaml) + duplicate detection.
Duplicate detection needs a lookup against previously-seen field values —
this module takes that as an injected function so it stays testable without
a live DB connection.
"""
import re
from typing import Callable, Optional
import yaml
from pathlib import Path

RULES_PATH = Path(__file__).parent.parent / "rules" / "field_rules.yaml"


def _load_rules() -> dict:
    with open(RULES_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def validate_fields(
    fields: dict,
    record_id: str,
    duplicate_lookup: Optional[Callable[[str, str, str], Optional[str]]] = None,
) -> dict:
    """
    duplicate_lookup(field_name, field_value, exclude_record_id) -> existing_record_id or None
    Injected by api-gateway (it owns the DB); lets this module stay DB-agnostic and unit-testable.
    """
    rules = _load_rules()
    violations = []

    for field_name, cfg in rules["fields"].items():
        value = fields.get(field_name)

        if cfg.get("required") and not value:
            violations.append(
                {
                    "field": field_name,
                    "rule": "required",
                    "message": f"{field_name} is required but was not extracted",
                }
            )
            continue

        if value and cfg.get("pattern"):
            if not re.fullmatch(cfg["pattern"], value.strip()):
                violations.append(
                    {
                        "field": field_name,
                        "rule": "format",
                        "message": f"{field_name} value '{value}' does not match expected pattern",
                    }
                )

        if value and duplicate_lookup:
            existing = duplicate_lookup(field_name, value, record_id)
            if existing:
                violations.append(
                    {
                        "field": field_name,
                        "rule": "duplicate",
                        "message": f"{field_name} '{value}' already exists on record {existing}",
                    }
                )

    return {"valid": len(violations) == 0, "violations": violations}
