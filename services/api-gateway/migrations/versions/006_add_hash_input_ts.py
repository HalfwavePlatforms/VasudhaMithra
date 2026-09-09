"""
Migration 006: Add hash_input_ts column to audit_log table
Revision ID: 006_add_hash_input_ts
Revises: 005_add_correction_log
Create Date: 2026-09-09
"""
from alembic import op
import sqlalchemy as sa

revision = "006_add_hash_input_ts"
down_revision = "005_add_correction_log"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column(
        "audit_log",
        sa.Column("hash_input_ts", sa.String(), nullable=True)
    )

def downgrade():
    op.drop_column("audit_log", "hash_input_ts")
