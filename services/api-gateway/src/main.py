"""
API Gateway.
Owns: the database, and orchestration of calls to ocr-pipeline and
extraction-engine. This is the ONLY service the frontends talk to.
Contract: see docs/api-contracts.md — section 3.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine
from models.db_models import Base
from routes import records, dashboard

app = FastAPI(title="API Gateway")

# Ensure all database tables are created
try:
    Base.metadata.create_all(bind=engine)
except Exception:
    pass

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to your deployed frontend origin(s) before real deploy
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(records.router)
app.include_router(dashboard.router)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


from fastapi.responses import HTMLResponse
from sqlalchemy import text


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/db-view", response_class=HTMLResponse)
def database_viewer():
    """Visual interactive browser for PostgreSQL land_records database."""
    with engine.connect() as conn:
        records_rows = conn.execute(text("SELECT id, original_filename, status, document_type, language, ocr_confidence, risk_level, spatial_consistency, uploaded_at FROM records ORDER BY uploaded_at DESC NULLS LAST LIMIT 50")).fetchall()
        fields_rows = conn.execute(text("SELECT record_id, field_name, field_value, confidence, was_corrected FROM record_fields ORDER BY record_id LIMIT 100")).fetchall()
        audit_rows = conn.execute(text("SELECT id, record_id, action, actor, details, created_at FROM audit_log ORDER BY created_at DESC NULLS LAST LIMIT 50")).fetchall()
        pg_ver = conn.execute(text("SELECT version()")).scalar()


    def make_table(headers, rows):
        th_html = "".join(f"<th style='padding:10px 12px;background:#0B3B60;color:white;text-align:left;font-size:12px;'>{h}</th>" for h in headers)
        tr_html = ""
        for i, r in enumerate(rows):
            bg = "#FFFFFF" if i % 2 == 0 else "#F8FAFC"
            tds = "".join(f"<td style='padding:8px 12px;border-bottom:1px solid #E2E8F0;font-size:12px;color:#1E293B;'>{v if v is not None else '<span style=\"color:#94A3B8;\">null</span>'}</td>" for v in r)
            tr_html += f"<tr style='background:{bg};'>{tds}</tr>"
        return f"<div style='overflow-x:auto;border:1px solid #CBD5E1;border-radius:6px;'><table style='width:100%;border-collapse:collapse;'><thead><tr>{th_html}</tr></thead><tbody>{tr_html}</tbody></table></div>"

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>VasudhaMithra — PostgreSQL Database Visualizer</title>
        <meta charset='utf-8'/>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; background: #F1F5F9; color: #0F172A; }}
            .header {{ background: #0B3B60; color: white; padding: 18px 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
            .content {{ max-width: 1400px; margin: 24px auto; padding: 0 24px; }}
            .card {{ background: white; border-radius: 8px; border: 1px solid #E2E8F0; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }}
            .badge {{ display: inline-block; padding: 4px 10px; border-radius: 999px; font-weight: 600; font-size: 11px; }}
            .badge-green {{ background: #DCFCE7; color: #166534; }}
            .tab-btn {{ padding: 10px 20px; border: 1px solid #CBD5E1; background: #F8FAFC; border-radius: 6px; font-weight: 600; cursor: pointer; margin-right: 8px; font-size: 13px; }}
            .tab-btn.active {{ background: #0B3B60; color: white; border-color: #0B3B60; }}
        </style>
    </head>
    <body>
        <div class='header'>
            <div style='display:flex; justify-content:space-between; align-items:center;'>
                <div>
                    <h1 style='margin:0; font-size:20px; font-weight:700;'>🐘 PostgreSQL Visual Database Explorer</h1>
                    <div style='font-size:12px; color:#93C5FD; margin-top:4px;'>Connected to local host: <strong>postgresql://postgres:postgres@localhost:5433/land_records</strong></div>
                </div>
                <div style='text-align:right;'>
                    <span class='badge badge-green'>● PostgreSQL 18 Connected</span>
                </div>
            </div>
        </div>
        <div class='content'>
            <div class='card' style='display:flex; justify-content:space-between; align-items:center;'>
                <div>
                    <strong>Engine Details:</strong> <span style='font-size:12px; color:#475569;'>{pg_ver.split(',')[0]}</span>
                </div>
                <div>
                    <a href='http://localhost:3000' style='background:#D97706; color:white; padding:8px 16px; border-radius:6px; text-decoration:none; font-size:13px; font-weight:600; margin-right:8px;'>Open Upload Portal ↗</a>
                    <a href='http://localhost:3001' style='background:#0284C7; color:white; padding:8px 16px; border-radius:6px; text-decoration:none; font-size:13px; font-weight:600;'>Open Dashboard ↗</a>
                </div>
            </div>

            <div style='margin-bottom:16px;'>
                <button class='tab-btn active' onclick='showTab("tab-records", this)'>📄 Table: records ({len(records_rows)} rows)</button>
                <button class='tab-btn' onclick='showTab("tab-fields", this)'>📋 Table: record_fields ({len(fields_rows)} rows)</button>
                <button class='tab-btn' onclick='showTab("tab-audit", this)'>🔒 Table: audit_log ({len(audit_rows)} rows)</button>
            </div>

            <div id='tab-records' class='card tab-content'>
                <h3 style='margin:0 0 12px 0; color:#0B3B60;'>Table: records</h3>
                {make_table(["ID", "Original Filename", "Status", "Document Type", "Language", "Confidence", "Risk Level", "Spatial Consistency", "Created At"], records_rows)}
            </div>

            <div id='tab-fields' class='card tab-content' style='display:none;'>
                <h3 style='margin:0 0 12px 0; color:#0B3B60;'>Table: record_fields</h3>
                {make_table(["Record ID", "Field Name", "Field Value", "Confidence", "Is Corrected"], fields_rows)}
            </div>

            <div id='tab-audit' class='card tab-content' style='display:none;'>
                <h3 style='margin:0 0 12px 0; color:#0B3B60;'>Table: audit_log</h3>
                {make_table(["ID", "Record ID", "Action", "Actor", "Timestamp"], audit_rows)}
            </div>
        </div>

        <script>
            function showTab(id, btn) {{
                document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
                document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
                document.getElementById(id).style.display = 'block';
                btn.classList.add('active');
            }}
        </script>
    </body>
    </html>
    """
    return html


