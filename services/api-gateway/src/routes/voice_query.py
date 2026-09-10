"""
Public Voice Query Assistant Endpoint.
Allows citizens to ask questions in regional languages about land records
via speech-to-text and receive plain-language spoken responses.

Architecture:
1. LLM Query Parsing (Strict JSON): Extracts ONLY survey_number and query_type.
   LLM is NEVER allowed to answer the query directly.
2. Real Database Lookup: Queries actual records in postgres/sqlite.
   Returns honest "No record found" if survey number is not digitized.
3. Localized Plain-Language Response Generation: Composes templates in
   the query's language (hi, kn, mr, bn, ta, te, en).
4. Privacy Discipline: Only returns public-safe facts.
"""
import os
import re
import json
import logging
from typing import Optional, Dict, Any, List
from collections import defaultdict
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models.db_models import Record, RecordField, ValidationResult

logger = logging.getLogger("api-gateway.voice_query")

router = APIRouter(tags=["public-voice-query"])

# IP rate limiting (30 requests/minute)
_RATE_LIMIT_WINDOW = 60.0
_RATE_LIMIT_MAX_REQUESTS = 30
_IP_REQUEST_TIMESTAMPS: Dict[str, List[float]] = defaultdict(list)


def check_rate_limit(request: Request):
    client_ip = request.client.host if request and request.client else "127.0.0.1"
    now = time.time()
    timestamps = _IP_REQUEST_TIMESTAMPS[client_ip]
    valid_cutoff = now - _RATE_LIMIT_WINDOW
    _IP_REQUEST_TIMESTAMPS[client_ip] = [ts for ts in timestamps if ts > valid_cutoff]
    if len(_IP_REQUEST_TIMESTAMPS[client_ip]) >= _RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(
            status_code=429,
            detail="Too many voice query requests. Please wait a moment before asking again.",
        )
    _IP_REQUEST_TIMESTAMPS[client_ip].append(now)


class VoiceQueryRequest(BaseModel):
    query_text: str = Field(..., description="Transcribed question from the citizen")
    language: str = Field(default="en", description="ISO language code: hi, kn, mr, bn, ta, te, en")
    survey_number_override: Optional[str] = Field(None, description="Optional manual survey number fallback")


# Numeral conversion for Indic scripts
INDIC_DIGITS = {
    # Devanagari (Hindi, Marathi)
    "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
    "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
    # Kannada
    "೦": "0", "೧": "1", "೨": "2", "೩": "3", "೪": "4",
    "೫": "5", "೬": "6", "೭": "7", "೮": "8", "೯": "9",
    # Bengali
    "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
    "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
    # Telugu
    "౦": "0", "౧": "1", "౨": "2", "౩": "3", "౪": "4",
    "౫": "5", "౬": "6", "౭": "7", "౮": "8", "౯": "9",
    # Tamil
    "௦": "0", "௧": "1", "௨": "2", "௩": "3", "௪": "4",
    "௫": "5", "௬": "6", "௭": "7", "௮": "8", "௯": "9",
}


def normalize_indic_numerals(text: str) -> str:
    for indic_char, ascii_char in INDIC_DIGITS.items():
        text = text.replace(indic_char, ascii_char)
    return text


