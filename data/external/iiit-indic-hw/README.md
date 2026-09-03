# IIIT Indic Handwritten Words Dataset (Reference & Benchmark)

## Overview
This folder is designated for Indic handwritten land-record research samples from the IIIT Hyderabad CVIT lab:
- **Dataset**: IIIT-INDIC-HW-WORDS-Hindi / Multi-script
- **Hugging Face Direct Access**: `c3rl/IIIT-INDIC-HW-WORDS-Hindi`
- **Citation**: CVIT, IIIT Hyderabad (https://cvit.iiit.ac.in/research/projects/cvit-projects/iiit-indic-hw-words)

## Download via Python
```python
from datasets import load_dataset
ds = load_dataset("c3rl/IIIT-INDIC-HW-WORDS-Hindi")
```

## Architectural Scope in VasudhaMithra
In accordance with the "No Fake AI" rule:
- Full Devanagari handwriting OCR is in Phase 2 roadmap.
- In the hackathon prototype, documents detected as handwritten (or with low character stroke confidence) are routed to the **Revenue Officer Human Verification Queue** with explainable evidence flags.