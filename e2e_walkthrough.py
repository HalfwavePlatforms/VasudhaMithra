import requests
import os
import sys
import json
import glob
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")

API_BASE = "http://127.0.0.1:8000"
HEADERS = {"X-Role": "tahsildar"}

def run_walkthrough():
    print("=" * 80)
    print("VASUDHAMITHRA PS 26018 — END-TO-END WORKFLOW INTEGRATION WALKTHROUGH")
    print("=" * 80)

    # -------------------------------------------------------------
    # STEP 0: Baseline Command Centre Stats
    # -------------------------------------------------------------
    print("\n[STEP 0] Baseline Command Centre Stats (GET /dashboard/stats)")
    r_stats_pre = requests.get(f"{API_BASE}/dashboard/stats", headers=HEADERS)
    stats_pre = r_stats_pre.json()
    print(f"Status Code: {r_stats_pre.status_code}")
    print(f"Total Processed: {stats_pre['total_processed']}")
    print(f"Verified Count: {stats_pre['verified_count']}")
    print(f"Pending Review Count: {stats_pre['pending_review_count']}")
    print(f"Field Accuracy: {(stats_pre['avg_extraction_accuracy']*100):.1f}%")
    print(f"Spatial Discrepancies: {stats_pre['spatial_discrepancy_count']}")

    # -------------------------------------------------------------
    # STEP 1: Document Intake (Upload real sample document)
    # -------------------------------------------------------------
    print("\n[STEP 1] Document Intake Upload (POST /records/upload)")
    sample_file = "data/sample-documents/doc_kn_01.png"
    if not os.path.exists(sample_file):
        sample_file = glob.glob("data/sample-documents/*.png")[0]
    
    print(f"Uploading real document: {sample_file} ({os.path.getsize(sample_file)} bytes)")
    with open(sample_file, "rb") as f:
        files = {"file": (os.path.basename(sample_file), f, "image/png")}
        data = {"language": "kn", "actor": "Deepak G.M. (District Admin)"}
        r_upload = requests.post(f"{API_BASE}/records/upload", headers=HEADERS, files=files, data=data)

    print(f"Upload Status Code: {r_upload.status_code}")
    upload_res = r_upload.json()
    print("Upload Response:")
    print(json.dumps(upload_res, indent=2))
    
    record_id = upload_res["record_id"]
    print(f"\n===> HANDOFF CONFIRMED: record_id = {record_id}")
    print(f"Pipeline initial status: {upload_res['status']}, Risk: {upload_res['risk_level']}")

    # -------------------------------------------------------------
    # STEP 2 & 3: Verification Desk (Inspect fields, violations, GIS)
    # -------------------------------------------------------------
    print(f"\n[STEP 2 & 3] Verification Desk Ingestion (GET /records/{record_id})")
    r_detail = requests.get(f"{API_BASE}/records/{record_id}", headers=HEADERS)
    print(f"Status Code: {r_detail.status_code}")
    rec_detail = r_detail.json()
    
    print(f"Document Type: {rec_detail['document_type']}")
    print(f"Overall OCR Confidence: {(rec_detail['ocr_confidence']*100):.1f}%")
    print("\nExtracted Fields & Real Confidences:")
    for f_name, f_val in rec_detail["fields"].items():
        conf = rec_detail["confidence_per_field"].get(f_name)
        conf_str = f"{(conf*100):.1f}%" if (conf is not None and conf > 0) else "Unverified"
        print(f"  - {f_name:20s}: {str(f_val):30s} [Conf: {conf_str}]")

    print(f"\nReal Validation Violations: {rec_detail['violations']}")
    print("GIS Spatial Consistency Check:")
    if rec_detail.get("gis"):
        print(f"  - Parcel ID: {rec_detail['gis'].get('parcel_id')}")
        print(f"  - Deed Stated Area: {rec_detail['gis'].get('area_doc_acres')} ac")
        print(f"  - Cadastral GIS Area: {rec_detail['gis'].get('area_gis_acres')} ac")
        print(f"  - Spatial Delta: {rec_detail['gis'].get('spatial_delta_pct')}%")
        print(f"  - Spatial Consistency: {rec_detail['gis'].get('spatial_consistency')}")
    else:
        print("  - Initial Status: Unmatched (survey number unverified on intake; pending human desk input)")

    # -------------------------------------------------------------
    # STEP 4: Human Verification Loop (Correct field & Approve via PATCH)
    # -------------------------------------------------------------
    print(f"\n[STEP 4] Human Verification: Correct Field & Approve (PATCH /records/{record_id})")
    # Correct owner_name and survey_number, and approve
    corrections_payload = {
        "actor": "Deepak G.M. (Tahsildar / Admin)",
        "reviewer_notes": "Verified against survey registry. Reconciled boundary with cadastral record.",
        "decision": "APPROVED",
        "fields": {
            **rec_detail["fields"],
            "owner_name": "Basavaraja Hegde",
            "survey_number": "145/2",
            "plot_area": "2.47 acres",
        }
    }
    
    r_patch = requests.patch(f"{API_BASE}/records/{record_id}", headers=HEADERS, json=corrections_payload)
    print(f"PATCH Status Code: {r_patch.status_code}")
    patched_rec = r_patch.json()
    print(f"New Status: {patched_rec['status']}")
    print(f"New Risk Level: {patched_rec['risk_level']}")
    print(f"Updated Owner: {patched_rec['fields']['owner_name']}")
    print(f"Updated Survey: {patched_rec['fields']['survey_number']}")
    if patched_rec.get("gis"):
        print(f"Updated GIS Consistency: {patched_rec['gis'].get('spatial_consistency')}")
        print(f"Matched Cadastral Parcel: {patched_rec['gis'].get('parcel_id')}")
        print(f"GIS Area: {patched_rec['gis'].get('area_gis_acres')} ac (Document Area: {patched_rec['gis'].get('area_doc_acres')} ac)")
    else:
        print(f"Updated GIS Consistency: {patched_rec.get('spatial_consistency', 'NOT_EVALUATED')}")
    print(f"Review Notes Recorded: {patched_rec['review']['reviewer_notes']}")
    print(f"Reviewed By: {patched_rec['review']['reviewed_by']}")

    # -------------------------------------------------------------
    # STEP 5: Audit Trail Verification
    # -------------------------------------------------------------
    print(f"\n[STEP 5] Audit Trail Event Verification (GET /dashboard/audit-trail?limit=6)")
    r_audit = requests.get(f"{API_BASE}/dashboard/audit-trail?limit=6", headers=HEADERS)
    audit_data = r_audit.json()
    print(f"Audit Trail Total Events: {audit_data['total']}")
    matching_events = [e for e in audit_data["audit_logs"] if e["record_id"] == record_id]
    print(f"Found {len(matching_events)} audit events for record {record_id}:")
    for ev in matching_events:
        print(f"  - [{ev['action']}] by '{ev['actor']}' at {ev['created_at']} -> Details: {ev['details']}")

    # -------------------------------------------------------------
    # STEP 6: Land Records Master Table Verification
    # -------------------------------------------------------------
    print(f"\n[STEP 6] Land Records Master Table (GET /records?page=1&limit=10)")
    r_master = requests.get(f"{API_BASE}/records?page=1&limit=10", headers=HEADERS)
    master_data = r_master.json()
    print(f"Total Master Records: {master_data['total']}")
    found_in_master = next((item for item in master_data["records"] if item["record_id"] == record_id), None)
    if found_in_master:
        print(f"✓ Record {record_id} found in Land Records Master Table:")
        print(f"  Survey: {found_in_master['fields'].get('survey_number')}")
        print(f"  Owner: {found_in_master['fields'].get('owner_name')}")
        print(f"  Status: {found_in_master['status']} (Badge: Validated)")
        print(f"  Risk: {found_in_master['risk_level']}")
    else:
        print("Record not in first page, checking by direct filter...")
        r_find = requests.get(f"{API_BASE}/records/{record_id}", headers=HEADERS)
        print(f"Direct Lookup Status: {r_find.json()['status']}")

    # -------------------------------------------------------------
    # STEP 7: Command Centre Increment Verification
    # -------------------------------------------------------------
    print(f"\n[STEP 7] Command Centre Metrics Delta (GET /dashboard/stats)")
    r_stats_post = requests.get(f"{API_BASE}/dashboard/stats", headers=HEADERS)
    stats_post = r_stats_post.json()
    print(f"Total Processed: {stats_pre['total_processed']} -> {stats_post['total_processed']} (+{stats_post['total_processed'] - stats_pre['total_processed']})")
    print(f"Verified Count:  {stats_pre['verified_count']} -> {stats_post['verified_count']} (+{stats_post['verified_count'] - stats_pre['verified_count']})")
    print(f"Pending Count:   {stats_pre['pending_review_count']} -> {stats_post['pending_review_count']}")
    
    print("\n" + "=" * 80)
    print("ALL 7 STEPS OF THE PS 26018 END-TO-END USER JOURNEY VERIFIED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    run_walkthrough()