def parse_query_with_regex_fallback(query_text: str) -> Dict[str, Optional[str]]:
    """
    Deterministic rule-based parser used as fallback if LLM is offline or disabled.
    Extracts survey_number and identifies query_type (status/owner/dispute/classification).
    """
    norm_text = normalize_indic_numerals(query_text)
    
    # 1. Detect query_type
    lower_text = norm_text.lower()
    query_type = "status"  # default
    
    # Owner keywords across languages
    if any(w in lower_text for w in [
        "owner", "khatedar", "pattadar", "name", "who is", "who owns",
        "मालिक", "किसके नाम", "खातेदार", "स्वामी",
        "ಮಾಲೀಕ", "ಯಾರ ಹೆಸರು", "ಖಾತೆದಾರ", "ಒಡೆಯ",
        "உரிமையாளர்", "யார் பெயர்", "பட்டாதாரர்",
        "యజమాని", "ఎవరి పేరు", "పట్టాదారు",
        "मालक", "कोणाचे नाव",
        "মালিক", "কার নাম",
    ]):
        query_type = "owner"
    # Dispute keywords
    elif any(w in lower_text for w in [
        "dispute", "court", "case", "problem", "conflict", "stay", "litigation",
        "विवाद", "झगड़ा", "कोर्ट", "मुकदमा", "केस",
        "ವಿವಾದ", "ನ್ಯಾಯಾಲಯ", "ಕೋರ್ಟ್", "ತಕರಾರು", "ಜಗಳ",
        "சர்ச்சை", "வழக்கு", "நீதிமன்றம்",
        "వివాదం", "కోర్టు", "కేసు", "వివాదాలు",
        "तंटा", "वाद", "न्यायालय",
        "বিরোধ", "মামলা", "আদালত",
    ]):
        query_type = "dispute"
    # Classification / Land Type keywords
    elif any(w in lower_text for w in [
        "classification", "type of land", "nature", "category", "agricultural", "dry land", "wet land",
        "वर्गीकरण", "भूमि का प्रकार", "जमीन की श्रेणी", "कृषि", "बंजर",
        "ವರ್ಗೀಕರಣ", "ಜಮೀನಿನ ಪ್ರಕಾರ", "ವಿಧ", "ಖುಷ್ಕಿ", "ತರಿ", "ಸರ್ಕಾರಿ",
        "வகைப்பாடு", "நில வகை", "நஞ்சை", "புஞ்சை",
        "వర్గీకరణ", "భూమి రకం", "మెట్ట", "పల్లం",
        "जमिनीचा प्रकार", "प्रवर्ग",
        "শ্রেণী", "জমির ধরণ",
    ]):
        query_type = "classification"
    # Status keywords
    elif any(w in lower_text for w in [
        "status", "validated", "approved", "verified", "progress", "state",
        "स्थिति", "स्टेटस", "मंजूर", "सत्यापित", "प्रगति",
        "ಸ್ಥಿತಿ", "ಪರಿಶೀಲನೆ", "ಅಂಗೀಕಾರ", "ಪ್ರಗತಿ", "ಆಗಿದೆಯೇ",
        "நிலை", "சரிபார்ப்பு", "முன்னேற்றம்",
        "స్థితి", "ధృవీకరణ", "ఆమోదం",
        "स्थिती", "मंजूरी",
        "অবস্থা", "যাচাই",
    ]):
        query_type = "status"

    # 2. Extract survey number
    survey_no = None
    patterns = [
        r"(?:survey|surve|sy\.?|khasra|khata|plot|सर्वे|खाता|खसरा|ಸರ್ವೆ|ಖಾತೆ|சர்வே|సర్వే|सर्व्हे|সার্ভে)\s*(?:no\.?|number|संख्या|ಸಂಖ್ಯೆ|எண்|నంబర్|क्रमांक|নম্বর)?\s*[:\-#]?\s*([0-9]+(?:\s*[\/\-]\s*[A-Za-z0-9]+)?)",
        r"\b([0-9]{1,5}\s*[\/\-]\s*[A-Za-z0-9]+)\b",
        r"\b([0-9]{1,5}[A-Za-z]?)\b",
    ]
    for pat in patterns:
        m = re.search(pat, norm_text, re.IGNORECASE)
        if m:
            candidate = m.group(1).replace(" ", "")
            if "/" in candidate or "-" in candidate or len(candidate) <= 4:
                survey_no = candidate
                break

    return {
        "survey_number": survey_no,
        "query_type": query_type,
    }


