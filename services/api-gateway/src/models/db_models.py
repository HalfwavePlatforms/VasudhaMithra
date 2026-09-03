import uuid
from sqlalchemy import Column, String, Float, Boolean, ForeignKey, DateTime, JSON, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Record(Base):
    __tablename__ = "records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    original_filename = Column(String, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, nullable=False, default="processing")
    raw_ocr_text = Column(String)
    ocr_confidence = Column(Float)
    document_type = Column(String, default="Standard Land Record")
    language = Column(String, default="en")
    risk_level = Column(String, default="LOW")

    # Spatial Consistency Engine fields (Document <-> Data <-> GIS)
    parcel_id = Column(String)
    area_doc_acres = Column(Float)
    area_gis_acres = Column(Float)
    spatial_consistency = Column(String, default="NOT_EVALUATED")  # MATCH | DISCREPANCY | NOT_EVALUATED
    spatial_delta_pct = Column(Float)
    gis_geojson = Column(JSON)

    # Human Verification & Audit
    reviewer_notes = Column(String)
    reviewed_by = Column(String)
    reviewed_at = Column(DateTime(timezone=True))

    fields = relationship("RecordField", back_populates="record", cascade="all, delete-orphan")
    validations = relationship("ValidationResult", back_populates="record", cascade="all, delete-orphan")



class RecordField(Base):
    __tablename__ = "record_fields"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_id = Column(UUID(as_uuid=True), ForeignKey("records.id", ondelete="CASCADE"))
    field_name = Column(String, nullable=False)
    field_value = Column(String)
    confidence = Column(Float)
    was_corrected = Column(Boolean, default=False)
    corrected_value = Column(String)

    record = relationship("Record", back_populates="fields")


class ValidationResult(Base):
    __tablename__ = "validation_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_id = Column(UUID(as_uuid=True), ForeignKey("records.id", ondelete="CASCADE"))
    field_name = Column(String)
    rule = Column(String, nullable=False)
    passed = Column(Boolean, nullable=False)
    message = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    record = relationship("Record", back_populates="validations")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_id = Column(UUID(as_uuid=True), ForeignKey("records.id", ondelete="CASCADE"))
    action = Column(String, nullable=False)
    actor = Column(String)
    details = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
