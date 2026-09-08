# VasudhaMithra — LRMS & DILRMP Integration Specification

## 1. Problem Statement & Government Context
**Problem Statement SIH26018 (Expected Solution Point 15)**:
> *"Integration with existing LRMS (Land Records Management Systems), DILRMP (Digital India Land Records Modernization Programme) databases, GIS platforms, and cadastral maps."*

This document defines the **LRMS & DILRMP Integration Architecture** of VasudhaMithra, explicitly demarcating what is **operational contract code** versus what is **honestly mocked** during evaluation.

---

## 2. Honest Statement of Scope: Real vs. Mocked

| Dimension | Live Hackathon Implementation (Real) | Upstream Production Scope (Mocked / Future) |
| :--- | :--- | :--- |
| **API Contract & Adapter Layer** | **Real**: `services/api-gateway/src/services/lrms_integration.py` defines the concrete `LRMSAdapter` interface (`push_verified_record`, `check_sync_status`). | Replaced with live HTTP/SOAP client communicating with NIC state gateways. |
| **Tamper-Evident Audit Trail** | **Real**: Every sync transaction computes a SHA-256 hash linked to the record's prior audit chain event, recording actor, timestamp, external ref, and details. | Unchanged — tamper-evident chain records the government sync event verbatim. |
| **Access Control & Gating** | **Real**: Sync requests are rejected (`HTTP 400`) unless the land record has attained verified/validated status. | Unchanged — only human- or policy-approved records can be pushed to government databases. |
| **Payload Schematization** | **Real**: Standard DILRMP National Data Standard payload generation mapping survey number, khata, khasra, owner, area, and village. | Mapped to state-specific XML/JSON formats (e.g., Bhoomi RTC XML vs Dharani API). |
| **Network & Database Connectivity** | **Mocked in-memory store**: Simulated external registry responding with unique reference tokens (`DILRMP-XXXXXXXX`). | Requires NICNET VPN, mTLS certificates, state department MoUs, and IP whitelisting. |

> [!IMPORTANT]
> **Why is live government database connectivity mocked?**  
> Indian state land registries (Bhoomi, MahaBhulekh, Dharani, Banglarbhumi) and the central DILRMP portal are classified as Critical Information Infrastructure (CII) by CERT-In and the Department of Land Resources (DoLR), Ministry of Rural Development. Real-time write access is restricted by law to designated revenue officers behind NICNET VPN tunnels and requires formal bilateral Data Sharing Agreements (DSAs).  
> **VasudhaMithra implements the full integration contract, verification gate, and audit logging** so that swapping in production endpoints requires altering only the network transport layer in `lrms_integration.py`.

---

## 3. Architecture & Integration Workflow

```
┌────────────────────────┐         ┌────────────────────────┐         ┌─────────────────────────┐
│   VasudhaMithra API    │         │      LRMS Adapter      │         │     DILRMP / LRMS       │
│  (services/api-gateway)│         │   (lrms_integration)   │         │     State Gateway       │
└───────────┬────────────┘         └───────────┬────────────┘         └────────────┬────────────┘
            │                                  │                                   │
            │ 1. POST /records/{id}/sync-lrms  │                                   │
            ├─────────────────────────────────>│                                   │
            │                                  │                                   │
            │ 2. Check record status           │                                   │
            │    [Must be verified/validated]  │                                   │
            │                                  │                                   │
            │ 3. Format DILRMP JSON payload    │                                   │
            │    (survey, owner, area, village)│                                   │
            │                                  │ 4. HTTP POST /records/push        │
            │                                  │    [mTLS / API Key via NICNET]    │
            │                                  ├──────────────────────────────────>│
            │                                  │                                   │
            │                                  │ 5. Return Receipt                 │
            │                                  │    {status: synced, ref: DILRMP-*}│
            │                                  │<──────────────────────────────────┤
            │ 6. Commit AuditLog Hash-Chain    │                                   │
            │    action: "lrms_sync"           │                                   │
            │    curr_hash = SHA256(prev_hash) │                                   │
            │                                  │                                   │
            │ 7. Return 200 OK + external_ref  │                                   │
            │<─────────────────────────────────┤                                   │
```

