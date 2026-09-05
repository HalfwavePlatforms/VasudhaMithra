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
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 24px", fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#1F2937" }}>
      {/* Header Banner */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "8px", border: "1px solid #E5E7EB", padding: "20px", marginBottom: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ fontSize: "11px", letterSpacing: "1.2px", textTransform: "uppercase", color: "#0B3B60", fontWeight: 700, marginBottom: "4px" }}>
              Revenue Department Human-in-the-Loop Desk
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0B3B60", margin: 0 }}>
              Official Revenue Review & Triage Queue
            </h2>
            <p style={{ fontSize: "13px", color: "#4B5563", margin: "4px 0 0 0" }}>
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
                  borderRadius: "6px",
                  border: statusFilter === tab.id ? "1px solid #0B3B60" : "1px solid #D1D5DB",
                  backgroundColor: statusFilter === tab.id ? "#0B3B60" : "#FFFFFF",
                  color: statusFilter === tab.id ? "#FFFFFF" : "#374151",
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
                borderRadius: "6px",
                border: "1px solid #D1D5DB",
                backgroundColor: "#F9FAFB",
                color: "#374151",
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
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "8px", border: "1px solid #E5E7EB", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        {loading ? (
          <div style={{ padding: "48px 16px", textAlign: "center", color: "#6B7280", fontSize: "14px", fontWeight: 500 }}>
            ⏳ Loading review queue from API Gateway...
          </div>
        ) : error ? (
          <div style={{ padding: "20px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", color: "#991B1B", fontSize: "13px" }}>
            <div style={{ fontWeight: 700, marginBottom: "4px" }}>⚠️ Error Loading Review Queue</div>
            <div>{error}</div>
            <div style={{ marginTop: "12px" }}>
              <button
                onClick={fetchQueue}
                style={{ backgroundColor: "#DC2626", color: "#FFFFFF", border: "none", padding: "6px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
              >
                Retry Request
              </button>
            </div>
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: "48px 16px", textAlign: "center", color: "#6B7280", fontSize: "14px" }}>
            No records pending review.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
              <thead>
                <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "2px solid #E2E8F0", color: "#475569", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.5px" }}>
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
                  let riskStyle = { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0", label: "✓ LOW" };
                  if (riskUpper === "MEDIUM") {
                    riskStyle = { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A", label: "⚠️ MEDIUM" };
                  } else if (riskUpper === "HIGH") {
                    riskStyle = { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA", label: "⚠️ HIGH" };
                  }

                  const statusNorm = (r.status || "pending_review").toLowerCase();
                  let statusStyle = { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A", label: "⏳ PENDING REVIEW" };
                  if (statusNorm === "validated") {
                    statusStyle = { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0", label: "✓ VALIDATED" };
                  } else if (statusNorm === "rejected") {
                    statusStyle = { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA", label: "✕ REJECTED" };
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
                        borderBottom: "1px solid #F1F5F9",
                        cursor: "pointer",
                        transition: "background-color 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", fontWeight: 700, color: "#0B3B60" }}>
                        {r.record_id}
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 500, color: "#1F2937" }}>
                        {r.original_filename || "—"}
                      </td>
                      <td style={{ padding: "10px 14px", color: "#4B5563" }}>
                        {r.document_type || "Land Record"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "6px",
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
                            borderRadius: "6px",
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
                      <td style={{ padding: "10px 14px", color: "#6B7280", fontSize: "12px" }}>
                        {formattedDate}
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: hasOcrConf ? "#0B3B60" : "#6B7280" }}>
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
                            backgroundColor: "#0B3B60",
                            color: "#FFFFFF",
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
