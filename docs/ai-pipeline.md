# VasudhaMithra — Document AI & OCR Pipeline Specification (Member 1)

## 1. Executive Summary & Architecture
The **OCR Pipeline (`services/ocr-pipeline`)** is the ingestion gateway of VasudhaMithra. It handles scanned land records, photographed village ledgers, and multi-page PDFs, executing optical preprocessing, script identification, and text extraction before handing off structured tokens to Member 2 (Extraction Engine).

```
                        ┌───────────────────────────────┐
                        │   Input (Image/PDF Base64)    │
                        └───────────────┬───────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │    PDF/Image Multi-Decoder    │
                        │    (PyMuPDF / OpenCV / PIL)   │
                        └───────────────┬───────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │   Document Image Enhancement  │
                        │   • Bilateral Noise Removal   │
                        │   • Adaptive Gaussian Thresh  │
                        │   • MinAreaRect Deskew (±45°) │
                        └───────────────┬───────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │    Optical Character Engine   │
                        │  (Tesseract / Google Vision)  │
                        └───────────────┬───────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │   Classification & Routing    │
                        │  • Script & Language Detect   │
                        │  • Document Type Classifier   │
                        │  • Handwriting Detection Gate │
                        └───────────────┬───────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │ Normalized OCR JSON Response  │
                        └───────────────────────────────┘
```

---

## 2. Image & PDF Preprocessing Stack

1. **PDF Multi-format Ingestion**:
   - Uses **PyMuPDF (`fitz`)** to render high-resolution 200–300 DPI raster representations of incoming PDF deed documents directly into OpenCV numpy matrices.
2. **Bilateral Filtering**:
   - Smooths background grain without blurring crisp text edges (`cv2.bilateralFilter(gray, 9, 75, 75)`).
3. **Adaptive Illumination Thresholding**:
   - Compensates for shadows and uneven lighting common in photographed records using Gaussian-weighted local neighborhoods (`cv2.adaptiveThreshold`).
4. **Automated Deskewing**:
   - Detects text block bounding contours via `cv2.minAreaRect`, computes skew angle $\theta$, and applies affine rotation transformation matrix $M$ to correct orientation.

---

## 3. Multilingual & Script Support

| Language | Script | Tesseract Pack | Status |
|---|---|---|---|
| **English** | Latin | `eng` | Supported |
| **Hindi** | Devanagari | `hin` | Supported |
| **Kannada** | Kannada | `kan` | Supported |
| **Marathi** | Devanagari | `mar` | Supported |
| **Tamil** | Tamil | `tam` | Supported |
| **Telugu** | Telugu | `tel` | Supported |
| **Bengali** | Bengali | `ben` | Supported |

---

## 4. Document Type Classification
Identifies document categories based on header token proximity:
- **`Record of Rights / RTC (Pahani)`**: Form 16 / Khasra register
- **`Mutation Extract (Form XII)`**: Form 12 / Mutation register
- **`Khata Certificate`**: Khatauni / Holding certificate
- **`Sale / Title Deed`**: Registered conveyance deed

---

## 5. Handwriting OCR — Honest Scope & Explainable Routing

> **No Fake AI Principle**: High-volume, uncontrolled cursive Indic handwriting recognition is an open research problem. VasudhaMithra implements a **smart triage mechanism**:

1. **Optical Stroke Variance Analysis**:
   - The engine checks for handwriting markers and low-confidence cursive stroke distributions.
2. **Automated Fallback to Human Verification**:
   - If handwritten text is detected, the engine flags `is_handwritten: true` and routes the document to the **Revenue Officer Review Queue** with explainable evidence notes (e.g., *"High character stroke variance indicative of cursive handwriting"*).

---

## 6. Dataset Structure & Benchmarking

### Dataset Layout
- `data/sample-documents/`: 49+ multilingual synthetic documents covering all 7 supported languages (`en`, `hi`, `kn`, `mr`, `bn`, `ta`, `te`).
- `data/ground-truth/`: 59 matching ground-truth JSON label files per image for objective accuracy evaluation.
- `data/edge-cases/`: 5 challenging test documents:
  1. `edge_01_rotated_18deg.png`: Severely skewed document (18°)
  2. `edge_02_low_contrast_faded.png`: Low contrast/faded ink
  3. `edge_03_deliberate_duplicate_survey.png`: Duplicate survey test
  4. `edge_04_handwritten_register_sample.png`: Historical handwritten register
  5. `edge_05_malformed_survey_format.png`: Malformed field test
- `data/layout-references/`: Specimen layout notes for MP Bhulekh, UP Bhulekh, and Karnataka Bhoomi.
- `data/external/iiit-indic-hw/`: Reference guide for the IIIT Indic Handwriting dataset (`c3rl/IIIT-INDIC-HW-WORDS-Hindi`).

### Benchmark Results (data/evaluate_accuracy.py)
Following bicubic resolution upscaling ($1.5\times$) and `--psm 6` tabular segmentation mode:
- **Total Fields Evaluated**: 590 fields across 59 ground-truth documents
- **Overall Recognition Match**: **435/590 (73.7%)**
- **Average Optical Confidence**: **77.1%**
- **Key Field Accuracies**:
  - `plot_area`: **98.3%**
  - `khata_number`: **96.6%**
  - `khasra_number`: **94.9%**
  - `survey_number`: **89.8%**
  - `owner_name`: **83.1%**
  - `tehsil`: **72.9%**
  - `district`: **66.1%**
  - `land_classification`: **61.0%**
  - `village`: **59.3%**


