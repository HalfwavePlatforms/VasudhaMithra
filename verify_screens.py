import urllib.request
import json
import base64

API = "http://127.0.0.1:8000"

def get(url):
    req = urllib.request.Request(url, headers={"X-Role": "tahsildar"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def verify():
    print("=== 1. SCREEN 1: COMMAND CENTRE ===")
    stats = get(f"{API}/dashboard/stats")
    audit = get(f"{API}/dashboard/audit-trail?limit=5")
    print(f"Endpoint: GET /dashboard/stats")
    print(f" - Records Digitized (total_processed): {stats['total_processed']}")
    print(f" - Field Accuracy (avg_extraction_accuracy): {(stats['avg_extraction_accuracy']*100):.1f}%")
    print(f" - Spatial Discrepancies (spatial_discrepancy_count): {stats['spatial_discrepancy_count']}")
    print(f" - Pending Validation (pending_review_count): {stats['pending_review_count']}")
    print(f" - District Breakdown count: {len(stats['by_district'])} districts")
    print(f"Endpoint: GET /dashboard/audit-trail")
    print(f" - Recent activity items returned: {len(audit['audit_logs'])}")
    if audit['audit_logs']:
        first = audit['audit_logs'][0]
        print(f"   Sample: [{first['action']}] by {first['actor']} for record {first['record_id']}")

    print("\n=== 2. SCREEN 2: DOCUMENT INTAKE (UPLOAD) ===")
    print("Endpoint: POST /records/upload")
    print(" - Supported parameters: file (multipart), language ('auto'|'hi'|'kn'|'en'|'mr'|'ta'|'te'), actor")
    print(" - Response returns: record_id, status, risk_level, spatial_consistency")

    print("\n=== 3. SCREEN 3: VERIFICATION DESK ===")
    pending = get(f"{API}/records?status=pending_review&limit=2")
    print(f"Endpoint: GET /records?status=pending_review")
    print(f" - Total pending review records in queue: {pending['total']}")
    if pending['records']:
        sample_rec = pending['records'][0]
        print(f" - Loaded record ID: {sample_rec['record_id']}")
        print(f" - Document Type: {sample_rec['document_type']}")
        print(f" - OCR Confidence: {(sample_rec['ocr_confidence']*100):.1f}%")
        print(f" - Real Schema Fields: {list(sample_rec['fields'].keys())}")
        confs = sample_rec['confidence_per_field']
        print(f" - Field Confidences: {confs}")
        print(f" - Real Violations: {sample_rec['violations']}")
        print(f" - GIS Consistency: {sample_rec['gis']['spatial_consistency']}")

    print("\n=== 4. SCREEN 4: LAND RECORDS (MASTER TABLE) ===")
    records = get(f"{API}/records?page=1&limit=5")
    print(f"Endpoint: GET /records?page=1&limit=5")
    print(f" - Master Table Total: {records['total']}")
    print(f" - Page: {records['page']} | Limit: {records['limit']}")
    print(f" - Sample Row: Survey '{records['records'][0]['fields'].get('survey_number') or records['records'][0]['fields'].get('khasra_number')}', Owner '{records['records'][0]['fields'].get('owner_name')}', Status '{records['records'][0]['status']}'")

    print("\n=== 5. SCREEN 5: GIS & PARCELS ===")
    # Try GIS via proxy or direct 8003
    try:
        parcels_resp = get(f"{API}/gis/parcels")
        print(f"Endpoint: GET /gis/parcels (via API Gateway proxy)")
        print(f" - Seeded parcel count: {parcels_resp['count']}")
    except Exception:
        req = urllib.request.Request("http://127.0.0.1:8003/gis/parcels")
        with urllib.request.urlopen(req) as resp:
            parcels_resp = json.loads(resp.read().decode())
        print(f"Endpoint: GET http://127.0.0.1:8003/gis/parcels (GIS service direct)")
        print(f" - Seeded parcel count: {parcels_resp['count']}")

    try:
        p_detail = get(f"{API}/gis/parcel/145/2")
        print(f"Endpoint: GET /gis/parcel/145/2 (via API Gateway proxy)")
    except Exception:
        req = urllib.request.Request("http://127.0.0.1:8003/gis/parcel/145/2")
        with urllib.request.urlopen(req) as resp:
            p_detail = json.loads(resp.read().decode())
        print(f"Endpoint: GET http://127.0.0.1:8003/gis/parcel/145/2 (GIS service direct)")

    print(f" - Parcel ID: {p_detail['parcel_id']}")
    print(f" - Cadastral GIS Area: {p_detail['area_gis']} Acres")
    print(f" - Polygon geometry type: {p_detail['geometry']['type']}")
    print(f" - Vertices count: {len(p_detail['geometry']['coordinates'][0])}")

if __name__ == "__main__":
    verify()
