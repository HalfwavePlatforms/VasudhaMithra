"""
Migration 007: Add village_lgd_code column to records table
Revision ID: 007_add_village_lgd_code
Revises: 006_add_hash_input_ts
Create Date: 2026-09-10
"""
from alembic import op
import sqlalchemy as sa

revision = "007_add_village_lgd_code"
down_revision = "006_add_hash_input_ts"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column(
        "records",
        sa.Column("village_lgd_code", sa.String(), nullable=True)
    )

def downgrade():
    op.drop_column("records", "village_lgd_code")
