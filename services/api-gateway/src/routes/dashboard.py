from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models.db_models import AuditLog, Record, RecordField, ValidationResult

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    total = db.query(Record).count()
    pending = db.query(Record).filter(Record.status == "pending_review").count()
    verified = db.query(Record).filter(Record.status == "validated").count()
    rejected = db.query(Record).filter(Record.status == "rejected").count()
    errors = db.query(ValidationResult).filter(ValidationResult.passed == False).count()  # noqa: E712
    spatial_discrepancies = db.query(Record).filter(Record.spatial_consistency == "DISCREPANCY").count()

    avg_conf_row = db.query(func.avg(RecordField.confidence)).scalar()
    avg_conf = round(float(avg_conf_row), 3) if avg_conf_row is not None else 0.0

    by_district = (
        db.query(RecordField.field_value, func.count(func.distinct(RecordField.record_id)))
        .filter(RecordField.field_name == "district", RecordField.field_value.isnot(None))
        .group_by(RecordField.field_value)
        .all()
    )

    by_classification = (
        db.query(RecordField.field_value, func.count(func.distinct(RecordField.record_id)))
        .filter(RecordField.field_name == "land_classification", RecordField.field_value.isnot(None))
        .group_by(RecordField.field_value)
        .all()
    )

    by_doc_type = (
        db.query(Record.document_type, func.count(Record.id))
        .group_by(Record.document_type)
        .all()
    )

    return {
        "total_processed": total,
        "verified_count": verified,
        "pending_review_count": pending,
        "rejected_count": rejected,
        "error_count": errors,
        "spatial_discrepancy_count": spatial_discrepancies,
        "avg_extraction_accuracy": avg_conf,
        "by_district": {district: count for district, count in by_district},
        "by_classification": {cls: count for cls, count in by_classification},
        "by_doc_type": {dtype: count for dtype, count in by_doc_type if dtype},
    }


@router.get("/audit-trail")
def audit_trail(limit: int = 30, db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return {
        "total": len(logs),
        "audit_logs": [
            {
                "id": str(l.id),
                "record_id": str(l.record_id) if l.record_id else None,
                "action": l.action,
                "actor": l.actor,
                "details": l.details,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in logs
        ],
    }

