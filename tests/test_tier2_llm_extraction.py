"""
Automated Verification Suite for Tier-2 LLM Extraction Fallback.

Tests:
1. Rule-based pass-through: LLM is NOT called when rules succeed (>60% required fields, conf >= 0.5).
2. Trigger condition (a): classification_confidence < 0.5 triggers Tier-2 LLM.
3. Trigger condition (b): missing required fields > 40% triggers Tier-2 LLM.
4. Provenance tracking: AI fields tagged 'ai_assisted', rule fields tagged 'rule_based'.
5. Confidence score integrity: AI fields have confidence None (never fake percentages).
6. Pending review enforcement: has_ai_assisted triggers needs_review / pending_review.
7. Cost / budget safeguard: LLM_EXTRACTION_MAX_CALLS cutoff terminates calls and returns note.
8. Legacy tabular register handling: with LLM enabled vs disabled.
"""
import os
import sys
from pathlib import Path

# Add extraction-engine to sys.path
SRC_DIR = Path(__file__).resolve().parent.parent / "services" / "extraction-engine" / "src"
sys.path.insert(0, str(SRC_DIR))

import llm_extractor
from field_extractor import extract_fields


def test_rule_based_success_bypasses_llm():
    """Confidently classified doc with valid fields should NEVER invoke LLM."""
    os.environ["LLM_PROVIDER"] = "mock"
    llm_extractor.reset_llm_call_count()

    sample_text = """
    GOVERNMENT OF KARNATAKA - REVENUE DEPARTMENT
    RECORD OF RIGHTS (RTC)
    Survey Number: 145/2A
    Khasra No: 145
    Khata No: 882
    Owner / Khatedar: Ramesh Rao
    Plot Extent / Area: 3.50 Acres
    Village: Ramapura
    Taluk / Tehsil: Kanakapura
    District: Ramanagara
    """
    res = extract_fields(
        raw_text=sample_text,
        bounding_boxes=[],
        document_type="Record of Rights / RTC (Pahani)",
        classification_confidence=0.90,
    )

    assert llm_extractor.get_llm_call_count() == 0, f"LLM was called {llm_extractor.get_llm_call_count()} times, expected 0!"
    assert res["fields"]["survey_number"] == "145/2A"
    assert res["extraction_sources"]["survey_number"] == "rule_based"
    assert res["has_ai_assisted"] is False
    assert res["ai_fallback_triggered"] is False
    print("PASS: test_rule_based_success_bypasses_llm")


def test_trigger_on_unclassified_document():
    """Document with classification_confidence < 0.5 should trigger LLM fallback."""
    os.environ["LLM_PROVIDER"] = "mock"
    llm_extractor.reset_llm_call_count()

    raw_text = "Unusual format revenue deed 123/4B with 2.25 acres"
    mock_ai_data = {
        "survey_number": "123/4B",
        "plot_area": "2.25 acres",
        "owner_name": "Sita Devi",
    }

    res = extract_fields(
        raw_text=raw_text,
        bounding_boxes=[],
        document_type="Standard Land Record",
        classification_confidence=0.40,  # Below 0.5 threshold
        mock_llm_data=mock_ai_data,
    )

    assert llm_extractor.get_llm_call_count() == 1
    assert res["ai_fallback_triggered"] is True
    assert res["has_ai_assisted"] is True
    assert res["fields"]["survey_number"] == "123/4B"
    assert res["extraction_sources"]["survey_number"] == "ai_assisted"
    assert res["confidence_per_field"]["survey_number"] is None, "AI fields must have confidence None!"
    assert "survey_number" in res["needs_review"]
    print("PASS: test_trigger_on_unclassified_document")


def test_trigger_on_missing_required_fields():
    """Document where >40% required fields are null triggers LLM fallback."""
    os.environ["LLM_PROVIDER"] = "mock"
    llm_extractor.reset_llm_call_count()

    # Raw text only has survey number; khasra, khata, owner, area are missing (4 of 5 missing = 80% > 40%)
    raw_text = "Survey No: 99/1B only."
    mock_ai_data = {
        "owner_name": "Vikram Singh",
        "plot_area": "4.50 hectares",
        "khata_number": "512",
    }

    res = extract_fields(
        raw_text=raw_text,
        bounding_boxes=[],
        document_type="Record of Rights / RTC (Pahani)",
        classification_confidence=0.90,
        mock_llm_data=mock_ai_data,
    )

    assert llm_extractor.get_llm_call_count() == 1
    assert res["ai_fallback_triggered"] is True
    assert res["has_ai_assisted"] is True
    # Rule based found survey_number
    assert res["fields"]["survey_number"] == "99/1B"
    assert res["extraction_sources"]["survey_number"] == "rule_based"
    assert res["confidence_per_field"]["survey_number"] is not None
    # AI filled owner_name and khata_number
    assert res["fields"]["owner_name"] == "Vikram Singh"
    assert res["extraction_sources"]["owner_name"] == "ai_assisted"
    assert res["confidence_per_field"]["owner_name"] is None
    print("PASS: test_trigger_on_missing_required_fields")


