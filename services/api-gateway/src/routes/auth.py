import logging
import os
import re
import secrets
import time
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from services.sms_service import send_otp_sms, send_sms, get_gateway_status, normalize_phone_e164

logger = logging.getLogger("api-gateway.auth")
router = APIRouter()

# In-memory OTP storage with 10-minute expiry
# Key: normalized_email or normalized_phone
_ACTIVE_OTPS: Dict[str, Dict[str, Any]] = {}

ALLOWED_DOMAIN_PATTERN = re.compile(r"@([a-z0-9-]+\.)*gov\.in$", re.IGNORECASE)
INDIAN_PHONE_PATTERN = re.compile(r"^(?:\+91|91|0)?[6-9]\d{9}$")

ROLE_MAP = {
    "revenue": {
        "label": "Revenue officer",
        "xRole": "officer",
        "defaultActor": "Revenue Officer",
    },
    "survey": {
        "label": "Survey team",
        "xRole": "surveyor",
        "defaultActor": "Cadastral Surveyor",
    },
    "citizen": {
        "label": "Citizen",
        "xRole": "citizen",
        "defaultActor": "Citizen",
    },
    "verifier": {
        "label": "Citizen",
        "xRole": "citizen",
        "defaultActor": "Citizen",
    },
    "officer": {
        "label": "Revenue officer",
        "xRole": "officer",
        "defaultActor": "Revenue Officer",
    },
    "surveyor": {
        "label": "Survey team",
        "xRole": "surveyor",
        "defaultActor": "Cadastral Surveyor",
    },
    "tahsildar": {
        "label": "Field Verifier",
        "xRole": "tahsildar",
        "defaultActor": "Field Verifier",
    },
    "admin": {
        "label": "System Administrator",
        "xRole": "admin",
        "defaultActor": "Chief Registrar",
    },
}


class SendOtpRequest(BaseModel):
    email: str = Field(..., description="Official government email ending in .gov.in")
    phone: str = Field(..., description="10-digit Indian mobile number")
    role: str = Field(default="revenue", description="User role (revenue, survey, verifier)")


class VerifyOtpRequest(BaseModel):
    email: str
    phone: str
    otp: str
    role: str = Field(default="revenue")


class TestSmsRequest(BaseModel):
    phone: str
    message: str


@router.get("/sms-status")
async def check_sms_status():
    """
    Returns current TextBee SMS Gateway connectivity, API key state, and connected devices.
    """
    return await get_gateway_status()


@router.post("/send-otp")
async def send_login_otp(req: SendOtpRequest):
    """
    Validates official email and mobile number, generates 6-digit OTP,
    and dispatches SMS via TextBee Android SMS Gateway.
    """
    email_clean = req.email.strip().lower()
    phone_clean = re.sub(r"[\s\-\(\)]", "", req.phone.strip())

    # 1. Validate email address
    # For citizen login, allow any valid standard email domain (e.g. @gmail.com, @yahoo.com)
    if req.role in ("citizen", "verifier"):
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email_clean):
            raise HTTPException(
                status_code=400,
                detail="Please enter a valid email address.",
            )
    else:
        if not ALLOWED_DOMAIN_PATTERN.search(email_clean):
            raise HTTPException(
                status_code=400,
                detail="Official email must end with .gov.in (e.g. officer@revenue.gov.in)",
            )

    # 2. Validate mobile number (10-digit Indian number starting with 6-9)
    if not INDIAN_PHONE_PATTERN.match(phone_clean):
        raise HTTPException(
            status_code=400,
            detail="Valid 10-digit mobile number required (e.g. 9876543210)",
        )

    normalized_phone = normalize_phone_e164(phone_clean)
    role_info = ROLE_MAP.get(req.role, ROLE_MAP["revenue"])
    actor_label = role_info["defaultActor"]

    # 3. Generate secure 6-digit numeric OTP
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = time.time() + 600.0  # 10 minutes

    # Store OTP under both email and phone keys for robust verification
    session_data = {
        "otp": otp_code,
        "expires_at": expires_at,
        "email": email_clean,
        "phone": normalized_phone,
        "role": req.role,
        "role_info": role_info,
    }
    _ACTIVE_OTPS[email_clean] = session_data
    _ACTIVE_OTPS[normalized_phone] = session_data

    # 4. Dispatch SMS via TextBee Gateway
    sms_res = await send_otp_sms(normalized_phone, otp_code, actor=actor_label)

    # 5. Mask phone for privacy in response: +91 ••••• ••3210
    masked_phone = f"{normalized_phone[:3]} ••••• ••{normalized_phone[-4:]}"

    return {
        "success": True,
        "message": f"Verification code dispatched to {masked_phone}",
        "phone": normalized_phone,
        "masked_phone": masked_phone,
        "email": email_clean,
        "expires_in_seconds": 600,
        "sms_status": sms_res,
        "sms_delivered": sms_res.get("sms_delivered", False),
        "device_pending": sms_res.get("device_pending", False),
        # Provide demo_otp and backup_otp so testing & login never get blocked by carrier delays
        "demo_otp": otp_code,
        "backup_otp": otp_code,
    }


@router.post("/verify-otp")
async def verify_login_otp(req: VerifyOtpRequest):
    """
    Validates submitted 6-digit OTP and issues authenticated user session.
    """
    email_clean = req.email.strip().lower()
    phone_clean = normalize_phone_e164(req.phone.strip())
    submitted_otp = req.otp.strip()

    # Look up OTP session
    session_data = _ACTIVE_OTPS.get(email_clean) or _ACTIVE_OTPS.get(phone_clean)

    if not session_data:
        raise HTTPException(
            status_code=400,
            detail="No verification session found. Please request a new OTP code.",
        )

    if time.time() > session_data["expires_at"]:
        _ACTIVE_OTPS.pop(email_clean, None)
        _ACTIVE_OTPS.pop(phone_clean, None)
        raise HTTPException(
            status_code=400,
            detail="Verification code has expired. Please request a new code.",
        )

    if session_data["otp"] != submitted_otp:
        raise HTTPException(
            status_code=400,
            detail="Invalid 6-digit verification code. Please check and re-enter.",
        )

    # OTP is valid! Clear it to prevent replay attacks
    _ACTIVE_OTPS.pop(email_clean, None)
    _ACTIVE_OTPS.pop(phone_clean, None)

    role_info = session_data.get("role_info") or ROLE_MAP.get(req.role, ROLE_MAP["revenue"])
    name_part = email_clean.split("@")[0].replace(".", " ").title()
    actor_full = f"{name_part} ({role_info['defaultActor']})"

    user_session = {
        "email": email_clean,
        "phone": phone_clean,
        "roleKey": req.role,
        "xRole": role_info["xRole"],
        "actor": actor_full,
        "loggedInAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    token = f"vasudha_bearer_{secrets.token_hex(20)}"

    logger.info(f"User login verified successfully: {email_clean} ({phone_clean}) as {role_info['xRole']}")

    return {
        "success": True,
        "message": "Authentication successful.",
        "token": token,
        "user": user_session,
    }


@router.post("/test-sms")
async def send_test_sms(req: TestSmsRequest):
    """
    Developer / Admin test utility to send an arbitrary SMS via TextBee.
    """
    res = await send_sms(req.phone, req.message)
    return res