---

## 4. REST API Endpoints

### 4.1 Synchronize Verified Record to LRMS
- **Endpoint**: `POST /records/{record_id}/sync-lrms`
- **Headers**:
  - `Authorization: Bearer <token>`
  - `X-Role: tahsildar` (or `officer` / `admin`)
  - `X-Actor: Tahsildar Ramanagara`
- **Pre-Conditions**:
  - Record must exist in database.
  - Record `status` must be `"validated"` or `"verified"`. If record is still in `"pending_review"`, `"processing"`, or `"rejected"`, the endpoint aborts with:
    ```json
    {
      "detail": "Only verified records can be synced to LRMS/DILRMP (current status: 'pending_review')"
    }
    ```
- **Response (`200 OK`)**:
  ```json
  {
    "status": "synced",
    "external_ref": "DILRMP-4F9A1B2C",
    "synced_at": "2026-09-08T18:00:00.000000+00:00",
    "system": "DILRMP-NIC-NationalRegistry",
    "record_id": "a1b2c3d4-...",
    "payload_summary": {
      "survey_number": "142/3",
      "owner_name": "Ramegowda",
      "village": "Harohalli"
    }
  }
  ```

### 4.2 Query Synchronization Status
- **Endpoint**: `GET /records/{record_id}/lrms-status`
- **Response (`200 OK`)**:
  ```json
  {
    "synced": true,
    "last_synced_at": "2026-09-08T18:00:00.000000+00:00",
    "external_ref": "DILRMP-4F9A1B2C",
    "system": "DILRMP-NIC-NationalRegistry"
  }
  ```

---

## 5. Tamper-Evident Hash-Chain Audit Logging

When `POST /records/{record_id}/sync-lrms` completes, the gateway immediately records an entry in the document's tamper-evident audit trail:
- **Action**: `"lrms_sync"`
- **Actor**: Header actor identity (e.g., `"Tahsildar Ramanagara"`)
- **Details**:
  ```json
  {
    "adapter": "LRMSAdapter (Mock/DILRMP Contract)",
    "external_ref": "DILRMP-4F9A1B2C",
    "synced_at": "2026-09-08T18:00:00.000000+00:00",
    "system": "DILRMP-NIC-NationalRegistry"
  }
  ```
- **Cryptographic Chaining**:
  $$\text{curr\_hash} = \text{SHA256}(\text{prev\_hash} + \text{record\_id} + \text{action} + \text{actor} + \text{details\_json} + \text{timestamp})$$

Any subsequent attempt to modify or counterfeit the sync receipt breaks the hash chain, detected automatically by `GET /records/{record_id}/audit/verify`.

---

## 6. Production Deployment Roadmap

To connect this adapter to live government systems in production:

1. **State System Schemas**:
   - **Karnataka (Bhoomi)**: Map to Bhoomi Mutation XML schema (`<BhoomiRecord><RTC survey="142" hissa="3"/></BhoomiRecord>`).
   - **Maharashtra (MahaBhulekh)**: Map to Mahabhumi 7/12 & 8A JSON REST API (`/api/v1/mutation/apply`).
   - **Telangana (Dharani)**: Map to CCLA Land Integration Gateway (`/dharani/v2/passbook/sync`).
   - **West Bengal (Banglarbhumi)**: Map to Khatian / Dag Ledger API (`/banglarbhumi/ledger/update`).
   - **DILRMP National Hub (NIC)**: Map to Open Land Data Interchange (OLDI) / DILRMP National Cadastral API.

2. **Security & Credentials**:
   - Install NIC Root CA and departmental mTLS client certificates.
   - Configure OAuth2 / API Key via environment variables:
     - `LRMS_ENDPOINT_URL=https://dilrmp-api.nic.in/v1/sync`
     - `LRMS_CLIENT_CERT_PATH=/etc/ssl/certs/nic_client.crt`
     - `LRMS_API_KEY=env_vault_secret`

3. **Code Changes Needed**:
   - **Zero changes** to `records.py`, database models, UI, or audit chain logic.
   - Only replace the body of `push_verified_record()` in `lrms_integration.py` with the HTTPS client call.
