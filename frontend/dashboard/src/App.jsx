import React, { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function App() {
  const [stats, setStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = () => {
    fetch(`${API_BASE}/dashboard/stats`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setStats(data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    fetch(`${API_BASE}/dashboard/audit-trail?limit=10`)
      .then((res) => (res.ok ? res.json() : { audit_logs: [] }))
      .then((data) => setAuditLogs(data.audit_logs || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  const totalProcessed = stats?.total_processed || 0;
  const pendingCount = stats?.pending_review_count || 0;
  const accuracyPct = stats?.avg_extraction_accuracy
    ? (stats.avg_extraction_accuracy * 100).toFixed(1)
    : "0.0";
  const discrepancyCount = stats?.spatial_discrepancy_count || 0;
  const byDistrict = stats?.by_district || {};
  const byDocType = stats?.by_doc_type || {};

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--color-bg-primary)", color: "var(--color-text-primary)" }}>
      {/* Sidebar matching visual system */}
      <aside style={{ width: 260, backgroundColor: "var(--color-sidebar-bg)", color: "var(--color-sidebar-text)", display: "flex", flexDirection: "column", height: "100vh", position: "fixed", left: 0, top: 0, borderRight: "1px solid var(--color-sidebar-border)" }}>
        {/* Logo */}
        <div style={{ padding: "20px", borderBottom: "1px solid var(--color-sidebar-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative", width: 32, height: 32 }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: 20, height: 20, backgroundColor: "var(--color-info)", borderRadius: 4 }} />
              <div style={{ position: "absolute", bottom: 0, right: 0, width: 20, height: 20, backgroundColor: "var(--color-accent)", borderRadius: 4, opacity: 0.9 }} />
            </div>
            <div>
              <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, fontWeight: "bold", color: "#FFFFFF", lineHeight: 1.2 }}>
                VasudhaMithra
              </h1>
              <p style={{ color: "var(--color-sidebar-muted)", fontSize: 11, fontWeight: 500 }}>
                भूमि अभिलेख प्रणाली
              </p>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <div style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: "var(--color-sidebar-icon)", padding: "0 12px 8px" }}>
            OPERATIONS
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, backgroundColor: "var(--color-sidebar-active)", color: "#FFFFFF", fontSize: 13, fontWeight: 600, border: "1px solid var(--color-sidebar-border)" }}>
              <span>⊞ Command centre</span>
              <span style={{ fontSize: 10, backgroundColor: "var(--color-accent)", color: "#FFFFFF", padding: "2px 6px", borderRadius: 10 }}>Live</span>
            </div>

            <a href="http://localhost:3000" target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, color: "var(--color-sidebar-muted)", fontSize: 13, fontWeight: 500 }}>
              <span>↑ Document intake</span>
              <span style={{ fontSize: 10, color: "var(--color-sidebar-icon)" }}>Portal ↗</span>
            </a>

            <a href="http://localhost:3000" target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, color: "var(--color-sidebar-muted)", fontSize: 13, fontWeight: 500 }}>
              <span>✓ Verification desk</span>
              {pendingCount > 0 && (
                <span style={{ fontSize: 11, fontWeight: "bold", backgroundColor: "var(--color-accent)", color: "#FFFFFF", padding: "1px 6px", borderRadius: 10 }}>
                  {pendingCount}
                </span>
              )}
            </a>

            <a href="http://localhost:3000" target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, color: "var(--color-sidebar-muted)", fontSize: 13, fontWeight: 500 }}>
              <span>📄 Land records</span>
              <span style={{ fontSize: 10, color: "var(--color-sidebar-icon)" }}>Master</span>
            </a>

            <a href="http://localhost:3000" target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, color: "var(--color-sidebar-muted)", fontSize: 13, fontWeight: 500 }}>
              <span>🗺 GIS & parcels</span>
              {discrepancyCount > 0 && (
                <span style={{ fontSize: 10, backgroundColor: "var(--color-accent-subtle)", color: "var(--color-accent)", border: "1px solid var(--color-border)", padding: "1px 6px", borderRadius: 10 }}>
                  {discrepancyCount} alert
                </span>
              )}
            </a>
          </div>
        </div>

        {/* Status widget */}
        <div style={{ padding: 12, borderTop: "1px solid var(--color-sidebar-border)", backgroundColor: "var(--color-sidebar-bg)" }}>
          <div style={{ backgroundColor: "var(--color-sidebar-hover)", border: "1px solid var(--color-sidebar-border)", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-sidebar-text)" }}>● Systems operational</span>
              <span style={{ fontSize: 10, color: "var(--color-sidebar-muted)" }}>Port 3001</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--color-sidebar-icon)", marginTop: 6, borderTop: "1px solid var(--color-sidebar-border)", paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
              <span>NIC Cloud · Bengaluru</span>
              <span style={{ fontFamily: "monospace" }}>v2.4.0</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div style={{ flex: 1, marginLeft: 260, display: "flex", flexDirection: "column" }}>
        {/* Top Header Bar */}
        <header style={{ height: 64, backgroundColor: "var(--color-bg-primary)", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", position: "sticky", top: 0, zIndex: 10 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "1px", color: "var(--color-text-muted)", textTransform: "uppercase" }}>
              KARNATAKA / REVENUE DEPARTMENT
            </div>
            <div style={{ fontSize: 16, fontWeight: "bold", color: "var(--color-text-primary)" }}>
              Command centre
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <a
              href="http://localhost:3000"
              style={{ textDecoration: "none", padding: "8px 14px", backgroundColor: "var(--color-sidebar-bg)", color: "var(--color-text-light)", borderRadius: 8, fontSize: 12, fontWeight: 600 }}
            >
              Open Full Upload & Verification Portal ↗
            </a>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "var(--color-sidebar-bg)", color: "var(--color-text-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: "bold", fontFamily: "serif" }}>
                DG
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>Deepak G.M.</div>
                <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>District Admin</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content View */}
        <main style={{ padding: 32, maxWidth: 1200, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          {error && (
            <div style={{ padding: 16, backgroundColor: "var(--color-error-bg)", color: "var(--color-error)", borderRadius: 12, border: "1px solid var(--color-error-border)", marginBottom: 24, fontSize: 13 }}>
              <strong>API Connection Issue:</strong> {error}. Ensure API Gateway is running on port 8000.
            </div>
          )}

          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <span style={{ fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px", color: "var(--color-accent)" }}>
              DIGITIZATION OVERVIEW
            </span>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, fontWeight: "bold", color: "var(--color-text-primary)", marginTop: 4 }}>
              Good morning, Deepak.
            </h2>
            <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 4 }}>
              Here's what needs attention across your land record operations today.
            </p>
          </div>

          {/* Alert Banner */}
          {pendingCount > 0 && (
            <div style={{ backgroundColor: "var(--color-accent-subtle)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "var(--color-accent)", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                  ✦
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: "bold", color: "var(--color-text-primary)" }}>
                    {pendingCount} records need verification
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                    AI confidence below threshold or flagged for revenue officer review.
                  </div>
                </div>
              </div>

              <a
                href="http://localhost:3000"
                style={{ textDecoration: "none", fontSize: 12, fontWeight: "bold", color: "var(--color-accent)" }}
              >
                Open verification desk →
              </a>
            </div>
          )}

          {/* 4 Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 32 }}>
            {/* Card 1: Records */}
            <div style={{ backgroundColor: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.5px" }}>
                Records digitized
              </div>
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, fontWeight: "bold", color: "var(--color-text-primary)", marginTop: 12 }}>
                {totalProcessed.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-success)", fontWeight: 500, marginTop: 4 }}>
                ● Live database records
              </div>
            </div>

            {/* Card 2: Accuracy */}
            <div style={{ backgroundColor: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.5px" }}>
                Field accuracy
              </div>
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, fontWeight: "bold", color: "var(--color-text-primary)", marginTop: 12 }}>
                {accuracyPct}%
              </div>
              <div style={{ fontSize: 12, color: "var(--color-success)", fontWeight: 500, marginTop: 4 }}>
                Optical token derived
              </div>
            </div>

            {/* Card 3: Spatial Discrepancies */}
            <div style={{ backgroundColor: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.5px" }}>
                Spatial discrepancies
              </div>
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, fontWeight: "bold", color: "var(--color-text-primary)", marginTop: 12 }}>
                {discrepancyCount}
              </div>
              <div style={{ fontSize: 12, color: discrepancyCount > 0 ? "var(--color-accent)" : "var(--color-success)", fontWeight: 500, marginTop: 4 }}>
                {discrepancyCount > 0 ? "Flagged for parcel survey" : "All boundaries consistent"}
              </div>
            </div>

            {/* Card 4: Dark Pending Card */}
            <div style={{ backgroundColor: "var(--color-sidebar-bg)", color: "var(--color-text-light)", borderRadius: 12, padding: 20, border: "1px solid var(--color-sidebar-border)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--color-sidebar-muted)", letterSpacing: "0.5px" }}>
                Pending validation
              </div>
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, fontWeight: "bold", color: "var(--color-text-light)", marginTop: 12 }}>
                {pendingCount}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-accent)", fontWeight: 600, marginTop: 8 }}>
                <a href="http://localhost:3000" style={{ color: "var(--color-accent)", textDecoration: "none" }}>
                  Review queue →
                </a>
              </div>
            </div>
          </div>

          {/* Activity & Coverage */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
            {/* Recent Activity */}
            <div style={{ backgroundColor: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 10, fontWeight: "bold", textTransform: "uppercase", color: "var(--color-accent)", letterSpacing: "0.5px" }}>
                LATEST ACTIVITY
              </div>
              <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, fontWeight: "bold", color: "var(--color-text-primary)", marginTop: 2, marginBottom: 16 }}>
                Recent audit events
              </h3>

              {auditLogs && auditLogs.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {auditLogs.slice(0, 5).map((l) => (
                    <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid var(--color-border-subtle)", fontSize: 12 }}>
                      <div>
                        <span style={{ fontWeight: 600, backgroundColor: "var(--color-success-bg)", color: "var(--color-success)", border: "1px solid var(--color-success-border)", padding: "2px 8px", borderRadius: 9999, marginRight: 8, fontSize: 11 }}>
                          {l.action}
                        </span>
                        <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>
                          {l.record_id ? `Record: ${l.record_id.slice(0, 8)}...` : "System Event"}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                        {l.actor || "System"} · {l.created_at ? new Date(l.created_at).toLocaleTimeString() : ""}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", padding: "16px 0" }}>
                  No recent audit events logged.
                </div>
              )}
            </div>

            {/* Coverage */}
            <div style={{ backgroundColor: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 10, fontWeight: "bold", textTransform: "uppercase", color: "var(--color-accent)", letterSpacing: "0.5px" }}>
                COVERAGE
              </div>
              <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, fontWeight: "bold", color: "var(--color-text-primary)", marginTop: 2, marginBottom: 16 }}>
                District records
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {Object.entries(byDistrict).slice(0, 5).map(([dist, count]) => {
                  const safeName = dist.replace(/[()]/g, "").slice(0, 16);
                  const pct = totalProcessed > 0 ? Math.round((count / totalProcessed) * 100) : 0;
                  return (
                    <div key={dist}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                        <span>{safeName}</span>
                        <span style={{ color: "var(--color-text-muted)" }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ width: "100%", height: 6, backgroundColor: "var(--color-bg-tertiary)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "var(--color-success)", borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