def call_llm_parser(query_text: str) -> Dict[str, Optional[str]]:
    """
    Calls the LLM provider to extract ONLY survey_number and query_type.
    Strictly instructs the LLM NEVER to answer the query.
    Falls back gracefully to deterministic regex parser on any issue.
    """
    prompt = (
        "Extract ONLY a survey_number and a query_type (status/owner/dispute/classification) "
        f"from this citizen's question: \"{query_text}\". Return valid JSON only. "
        "If no clear survey number is mentioned, return survey_number: null. "
        "Schema: {\"survey_number\": string or null, \"query_type\": \"status\"|\"owner\"|\"dispute\"|\"classification\"}"
    )

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_VISION_API_KEY")
    if api_key:
        model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.0, "responseMimeType": "application/json"},
        }
        try:
            resp = httpx.post(url, json=payload, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])
                raw_json = parts[0].get("text", "")
                parsed = json.loads(raw_json)
                s_num = parsed.get("survey_number")
                if s_num:
                    s_num = normalize_indic_numerals(str(s_num).strip())
                q_type = parsed.get("query_type", "status")
                if q_type not in ("status", "owner", "dispute", "classification"):
                    q_type = "status"
                return {"survey_number": s_num, "query_type": q_type}
        except Exception as e:
            logger.warning("Gemini LLM query parsing failed (%s). Falling back to rule-based parser.", e)

    # Fallback to deterministic regex parser
    return parse_query_with_regex_fallback(query_text)


def get_effective_field_value(rf: RecordField) -> str:
    """Returns the effective field value, treating 'None' / 'null' strings as empty."""
    if rf.corrected_value and rf.corrected_value.strip().lower() not in ("none", "null", "n/a", ""):
        return rf.corrected_value.strip()
    if rf.field_value and rf.field_value.strip().lower() not in ("none", "null", "n/a", ""):
        return rf.field_value.strip()
    return ""


def query_real_record(survey_number: str, db: Session) -> Optional[Record]:
    """
    Searches the database for a record matching the survey number or khasra number.
    Handles exact match, case-insensitivity, and slash variants (e.g. 145/2 vs 145-2).
    """
    if not survey_number:
        return None

    clean_s = survey_number.strip().replace(" ", "").lower()
    variants = {
        clean_s,
        clean_s.replace("-", "/"),
        clean_s.replace("/", "-"),
    }

    records = db.query(Record).all()
    # Prioritize validated records
    records.sort(key=lambda r: 0 if r.status == "validated" else 1)

    for rec in records:
        fields_map = {
            rf.field_name: get_effective_field_value(rf).lower().replace(" ", "")
            for rf in rec.fields
        }
        rec_survey = fields_map.get("survey_number") or fields_map.get("khasra_number") or ""
        rec_parcel = (rec.parcel_id or "").strip().lower().replace(" ", "")

        if rec_survey in variants or rec_parcel in variants:
            return rec

    return None


