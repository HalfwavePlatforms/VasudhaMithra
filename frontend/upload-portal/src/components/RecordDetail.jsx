import React, { useState, useEffect } from "react";
import BhuvanGisMap from "./BhuvanGisMap";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const SCHEMA_FIELDS = [
  "survey_number",
  "khata_number",
  "khasra_number",
  "owner_name",
  "plot_area_acres",
  "district",
  "taluk",
  "village",
  "land_type",
  "tax_assessment"
];

export default function RecordDetail({ recordId, onBack }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editFields, setEditFields] = useState({});
  const [showRawOcr, setShowRawOcr] = useState(false);

  // Phase 3 Validation & Decision Control States
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  useEffect(() => {
    if (!recordId) return;
    async function fetchRecord() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/records/${recordId}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch record details (${res.status} ${res.statusText})`);
        }
        const data = await res.json();
        setRecord(data);

        // Merge fields to maintain exact schema
        const mergedFields = {};
        SCHEMA_FIELDS.forEach(f => {
          mergedFields[f] = data.fields?.[f] ?? "";
        });
        if (data.fields) {
          Object.keys(data.fields).forEach(k => {
            if (!(k in mergedFields)) mergedFields[k] = data.fields[k];
          });
        }
        setEditFields(mergedFields);

        // Pre-fill reviewer notes if already present
        if (data.review?.reviewer_notes) {
          setReviewerNotes(data.review.reviewer_notes);
        }
      } catch (err) {
        console.error("Error fetching record detail:", err);
        setError(err.message || "Failed to load record details from API Gateway.");
      } finally {
        setLoading(false);
      }
    }
    fetchRecord();
  }, [recordId]);

  async function handleSubmitDecision(decision) {
    if (!reviewerNotes || !reviewerNotes.trim()) {
      setSubmitError("Reviewer Notes are required before submitting a decision.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    const payload = {
      actor: "Revenue Officer",
      reviewer_notes: reviewerNotes.trim(),
      decision: decision,
      fields: editFields
    };

    try {
      const res = await fetch(`${API_BASE}/records/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`PATCH request failed (${res.status} ${res.statusText}): ${errText}`);
      }

      const updatedRecord = await res.json();
      setRecord(updatedRecord);
      setSubmitSuccess(`Decision "${decision}" submitted successfully! Navigating to Review Queue...`);

      setTimeout(() => {
        if (onBack) onBack();
      }, 1200);

    } catch (err) {
      console.error("Error submitting decision PATCH:", err);
      setSubmitError(err.message || "Failed to submit decision to API Gateway.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "48px 16px", textAlign: "center", color: "#6B7280", fontSize: "14px", fontFamily: "Inter, sans-serif" }}>
        ⏳ Fetching record details for <code style={{ fontFamily: "monospace", color: "#0B3B60" }}>{recordId}</code>...
      </div>
    );
  }

  if (error || !record) {
    return (
      <div style={{ maxWidth: "1280px", margin: "24px auto", padding: "0 16px", fontFamily: "Inter, sans-serif" }}>
        <button
          onClick={onBack}
          style={{ backgroundColor: "#F3F4F6", border: "1px solid #D1D5DB", padding: "6px 14px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", fontWeight: 600, marginBottom: "16px" }}
        >
          ← Back to Review Queue
        </button>
        <div style={{ padding: "20px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", color: "#991B1B", fontSize: "13px" }}>
          <div style={{ fontWeight: 700, marginBottom: "4px" }}>⚠️ Error Loading Record Details</div>
          <div>{error || "Record not found."}</div>
        </div>
      </div>
    );
  }

  const riskUpper = (record.risk_level || "LOW").toUpperCase();
  let riskBadge = { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0", label: "✓ LOW" };
  if (riskUpper === "MEDIUM") {
    riskBadge = { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A", label: "⚠️ MEDIUM" };
  } else if (riskUpper === "HIGH") {
    riskBadge = { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA", label: "⚠️ HIGH" };
  }

  const statusNorm = (record.status || "pending_review").toLowerCase();
  let statusBadge = { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A", label: "⏳ PENDING REVIEW" };
  if (statusNorm === "validated") {
    statusBadge = { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0", label: "✓ VALIDATED" };
  } else if (statusNorm === "rejected") {
    statusBadge = { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA", label: "✕ REJECTED" };
  }

  const hasOcrConf = typeof record.ocr_confidence === "number" && !isNaN(record.ocr_confidence) && record.ocr_confidence > 0;
  const ocrConfPct = hasOcrConf
    ? `${(record.ocr_confidence * 100).toFixed(1)}%`
    : "Unverified";

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 24px", fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#1F2937" }}>
      {/* Top Action Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <button
          onClick={onBack}
          style={{ backgroundColor: "#0B3B60", color: "#FFFFFF", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          ← Back to Review Queue
        </button>
        <span style={{ fontSize: "12px", color: "#6B7280" }}>
          Ingested ISO Timestamp: <strong style={{ color: "#374151" }}>{record.uploaded_at ? new Date(record.uploaded_at).toLocaleString() : "—"}</strong>
        </span>
      </div>

      {/* Header Info Banner */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "8px", border: "1px solid #E5E7EB", padding: "20px", marginBottom: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ fontSize: "11px", fontFamily: "monospace", color: "#0B3B60", fontWeight: 700, marginBottom: "4px" }}>
              RECORD ID: {record.record_id} | FILE: {record.original_filename || "—"}
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0B3B60", margin: "4px 0" }}>
              {record.document_type || "Land Record"} ({record.language ? record.language.toUpperCase() : "EN"})
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "11px", color: "#6B7280", display: "block", fontWeight: 600, textTransform: "uppercase" }}>Risk Level</span>
              <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", backgroundColor: riskBadge.bg, color: riskBadge.text, border: `1px solid ${riskBadge.border}`, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                {riskBadge.label}
              </span>
            </div>

            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "11px", color: "#6B7280", display: "block", fontWeight: 600, textTransform: "uppercase" }}>Status</span>
              <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", backgroundColor: statusBadge.bg, color: statusBadge.text, border: `1px solid ${statusBadge.border}`, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                {statusBadge.label}
              </span>
            </div>

            <div style={{ textAlign: "right", paddingLeft: "16px", borderLeft: "1px solid #E5E7EB" }}>
              <span style={{ fontSize: "11px", color: "#6B7280", display: "block", fontWeight: 600, textTransform: "uppercase" }}>OCR Confidence</span>
              <span style={{ fontSize: "20px", fontWeight: 800, color: hasOcrConf ? "#059669" : "#6B7280" }}>
                {ocrConfPct}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Layout Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        
        {/* Left Column: Original Document Viewer */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: "8px", border: "1px solid #E5E7EB", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#0B3B60", margin: "0 0 16px 0" }}>
            📄 Original Document File Source
          </h3>
          {record.image_url || record.file_path || record.image_base64 ? (
            <img
              src={record.image_url || record.file_path || (record.image_base64 ? `data:image/png;base64,${record.image_base64}` : '')}
              alt="Land Record Original Document"
              style={{ width: "100%", height: "auto", borderRadius: "8px", border: "1px solid #D1D5DB" }}
            />
          ) : (
            <div style={{ padding: "80px 20px", textAlign: "center", backgroundColor: "#F9FAFB", border: "2px dashed #D1D5DB", borderRadius: "8px", color: "#6B7280", fontSize: "13px" }}>
              Document view not available
            </div>
          )}
        </div>

        {/* Right Column: Schema Fields & Metadata */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Extracted Fields Form Grid */}
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: "8px", border: "1px solid #E5E7EB", padding: "20px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#0B3B60", margin: "0 0 16px 0" }}>
              📋 Extracted Land Record Fields
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {Object.keys(editFields).map((key) => {
                const confRaw = record.confidence_per_field?.[key];
                const hasConf = typeof confRaw === "number" && !isNaN(confRaw);
                const confVal = hasConf ? confRaw : null;
                const confPct = hasConf ? Math.round(confVal * 100) : null;

                let badgeStyle = { bg: "#F3F4F6", text: "#6B7280", border: "#E5E7EB" };
                if (hasConf) {
                  if (confVal < 0.70) {
                    badgeStyle = { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" };
                  } else if (confVal < 0.85) {
                    badgeStyle = { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" };
                  } else {
                    badgeStyle = { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" };
                  }
                }

                const isLowConf = hasConf && confVal < 0.85;

                return (
                  <div
                    key={key}
                    style={{
                      backgroundColor: isLowConf ? "#FEF2F2" : "#F9FAFB",
                      border: isLowConf ? "1px solid #FCA5A5" : "1px solid #E5E7EB",
                      borderRadius: "8px",
                      padding: "10px 12px"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#374151" }}>
                        {key.replace(/_/g, " ")}
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {isLowConf && (
                          <span style={{ fontSize: "10px", fontWeight: 700, backgroundColor: "#DC2626", color: "#FFFFFF", padding: "2px 6px", borderRadius: "4px" }}>
                            ⚠️ Low Confidence (&lt;85%)
                          </span>
                        )}
                        {!hasConf && (
                          <span style={{ fontSize: "10px", fontWeight: 600, backgroundColor: "#F3F4F6", color: "#6B7280", border: "1px solid #E5E7EB", padding: "2px 6px", borderRadius: "4px" }}>
                            Unverified
                          </span>
                        )}
                        {hasConf && (
                          <span style={{ fontSize: "10px", fontWeight: 700, backgroundColor: badgeStyle.bg, color: badgeStyle.text, border: `1px solid ${badgeStyle.border}`, padding: "2px 6px", borderRadius: "4px" }}>
                            {confPct}%
                          </span>
                        )}
                      </div>
                    </div>

                    <input
                      type="text"
                      value={editFields[key] ?? ""}
                      onChange={(e) => setEditFields({ ...editFields, [key]: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        fontSize: "13px",
                        borderRadius: "6px",
                        border: "1px solid #D1D5DB",
                        backgroundColor: "#FFFFFF",
                        outline: "none"
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rule Violations Section */}
          {record.violations && record.violations.length > 0 && (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "8px", border: "1px solid #FECACA", padding: "16px" }}>
              <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#991B1B", margin: "0 0 12px 0" }}>
                ⚠️ Rule Violations ({record.violations.length})
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {record.violations.map((v, idx) => (
                  <div key={idx} style={{ padding: "10px 12px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "6px", fontSize: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#7F1D1D", marginBottom: "2px" }}>
                      <span>Field: <code style={{ fontFamily: "monospace" }}>{v.field || "General"}</code> | Rule: {v.rule || "Validation"}</span>
                      <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", backgroundColor: v.severity === "HIGH" ? "#DC2626" : "#D97706", color: "#FFFFFF" }}>
                        {v.severity || "WARNING"}
                      </span>
                    </div>
                    <div style={{ color: "#4B5563" }}>{v.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Phase 4: ISRO Bhuvan GIS Map & Multi-Thematic Analytics */}
          <BhuvanGisMap gis={record.gis} />

          {/* Review Metadata (Read-Only) */}
          {record.review && (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "8px", border: "1px solid #E5E7EB", padding: "16px" }}>
              <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#0B3B60", margin: "0 0 8px 0" }}>
                📑 Existing Review Log (Read-Only)
              </h4>
              <div style={{ fontSize: "12px", color: "#374151", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div><strong>Reviewed By:</strong> {record.review.reviewed_by || "Unassigned"}</div>
                <div><strong>Reviewed At:</strong> {record.review.reviewed_at ? new Date(record.review.reviewed_at).toLocaleString() : "Pending"}</div>
                <div style={{ gridColumn: "1 / -1", marginTop: "4px" }}>
                  <strong>Reviewer Notes:</strong> {record.review.reviewer_notes || "No notes entered."}
                </div>
              </div>
            </div>
          )}

          {/* Phase 3: Validation & Decision Controls */}
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: "8px", border: "1px solid #0B3B60", padding: "20px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0B3B60", margin: "0 0 12px 0" }}>
              🛡️ Official Revenue Validation & Decision Controls
            </h3>

            {submitError && (
              <div style={{ padding: "12px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "6px", color: "#991B1B", fontSize: "12px", marginBottom: "12px", fontWeight: 600 }}>
                ⚠️ {submitError}
              </div>
            )}

            {submitSuccess && (
              <div style={{ padding: "12px 14px", backgroundColor: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "6px", color: "#065F46", fontSize: "12px", marginBottom: "12px", fontWeight: 600 }}>
                ✓ {submitSuccess}
              </div>
            )}

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>
                Reviewer Notes / Mutation Order Justification <span style={{ color: "#DC2626" }}>* (Required)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Enter mandatory officer remarks or mutation order reference..."
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: "13px",
                  borderRadius: "6px",
                  border: "1px solid #D1D5DB",
                  backgroundColor: "#FFFFFF",
                  outline: "none",
                  fontFamily: "inherit"
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
              <button
                onClick={() => handleSubmitDecision("APPROVED")}
                disabled={!reviewerNotes.trim() || isSubmitting}
                style={{
                  backgroundColor: !reviewerNotes.trim() || isSubmitting ? "#9CA3AF" : "#059669",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: !reviewerNotes.trim() || isSubmitting ? "not-allowed" : "pointer",
                  opacity: !reviewerNotes.trim() || isSubmitting ? 0.7 : 1,
                  transition: "all 0.15s ease"
                }}
              >
                {isSubmitting ? "Submitting..." : "✓ Approve / Certify"}
              </button>

              <button
                onClick={() => handleSubmitDecision("NEEDS_SURVEY")}
                disabled={!reviewerNotes.trim() || isSubmitting}
                style={{
                  backgroundColor: !reviewerNotes.trim() || isSubmitting ? "#9CA3AF" : "#D97706",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: !reviewerNotes.trim() || isSubmitting ? "not-allowed" : "pointer",
                  opacity: !reviewerNotes.trim() || isSubmitting ? 0.7 : 1,
                  transition: "all 0.15s ease"
                }}
              >
                {isSubmitting ? "Submitting..." : "⚠ Flag for Field Survey"}
              </button>

              <button
                onClick={() => handleSubmitDecision("REJECTED")}
                disabled={!reviewerNotes.trim() || isSubmitting}
                style={{
                  backgroundColor: !reviewerNotes.trim() || isSubmitting ? "#9CA3AF" : "#DC2626",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: !reviewerNotes.trim() || isSubmitting ? "not-allowed" : "pointer",
                  opacity: !reviewerNotes.trim() || isSubmitting ? 0.7 : 1,
                  transition: "all 0.15s ease"
                }}
              >
                {isSubmitting ? "Submitting..." : "✕ Reject Record"}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Raw OCR Text Collapsible Drawer */}
      <div style={{ marginTop: "20px", backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "16px" }}>
        <button
          onClick={() => setShowRawOcr(!showRawOcr)}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#0B3B60" }}>
            📝 Raw OCR Recognized Text
          </span>
          <span style={{ fontSize: "12px", color: "#6B7280", fontWeight: 600 }}>
            {showRawOcr ? "▲ Hide Raw Text" : "▼ Show Raw Text"}
          </span>
        </button>
        {showRawOcr && (
          <pre style={{ marginTop: "12px", backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", padding: "14px", borderRadius: "8px", fontFamily: "monospace", fontSize: "12px", color: "#334155", whiteSpace: "pre-wrap", maxHeight: "300px", overflowY: "auto" }}>
            {record.raw_ocr_text || "No raw OCR text recorded for this document."}
          </pre>
        )}
      </div>
    </div>
  );
}
