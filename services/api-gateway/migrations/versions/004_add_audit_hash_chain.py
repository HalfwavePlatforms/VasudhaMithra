"""
Migration 004: Add prev_hash and curr_hash columns to audit_log table
Revision ID: 004_add_audit_hash_chain
Revises: 003_add_state_column
Create Date: 2026-09-08
"""
from alembic import op
import sqlalchemy as sa

revision = "004_add_audit_hash_chain"
down_revision = "003_add_state_column"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column(
        "audit_log",
        sa.Column("prev_hash", sa.String(), nullable=True)
    )
    op.add_column(
        "audit_log",
        sa.Column("curr_hash", sa.String(), nullable=True)
    )

def downgrade():
    op.drop_column("audit_log", "curr_hash")
    op.drop_column("audit_log", "prev_hash")