# Multilingual response templates
# Language codes: hi, kn, mr, bn, ta, te, en
RESPONSES = {
    "en": {
        "no_survey": "Please mention your land survey number so I can check your record.",
        "not_found": "No digitized record was found for survey number {survey}.",
        "status": "Survey number {survey} is currently {status}.",
        "owner": "Survey number {survey} is registered to {owner}.",
        "classification": "The land classification for survey number {survey} is {classification}.",
        "dispute_none": "For survey number {survey}, no dispute or spatial discrepancy is recorded on the platform.",
        "dispute_found": "Survey number {survey} has a recorded discrepancy or pending review.",
        "status_map": {
            "validated": "fully verified and validated",
            "pending_review": "under administrative review",
            "rejected": "rejected during verification",
            "processing": "currently being digitized",
        }
    },
    "hi": {
        "no_survey": "कृपया अपने भू-अभिलेख की जांच के लिए सर्वे नंबर बताएं।",
        "not_found": "सर्वे संख्या {survey} के लिए कोई डिजिटाइज़्ड रिकॉर्ड नहीं मिला।",
        "status": "सर्वे संख्या {survey} वर्तमान में {status} है।",
        "owner": "सर्वे संख्या {survey} {owner} के नाम पर पंजीकृत है।",
        "classification": "सर्वे संख्या {survey} का भूमि वर्गीकरण {classification} है।",
        "dispute_none": "सर्वे संख्या {survey} पर कोई विवाद या विसंगति दर्ज नहीं है।",
        "dispute_found": "सर्वे संख्या {survey} पर विसंगति या समीक्षा लंबित दर्ज है।",
        "status_map": {
            "validated": "सत्यापित एवं प्रमाणित",
            "pending_review": "अधिकारियों द्वारा समीक्षाधीन",
            "rejected": "अस्वीकृत",
            "processing": "डिजिटलीकरण प्रक्रिया में",
        }
    },
    "kn": {
        "no_survey": "ನಿಮ್ಮ ಭೂ ದಾಖಲೆಯನ್ನು ಪರಿಶೀಲಿಸಲು ದಯವಿಟ್ಟು ಸರ್ವೆ ನಂಬರ್ ತಿಳಿಸಿ.",
        "not_found": "ಸರ್ವೆ ನಂಬರ್ {survey} ಗೆ ಯಾವುದೇ ಡಿಜಿಟಲೀಕೃತ ದಾಖಲೆ ಕಂಡುಬಂದಿಲ್ಲ.",
        "status": "ಸರ್ವೆ ನಂಬರ್ {survey} ಪ್ರಸ್ತುತ {status} ಆಗಿದೆ.",
        "owner": "ಸರ್ವೆ ನಂಬರ್ {survey} {owner} ಅವರ ಹೆಸರಿನಲ್ಲಿ ನೋಂದಾಯಿಸಲಾಗಿದೆ.",
        "classification": "ಸರ್ವೆ ನಂಬರ್ {survey} ಜಮೀನಿನ ವರ್ಗೀಕರಣ {classification} ಆಗಿದೆ.",
        "dispute_none": "ಸರ್ವೆ ನಂಬರ್ {survey} ಗೆ ಯಾವುದೇ ವಿವಾದ ಅಥವಾ ವ್ಯತ್ಯಾಸ ದಾಖಲಾಗಿಲ್ಲ.",
        "dispute_found": "ಸರ್ವೆ ನಂಬರ್ {survey} ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ ಅಥವಾ ವ್ಯತ್ಯಾಸ ಕಂಡುಬಂದಿದೆ.",
        "status_map": {
            "validated": "ಪರಿಶೀಲಿಸಿ ಅಂಗೀಕರಿಸಲಾಗಿದೆ",
            "pending_review": "ಅಧಿಕಾರಿಗಳ ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ",
            "rejected": "ತಿರಸ್ಕರಿಸಲಾಗಿದೆ",
            "processing": "ಡಿಜಿಟಲೀಕರಣ ಪ್ರಕ್ರಿಯೆಯಲ್ಲಿದೆ",
        }
    },
    "mr": {
        "no_survey": "कृपया जमिनीची नोंद तपासण्यासाठी सर्व्हे क्रमांक सांगा.",
        "not_found": "सर्व्हे क्रमांक {survey} साठी कोणतीही डिजिटल नोंद आढळली नाही.",
        "status": "सर्व्हे क्रमांक {survey} सद्यस्थितीत {status} आहे.",
        "owner": "सर्व्हे क्रमांक {survey} {owner} यांच्या नावावर नोंदणीकृत आहे.",
        "classification": "सर्व्हे क्रमांक {survey} चा जमिनीचा प्रकार {classification} आहे.",
        "dispute_none": "सर्व्हे क्रमांक {survey} वर कोणताही वाद किंवा तफावत नोंदवलेली नाही.",
        "dispute_found": "सर्व्हे क्रमांक {survey} वर तफावत किंवा फेरतपासणी प्रलंबित आहे.",
        "status_map": {
            "validated": "तपासणी करून मंजूर",
            "pending_review": "अधिकाऱ्यांच्या तपासणीत",
            "rejected": "नाकारले",
            "processing": "डिजिटलायझेशन प्रक्रियेत",
        }
    },
    "bn": {
        "no_survey": "আপনার জমির রেকর্ড দেখতে অনুগ্রহ করে সার্ভে নম্বর বলুন।",
        "not_found": "সার্ভে নম্বর {survey}-এর জন্য কোনো ডিজিটাইজড রেকর্ড পাওয়া যায়নি।",
        "status": "সার্ভে নম্বর {survey} বর্তমানে {status} অবস্থায় আছে।",
        "owner": "সার্ভে নম্বর {survey} {owner}-এর নামে নথিভুক্ত।",
        "classification": "সার্ভে নম্বর {survey}-এর জমির শ্রেণী হলো {classification}।",
        "dispute_none": "সার্ভে নম্বর {survey}-এ কোনো বিরোধ বা অমিল নথিভুক্ত নেই।",
        "dispute_found": "সার্ভে নম্বর {survey}-এ অমিল বা পর্যালোচনা বিচারাধীন রয়েছে।",
        "status_map": {
            "validated": "যাচাই ও অনুমোদিত",
            "pending_review": "পর্যালোচনাধীন",
            "rejected": "বাতিল",
            "processing": "ডিজিটাইজেশন প্রক্রিয়ায় রয়েছে",
        }
    },
    "ta": {
        "no_survey": "நில பதிவை சரிபார்க்க தயவுசெய்து சர்வே எண்ணைக் குறிப்பிடவும்.",
        "not_found": "சர்வே எண் {survey}-க்கு எந்த பதிவும் கிடைக்கவில்லை.",
        "status": "சர்வே எண் {survey} தற்போது {status} நிலையில் உள்ளது.",
        "owner": "சர்வே எண் {survey} {owner} அவர்களின் பெயரில் பதிவு செய்யப்பட்டுள்ளது.",
        "classification": "சர்வே எண் {survey}-ன் நில வகைப்பாடு {classification} ஆகும்.",
        "dispute_none": "சர்வே எண் {survey}-ல் எந்த சர்ச்சையும் அல்லது முரண்பாடும் பதிவாகவில்லை.",
        "dispute_found": "சர்வே எண் {survey} மறுபரிசீலனையில் உள்ளது.",
        "status_map": {
            "validated": "சரிபார்க்கப்பட்டு அங்கீகரிக்கப்பட்டது",
            "pending_review": "அதிகாரிகளின் பரிசீலனையில்",
            "rejected": "நிராகரிக்கப்பட்டது",
            "processing": "செயல்பாட்டில் உள்ளது",
        }
    },
    "te": {
        "no_survey": "భూమి రికార్డును తనిఖీ చేయడానికి దయచేసి సర్వే నంబర్ చెప్పండి.",
        "not_found": "సర్వే నంబర్ {survey} కొరకు ఎటువంటి డిజిటల్ రికార్డు కనుగొనబడలేదు.",
        "status": "సర్వే నంబర్ {survey} ప్రస్తుతం {status} స్థితిలో ఉంది.",
        "owner": "సర్వే నంబర్ {survey} {owner} పేరిట నమోదు చేయబడింది.",
        "classification": "సర్వే నంబర్ {survey} భూమి వర్గీకరణ {classification}.",
        "dispute_none": "సర్వే నంబర్ {survey} పై ఎటువంటి వివాదం లేదా వ్యత్యాసం నమోదు కాలేదు.",
        "dispute_found": "సర్వే నంబర్ {survey} పునఃసమీక్షలో ఉంది.",
        "status_map": {
            "validated": "ధృవీకరించబడి ఆమోదించబడింది",
            "pending_review": "అధికారుల పరిశీలనలో ఉంది",
            "rejected": "తిరస్కరించబడింది",
            "processing": "డిజిటలైజేషన్ జరుగుతోంది",
        }
    },
}


