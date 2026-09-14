# 🌾 VasudhaMithra (वसुधामित्र)
### Intelligent Multilingual Land Record Digitization, Fraud Prevention & Spatial Cadastral Platform
**Smart India Hackathon (SIH) — Problem Statement ID: SIH26018**  
*Aligned with the Digital India Land Records Modernization Programme (DILRMP), Department of Land Resources (DoLR), Ministry of Rural Development, Govt. of India.*

---

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB.svg?logo=python&logoColor=white)](https://python.org)
[![React](https://img.shields.io/badge/React-19.2-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8.2-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.3-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![PostGIS](https://img.shields.io/badge/PostGIS-3.4-336791.svg?logo=postgis&logoColor=white)](https://postgis.net)
[![OpenCV](https://img.shields.io/badge/OpenCV-4.10-5C3EE8.svg?logo=opencv&logoColor=white)](https://opencv.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📌 Table of Contents
- [Executive Overview](#-executive-overview)
- [Key Capabilities & Innovations](#-key-capabilities--innovations)
- [System Architecture & Data Flow](#-system-architecture--data-flow)
- [Technical Stack](#-technical-stack)
- [Repository Structure](#-repository-structure)
- [Quick Start Guide](#-quick-start-guide)
  - [Prerequisites](#prerequisites)
  - [Option A: One-Command Docker Setup](#option-a-one-command-docker-setup-recommended)
  - [Option B: Local Development Setup](#option-b-local-development-setup)
- [Environment Configuration](#-environment-configuration)
- [API Reference & Contracts](#-api-reference--contracts)
- [Security, Auditability & Governance](#-security-auditability--governance)
- [Multilingual & Indic Script Support](#-multilingual--indic-script-support)
- [Cadastral GIS & Bhuvan Integration](#-cadastral-gis--bhuvan-integration)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Honest Scope: Real vs. Roadmap](#-honest-scope-real-vs-roadmap)
- [Team & Acknowledgments](#-team--acknowledgments)

---

## 📖 Executive Overview

Across India, millions of legacy land records (such as **Record of Rights (RoR)**, **Pahani / RTC**, **7/12 Extracts**, **Khatauni**, **Form XII Mutation Registers**, and registered **Sale Deeds**) reside in paper formats within village and taluk revenue offices. These records suffer from ink fading, physical decay, geometric skewing, regional linguistic barriers, and vulnerability to fraudulent tampering.

**VasudhaMithra (वसुधामित्र)** solves this national challenge by delivering an end-to-end, AI-powered digitization, validation, and spatial governance ecosystem:
1. **Multi-Modal Document AI**: Restores damaged scans, corrects skew ($\pm 45^\circ$), and extracts multilingual Indic text across **7 regional languages** (Hindi, Kannada, Marathi, Tamil, Telugu, Bengali, English).
2. **Hybrid Extraction & Zero-Hallucination Parsing**: Combines deterministic regular expression engines with LLM inference to extract survey numbers, owner details, land types, and areas with granular confidence scoring.
3. **Automated Cross-Validation & Anomaly Detection**: Cross-references mathematical parcel areas against cadastral boundary geometries and detects duplicate registrations and court stays.
4. **Cadastral GIS & ISRO Bhuvan Mapping**: Visualizes land parcels via PostGIS and Leaflet, overlaying official ISRO Bhuvan satellite and topographic layers.
5. **Biometric Face Check & 2FA**: Secures revenue officer operations via OpenCV facial detection and OTP phone authentication.
6. **Cryptographic SHA-256 Hash Chaining**: Creates an immutable, tamper-evident audit trail for every field alteration, review action, and state synchronization.
7. **Legally Certified Digital RoR Generation**: Generates official PDF certificates complete with cadastral boundary sketches, watermarks, regional Indic typography, and verifiable QR codes.
8. **Citizen Voice Assistant (VoiceBot)**: Enables non-literate and rural citizens to query land record status, ownership, and dispute flags in their mother tongue via voice.

---

## 🚀 Key Capabilities & Innovations

### 1. Document AI & Optical Preprocessing Pipeline
- **High-DPI Ingestion**: Renders multi-page PDF deeds and high-resolution TIFF/PNG/JPEG files at 300 DPI directly into OpenCV memory arrays via **PyMuPDF (`fitz`)**.
- **Bilateral Noise Reduction**: Strips background paper yellowing and scan grain while preserving crisp ink stroke boundaries (`cv2.bilateralFilter`).
- **Adaptive Gaussian Thresholding**: Compensates for non-uniform lighting and shadows typical in mobile camera snapshots.
- **Automated Contour Deskewing**: Calculates rotation angle $\theta$ from text bounding boxes via `cv2.minAreaRect` and applies affine correction matrices.
- **Handwriting Triage**: Calculates optical stroke variance. Flagged cursive handwriting is automatically routed to human revenue officers with explainable diagnostics rather than hallucinating text.

### 2. Zero-Hallucination Structured Extraction
- Extracts critical land metadata:
  - **Survey Number & Sub-division** (e.g., `142/3A`, `84/1B`)
  - **Khata / Patta / Khasra Number**
  - **Owner / Khatedar / Pattadar Name**
  - **Land Classification** (Dry/Jirayat, Wet/Bagayat, Garden, Inam, Government/Sarkari)
  - **Area Conversions** (Acres, Guntas, Cents, Bighas, Hectares, Sq. Meters)
  - **Boundary Neighbors** (North, South, East, West parcels)
- Employs deterministic regex tokenizers alongside LLM fallback (Claude / OpenAI / Gemini / local Ollama) with strict JSON output schemas.

### 3. Cadastral GIS & ISRO Bhuvan Spatial Integration
- Seamlessly maps geo-referenced parcel boundary polygons stored in **PostgreSQL + PostGIS**.
- Overlays cadastral boundaries directly over **ISRO Bhuvan WMS** satellite imagery and OpenStreetMap basemaps.
- Computes mathematical polygon area and compares it against textual deed areas, immediately flagging spatial discrepancies.

### 4. Biometric Face Verification & Two-Factor Authentication
- Implements two-factor revenue officer authentication: SMS / Aadhaar OTP verification via telephone gateways.
- Integrated **OpenCV Haar Cascade** facial detection algorithm (`haarcascade_frontalface_default.xml`) to verify officer presence during sign-in and document certification workflows.

### 5. Revenue Officer Verification Desk
- Side-by-side interactive document inspector with synchronized pan/zoom.
- Color-coded visual bounding boxes linked to each extracted field.
- Confidence indicators: High ($\ge 0.85$), Medium ($0.60 - 0.84$), Low ($< 0.60$).
- Field-level editing with instant re-validation and approval/rejection audit triggers.

### 6. Tamper-Evident SHA-256 Audit Trail
- Every document state change (Ingestion $\to$ OCR $\to$ Extraction $\to$ Review $\to$ Validation $\to$ Sync) is linked to a forward-chained cryptographic SHA-256 hash.
- Logs the actor, IP address, timestamp, previous block hash, and modification diff, preventing clandestine database tampering.

### 7. Certified Digital Land Certificate Generator
- Automated generation of government-standard legal digital land certificates using **ReportLab** and **Matplotlib**.
- Features:
  - Dynamic cadastral boundary sketch with cardinal directional markers.
  - Authentic government emblem and diagonal security watermark.
  - Regional typography utilizing Google Noto Sans Indic font families (`Devanagari`, `Kannada`, `Tamil`, `Telugu`, `Bengali`).
  - Cryptographic QR code encoding citizen verification URL and SHA-256 certificate digest.

### 8. Citizen Multilingual Voice Assistant (VoiceBot)
- Web Speech API integration providing speech-to-text (STT) and native text-to-speech (TTS).
- Normalizes Indic numerals (Devanagari `०-९`, Kannada `೦-೯`, Telugu `౦-౯`, Tamil `௦-௯`, Bengali `০-৯`) to standard digits.
- Queries real database records and returns plain-language spoken summaries in the citizen's native language regarding ownership, survey status, and dispute flags.

### 9. DILRMP & National LRMS Integration Adapter
- Production-ready adapter contract conforming to Digital India Land Records Modernization Programme standards.
- Enforces strict business pre-conditions: only validated records can be synced, generating official external references (`DILRMP-XXXXXXXX`).

### 10. Responsive, Mobile-First Design
- Optimized for desktop workstations, laptops, tablets, and smartphones.
- Mobile off-canvas drawer navigation, responsive 6-digit OTP inputs, touch-friendly dropzones, and adaptive document preview panes.

---

## 🏗 System Architecture & Data Flow

```mermaid
flowchart TD
    subgraph ClientLayer ["Client Application Layer (React 19 + Vite + Tailwind v4)"]
        UP["Upload Portal & Officer Workspace\n(Port 3000)"]
        VP["Citizen Voice Assistant & Public Verify\n(Port 3000)"]
        DB["Real-Time Analytics Dashboard\n(Port 3001)"]
    end

    subgraph GatewayLayer ["API Gateway (FastAPI - Port 8000)"]
        GW["API Gateway Orchestrator"]
        AUTH["Auth & Biometric Face Service\n(OpenCV + SMS Gateway)"]
        AUDIT["SHA-256 Hash-Chain Audit Engine"]
        CERT["ReportLab Digital Certificate Engine"]
        VOICE["Multilingual Voice Query Router"]
    end

    subgraph ServiceMesh ["Microservices / Embedded Engine Layer"]
        OCR["OCR Pipeline (Port 8001)\n(Tesseract / Google Vision / OpenCV)"]
        EXT["Extraction Engine (Port 8002)\n(Regex Rules + LLM Fallback)"]
        GIS["GIS Spatial Service (Port 8003)\n(PostGIS + Cadastral Engine)"]
    end

    subgraph StorageLayer ["Data & Storage Layer"]
        PG[("PostgreSQL 16 + PostGIS 3.4\n(Port 5432)")]
        FS[("Document & Certificate Storage\n(Encrypted Local / S3)")]
    end

    subgraph ExternalServices ["External & Government Integrations"]
        BHUVAN["ISRO Bhuvan WMS Gateway"]
        DILRMP["DILRMP / State LRMS Adapter\n(Bhoomi / Dharani / MahaBhulekh)"]
    end

    UP -->|REST / Multipart| GW
    VP -->|Audio STT / REST| GW
    DB -->|Polling / WebSocket| GW

    GW --> AUTH
    GW --> AUDIT
    GW --> CERT
    GW --> VOICE

    GW -->|HTTP / Internal| OCR
    GW -->|HTTP / Internal| EXT
    GW -->|HTTP / Internal| GIS

    GW -->|SQL / GeoAlchemy| PG
    GIS -->|Spatial SQL| PG
    GW -->|Read/Write| FS

    GIS -.->|WMS Tile Sync| BHUVAN
    GW -.->|Adapter Sync| DILRMP
```

---

## 💻 Technical Stack

| Domain | Technology / Library | Version | Purpose |
|:---|:---|:---|:---|
| **Frontend Framework** | React + TypeScript / JSX | 19.2.x | Responsive web portal and officer review workstation |
| **Build & Tooling** | Vite | 8.2.x | High-speed frontend bundling and HMR |
| **Styling & Icons** | Tailwind CSS + Lucide React | 4.3.x / 1.40.x | Modern governmental theme, mobile responsiveness |
| **Mapping & GIS** | Leaflet + OpenLayers | 1.9.x / 10.10.x | Interactive cadastral parcel visualization & spatial boundaries |
| **Backend Framework** | FastAPI (Python) | 0.115.x | High-throughput async REST API gateway and microservices |
| **Application Server** | Uvicorn (Standard) | 0.30.x | ASGI production server |
| **Database & Spatial** | PostgreSQL + PostGIS | 16 / 3.4 | Relational records, spatial polygons, and indexes |
| **ORM & Migrations** | SQLAlchemy + Alembic + GeoAlchemy2 | 2.0.x / 1.13.x | Database modeling, spatial schemas, schema migrations |
| **Computer Vision** | OpenCV (`opencv-python-headless`) | 4.10.x | Noise filtering, deskewing, Haar Cascade face detection |
| **OCR Engines** | Tesseract OCR + Google Cloud Vision | 5.x / 3.7.x | Optical character recognition across 7 Indic scripts |
| **PDF Processing** | PyMuPDF (`fitz`) + PyPDF | 1.24.x / 3.x | High-resolution 300 DPI rasterization and parsing |
| **Certificate Engine** | ReportLab + Matplotlib | 4.0.x / 3.8.x | Vector PDF certificate synthesis, parcel sketches, Indic fonts |
| **Biometrics & OTP** | OpenCV Haar Cascade + Sinch/Twilio | — | Live facial framing and SMS OTP two-factor verification |
| **Containerization** | Docker + Docker Compose | 24+ | Production microservice container orchestration |

---

## 📁 Repository Structure

```tree
land-record-digitizer/
├── docker-compose.yml             # Full microservice orchestration (Postgres, OCR, Extractor, GIS, Gateway, UI)
├── docker-compose.prod.yml        # Production Docker configuration
├── .env.example                   # Master environment variable template
├── README.md                      # Project documentation and specifications
│
├── frontend/
│   ├── upload-portal/             # Main portal (Officer Workspace, Citizen VoiceBot, Verification Desk)
│   │   ├── src/
│   │   │   ├── components/        # UI Views (CommandCentre, VerificationDesk, GisParcels, LoginPage, etc.)
│   │   │   ├── App.jsx            # Application shell with responsive navigation drawer
│   │   │   └── main.jsx           # React DOM bootstrap
│   │   ├── package.json           # Frontend dependencies (React 19, Tailwind v4, Leaflet)
│   │   └── vite.config.js         # Vite configuration
│   └── dashboard/                 # Real-time state digitization KPI analytics dashboard
│
├── services/
│   ├── api-gateway/               # Primary API Gateway & Orchestration Service (Port 8000)
│   │   ├── src/
│   │   │   ├── routes/            # REST endpoints: auth, records, dashboard, public_verify, voice_query
│   │   │   ├── services/          # Certificate generator, LRMS adapter, SMS service
│   │   │   ├── models/            # SQLAlchemy database models (Record, Field, AuditLog, etc.)
│   │   │   ├── embedded_ocr/      # Embedded OCR fallback engine for single-instance mode
│   │   │   ├── embedded_extraction/# Embedded NLP extraction engine
│   │   │   ├── embedded_gis/      # Embedded spatial cadastral engine
│   │   │   └── main.py            # FastAPI gateway application entrypoint
│   │   ├── requirements.txt       # Python dependencies
│   │   └── Dockerfile             # Gateway container specification
│   │
│   ├── ocr-pipeline/              # Standalone OCR & Computer Vision Microservice (Port 8001)
│   │   ├── src/
│   │   │   ├── ocr_engine.py      # Tesseract & Google Vision pipeline
│   │   │   ├── preprocess.py      # Bilateral filtering, Gaussian threshold, deskewing
│   │   │   └── main.py            # FastAPI service entrypoint
│   │   └── requirements.txt
│   │
│   ├── extraction-engine/         # Information Extraction & Validation Microservice (Port 8002)
│   │   ├── src/
│   │   │   ├── field_extractor.py # Regex rule engine for survey numbers, areas, owners
│   │   │   ├── llm_extractor.py   # LLM fallback integration (OpenAI / Claude / Gemini)
│   │   │   ├── validators.py      # Area consistency and syntax validation rules
│   │   │   └── main.py
│   │   └── requirements.txt
│   │
│   └── gis-service/               # Cadastral GIS & Spatial Analysis Microservice (Port 8003)
│       ├── src/
│       │   ├── main.py            # GeoJSON parcel endpoints and Bhuvan layer adapters
│       │   └── db/                # Spatial database connectors
│       └── requirements.txt
│
├── data/
│   ├── sample-documents/          # 96 multi-language evaluation land records
│   ├── ground-truth/              # 88 ground-truth JSON annotations for benchmarking
│   └── edge-cases/                # Skewed, degraded, and low-contrast test documents
│
├── docs/                          # Comprehensive technical design specifications
│   ├── ai-pipeline.md             # Document AI, optical preprocessing, and OCR details
│   ├── api-contracts.md           # Single source of truth for REST contracts
│   ├── db-schema.md               # PostgreSQL/PostGIS database schema definitions
│   ├── lrms-dilrmp-integration.md # DILRMP & state LRMS national adapter specification
│   └── deployment.md              # Cloud and bare-metal deployment guide
│
└── infra/                         # Nginx proxies, health checks, and CI configuration
```

---

## ⚡ Quick Start Guide

### Prerequisites
- **Docker & Docker Compose** (Recommended) or:
  - **Python**: `3.11` or higher
  - **Node.js**: `20.x` or higher
  - **PostgreSQL**: `16` with **PostGIS 3.4**
  - **Tesseract OCR**: `5.x` with Indic language packs (`eng`, `hin`, `kan`, `mar`, `tam`, `tel`, `ben`)

---

### Option A: One-Command Docker Setup (Recommended)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/HalfwavePlatforms/VasudhaMithra.git
   cd VasudhaMithra
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env to add your API keys (optional for local mock mode)
   ```

3. **Launch the entire microservice mesh**:
   ```bash
   docker-compose up --build
   ```

4. **Access the platform**:
   - 🌐 **Upload Portal & Review Desk**: [http://localhost:3000](http://localhost:3000)
   - 📊 **Analytics Dashboard**: [http://localhost:3001](http://localhost:3001)
   - 📚 **Interactive Swagger API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - 🗺 **Cadastral GIS Service**: [http://localhost:8003/docs](http://localhost:8003/docs)

---

### Option B: Local Development Setup

#### 1. Backend Gateway & Services
```bash
# Navigate to the API Gateway
cd services/api-gateway

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start API Gateway (runs embedded OCR, Extraction, and GIS in standalone mode)
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Frontend Upload Portal
```bash
# In a separate terminal, navigate to the frontend directory
cd frontend/upload-portal

# Install Node dependencies
npm install

# Start development server
npm run dev
```

---

## ⚙ Environment Configuration

Create a `.env` file in the root directory. Key configuration parameters include:

| Variable | Description | Default Value |
|:---|:---|:---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/land_records` |
| `OCR_SERVICE_URL` | URL of OCR microservice | `http://localhost:8001` |
| `EXTRACTION_SERVICE_URL`| URL of extraction microservice | `http://localhost:8002` |
| `GIS_SERVICE_URL` | URL of GIS microservice | `http://localhost:8003` |
| `STORAGE_DIR` | Local directory for document uploads and cache | `./storage` |
| `OPENAI_API_KEY` | (Optional) OpenAI API key for LLM extraction | `sk-...` |
| `ANTHROPIC_API_KEY` | (Optional) Anthropic Claude API key | `sk-ant-...` |
| `GOOGLE_APPLICATION_CREDENTIALS` | (Optional) Path to Google Vision service account | `./service-account.json` |
| `SINCH_SERVICE_PLAN_ID`| (Optional) Sinch SMS gateway service plan ID | — |
| `SINCH_API_TOKEN` | (Optional) Sinch SMS gateway bearer token | — |
| `SINCH_SMS_FROM` | (Optional) Registered Sinch SMS sender number | — |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins | `http://localhost:3000,http://localhost:3001` |

---

## 📡 API Reference & Contracts

All endpoints return standard JSON responses and comprehensive HTTP status codes. Full OpenAPI/Swagger documentation is available at `http://localhost:8000/docs`.

### Authentication & Biometrics
- `POST /auth/login/request-otp` — Request 6-digit SMS OTP for citizen or officer phone number.
- `POST /auth/login/verify-otp` — Validate OTP, returning an 8-hour authenticated session token.
- `POST /auth/webcam-face-check` — Process webcam snapshot with OpenCV, detect facial bounding box, and update officer avatar.

### Land Records & Processing
- `POST /records/upload` — Upload land record document (PDF/PNG/JPG) to trigger asynchronous ingestion, optical preprocessing, and extraction.
- `GET /records` — Paginated list of digitized records with state filters (`processing`, `pending_review`, `validated`, `rejected`).
- `GET /records/{id}` — Retrieve full details, extracted fields, confidence scores, and audit history.
- `PATCH /records/{id}` — Human-in-the-loop review: update extracted fields and trigger automated re-validation.
- `POST /records/{id}/approve` — Revenue officer digital sign-off and status transition to `validated`.
- `POST /records/{id}/reject` — Reject record with rejection reason and audit logging.

### Cadastral GIS & Certificates
- `GET /records/{id}/certificate` — Generate and download official tamper-proof PDF land certificate with cadastral boundary map and QR code.
- `GET /gis/parcel/{survey_number}` — Retrieve GeoJSON cadastral parcel boundaries, area geometry, and neighbor parcels.
- `POST /records/{id}/sync-lrms` — Synchronize validated land record with national DILRMP / state LRMS registry.

### Public Citizen Services
- `POST /public/voice-query` — Citizen voice assistant query parser and localized audio response generator.
- `GET /public/verify/{qr_token}` — Public verification portal to validate authenticity of printed certificates via QR code scan.

---

## 🛡 Security, Auditability & Governance

1. **Role-Based Access Control (RBAC)**:
   - **Citizen**: Read-only public verification, voice queries, status checks.
   - **Surveyor / Operator**: Document ingestion, scan uploads, initial metadata entry.
   - **Revenue Officer / Tehsildar**: Biometric face verification, field correction, rejection/approval authority, LRMS synchronization.
   - **Administrator**: System audit ledger inspection, user provisioning, model re-training triggers.

2. **Cryptographic SHA-256 Hash Chaining**:
   ```
   Block N = SHA-256(Block N-1 Hash + Timestamp + Actor ID + Action + Field Diffs)
   ```
   Guarantees that no administrative user or database operator can silently modify land titles or ownership records without breaking the cryptographic chain.

3. **Privacy by Design**:
   Public citizen queries and voice responses omit sensitive personal identifiers (Aadhaar numbers, exact phone numbers) and return only public revenue registry facts.

---

## 🌐 Multilingual & Indic Script Support

VasudhaMithra includes native support for 7 major Indian languages and scripts:

| Language | Script | Tesseract ISO | Regional Font Family | Supported Documents |
|:---|:---|:---|:---|:---|
| **English** | Latin | `eng` | Roboto / Inter | Registered Deeds, Survey Maps, All States |
| **Hindi (हिन्दी)** | Devanagari | `hin` | Noto Sans Devanagari | Khasra, Khatauni (UP, MP, Bihar, Rajasthan) |
| **Kannada (ಕನ್ನಡ)** | Kannada | `kan` | Noto Sans Kannada | Bhoomi RTC, Pahani, Form 16 (Karnataka) |
| **Marathi (मराठी)** | Devanagari | `mar` | Noto Sans Devanagari | 7/12 Extract, Ferfar (Maharashtra) |
| **Tamil (தமிழ்)** | Tamil | `tam` | Noto Sans Tamil | Patta, Chitta, Adangal (Tamil Nadu) |
| **Telugu (తెలుగు)** | Telugu | `tel` | Noto Sans Telugu | Dharani Passbook, Adangal (AP, Telangana) |
| **Bengali (বাংলা)** | Bengali | `ben` | Noto Sans Bengali | Banglarbhumi Khatian, Porcha (West Bengal) |

---

## 🗺 Cadastral GIS & Bhuvan Integration

VasudhaMithra combines alphanumeric land record databases with spatial geographic data:
- **Spatial Geometry**: Parcels are stored in PostGIS as multi-polygons in EPSG:4326 (WGS 84) coordinate reference systems.
- **ISRO Bhuvan WMS Layer**: Visualizes satellite high-resolution imagery and thematic maps provided by the Indian Space Research Organisation.
- **Boundary Validation**: Automatically verifies that textual cardinal neighbors (North, South, East, West) match actual adjacent spatial polygon geometries.

---

## 🧪 Testing & Quality Assurance

### Run Backend Unit & Integration Tests
```bash
cd services/api-gateway
pytest tests/ -v
```

### Run Frontend Production Build & TypeScript Verification
```bash
cd frontend/upload-portal
npm run build
```

### Benchmark OCR Accuracy Against Ground-Truth Dataset
```bash
python data/benchmark_ocr.py --dataset data/sample-documents --ground-truth data/ground-truth
```

---

## ⚖ Honest Scope: Real vs. Roadmap

To uphold engineering integrity, VasudhaMithra explicitly distinguishes operational code from simulated integration layers:

| Dimension | Live Implementation (Real) | Enterprise Production Scope (Roadmap) |
|:---|:---|:---|
| **Printed Indic OCR** | **Real**: Preprocessing, bilateral filtering, deskewing, and Tesseract/Vision OCR across 7 languages. | Scaled GPU cluster deployment with custom fine-tuned TrOCR models. |
| **Handwriting Handling** | **Real**: Optical stroke variance triage routing cursive handwriting to human review. | Active research models for uncontrolled cursive Indic handwriting. |
| **Information Extraction** | **Real**: Deterministic regex rule engines + zero-hallucination LLM fallback. | Integration with state-specific historical deed vernacular ontologies. |
| **GIS Mapping** | **Real**: PostGIS spatial database, Leaflet parcel visualization, Bhuvan WMS overlay. | Real-time synchronization with state GeoServer instances. |
| **DILRMP / LRMS Sync** | **Real**: Full API adapter contract, payload schemas, and SHA-256 audit logging. | Direct NICNET VPN connectivity requiring state bilateral DSAs. |

---

## 👥 Team & Acknowledgments

- **Team**: VasudhaMithra Core Team
- **Event**: Smart India Hackathon (SIH)
- **Problem Statement**: SIH26018 — *Intelligent Land Record Digitization and Validation System*
- **Sponsoring Body**: Department of Land Resources (DoLR), Ministry of Rural Development, Government of India.
- **Data & Mapping Partners**: ISRO Bhuvan Geo-Platform, National Informatics Centre (NIC).

---

<div align="center">
  <sub>Built with ❤️ for Digital India and transparent, fraud-free land governance.</sub>
</div>
