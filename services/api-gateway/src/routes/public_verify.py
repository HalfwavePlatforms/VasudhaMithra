import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from database import get_db
from models.db_models import Record
from services.verification_signer import verify_record_token
from routes.records import verify_audit_trail_internal

router = APIRouter(prefix="/verify", tags=["public-verify"])

# In-memory sliding window rate limiter: IP -> list of timestamps
_RATE_LIMIT_WINDOW = 60.0  # 1 minute window
_RATE_LIMIT_MAX_REQUESTS = 30  # Max 30 requests per minute per IP
_IP_REQUEST_TIMESTAMPS: Dict[str, List[float]] = defaultdict(list)


def check_rate_limit(request: Request):
    """
    In-memory IP rate limiter to protect the public verification endpoint from scraping/DoS.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    now = time.time()
    
    # Prune timestamps older than window
    timestamps = _IP_REQUEST_TIMESTAMPS[client_ip]
    valid_cutoff = now - _RATE_LIMIT_WINDOW
    _IP_REQUEST_TIMESTAMPS[client_ip] = [ts for ts in timestamps if ts > valid_cutoff]
    
    if len(_IP_REQUEST_TIMESTAMPS[client_ip]) >= _RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(
            status_code=429,
            detail="Too many verification requests. Please wait a moment before trying again.",
        )
    
    _IP_REQUEST_TIMESTAMPS[client_ip].append(now)


@router.get("/{record_id}")
def verify_record_public(
    record_id: uuid.UUID,
    token: str = Query(..., description="HMAC signature verification token"),
    request: Request = None,
    db: Session = Depends(get_db),
):
    """
    Public, unauthenticated, read-only endpoint for verifying a validated land record.
    Protected by HMAC-SHA256 token matching and per-IP rate limiting.
    Deliberately excludes sensitive fields (confidence, raw OCR, reviewer notes, personal contact details).
    """
    check_rate_limit(request)

    # 1. Constant-time token verification
    if not verify_record_token(record_id, token):
        raise HTTPException(
            status_code=403,
            detail="Invalid or unauthorized verification token. Please verify the URL or scan the original official QR code.",
        )

    # 2. Look up record
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=404,
            detail="Land record not found for the provided identifier.",
        )

    # 3. Extract ONLY non-sensitive public facts
    fields_map = {rf.field_name: (rf.corrected_value or rf.field_value) for rf in record.fields}
    survey_no = fields_map.get("survey_number") or fields_map.get("khasra_number") or fields_map.get("plot_number") or "N/A"
    owner_name = fields_map.get("owner_name") or "N/A"
    village = fields_map.get("village") or "N/A"
    district = fields_map.get("district") or "N/A"
    state = record.state or fields_map.get("state") or "N/A"

    # 4. Check cryptographic hash-chain untampered state
    audit_check = verify_audit_trail_internal(record_id, db)
    audit_chain_valid = bool(audit_check.get("valid", False))
    audit_entries_count = audit_check.get("verified_entries", 0)

    return {
        "record_id": str(record.id),
        "survey_number": survey_no,
        "owner_name": owner_name,
        "village": village,
        "district": district,
        "state": state,
        "validation_status": record.status,
        "document_type": record.document_type or "Official Land Record",
        "audit_chain_valid": audit_chain_valid,
        "audit_entries_count": audit_entries_count,
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "integrity_message": (
            "Cryptographic audit hash-chain is valid and untampered."
            if audit_chain_valid
            else f"Warning: Integrity check failed ({audit_check.get('reason', 'Broken chain')})"
        ),
    }
