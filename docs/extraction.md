# Extraction Engine — Technical Reference

> **Owner:** Member 2 (Extraction, Validation & GIS)
> **Service port:** 8002
> **PS:** SIH 26018 — Land Record Digitization & Validation

---

## 1. Architecture Overview

```
OCR Pipeline (Member 1)
    │  raw_text + bounding_boxes
    ▼
POST /extraction/parse
    │
    ├── field_extractor.py
    │     ├── Load rules/field_rules.yaml
    │     ├── For each field: keyword proximity search → regex match
    │     └── Compute real confidence (OCR bbox avg OR position bias)
    │
    └── Returns: fields{}, structured_record{}, area_acres, confidence_per_field, needs_review

POST /extraction/validate
    │
    ├── validators.py
    │     ├── Phase 1: Per-field (required / format / confidence / duplicate)
    │     └── Phase 2: Cross-field consistency checks
    │           ├── Area sanity range
    │           ├── Admin hierarchy (village/tehsil/district)
    │           ├── survey_number ≡ khasra_number overlap
    │           └── GIS area discrepancy (if gis_area_acres provided)
    │
    └── Returns: valid, status, risk_level, confidence, issues[], violations[]
```

---

## 2. Fields

All 12 fields are defined in [`rules/field_rules.yaml`](../services/extraction-engine/rules/field_rules.yaml) and handled by the same rule engine — no hardcoded field-specific logic in Python.

### Required Fields (cause HIGH violation if missing)

| Field | Pattern | Description |
|-------|---------|-------------|
| `survey_number` | `\d+/\d+[A-Za-z]?` | Cadastral survey parcel ID |
| `khasra_number` | `\d+(/\d+)*` | Khasra / plot number (North India) |
| `khata_number` | `\d+` | Account/khata number in land register |
| `owner_name` | *free text* | Name of registered landowner |
| `plot_area` | area+unit pattern | Total plot/parcel area with unit |

### Optional Fields

| Field | Pattern | Description |
|-------|---------|-------------|
| `village` | *free text* | Village / Gram / Mauza |
| `tehsil` | *free text* | Tehsil / Taluka / Mandal |
| `district` | *free text* | District / Zila |
| `land_classification` | *free text* | Agricultural / Residential / etc. |
| `mutation_number` | `MR[-/]?\d+[/]\d+` or `\d{1,6}/\d{4}` | Mutation / Dakhil-Kharij reference |
| `registration_info` | `REG[-/]?\d+[/]\d{4}` or `\d{3,6}/\d{4}` | Deed registration number |
| `ownership_type` | *free text* | Individual / Joint / Government / etc. |

---

## 3. Multilingual Keyword Coverage

| Field | English | Hindi | Kannada | Tamil | Telugu |
|-------|---------|-------|---------|-------|--------|
| survey_number | ✓ | ✓ सर्वे नं | ✓ ಸರ್ವೆ ನಂ | ✓ சர்வே எண் | ✓ సర్వే నంబరు |
| khasra_number | ✓ | ✓ खसरा | ✓ ಖಸ್ರಾ | ✓ கஸ்ரா | ✓ ఖస్రా |
| khata_number | ✓ | ✓ खाता | ✓ ಖಾತಾ | ✓ காதா | ✓ ఖాతా |
| owner_name | ✓ | ✓ मालिक/खातेदार | ✓ ಖಾತೇದಾರ | ✓ நில உரிமையாளர் | ✓ భూ యజమాని |
| plot_area | ✓ | ✓ क्षेत्रफल | ✓ ವಿಸ್ತೀರ್ಣ | ✓ பரப்பளவு | ✓ విస్తీర్ణం |
| **village** | ✓ | ✓ **गाँव/ग्राम** *(new)* | ✓ ಗ್ರಾಮ | ✓ கிராமம் | ✓ గ్రామం |
| **tehsil** | ✓ | ✓ **तहसील** *(new)* | ✓ ತಾಲೂಕು | ✓ வட்டம் | ✓ తాలూకా |
| **district** | ✓ | ✓ **जिला/ज़िला** *(new)* | ✓ ಜಿಲ್ಲೆ | ✓ மாவட்டம் | ✓ జిల్లా |
| **land_classification** | ✓ | ✓ **भूमि वर्ग** *(new)* | ✓ ಭೂಮಿಯ ವರ್ಗೀಕರಣ | ✓ நில வகைப்பாடு | ✓ భూమి వర్గీకరణ |
| mutation_number | ✓ | ✓ नामांतरण/दाखिल-खारिज | ✓ ವರ್ಗಾವಣೆ | ✓ உரிமை மாற்றம் | ✓ మ్యుటేషన్ |
| registration_info | ✓ | ✓ पंजीकरण | ✓ ನೋಂದಣಿ | ✓ பதிவு எண் | ✓ నమోదు సంఖ్య |
| ownership_type | ✓ | ✓ स्वामित्व प्रकार | ✓ ಮಾಲಿಕತ್ವ ಪ್ರಕಾರ | ✓ உரிமை வகை | ✓ యాజమాన్యం రకం |

> Rows marked *(new)* were previously missing Hindi coverage and have been added.

---

## 4. plot_area Output Shape

`plot_area` in `structured_record` emits a typed numeric shape (not raw string):

