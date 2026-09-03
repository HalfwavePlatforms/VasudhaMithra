import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function App() {
  const [stats, setStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  function loadData() {
    fetch(`${API_BASE}/dashboard/stats`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load stats: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setStats(data);
        setLastRefreshed(new Date());
      })
      .catch((e) => setError(e.message));

    fetch(`${API_BASE}/dashboard/audit-trail?limit=15`)
      .then((res) => (res.ok ? res.json() : { audit_logs: [] }))
      .then((data) => setAuditLogs(data.audit_logs || []))
      .catch(() => {});
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 6000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div style={{ padding: 32, fontFamily: "Inter, sans-serif" }}>
        <div style={{ backgroundColor: "#FEE2E2", color: "#991B1B", padding: 16, borderRadius: 6 }}>
          <strong>Error connecting to API Gateway:</strong> {error}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ padding: 48, textAlign: "center", fontFamily: "Inter, sans-serif", color: "#4B5563" }}>
        Loading VasudhaMithra Intelligence Analytics...
      </div>
    );
  }

  const verifiedPct = stats.total_processed > 0 ? Math.round((stats.verified_count / stats.total_processed) * 100) : 0;

  return (
    <div style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", backgroundColor: "#F4F6F9", minHeight: "100vh", color: "#1F2937" }}>
      {/* Gov Top Banner */}
      <header style={{ backgroundColor: "#0B3B60", color: "#FFFFFF", padding: "12px 24px", borderBottom: "4px solid #D97706" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: "50%", backgroundColor: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", color: "#0B3B60", fontWeight: 900, fontSize: 20 }}>
              🏛️
            </div>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: "#FCD34D", fontWeight: 700 }}>
                Digital India Land Records Modernization Programme (DILRMP)
              </div>
              <h1 style={{ fontSize: 20, margin: 0, fontWeight: 700 }}>
                VasudhaMithra — National Digitization & Cadastral Intelligence Analytics
              </h1>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 11, color: "#D1D5DB" }}>
              Live Polling (Synced: {lastRefreshed.toLocaleTimeString()})
            </span>
            <a
              href="http://localhost:3000"
              target="_blank"
              rel="noreferrer"
              style={{ backgroundColor: "#D97706", color: "#FFF", padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, textDecoration: "none" }}
            >
              📥 Open Upload & Review Portal
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 24px" }}>
        {/* KPI Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>
          <KPICard
            label="Total Digitized Records"
            value={stats.total_processed}
            sub="Across all tehsils"
            color="#0B3B60"
          />
          <KPICard
            label="Certified & Validated"
            value={stats.verified_count || 0}
            sub={`${verifiedPct}% conversion rate`}
            color="#059669"
          />
          <KPICard
            label="Pending Officer Review"
            value={stats.pending_review_count}
            sub="Backlog queue"
            color="#D97706"
          />
          <KPICard
            label="Spatial Discrepancies"
            value={stats.spatial_discrepancy_count || 0}
            sub="Deed vs GIS conflict (>5%)"
            color="#DC2626"
            highlight={stats.spatial_discrepancy_count > 0}
          />
          <KPICard
            label="Avg. Extraction Accuracy"
            value={`${(stats.avg_extraction_accuracy * 100).toFixed(1)}%`}
            sub="Optical character match"
            color="#2563EB"
          />
        </div>

        {/* 2-Column Analytics Section */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
          {/* District Breakdown */}
          <div style={{ backgroundColor: "#FFFFFF", padding: 20, borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0B3B60", margin: "0 0 16px 0" }}>
              📍 Digitization by Revenue District
            </h2>
            {Object.keys(stats.by_district || {}).length === 0 ? (
              <div style={{ color: "#9CA3AF", fontSize: 13 }}>No district data yet</div>
            ) : (
              <div>
                {Object.entries(stats.by_district).map(([district, count]) => {
                  const pct = Math.round((count / Math.max(1, stats.total_processed)) * 100);
                  return (
                    <div key={district} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{district}</span>
                        <span style={{ color: "#6B7280" }}>{count} records ({pct}%)</span>
                      </div>
                      <div style={{ backgroundColor: "#E5E7EB", height: 8, borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, backgroundColor: "#0B3B60", height: "100%", borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Land Classification & Document Type Breakdown */}
          <div style={{ backgroundColor: "#FFFFFF", padding: 20, borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0B3B60", margin: "0 0 16px 0" }}>
              🌾 Land Classification & Document Types
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#4B5563", marginBottom: 8, textTransform: "uppercase" }}>
                  Land Classification
                </div>
                {Object.entries(stats.by_classification || {}).map(([cls, count]) => (
                  <div key={cls} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid #F3F4F6" }}>
                    <span>{cls}</span>
                    <span style={{ fontWeight: 700, color: "#0B3B60" }}>{count}</span>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#4B5563", marginBottom: 8, textTransform: "uppercase" }}>
                  Document Categories
                </div>
                {Object.entries(stats.by_doc_type || {}).map(([dtype, count]) => (
                  <div key={dtype} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid #F3F4F6" }}>
                    <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: 160 }}>{dtype}</span>
                    <span style={{ fontWeight: 700, color: "#059669" }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Live Immutable Audit Log Table */}
        <div style={{ backgroundColor: "#FFFFFF", padding: 20, borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0B3B60", margin: 0 }}>
                🛡️ Live System Audit Trail (Tamper-evident Event Ledger)
              </h2>
              <p style={{ fontSize: 12, color: "#6B7280", margin: "2px 0 0 0" }}>
                Records provenance of every ingestion, OCR extraction, spatial validation, and human review decision.
              </p>
            </div>
            <button
              onClick={loadData}
              style={{ backgroundColor: "#F3F4F6", border: "1px solid #D1D5DB", padding: "5px 12px", borderRadius: 4, fontSize: 12, cursor: "pointer", fontWeight: 600 }}
            >
              ⟳ Refresh Log
            </button>
          </div>

          {auditLogs.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>No audit logs recorded yet.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "2px solid #E2E8F0", textAlign: "left", color: "#475569" }}>
                  <th style={{ padding: "8px 12px" }}>Timestamp (UTC)</th>
                  <th style={{ padding: "8px 12px" }}>Action</th>
                  <th style={{ padding: "8px 12px" }}>Actor / Role</th>
                  <th style={{ padding: "8px 12px" }}>Record ID</th>
                  <th style={{ padding: "8px 12px" }}>Audit Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "8px 12px", color: "#64748B", fontFamily: "monospace" }}>
                      {log.created_at ? new Date(log.created_at).toLocaleTimeString() : "—"}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ backgroundColor: "#EFF6FF", color: "#1E40AF", padding: "2px 6px", borderRadius: 4, fontWeight: 700, fontSize: 10 }}>
                        {log.action?.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px", fontWeight: 600, color: "#374151" }}>{log.actor || "System"}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "#0B3B60" }}>
                      {log.record_id ? log.record_id.slice(0, 8) : "—"}
                    </td>
                    <td style={{ padding: "8px 12px", color: "#6B7280", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, sub, color, highlight }) {
  return (
    <div
      style={{
        backgroundColor: highlight ? "#FEF2F2" : "#FFFFFF",
        border: highlight ? "2px solid #DC2626" : "1px solid #E5E7EB",
        borderRadius: 8,
        padding: "16px 14px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 800, color: color, marginBottom: 2 }}>{value}</div>
      <div style={{ color: "#374151", fontSize: 13, fontWeight: 700 }}>{label}</div>
      <div style={{ color: "#9CA3AF", fontSize: 11, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

