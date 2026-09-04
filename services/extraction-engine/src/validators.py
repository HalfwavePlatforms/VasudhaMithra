"""
Validation: format rules (from field_rules.yaml) + consistency checks + duplicate detection.
Produces explainable validation outputs, risk levels, and status decisions.

Consistency checks added:
  - Area sanity range (plausible land size bounds)
  - Village / tehsil / district administrative hierarchy co-presence
  - survey_number vs khasra_number identity (extraction overlap detection)
  - GIS area discrepancy (document area vs PostGIS ST_Area) — WOW feature

Rule: never say "AI detected fraud" — use "Potential inconsistency detected" for
heuristic checks so outputs are honest about their nature.
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
    gis_area_acres: Optional[float] = None,
) -> dict:
    """
    Validates extracted fields, performs consistency checks and duplicate detection,
    assesses risk, and returns a structured, explainable validation result.

    Args:
        fields:               Flat dict of field_name → raw string value.
        record_id:            Document/record UUID (for duplicate lookup).
        confidence_per_field: Optional dict of field_name → float confidence.
        duplicate_lookup:     Optional callable(field, value, record_id) → existing_id or None.
        gis_area_acres:       Optional float from GIS service (ST_Area). When provided, an
                              area discrepancy check is performed against the extracted plot_area.
    """
    rules = _load_rules()
    violations = []
    issues = []
    conf_dict = confidence_per_field or {}

    # ── Phase 1: Per-field format + required + confidence checks ─────────────

    for field_name, cfg in rules["fields"].items():
        value = fields.get(field_name)
        field_conf = conf_dict.get(field_name, 0.85)

        # 1a. Required field check
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

        # 1b. Pattern format check
        if value and cfg.get("pattern"):
            if not re.search(cfg["pattern"], value.strip(), re.IGNORECASE):
                issue_text = (
                    f"{field_name} value '{value}' does not conform to standard format "
                    f"rule ({cfg['pattern']})."
                )
                violations.append(
                    {
                        "field": field_name,
                        "rule": "format",
                        "severity": "MEDIUM",
                        "message": issue_text,
                    }
                )
                issues.append(issue_text)

        # 1c. Confidence threshold check
        threshold = rules.get("confidence_review_threshold", 0.75)
        if value and field_conf < threshold:
            issue_text = (
                f"{field_name} extracted with low optical confidence "
                f"({round(field_conf * 100, 1)}% < {int(threshold * 100)}%)."
            )
            violations.append(
                {
                    "field": field_name,
                    "rule": "low_confidence",
                    "severity": "LOW",
                    "message": issue_text,
                }
            )
            issues.append(issue_text)

        # 1d. Duplicate lookup check
        if value and duplicate_lookup:
            existing = duplicate_lookup(field_name, value, record_id)
            if existing:
                issue_text = (
                    f"Potential duplicate: {field_name} '{value}' matches prior "
                    f"registered record {existing}."
                )
                violations.append(
                    {
                        "field": field_name,
                        "rule": "duplicate",
                        "severity": "HIGH",
                        "message": issue_text,
                    }
                )
                issues.append(issue_text)

    # ── Phase 2: Cross-field consistency checks ───────────────────────────────

    _check_area_sanity(fields, rules, violations, issues)
    _check_admin_hierarchy(fields, violations, issues)
    _check_survey_khasra_identity(fields, violations, issues)
    if gis_area_acres is not None:
        _check_area_discrepancy(fields, gis_area_acres, rules, violations, issues)

    # ── Phase 3: Risk level & status ─────────────────────────────────────────

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


# ── Consistency check helpers ─────────────────────────────────────────────────

def _check_area_sanity(
    fields: dict, rules: dict, violations: list, issues: list
) -> None:
    """
    Verify extracted plot_area is within plausible real-world bounds.
    Bounds are configurable via field_rules.yaml (area_min_acres / area_max_acres).
    """
    from field_extractor import parse_area_to_acres  # local import avoids circular

    raw_area = fields.get("plot_area")
    if not raw_area:
        return

    area_acres, _ = parse_area_to_acres(raw_area)
    if area_acres is None:
        return

    min_acres = rules.get("area_min_acres", 0.001)
    max_acres = rules.get("area_max_acres", 5000.0)

    if area_acres < min_acres or area_acres > max_acres:
        issue_text = (
            f"plot_area value {area_acres} acres is outside the plausible range "
            f"[{min_acres}, {max_acres}] acres — verify document or unit conversion."
        )
        violations.append(
            {
                "field": "plot_area",
                "rule": "area_sanity",
                "severity": "MEDIUM",
                "message": issue_text,
            }
        )
        issues.append(issue_text)


def _check_admin_hierarchy(fields: dict, violations: list, issues: list) -> None:
    """
    If village is present but both tehsil and district are absent, the administrative
    hierarchy is incomplete — flag for human review.
    """
    village = fields.get("village")
    tehsil = fields.get("tehsil")
    district = fields.get("district")

    if village and not tehsil and not district:
        issue_text = (
            f"Village '{village}' was extracted but tehsil and district are both missing. "
            "Administrative hierarchy incomplete — verify document coverage."
        )
        violations.append(
            {
                "field": "village",
                "rule": "admin_hierarchy",
                "severity": "LOW",
                "message": issue_text,
            }
        )
        issues.append(issue_text)


def _check_survey_khasra_identity(fields: dict, violations: list, issues: list) -> None:
    """
    survey_number and khasra_number being identical usually indicates an extraction
    overlap — the same token was matched by both field rules. Flag as MEDIUM.
    """
    sn = fields.get("survey_number")
    kn = fields.get("khasra_number")

    if sn and kn and sn.strip() == kn.strip():
        issue_text = (
            f"survey_number and khasra_number are identical ('{sn}'). "
            "This typically indicates an extraction overlap — verify source document."
        )
        violations.append(
            {
                "field": "survey_number",
                "rule": "field_overlap",
                "severity": "MEDIUM",
                "message": issue_text,
            }
        )
        issues.append(issue_text)


def _check_area_discrepancy(
    fields: dict,
    gis_area_acres: float,
    rules: dict,
    violations: list,
    issues: list,
) -> None:
    """
    Compare document-stated plot_area against GIS cadastral layer area (ST_Area).

    Δ% = |doc_acres - gis_acres| / gis_acres × 100

    ≤ threshold%  → informational note only (no violation added)
    > threshold%  → HIGH severity violation with human-readable explanation

    Rule: describe as "Potential inconsistency detected" — never claim fraud or AI detection.
    """
    from field_extractor import parse_area_to_acres  # local import avoids circular

    raw_area = fields.get("plot_area")
    if not raw_area:
        return

    doc_acres, _ = parse_area_to_acres(raw_area)
    if doc_acres is None or gis_area_acres <= 0:
        return

    threshold_pct = rules.get("area_discrepancy_threshold_pct", 5.0)
    delta_pct = round(abs(doc_acres - gis_area_acres) / gis_area_acres * 100, 2)

    if delta_pct <= threshold_pct:
        # No violation — just an informational entry in issues for auditability
        info_text = (
            f"Spatial consistency check: ✓ SPATIAL MATCH — "
            f"document area {doc_acres} acres vs GIS area {gis_area_acres} acres "
            f"(Δ = {delta_pct}%, within {threshold_pct}% threshold)."
        )
        issues.append(info_text)
    else:
        issue_text = (
            f"Potential inconsistency detected: document states {doc_acres} acres but "
            f"GIS cadastral layer records {gis_area_acres} acres "
            f"(Δ = {delta_pct}%, threshold = {threshold_pct}%). "
            "Human verification required — field survey or deed correction may be needed."
        )
        violations.append(
            {
                "field": "plot_area",
                "rule": "area_gis_discrepancy",
                "severity": "HIGH",
                "message": issue_text,
                "detail": {
                    "doc_acres": doc_acres,
                    "gis_acres": gis_area_acres,
                    "delta_pct": delta_pct,
                    "threshold_pct": threshold_pct,
                },
            }
        )
        issues.append(issue_text)
