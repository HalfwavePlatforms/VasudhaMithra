import hashlib
import hmac
import os
import uuid

VERIFICATION_SECRET = os.getenv("VERIFICATION_SECRET_KEY", "vasudha-land-record-verification-secret-2026")

def generate_verification_token(record_id: str | uuid.UUID) -> str:
    clean_id = str(record_id).strip().lower()
    sig = hmac.new(
        VERIFICATION_SECRET.encode("utf-8"),
        clean_id.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return sig[:20]

def verify_record_token(record_id: str | uuid.UUID, token: str) -> bool:
    if not token or not token.strip():
        return False
    expected = generate_verification_token(record_id)
    return hmac.compare_digest(expected, token.strip().lower())
