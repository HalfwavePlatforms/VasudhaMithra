from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models.db_models import Record, RecordField, ValidationResult

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    total = db.query(Record).count()
    pending = db.query(Record).filter(Record.status == "pending_review").count()
    errors = db.query(ValidationResult).filter(ValidationResult.passed == False).count()  # noqa: E712

    avg_conf_row = db.query(func.avg(RecordField.confidence)).scalar()
    avg_conf = round(float(avg_conf_row), 3) if avg_conf_row is not None else 0.0

    by_district = (
        db.query(RecordField.field_value, func.count(func.distinct(RecordField.record_id)))
        .filter(RecordField.field_name == "district", RecordField.field_value.isnot(None))
        .group_by(RecordField.field_value)
        .all()
    )

    return {
        "total_processed": total,
        "avg_extraction_accuracy": avg_conf,
        "pending_review_count": pending,
        "error_count": errors,
        "by_district": {district: count for district, count in by_district},
    }