---

## 7. PROPOSED API Contract Update (Awaiting Member 3 Approval)

### Proposed Output Schema for `POST /ocr/extract`
```json
{
  "document_id": "DOC-A1B2C3D4",
  "language": "hi",
  "document_type": "Record of Rights / RTC (Pahani)",
  "pages": 1,
  "raw_text": "GOVERNMENT OF KARNATAKA / MP ...",
  "confidence": 0.92,
  "bounding_boxes": [
    {
      "text": "Survey",
      "confidence": 0.96,
      "box": [10.0, 10.0, 100.0, 30.0]
    }
  ],
  "handwriting": {
    "is_handwritten": false,
    "routing": "automated_pipeline",
    "notes": "Printed typography detected"
  },
  "metadata": {
    "width": 920,
    "height": 720,
    "deskew_angle": 0.0,
    "is_pdf": false
  }
}
```
*Backward Compatibility Note: Existing fields `raw_text`, `confidence`, and `bounding_boxes` remain identical so downstream consumers are never broken.*

---

## 8. Legacy Tabular Registers (Disclosed Phase 2 Roadmap)

### 8.1 Architectural Context & Limitations of Keyword Proximity
Traditional Indian land revenue archives contain dense legacy Khasra/Khatauni registers organized in multi-column tabular grids (often featuring Hindi/regional script column headers such as `(1) खसरा नं`, `(2) खाता संख्या`, `(3) भूमि स्वामी / काश्तकार`, `(4) रकबा`, `(5) भूमि प्रकार`).

Standard information extraction engines rely on **keyword proximity heuristics** (e.g., locating an anchor label like `"Owner / खातेदार:"` and extracting the token immediately adjacent or below). On multi-row tabular registers, this paradigm breaks down:
1. **Vertical/Horizontal Decoupling**: Column headers reside at the top of the ledger, separated from entry rows by several centimeters or variable numbers of intervening data cells.
2. **Multi-Record Coexistence**: Multiple distinct parcels/owners exist in consecutive rows within a single image; linear proximity cannot associate which value belongs to which record.
3. **Broken Linear Text Flow**: Standard line-by-line OCR reading orders interleave text fragments across adjacent columns, destroying semantic key-value relationships.

Attempting keyword-proximity extraction on dense tabular registers inevitably leads to catastrophic hallucination or spurious extractions.

### 8.2 The Honest Smart Triage Mechanism
Rather than producing low-confidence or erroneous automated extractions, VasudhaMithra implements a **smart triage mechanism**:

```
[Incoming Document] 
       │
       ▼
[OCR & Preprocessing] ──▶ Bounding Box Tokens & Text
       │
       ▼
[Document Classifier] ──▶ Detects Grid Density & Column Headers
       │
       ├─────────────────────────────────────────────────┐
       ▼ (linear extract)                                ▼ (legacy tabular)
[Normal Extraction Engine]                   [Safe Triage Bypass]
 • field_rules.yaml Regex                     • Skip linear field parsing
 • Proximity Scoring                          • Set fields = None, confidences = None
 • GIS Cross-Verification                     • Preserve full raw OCR text
       │                                      • Flag status = "pending_review"
       │                                      • Rule: "legacy_tabular_format"
       │                                      • Route to Officer Review Queue
       ▼                                                 │
[Automated Validation]                                   ▼
                                            [Human-in-the-Loop Transcription]
```

1. **Detection**:
   - `is_tabular_layout()` checks for table-specific column markers (`स्तंभ`, `कॉलम`, `column`, `अनुक्रमांक`), numbered column headers (`(1) (2) (3)` or `स्तंभ १, स्तंभ २`), and geometric 2D bounding-box spatial clustering (identifying $\ge 3$ distinct rows with $\ge 3$ short tokens spanning horizontal clusters).
   - Classified as `legacy_tabular_register`.
2. **Safe Bypass & Routing**:
   - Skips linear `field_rules.yaml` extraction.
   - Sets standard schema fields to `None` and field confidences to `None` (preventing synthetic or hallucinated values).
   - Ingests and stores raw OCR text and bounding boxes for verbatim reference.
   - Directs record status to `"pending_review"` with risk level `MEDIUM` and explainable audit trail:
     `"Legacy tabular format detected — automated field extraction not yet supported, routed for manual transcription."`
   - Surfaces immediately in the Revenue Officer Review Queue for manual verification and transcription.

### 8.3 Phase 2 Roadmap: Full Table-Structure Recognition
To evolve from smart triage to end-to-end automated tabular extraction in Phase 2, the pipeline architecture is designed to integrate:
1. **Table Detection & Structure Recognition (TD/TSR)**:
   - Integration of **Table-Transformer (TATR)** or **PaddleOCR Table Recognition (PP-Structure)** to segment individual table cells, rows, and columns.
2. **Cell Coordinate Association**:
   - Intersecting OCR bounding-box polygons with detected cell boundary rectangles to reconstruct structured 2D dataframe matrices `(row_idx, col_idx)`.
3. **Multimodal Layout Models**:
   - Deployment of LayoutLMv3 or IndicLayoutLM fine-tuned on state revenue registers to classify column roles and multi-row ownership linkages.