def clean_display_value(val: Optional[str]) -> str:
    if not val or val.strip().lower() in ("none", "null", "n/a"):
        return "Not Specified"
    cleaned = re.split(r"(?:Plot Extent|Area|Village|Gram|Tehsil|Mutation)", val, flags=re.IGNORECASE)[0]
    cleaned = re.sub(r"^[/:\s\-]+", "", cleaned).strip()
    return cleaned if cleaned else val.strip()


def compose_spoken_response(
    lang: str,
    query_type: str,
    survey_number: Optional[str],
    record: Optional[Record],
) -> str:
    templates = RESPONSES.get(lang, RESPONSES["en"])

    if not survey_number:
        return templates["no_survey"]

    if not record:
        return templates["not_found"].format(survey=survey_number)

    fields_map = {
        rf.field_name: get_effective_field_value(rf) for rf in record.fields
    }
    owner = clean_display_value(fields_map.get("owner_name"))
    classification = clean_display_value(fields_map.get("land_classification"))
    
    # Map status
    status_key = record.status or "processing"
    status_str = templates["status_map"].get(status_key, status_key)

    # Check dispute/discrepancy
    has_dispute = (
        record.spatial_consistency == "DISCREPANCY"
        or record.status == "rejected"
        or any(not v.passed for v in record.validations)
    )

    if query_type == "owner":
        if owner != "Not Specified":
            return templates["owner"].format(survey=survey_number, owner=owner)
        else:
            return templates["status"].format(survey=survey_number, status=status_str)

    elif query_type == "classification":
        if classification != "Not Specified":
            return templates["classification"].format(survey=survey_number, classification=classification)
        else:
            return templates["status"].format(survey=survey_number, status=status_str)

    elif query_type == "dispute":
        if has_dispute:
            return templates["dispute_found"].format(survey=survey_number)
        else:
            return templates["dispute_none"].format(survey=survey_number)

    else:  # status / general
        return templates["status"].format(survey=survey_number, status=status_str)


