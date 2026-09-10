import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Save,
  RotateCw,
  Eye,
  Layers,
  MapPin,
  ExternalLink,
  ChevronDown,
  Loader2,
  QrCode,
  FileCheck,
} from "lucide-react";
import CadastralLeafletMap from "./CadastralLeafletMap";
import QrCodeModal from "./QrCodeModal";

export default function VerificationDesk({
  apiBase,
  selectedRecordId,
  setSelectedRecordId,
  onRecordUpdated,
  setActiveTab,
}) {
  const [pendingRecords, setPendingRecords] = useState([]);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [editedFields, setEditedFields] = useState({});
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeDocView, setActiveDocView] = useState("image"); // "image" | "raw_ocr"
  const [imageError, setImageError] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);

  const handleOpenQr = async () => {
    if (!currentRecord) return;
    if (currentRecord.verification_token && currentRecord.verification_url) {
      setShowQrModal(true);
      return;
    }
    try {
      const token = localStorage.getItem("vasudha_token");
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      else headers["X-Role"] = "officer";

      const res = await fetch(`${apiBase}/records/${currentRecord.record_id}/generate-qr`, {
        method: "POST",
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentRecord((prev) => ({
          ...prev,
          verification_token: data.verification_token,
          verification_url: data.verification_url,
        }));
      }
    } catch {}
    setShowQrModal(true);
  };

  // 1. Fetch pending review records
  const fetchPendingRecords = async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`${apiBase}/records?status=pending_review&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setPendingRecords(data.records || []);
        // If no selected record, default to first pending
        if (!selectedRecordId && data.records && data.records.length > 0) {
          setSelectedRecordId(data.records[0].record_id);
        }
      }
    } catch (e) {
      console.error("Failed to load pending review records:", e);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchPendingRecords();
  }, [apiBase]);

  // 2. Fetch specific record details, and poll if status is "processing"
  useEffect(() => {
    if (!selectedRecordId) return;

    let isMounted = true;
    let pollTimer = null;

    const fetchDetail = () => {
      fetch(`${apiBase}/records/${selectedRecordId}`)
        .then((res) => {
          if (!res.ok) throw new Error("Record not found");
          return res.json();
        })
        .then((data) => {
          if (!isMounted) return;
          setCurrentRecord(data);
          setEditedFields(data.fields || {});
          setReviewerNotes(data.review?.reviewer_notes || "");
          setLoadingRecord(false);

          // If still processing, re-poll in 1.5s
          if (data.status === "processing") {
            pollTimer = setTimeout(fetchDetail, 1500);
          }
        })
        .catch((err) => {
          console.error("Error fetching record:", err);
          if (isMounted) setLoadingRecord(false);
        });
    };

    setLoadingRecord(true);
    setImageError(false);
    fetchDetail();

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [selectedRecordId, apiBase]);

  const handleFieldChange = (key, val) => {
    setEditedFields((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  // 3. Save Field Corrections (PATCH /records/{id}/fields)
  const handleSaveCorrections = async () => {
    if (!currentRecord) return;
    setActionLoading(true);
    setNotification(null);

    try {
      const token = localStorage.getItem("vasudha_token");
      const headers = {
        "Content-Type": "application/json",
        "X-Role": "tahsildar",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${apiBase}/records/${currentRecord.record_id}/fields`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          actor: "Deepak G.M. (District Admin)",
          reviewer_notes: reviewerNotes,
          fields: editedFields,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to save corrections");
      }

      const updated = await res.json();
      setCurrentRecord(updated);
      setEditedFields(updated.fields || {});
      setNotification({ type: "success", text: "Field corrections saved successfully." });
      if (onRecordUpdated) onRecordUpdated();
    } catch (e) {
      setNotification({ type: "error", text: e.message });
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Submit Official Decision (Approve or Reject via PATCH /records/{id})
  const handleDecision = async (decision) => {
    if (!currentRecord) return;
    setActionLoading(true);
    setNotification(null);

    try {
      const token = localStorage.getItem("vasudha_token");
      const headers = {
        "Content-Type": "application/json",
        "X-Role": "tahsildar",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${apiBase}/records/${currentRecord.record_id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          actor: "Deepak G.M. (Tahsildar / Admin)",
          reviewer_notes: reviewerNotes || (decision === "APPROVED" ? "Approved by revenue officer." : "Rejected due to validation discrepancies."),
          decision: decision,
          fields: editedFields,
        }),
      });


      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Review submission failed (${decision})`);
      }

      const updated = await res.json();
      setCurrentRecord(updated);
      setNotification({
        type: "success",
        text: `Record ${currentRecord.record_id.slice(0, 8)}... successfully ${decision === "APPROVED" ? "approved & validated" : "flagged as rejected"}. Transitioning to Land Records...`,
      });

      // Refresh pending list and dashboard stats
      fetchPendingRecords();
      if (onRecordUpdated) onRecordUpdated();

      // Navigate user to Land Records per Step 2
      setTimeout(() => {
        if (setActiveTab) {
          setActiveTab("land_records");
        }
      }, 1000);
    } catch (e) {
      setNotification({ type: "error", text: e.message });
    } finally {
      setActionLoading(false);
    }
  };


  const schemaLabels = {
    survey_number: "Survey Number",
    khasra_number: "Khasra Number",
    khata_number: "Khata Number",
    owner_name: "Owner / Khatedar Name",
    plot_area: "Plot Extent / Area",
    village: "Village (Gram)",
    tehsil: "Taluk / Tehsil",
    district: "District (Zilla)",
    land_classification: "Land Classification",
    mutation_number: "Mutation Reference No",
  };

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
            VERIFICATION & AUDIT
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[var(--color-text-primary)] tracking-tight mt-1">
            Verification desk
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Inspect optical extractions, resolve schema violations, and authenticate land title certificates.
          </p>
        </div>

        {/* Record Selector Pills */}
        {pendingRecords.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-md py-1">
            <span className="text-xs font-semibold text-[var(--color-text-muted)] flex-shrink-0">
              Queue ({pendingRecords.length}):
            </span>
            {pendingRecords.slice(0, 5).map((r) => (
              <button
                key={r.record_id}
                onClick={() => setSelectedRecordId(r.record_id)}
                className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-lg transition-all flex-shrink-0 cursor-pointer ${
                  r.record_id === selectedRecordId
                    ? "bg-[var(--color-sidebar-bg)] text-white shadow-xs"
                    : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-tertiary)]"
                }`}
              >
                {r.record_id.slice(0, 8)}...
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
            notification.type === "success"
              ? "bg-[var(--color-success-bg)] border-[var(--color-success-border)] text-[var(--color-success)]"
              : "bg-[var(--color-error-bg)] border-[var(--color-error-border)] text-[var(--color-error)]"
          }`}
        >
          <span>{notification.text}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-xs underline ml-4 hover:opacity-75 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {loadingRecord ? (
        <div className="p-16 text-center text-[var(--color-text-muted)]">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--color-accent)]" />
          Loading land record verification payload...
        </div>
      ) : !currentRecord ? (
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-12 text-center text-[var(--color-text-muted)]">
          <ShieldCheck className="w-10 h-10 text-[var(--color-success)] mx-auto mb-3" />
          <h3 className="text-base font-bold text-[var(--color-text-primary)]">
            No Record Selected
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Select a record from the queue above or upload a new deed from Document Intake.
          </p>
        </div>
      ) : currentRecord.status === "processing" ? (
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-12 text-center text-[var(--color-text-muted)] space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-[var(--color-accent)] mx-auto mb-2" />
          <h3 className="text-base font-bold text-[var(--color-text-primary)]">
            Pipeline In Progress for Record {currentRecord.record_id.slice(0, 8)}...
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] max-w-md mx-auto">
            Optical OCR and AI layout extraction are active. Real confidence scores, schema fields, and Cadastral GIS spatial validation will populate automatically.
          </p>
        </div>
      ) : (
        /* Split-Pane Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Pane (5 Cols): Source Document Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5 shadow-xs flex flex-col h-[740px]">
              {/* Document Header & View Switcher */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-subtle)]">
                <div>
                  <div className="text-xs font-bold text-[var(--color-text-primary)] truncate max-w-[200px]">
                    {currentRecord.original_filename || "document_scan.png"}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-muted)]">
                    Lang: <span className="font-semibold uppercase text-[var(--color-text-primary)]">{currentRecord.language}</span> · OCR:{" "}
                    <span className="font-semibold text-[var(--color-success)]">
                      {currentRecord.ocr_confidence
                        ? `${(currentRecord.ocr_confidence * 100).toFixed(1)}%`
                        : "N/A"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center bg-[var(--color-bg-primary)] p-0.5 rounded-lg border border-[var(--color-border)] text-xs">
                  <button
                    onClick={() => setActiveDocView("image")}
                    className={`px-2.5 py-1 rounded font-semibold transition-all cursor-pointer ${
                      activeDocView === "image"
                        ? "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] shadow-2xs"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    Image
                  </button>
                  <button
                    onClick={() => setActiveDocView("raw_ocr")}
                    className={`px-2.5 py-1 rounded font-semibold transition-all cursor-pointer ${
                      activeDocView === "raw_ocr"
                        ? "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] shadow-2xs"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    OCR Stream
                  </button>
                </div>
              </div>

              {/* Document Viewer Body */}
              <div className="flex-1 overflow-auto mt-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-lg p-3 flex items-center justify-center">
                {activeDocView === "image" && !imageError ? (
                  <img
                    src={`${apiBase}/records/${currentRecord.record_id}/download`}
                    alt="Original land deed"
                    onError={() => setImageError(true)}
                    className="max-w-full max-h-full object-contain rounded shadow-xs"
                  />
                ) : (
                  <div className="w-full h-full text-left font-mono text-[11px] leading-relaxed text-[var(--color-text-primary)] whitespace-pre-wrap select-text overflow-y-auto">
                    {imageError && (
                      <div className="mb-3 p-2 bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] text-[var(--color-warning)] text-[10px] rounded">
                        Document image not found on local disk. Displaying recognized OCR text stream:
                      </div>
                    )}
                    {currentRecord.raw_ocr_text || "No OCR text available for this record."}
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                <span>Status: <strong className="text-[var(--color-text-primary)]">{currentRecord.status}</strong></span>
                <span className="font-mono">{currentRecord.record_id.slice(0, 16)}...</span>
              </div>
            </div>
          </div>

          {/* Right Pane (7 Cols): Schema, Checks & Actions */}
          <div className="lg:col-span-7 space-y-5">
            {/* Record Overview Banner Card */}
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-mono text-[var(--color-text-muted)]">
                    RECORD ID: {currentRecord.record_id}
                  </div>
                  <h3 className="text-base font-serif font-bold text-[var(--color-text-primary)] mt-0.5">
                    {currentRecord.document_type || "Standard Land Record"}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {/* Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      currentRecord.status === "validated"
                        ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]"
                        : currentRecord.status === "rejected"
                        ? "bg-[var(--color-error-bg)] text-[var(--color-error)] border border-[var(--color-error-border)]"
                        : "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]"
                    }`}
                  >
                    ● {currentRecord.status === "validated"
                      ? "Validated"
                      : currentRecord.status === "rejected"
                      ? "Rejected"
                      : "Pending Review"}
                  </span>

                  {/* Risk Badge */}
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      currentRecord.risk_level === "LOW"
                        ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]"
                        : currentRecord.risk_level === "MEDIUM"
                        ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]"
                        : "bg-[var(--color-error-bg)] text-[var(--color-error)] border border-[var(--color-error-border)]"
                    }`}
                  >
                    {currentRecord.risk_level || "MEDIUM"}
                  </span>

                  {/* Public QR Verification Button */}
                  <button
                    type="button"
                    onClick={handleOpenQr}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--color-bg-primary)] border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-full text-xs font-semibold transition-colors cursor-pointer"
                    title="Generate / View Public Verification QR Code"
                  >
                    <QrCode className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    <span>QR Verification</span>
                  </button>

                  {/* Digital Certificate Download (Only for validated records) */}
                  {currentRecord.status === "validated" ? (
                    <a
                      href={`${apiBase}/records/${currentRecord.record_id}/certificate`}
                      download
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--color-success-bg)] border border-[var(--color-success-border)] hover:bg-[var(--color-success-bg)]/80 text-[var(--color-success)] rounded-full text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                      title="Download Official Digital Land Record Certificate (PDF)"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>Digital Certificate</span>
                    </a>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)]/40 rounded-full text-xs font-semibold cursor-not-allowed"
                      title="Certificate available only after record validation"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>Certificate</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Official Govt. Location Code (LGD) */}
              <div className="mt-3 pt-2.5 border-t border-[var(--color-border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                  <span className="font-semibold text-[var(--color-text-secondary)]">Official Govt. Location Code (LGD):</span>
                  {currentRecord.village_lgd_code ? (
                    <a
                      href="https://lgdirectory.gov.in/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono font-bold text-[var(--color-accent)] bg-[var(--color-accent-subtle)] hover:bg-[var(--color-accent-subtle)]/80 px-2 py-0.5 rounded border border-[var(--color-border)] cursor-pointer transition-colors"
                      title="Verify official location in Local Government Directory (MoPR)"
                    >
                      <span>LGD {currentRecord.village_lgd_code}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-[11px] text-[var(--color-text-muted)] italic px-2 py-0.5 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)]">
                      Pending canonicalization
                    </span>
                  )}
                </div>
                {currentRecord.village_lgd_code && (
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    Standardised via Local Government Directory
                  </span>
                )}
              </div>

              {/* REAL Validation Issues List from validators.py */}
              <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
                <div className="text-xs font-bold text-[var(--color-text-primary)] mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                  Validation Rules & Consistency Audit:
                </div>

                {currentRecord.violations && currentRecord.violations.length > 0 ? (
                  <div className="space-y-2">
                    {currentRecord.violations.map((v, i) => (
                      <div
                        key={i}
                        className="p-2.5 bg-[var(--color-accent-subtle)] border border-[var(--color-border)] rounded-lg text-xs flex items-start gap-2 text-[var(--color-text-primary)]"
                      >
                        <AlertTriangle className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="uppercase font-mono text-[10px] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded border border-[var(--color-border)] mr-1">
                            {v.rule}
                          </strong>
                          <span>{v.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-lg text-xs flex items-center gap-2 text-[var(--color-success)]">
                    <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" />
                    <span>Zero validation rule violations detected. Record conforms to schema.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Extracted Land Record Schema Card */}
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                  Extracted Land Record Schema
                </h4>
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  Field Confidence (OCR token derived)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(schemaLabels).map(([key, label]) => {
                  const val = editedFields[key] !== undefined ? editedFields[key] : "";
                  const rawConf = currentRecord.confidence_per_field?.[key];

                  const isAiAssisted = currentRecord.extraction_sources?.[key] === "ai_assisted";

                  // PROMPT RULE: Use REAL confidence values per field
                  let confDisplay = "Unverified";
                  let confStyle = "bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] border-[var(--color-border)]";

                  if (isAiAssisted) {
                    confDisplay = "AI-extracted, pending review";
                    confStyle = "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]";
                  } else if (rawConf !== null && rawConf !== undefined && typeof rawConf === "number" && rawConf > 0) {
                    const pct = Math.round(rawConf * 100);
                    confDisplay = `${pct}%`;
                    confStyle = pct >= 80
                      ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]"
                      : "bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border-[var(--color-border)]";
                  }

                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[var(--color-text-secondary)]">{label}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${confStyle}`}>
                          {confDisplay}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={val || ""}
                        onChange={(e) => handleFieldChange(key, e.target.value)}
                        placeholder={`Enter ${label.toLowerCase()}...`}
                        className="w-full text-xs bg-[var(--color-bg-primary)] border border-[var(--color-border-strong)] rounded-lg px-2.5 py-1.5 text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Document <-> GIS Spatial Consistency Engine Card */}
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
                    SPATIAL CONSISTENCY ENGINE
                  </span>
                  <h4 className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                    <span>Cadastral GIS Verification</span>
                    {currentRecord.gis?.parcel_id && (
                      <span className="text-[10px] px-2 py-0.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded text-[var(--color-text-secondary)] font-mono">
                        {currentRecord.gis.parcel_id}
                      </span>
                    )}
                  </h4>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    currentRecord.gis?.spatial_consistency === "MATCH"
                      ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]"
                      : currentRecord.gis?.spatial_consistency === "DISCREPANCY"
                      ? "bg-[var(--color-error-bg)] text-[var(--color-error)] border border-[var(--color-error-border)]"
                      : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
                  }`}
                >
                  {currentRecord.gis?.spatial_consistency || "NOT_EVALUATED"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-center text-xs">
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">
                    Deed Stated Area
                  </div>
                  <div className="font-bold text-[var(--color-text-primary)] mt-0.5">
                    {currentRecord.gis?.area_doc_acres ? `${currentRecord.gis.area_doc_acres} Acres` : "N/A"}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">
                    Cadastral GIS Area
                  </div>
                  <div className="font-bold text-[var(--color-text-primary)] mt-0.5">
                    {currentRecord.gis?.area_gis_acres ? `${currentRecord.gis.area_gis_acres} Acres` : "N/A"}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">
                    Spatial Delta (Δ%)
                  </div>
                  <div className="font-bold text-[var(--color-text-primary)] mt-0.5">
                    {currentRecord.gis?.spatial_delta_pct !== null && currentRecord.gis?.spatial_delta_pct !== undefined
                      ? `${currentRecord.gis.spatial_delta_pct}%`
                      : "N/A"}
                  </div>
                </div>
              </div>

              {/* If geometry is available, render Leaflet map & Official State Portal Links */}
              {currentRecord.gis?.geometry ? (
                <div className="mt-2 space-y-2">
                  <CadastralLeafletMap
                    geometry={currentRecord.gis.geometry}
                    gis={currentRecord.gis}
                    height="200px"
                  />
                  {(() => {
                    const firstCoord = currentRecord.gis.geometry?.coordinates?.[0]?.[0];
                    const lon = firstCoord ? firstCoord[0] : 77.1006;
                    const lat = firstCoord ? firstCoord[1] : 13.3400;
                    const stateName = String(currentRecord.gis.state || (currentRecord.language === "kn" ? "Karnataka" : "")).toLowerCase();
                    const isKarnataka = stateName.includes("karn") || currentRecord.language === "kn";
                    const isMaharashtra = stateName.includes("maha") || currentRecord.language === "mr";

                    return (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[var(--color-text-secondary)] border-t border-[var(--color-border-subtle)]">
                        <span className="flex items-center gap-1 font-semibold text-[var(--color-text-primary)]">
                          <Layers className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                          Official State Spatial Portals:
                        </span>
                        <div className="flex items-center gap-2">
                          {isKarnataka && (
                            <a
                              href={`https://kgis.ksrsac.in/karnataka/?lat=${lat}&lon=${lon}&zoom=17`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border-strong)] rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] font-semibold transition-colors"
                            >
                              <span>KGIS / Bhoomi Cadastre</span>
                              <ExternalLink className="w-3 h-3 text-[var(--color-text-muted)]" />
                            </a>
                          )}
                          {isMaharashtra && (
                            <a
                              href="https://mahabhulekh.maharashtra.gov.in/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border-strong)] rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] font-semibold transition-colors"
                            >
                              <span>Mahabhulekh Bhunaksha</span>
                              <ExternalLink className="w-3 h-3 text-[var(--color-text-muted)]" />
                            </a>
                          )}
                          <a
                            href={`https://bhuvan-app1.nrsc.gov.in/bhuvan2d/bhuvan/bhuvan2d.php?lat=${lat}&lon=${lon}&zoom=17`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border-strong)] rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] font-semibold transition-colors"
                          >
                            <span>ISRO Bhuvan (NRSC)</span>
                            <ExternalLink className="w-3 h-3 text-[var(--color-text-muted)]" />
                          </a>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="p-4 bg-[var(--color-bg-secondary)] border border-dashed border-[var(--color-border-strong)] rounded-lg text-center text-xs text-[var(--color-text-muted)] space-y-2">
                  <p>Cadastral parcel geometry not yet mapped for this survey number.</p>
                  <button
                    type="button"
                    onClick={handleSaveCorrections}
                    className="px-3 py-1.5 bg-[var(--color-accent)] text-white rounded text-xs font-semibold hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer"
                  >
                    Map Cadastral Boundary
                  </button>
                </div>
              )}
            </div>

            {/* Officer Remarks & Decision Buttons */}
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5 shadow-xs space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                  Revenue Officer Verification Remarks / Mutation Ref
                </label>
                <textarea
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  rows={2}
                  placeholder="Enter verification rationale, mutation reference order, or audit justification..."
                  className="w-full text-xs bg-[var(--color-bg-primary)] border border-[var(--color-border-strong)] rounded-lg p-2.5 text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--color-border-subtle)]">
                <button
                  onClick={handleSaveCorrections}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-tertiary)] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  Save Corrections
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDecision("REJECTED")}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--color-error)] bg-[var(--color-error-bg)] border border-[var(--color-error-border)] hover:bg-[var(--color-bg-tertiary)] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Flag / Reject
                  </button>

                  <button
                    onClick={() => handleDecision("APPROVED")}
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve Record
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Verification Modal */}
      {showQrModal && currentRecord && (
        <QrCodeModal
          record={currentRecord}
          onClose={() => setShowQrModal(false)}
        />
      )}
    </div>
  );
}
