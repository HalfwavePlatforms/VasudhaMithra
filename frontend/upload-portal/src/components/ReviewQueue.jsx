import React, { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function ReviewQueue({ onSelectRecord }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("pending_review");

  async function fetchQueue() {
    setLoading(true);
    setError(null);
    try {
      let url = `${API_BASE}/records`;
      if (statusFilter && statusFilter !== "all") {
        url += `?status=${statusFilter}`;
      }
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch records (${res.status} ${res.statusText})`);
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.records || []);
      setRecords(list);
    } catch (err) {
      console.error("Error fetching review queue:", err);
      setError(err.message || "Failed to fetch review queue from API Gateway.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchQueue();
  }, [statusFilter]);

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 24px", fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "var(--color-text-primary)" }}>
      {/* Header Banner */}
      <div style={{ backgroundColor: "var(--color-bg-secondary)", borderRadius: "12px", border: "1px solid var(--color-border)", padding: "24px", marginBottom: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ fontSize: "11px", letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--color-accent)", fontWeight: 700, marginBottom: "4px" }}>
              Revenue Department Human-in-the-Loop Desk
            </div>
            <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text-primary)", margin: 0, fontFamily: "serif" }}>
              Official Revenue Review & Triage Queue
            </h2>
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "4px 0 0 0" }}>
              Official revenue backlog requiring human verification, OCR validation, and cadastral GIS audit.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {[
              { id: "pending_review", label: "Pending Review" },
              { id: "validated", label: "Validated" },
              { id: "all", label: "All Records" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: statusFilter === tab.id ? "1px solid var(--color-sidebar-bg)" : "1px solid var(--color-border-strong)",
                  backgroundColor: statusFilter === tab.id ? "var(--color-sidebar-bg)" : "var(--color-bg-secondary)",
                  color: statusFilter === tab.id ? "var(--color-text-light)" : "var(--color-text-primary)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {tab.label}
              </button>
            ))}
            <button
              onClick={fetchQueue}
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid var(--color-border-strong)",
                backgroundColor: "var(--color-bg-tertiary)",
                color: "var(--color-text-primary)",
                cursor: "pointer",
                marginLeft: "4px"
              }}
              title="Refresh Queue"
            >
              ⟳ Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div style={{ backgroundColor: "var(--color-bg-secondary)", borderRadius: "12px", border: "1px solid var(--color-border)", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        {loading ? (
          <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "14px", fontWeight: 500 }}>
            ⏳ Loading review queue from API Gateway...
          </div>
        ) : error ? (
          <div style={{ padding: "20px", backgroundColor: "var(--color-error-bg)", border: "1px solid var(--color-error-border)", borderRadius: "8px", color: "var(--color-error)", fontSize: "13px" }}>
            <div style={{ fontWeight: 700, marginBottom: "4px" }}>⚠️ Error Loading Review Queue</div>
            <div>{error}</div>
            <div style={{ marginTop: "12px" }}>
              <button
                onClick={fetchQueue}
                style={{ backgroundColor: "var(--color-error)", color: "var(--color-text-light)", border: "none", padding: "6px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
              >
                Retry Request
              </button>
            </div>
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "14px" }}>
            No records pending review.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--color-bg-tertiary)", borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.5px" }}>
                  <th style={{ padding: "10px 14px" }}>Record ID</th>
                  <th style={{ padding: "10px 14px" }}>Filename</th>
                  <th style={{ padding: "10px 14px" }}>Document Type</th>
                  <th style={{ padding: "10px 14px" }}>Risk Level</th>
                  <th style={{ padding: "10px 14px" }}>Status</th>
                  <th style={{ padding: "10px 14px" }}>Uploaded At</th>
                  <th style={{ padding: "10px 14px" }}>OCR Confidence</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const riskUpper = (r.risk_level || "LOW").toUpperCase();
                  let riskStyle = { bg: "var(--color-success-bg)", text: "var(--color-success)", border: "var(--color-success-border)", label: "✓ LOW" };
                  if (riskUpper === "MEDIUM") {
                    riskStyle = { bg: "var(--color-warning-bg)", text: "var(--color-warning)", border: "var(--color-warning-border)", label: "⚠️ MEDIUM" };
                  } else if (riskUpper === "HIGH") {
                    riskStyle = { bg: "var(--color-error-bg)", text: "var(--color-error)", border: "var(--color-error-border)", label: "⚠️ HIGH" };
                  }

                  const statusNorm = (r.status || "pending_review").toLowerCase();
                  let statusStyle = { bg: "var(--color-warning-bg)", text: "var(--color-warning)", border: "var(--color-warning-border)", label: "⏳ PENDING REVIEW" };
                  if (statusNorm === "validated") {
                    statusStyle = { bg: "var(--color-success-bg)", text: "var(--color-success)", border: "var(--color-success-border)", label: "✓ VALIDATED" };
                  } else if (statusNorm === "rejected") {
                    statusStyle = { bg: "var(--color-error-bg)", text: "var(--color-error)", border: "var(--color-error-border)", label: "✕ REJECTED" };
                  }

                  const formattedDate = r.uploaded_at
                    ? new Date(r.uploaded_at).toLocaleString()
                    : "—";

                  const hasOcrConf = typeof r.ocr_confidence === "number" && !isNaN(r.ocr_confidence) && r.ocr_confidence > 0;
                  const confidencePct = hasOcrConf
                    ? `${(r.ocr_confidence * 100).toFixed(1)}%`
                    : "Unverified";

                  return (
                    <tr
                      key={r.record_id}
                      onClick={() => {
                        if (onSelectRecord) onSelectRecord(r.record_id);
                        window.location.hash = `/records/${r.record_id}`;
                      }}
                      style={{
                        borderBottom: "1px solid var(--color-border-subtle)",
                        cursor: "pointer",
                        transition: "background-color 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-bg-tertiary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", fontWeight: 700, color: "var(--color-accent)" }}>
                        {r.record_id}
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 500, color: "var(--color-text-primary)" }}>
                        {r.original_filename || "—"}
                      </td>
                      <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)" }}>
                        {r.document_type || "Land Record"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "9999px",
                            backgroundColor: riskStyle.bg,
                            color: riskStyle.text,
                            border: `1px solid ${riskStyle.border}`,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                        >
                          {riskStyle.label}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "9999px",
                            backgroundColor: statusStyle.bg,
                            color: statusStyle.text,
                            border: `1px solid ${statusStyle.border}`,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                        >
                          {statusStyle.label}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", color: "var(--color-text-muted)", fontSize: "12px" }}>
                        {formattedDate}
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: hasOcrConf ? "var(--color-success)" : "var(--color-text-muted)" }}>
                        {confidencePct}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <a
                          href={`#/records/${r.record_id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectRecord) onSelectRecord(r.record_id);
                          }}
                          style={{
                            backgroundColor: "var(--color-sidebar-bg)",
                            color: "var(--color-text-light)",
                            padding: "6px 14px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 700,
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                        >
                          Inspect →
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