@router.post("/voice-query")
def process_voice_query(
    body: VoiceQueryRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Public voice query endpoint for citizens.
    Takes transcribed speech text and language, parses the lookup intent via strict LLM schema,
    queries real database records, and returns public-safe facts with a localized spoken response.
    """
    check_rate_limit(request)

    lang = (body.language or "en").lower().strip()
    if lang not in RESPONSES:
        lang = "en"

    query_text = (body.query_text or "").strip()
    
    # 1. Parse query into lookup intent
    if body.survey_number_override:
        survey_number = normalize_indic_numerals(body.survey_number_override.strip())
        parsed = parse_query_with_regex_fallback(query_text)
        query_type = parsed["query_type"]
    else:
        parsed = call_llm_parser(query_text)
        survey_number = parsed.get("survey_number")
        query_type = parsed.get("query_type", "status")

    # 2. Database lookup
    record = None
    if survey_number:
        record = query_real_record(survey_number, db)

    # 3. Formulate spoken answer in query language
    spoken_answer = compose_spoken_response(lang, query_type, survey_number, record)

    # 4. Filter public-safe facts ONLY
    record_data = None
    if record:
        fields_map = {rf.field_name: get_effective_field_value(rf) for rf in record.fields}
        has_dispute = (
            record.spatial_consistency == "DISCREPANCY"
            or record.status == "rejected"
            or any(not v.passed for v in record.validations)
        )
        record_data = {
            "record_id": str(record.id),
            "survey_number": survey_number,
            "status": record.status,
            "owner_name": clean_display_value(fields_map.get("owner_name")),
            "land_classification": clean_display_value(fields_map.get("land_classification")),
            "village": clean_display_value(fields_map.get("village")),
            "district": clean_display_value(fields_map.get("district")),
            "has_dispute": has_dispute,
            "dispute_status": "Discrepancy recorded" if has_dispute else "Clear - No dispute",
        }

    return {
        "query_text": query_text,
        "language": lang,
        "parsed": {
            "survey_number": survey_number,
            "query_type": query_type,
        },
        "record_found": record is not None,
        "data": record_data,
        "spoken_response": spoken_answer,
    }
