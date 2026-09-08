"""
Migration 005: Add correction_logs table for AI learning mechanism feedback loop
Revision ID: 005_add_correction_log
Revises: 004_add_audit_hash_chain
Create Date: 2026-09-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "005_add_correction_log"
down_revision = "004_add_audit_hash_chain"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "correction_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("record_id", UUID(as_uuid=True), sa.ForeignKey("records.id", ondelete="CASCADE"), nullable=True),
        sa.Column("field_name", sa.String(), nullable=False),
        sa.Column("document_type", sa.String(), nullable=True),
        sa.Column("language", sa.String(), nullable=True),
        sa.Column("original_value", sa.String(), nullable=True),
        sa.Column("original_confidence", sa.Float(), nullable=True),
        sa.Column("corrected_value", sa.String(), nullable=True),
        sa.Column("corrected_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_correction_logs_field_doc_lang", "correction_logs", ["field_name", "document_type", "language"])

def downgrade():
    op.drop_index("ix_correction_logs_field_doc_lang", table_name="correction_logs")
    op.drop_table("correction_logs")