def test_budget_cutoff_safeguard():
    """Budget cutoff safeguard must skip LLM and flag ai_extraction_budget_reached."""
    os.environ["LLM_PROVIDER"] = "mock"
    os.environ["LLM_EXTRACTION_MAX_CALLS"] = "2"
    llm_extractor.reset_llm_call_count()

    raw_text = "Partial text 100/2A"
    mock_ai = {"survey_number": "100/2A"}

    # Call 1
    extract_fields(raw_text, [], classification_confidence=0.3, mock_llm_data=mock_ai)
    assert llm_extractor.get_llm_call_count() == 1

    # Call 2 (hits budget limit of 2)
    extract_fields(raw_text, [], classification_confidence=0.3, mock_llm_data=mock_ai)
    assert llm_extractor.get_llm_call_count() == 2

    # Call 3: Budget exceeded!
    res3 = extract_fields(raw_text, [], classification_confidence=0.3, mock_llm_data=mock_ai)
    assert llm_extractor.get_llm_call_count() == 2, "Session counter must not exceed budget!"
    assert res3["ai_fallback_note"] == "ai_extraction_budget_reached"
    assert "ai_extraction_budget_reached" in res3["needs_review"]
    print("PASS: test_budget_cutoff_safeguard")


def test_legacy_tabular_register_behavior():
    """Verify legacy_tabular_register with LLM disabled vs enabled."""
    os.environ["LLM_PROVIDER"] = "none"
    llm_extractor.reset_llm_call_count()

    tabular_text = """
    स्तंभ १ | स्तंभ २ | स्तंभ ३ | स्तंभ ४
    खसरा | खाता | भूमि स्वामी | रकबा
    101/1 | 45 | रामेश्वर प्रसाद | 2.50 एकड़
    """

    # 1. With LLM disabled: honest fallback path
    res_disabled = extract_fields(tabular_text, [], document_type="legacy_tabular_register")
    assert res_disabled["has_ai_assisted"] is False
    assert res_disabled["fields"]["survey_number"] is None
    assert "all_fields_legacy_tabular_format" in res_disabled["needs_review"]
    assert "manual transcription" in res_disabled["triage_reason"]

    # 2. With LLM enabled: fills AI-assisted fields, tags ai_assisted, forces pending review
    os.environ["LLM_PROVIDER"] = "mock"
    os.environ["LLM_EXTRACTION_MAX_CALLS"] = "100"
    llm_extractor.reset_llm_call_count()

    mock_tabular_ai = {
        "survey_number": "101/1",
        "khata_number": "45",
        "owner_name": "रामेश्वर प्रसाद",
        "plot_area": "2.50 एकड़",
    }
    res_enabled = extract_fields(
        tabular_text,
        [],
        document_type="legacy_tabular_register",
        mock_llm_data=mock_tabular_ai,
    )
    assert res_enabled["has_ai_assisted"] is True
    assert res_enabled["ai_fallback_triggered"] is True
    assert res_enabled["fields"]["survey_number"] == "101/1"
    assert res_enabled["extraction_sources"]["survey_number"] == "ai_assisted"
    assert res_enabled["confidence_per_field"]["survey_number"] is None
    assert len(res_enabled["needs_review"]) > 0
    print("PASS: test_legacy_tabular_register_behavior")


if __name__ == "__main__":
    test_rule_based_success_bypasses_llm()
    test_trigger_on_unclassified_document()
    test_trigger_on_missing_required_fields()
    test_budget_cutoff_safeguard()
    test_legacy_tabular_register_behavior()
    print("\nALL 5 AUTOMATED TIER-2 EXTRACTION TESTS PASSED SUCCESSFULLY!")
