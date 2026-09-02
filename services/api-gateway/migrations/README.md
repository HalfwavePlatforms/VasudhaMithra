# Migrations

For the hackathon, `Base.metadata.create_all()` in main.py handles table creation
directly — good enough for a 36-hour build with one DB instance.

If this grows past the hackathon, switch to real Alembic migrations:
```bash
pip install alembic
alembic init migrations
# then generate migrations from model changes:
alembic revision --autogenerate -m "description"
alembic upgrade head
```