```json
{
  "plot_area": {
    "value": 2.45,
    "unit": "acre",
    "raw": "2.45 acres",
    "confidence": 0.94
  }
}
```

- `value` — **float**, always in acres regardless of document unit
- `unit` — original unit label: `"acre"`, `"hectare"`, `"guntha"`, `"sq_ft"`, `"sq_m"`
- `raw` — original string from document (preserved for audit)
- `confidence` — real signal from OCR bbox or position bias

The flat `fields["plot_area"]` string is preserved unchanged for backward compatibility with the API Gateway.

### Unit Conversions

| Input unit | Multiplier (→ acres) |
|------------|---------------------|
| acre / acres / एकड़ | × 1.0 |
| hectare / हेक्टेयर | × 2.47105 |
| guntha / गुंठा | × 0.025 |
| sq.ft | × 0.0000229568 |
| sq.m | × 0.000247105 |

---

## 5. Confidence Scoring

Confidence scores **derive from real signals** — never hardcoded.

**Signal 1 (strongest):** When OCR bounding boxes are provided, the field confidence is the average of all bbox `confidence` values whose `text` appears in the matched field value.

**Signal 2 (position bias):** When no bbox matches, a position bonus is applied:
```
base = 0.72
position_bonus = 0.04 × (1 - match_position / doc_length)
confidence = base + position_bonus  # range [0.72, 0.76]
```
Fields appearing early in the document (header fields) receive a small boost.

---

## 6. Consistency Checks (Phase 2 of Validation)

These checks run after per-field format validation. They are explainable heuristics, not AI — results always say "Potential inconsistency detected", never "fraud detected".

### Area Sanity Range
- **Rule:** `0.001 ≤ plot_area_acres ≤ 5000.0`
- **Violation severity:** MEDIUM
- **Config:** `area_min_acres` / `area_max_acres` in `field_rules.yaml`

### Administrative Hierarchy
- **Rule:** If `village` is extracted but both `tehsil` and `district` are absent
- **Violation severity:** LOW
- **Explanation:** `"Village extracted but tehsil/district missing — administrative hierarchy incomplete"`

### Survey/Khasra Identity
- **Rule:** `survey_number == khasra_number` (exact string match)
- **Violation severity:** MEDIUM
- **Explanation:** Usually indicates keyword window overlap during extraction

### GIS Area Discrepancy *(WOW Feature)*
- **Trigger:** `gis_area_acres` provided in `POST /extraction/validate`
- **Formula:** `Δ% = |doc_acres - gis_acres| / gis_acres × 100`
- `Δ% ≤ 5.0%` → info-only issue: `"✓ SPATIAL MATCH (Δ = X%)"`
- `Δ% > 5.0%` → HIGH violation: `"Potential inconsistency detected: document states X acres, GIS cadastral layer records Y acres (Δ = Z%). Human verification required."`
- **Threshold config:** `area_discrepancy_threshold_pct` in `field_rules.yaml`

---

## 7. API Endpoints

### POST /extraction/parse

**Request** (from OCR pipeline):
```json
{
  "raw_text": "Survey No 145/2A Owner Ramesh Kumar ...",
  "bounding_boxes": [
    {"text": "145/2A", "confidence": 0.96, "box": [10, 20, 80, 35]}
  ]
}
```

**Response:**
```json
{
  "fields": {
    "survey_number": "145/2A",
    "owner_name": "Ramesh Kumar",
    "plot_area": "2.45 acres",
    "village": "Kothari",
    "registration_info": "4567/2024",
    "ownership_type": "Individual Freehold"
  },
  "structured_record": {
    "survey_number": {"value": "145/2A", "confidence": 0.96},
    "plot_area": {"value": 2.45, "unit": "acre", "raw": "2.45 acres", "confidence": 0.91}
  },
  "area_acres": 2.45,
  "confidence_per_field": {"survey_number": 0.96, "plot_area": 0.91},
  "needs_review": []
}
```

### POST /extraction/validate

**Request:**
```json
{
  "record_id": "uuid",
  "fields": {"survey_number": "145/2", "plot_area": "2.45 acres", ...},
  "confidence_per_field": {"survey_number": 0.96},
  "gis_area_acres": 2.47
}
```

**Response:**
```json
{
  "valid": true,
  "status": "VERIFIED",
  "risk_level": "LOW",
  "confidence": 0.94,
  "issues": [
    "Spatial consistency check: ✓ SPATIAL MATCH — document area 2.45 acres vs GIS area 2.47 acres (Δ = 0.81%, within 5.0% threshold)."
  ],
  "violations": []
}
```

---

## 8. Running Locally

```bash
cd services/extraction-engine
pip install -r requirements.txt    # no spaCy — lightweight install
cd src
uvicorn main:app --port 8002 --reload

# Run all tests
cd ..
pytest tests/ -v
```

No external dependencies needed — the service is fully self-contained.

---

## 9. Adding New Fields

Edit only `rules/field_rules.yaml` — no Python changes required:

```yaml
fields:
  my_new_field:
    pattern: '\d+[A-Z]'        # null for free text
    window_chars: 100           # optional, default 100
    keywords:
      - "english keyword"
      - "हिंदी कीवर्ड"
      - "ಕನ್ನಡ"
    required: false
```

The extractor, validator, and API all pick up new fields automatically.
