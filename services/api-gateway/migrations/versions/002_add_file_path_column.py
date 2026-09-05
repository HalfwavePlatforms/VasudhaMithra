"""
Migration 002: Add file_path column to records table
Revision ID: 002_add_file_path_column
Revises: 001_add_geom_column
Create Date: 2026-09-05
"""
from alembic import op
import sqlalchemy as sa

revision = "002_add_file_path_column"
down_revision = "001_add_geom_column"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column(
        "records",
        sa.Column("file_path", sa.String(), nullable=True)
    )

def downgrade():
    op.drop_column("records", "file_path")
