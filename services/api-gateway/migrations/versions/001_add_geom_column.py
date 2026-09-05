"""
Migration 001: Add geom column to records table
Revision ID: 001_add_geom_column
Revises: None
Create Date: 2026-09-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001_add_geom_column"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.add_column(
        "records",
        sa.Column("geom", postgresql.JSON(astext_type=sa.Text()), nullable=True)
    )

def downgrade():
    op.drop_column("records", "geom")
