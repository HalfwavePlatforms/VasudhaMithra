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
- `data/sample-documents/`: Curated synthetic document set (RTC, Mutation, Sale Deeds).
- `data/ground-truth/`: Matching ground truth JSON labels per image for objective accuracy evaluation.
- `data/edge-cases/`: 5 challenging test documents:
  1. `edge_01_rotated_18deg.png`: Severely skewed document (18°)
  2. `edge_02_low_contrast_faded.png`: Low contrast/faded ink
  3. `edge_03_deliberate_duplicate_survey.png`: Duplicate survey test
  4. `edge_04_handwritten_register_sample.png`: Historical handwritten register
  5. `edge_05_malformed_survey_format.png`: Malformed field test
- `data/layout-references/`: Specimen layout notes for MP Bhulekh, UP Bhulekh, and Karnataka Bhoomi.
- `data/external/iiit-indic-hw/`: Reference and download guide for the IIIT Indic Handwriting dataset.

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