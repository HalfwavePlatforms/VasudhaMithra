"""
Migration 003: Add state column to records table
Revision ID: 003_add_state_column
Revises: 002_add_file_path_column
Create Date: 2026-09-05
"""
from alembic import op
import sqlalchemy as sa

revision = "003_add_state_column"
down_revision = "002_add_file_path_column"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column(
        "records",
        sa.Column("state", sa.String(), nullable=True, server_default="Madhya Pradesh")
    )

def downgrade():
    op.drop_column("records", "state")
