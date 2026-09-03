# SIH 2026 Judge Demonstration Script & Workflow

## Step 1: Officer Ingestion (Upload Portal @ :3000)
- Select or drag-and-drop a legacy land record (e.g. `data/sample-documents/synthetic_record_000.png`).
- Click **Start Automated Digitization & Validation Pipeline**.
- The system executes Bilateral filtering -> Deskewing -> Multi-script OCR -> Regex & NLP extraction -> Spatial Cadastral Lookup in under 2 seconds.

## Step 2: Side-by-Side Verification Inspector
- Inspect the 3-column verification view:
  1. **OCR Stream**: Preprocessed raw text stream and optical confidence.
  2. **Schema & Confidence**: Individual field values with computed optical confidence badges.
  3. **Winning Feature Card**: Live Document Extent vs GIS Cadastral Parcel Area cross-validation.
- Observe the cadastral parcel boundary polygon.

## Step 3: Human-in-the-Loop Review Queue
- Navigate to **Revenue Review Backlog Queue**.
- Inspect flagged records (low confidence or spatial discrepancy).
- Perform an inline correction, enter officer remarks, and click **Approve & Certify** or **Flag for Re-survey**.

## Step 4: Executive Intelligence Dashboard (@ :3001)
- Switch to the live analytics portal at `http://localhost:3001`.
- View real-time KPI metrics: Total Digitized Records, Certified Rate, Spatial Discrepancies Flagged, District breakdowns, and the Tamper-evident Audit Ledger.