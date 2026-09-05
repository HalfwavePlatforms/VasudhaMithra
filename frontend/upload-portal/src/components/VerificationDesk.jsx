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
  Loader2
} from "lucide-react";
import CadastralLeafletMap from "./CadastralLeafletMap";

export default function VerificationDesk({
  apiBase,
  selectedRecordId,
  setSelectedRecordId,
  onRecordUpdated,
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

  // 2. Fetch specific record details when selectedRecordId changes
  useEffect(() => {
    if (!selectedRecordId) return;

    setLoadingRecord(true);
    setImageError(false);
    fetch(`${apiBase}/records/${selectedRecordId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Record not found");
        return res.json();
      })
      .then((data) => {
        setCurrentRecord(data);
        setEditedFields(data.fields || {});
        setReviewerNotes(data.review?.reviewer_notes || "");
      })
      .catch((err) => {
        console.error("Error fetching record:", err);
      })
      .finally(() => {
        setLoadingRecord(false);
      });
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
      const res = await fetch(`${apiBase}/records/${currentRecord.record_id}/fields`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Role": "tahsildar",
        },
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

  // 4. Submit Official Decision (Approve or Reject via POST /records/{id}/review)
  const handleDecision = async (decision) => {
    if (!currentRecord) return;
    setActionLoading(true);
    setNotification(null);

    try {
      const res = await fetch(`${apiBase}/records/${currentRecord.record_id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Role": "tahsildar",
        },
        body: JSON.stringify({
          actor: "Deepak G.M. (Tahsildar / Admin)",
          reviewer_notes: reviewerNotes || (decision === "APPROVED" ? "Approved by revenue officer." : "Rejected due to validation discrepancies."),
          decision: decision,
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
        text: `Record successfully ${decision === "APPROVED" ? "approved & validated" : "flagged as rejected"}.`,
      });

      // Refresh pending list
      fetchPendingRecords();
      if (onRecordUpdated) onRecordUpdated();
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
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#D9714B]">
            VERIFICATION & AUDIT
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#16241F] tracking-tight mt-1">
            Verification desk
          </h1>
          <p className="text-sm text-[#737167] mt-1">
            Inspect optical extractions, resolve schema violations, and authenticate land title certificates.
          </p>
        </div>

        {/* Record Selector Pills */}
        {pendingRecords.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-md py-1">
            <span className="text-xs font-semibold text-[#8A887E] flex-shrink-0">
              Queue ({pendingRecords.length}):
            </span>
            {pendingRecords.slice(0, 5).map((r) => (
              <button
                key={r.record_id}
                onClick={() => setSelectedRecordId(r.record_id)}
                className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-lg transition-all flex-shrink-0 ${
                  r.record_id === selectedRecordId
                    ? "bg-[#16241F] text-white shadow-xs"
                    : "bg-white text-[#5A584F] border border-[#DDD9CE] hover:bg-[#F2EFE8]"
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
              ? "bg-[#EBF7F2] border-[#C5E8D9] text-[#1D8374]"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <span>{notification.text}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-xs underline ml-4 hover:opacity-75"
          >
            Dismiss
          </button>
        </div>
      )}

      {loadingRecord ? (
        <div className="p-16 text-center text-[#8A887E]">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#D9714B]" />
          Loading land record verification payload...
        </div>
      ) : !currentRecord ? (
        <div className="bg-white border border-[#E6E3DB] rounded-xl p-12 text-center text-[#737167]">
          <ShieldCheck className="w-10 h-10 text-[#1D8374] mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#16241F]">
            No Record Selected
          </h3>
          <p className="text-xs text-[#8A887E] mt-1">
            Select a record from the queue above or upload a new deed from Document Intake.
          </p>
        </div>
      ) : (
        /* Split-Pane Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Pane (5 Cols): Source Document Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-[#E6E3DB] rounded-xl p-5 shadow-xs flex flex-col h-[740px]">
              {/* Document Header & View Switcher */}
              <div className="flex items-center justify-between pb-3 border-b border-[#F2EFE8]">
                <div>
                  <div className="text-xs font-bold text-[#16241F] truncate max-w-[200px]">
                    {currentRecord.original_filename || "document_scan.png"}
                  </div>
                  <div className="text-[11px] text-[#8A887E]">
                    Lang: <span className="font-semibold uppercase text-[#16241F]">{currentRecord.language}</span> · OCR:{" "}
                    <span className="font-semibold text-[#1D8374]">
                      {currentRecord.ocr_confidence
                        ? `${(currentRecord.ocr_confidence * 100).toFixed(1)}%`
                        : "N/A"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center bg-[#F7F5EF] p-0.5 rounded-lg border border-[#E6E3DB] text-xs">
                  <button
                    onClick={() => setActiveDocView("image")}
                    className={`px-2.5 py-1 rounded font-semibold transition-all ${
                      activeDocView === "image"
                        ? "bg-white text-[#16241F] shadow-2xs"
                        : "text-[#737167] hover:text-[#16241F]"
                    }`}
                  >
                    Image
                  </button>
                  <button
                    onClick={() => setActiveDocView("raw_ocr")}
                    className={`px-2.5 py-1 rounded font-semibold transition-all ${
                      activeDocView === "raw_ocr"
                        ? "bg-white text-[#16241F] shadow-2xs"
                        : "text-[#737167] hover:text-[#16241F]"
                    }`}
                  >
                    OCR Stream
                  </button>
                </div>
              </div>

              {/* Document Viewer Body */}
              <div className="flex-1 overflow-auto mt-4 bg-[#FAF9F5] border border-[#EAE7DF] rounded-lg p-3 flex items-center justify-center">
                {activeDocView === "image" && !imageError ? (
                  <img
                    src={`${apiBase}/records/${currentRecord.record_id}/download`}
                    alt="Original land deed"
                    onError={() => setImageError(true)}
                    className="max-w-full max-h-full object-contain rounded shadow-xs"
                  />
                ) : (
                  <div className="w-full h-full text-left font-mono text-[11px] leading-relaxed text-[#2C2B27] whitespace-pre-wrap select-text overflow-y-auto">
                    {imageError && (
                      <div className="mb-3 p-2 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] rounded">
                        Document image not found on local disk. Displaying recognized OCR text stream:
                      </div>
                    )}
                    {currentRecord.raw_ocr_text || "No OCR text available for this record."}
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-[#F2EFE8] flex items-center justify-between text-[11px] text-[#8A887E]">
                <span>Status: <strong className="text-[#16241F]">{currentRecord.status}</strong></span>
                <span className="font-mono">{currentRecord.record_id.slice(0, 16)}...</span>
              </div>
            </div>
          </div>

          {/* Right Pane (7 Cols): Schema, Checks & Actions */}
          <div className="lg:col-span-7 space-y-5">
            {/* Record Overview Banner Card */}
            <div className="bg-white border border-[#E6E3DB] rounded-xl p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-mono text-[#8A887E]">
                    RECORD ID: {currentRecord.record_id}
                  </div>
                  <h3 className="text-base font-serif font-bold text-[#16241F] mt-0.5">
                    {currentRecord.document_type || "Standard Land Record"}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {/* Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      currentRecord.status === "validated"
                        ? "bg-[#EBF7F2] text-[#1D8374] border border-[#C5E8D9]"
                        : currentRecord.status === "rejected"
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : "bg-[#FAF3EE] text-[#D9714B] border border-[#F3DFC7]"
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
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      currentRecord.risk_level === "LOW"
                        ? "bg-emerald-100 text-emerald-800"
                        : currentRecord.risk_level === "MEDIUM"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {currentRecord.risk_level || "MEDIUM"}
                  </span>
                </div>
              </div>

              {/* REAL Validation Issues List from validators.py */}
              <div className="mt-4 pt-3 border-t border-[#F2EFE8]">
                <div className="text-xs font-bold text-[#16241F] mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#D9714B]" />
                  Validation Rules & Consistency Audit:
                </div>

                {currentRecord.violations && currentRecord.violations.length > 0 ? (
                  <div className="space-y-2">
                    {currentRecord.violations.map((v, i) => (
                      <div
                        key={i}
                        className="p-2.5 bg-[#FAF3EE] border border-[#F3DFC7] rounded-lg text-xs flex items-start gap-2 text-[#6D3219]"
                      >
                        <AlertTriangle className="w-4 h-4 text-[#D9714B] flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="uppercase font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-[#E8C5A5] mr-1">
                            {v.rule}
                          </strong>
                          <span>{v.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 bg-[#EBF7F2] border border-[#C5E8D9] rounded-lg text-xs flex items-center gap-2 text-[#1D8374]">
                    <CheckCircle2 className="w-4 h-4 text-[#1D8374]" />
                    <span>Zero validation rule violations detected. Record conforms to schema.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Extracted Land Record Schema Card */}
            <div className="bg-white border border-[#E6E3DB] rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#16241F]">
                  Extracted Land Record Schema
                </h4>
                <span className="text-[11px] text-[#8A887E]">
                  Field Confidence (OCR token derived)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(schemaLabels).map(([key, label]) => {
                  const val = editedFields[key] !== undefined ? editedFields[key] : "";
                  const rawConf = currentRecord.confidence_per_field?.[key];

                  // PROMPT RULE: Use REAL confidence values per field (post fallback-cleanup fix - show "Unverified" not a fake %)
                  let confDisplay = "Unverified";
                  let confStyle = "bg-neutral-100 text-neutral-600 border-neutral-200";

                  if (rawConf !== null && rawConf !== undefined && typeof rawConf === "number" && rawConf > 0) {
                    const pct = Math.round(rawConf * 100);
                    confDisplay = `${pct}%`;
                    confStyle = pct >= 80
                      ? "bg-[#EBF7F2] text-[#1D8374] border-[#C5E8D9]"
                      : "bg-[#FAF3EE] text-[#D9714B] border-[#F3DFC7]";
                  }

                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[#5A584F]">{label}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${confStyle}`}>
                          {confDisplay}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={val || ""}
                        onChange={(e) => handleFieldChange(key, e.target.value)}
                        placeholder={`Enter ${label.toLowerCase()}...`}
                        className="w-full text-xs bg-[#F7F5EF] border border-[#DDD9CE] rounded-lg px-2.5 py-1.5 text-[#16241F] focus:outline-none focus:ring-1 focus:ring-[#D9714B] focus:border-[#D9714B]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Document <-> GIS Spatial Consistency Engine Card */}
            <div className="bg-white border border-[#E6E3DB] rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#D9714B]">
                    SPATIAL CONSISTENCY ENGINE
                  </span>
                  <h4 className="text-xs font-bold text-[#16241F]">
                    Cadastral GIS Verification
                  </h4>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    currentRecord.gis?.spatial_consistency === "MATCH"
                      ? "bg-[#EBF7F2] text-[#1D8374]"
                      : currentRecord.gis?.spatial_consistency === "DISCREPANCY"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-[#F2EFE8] text-[#737167]"
                  }`}
                >
                  {currentRecord.gis?.spatial_consistency || "NOT_EVALUATED"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 p-3 bg-[#FAF9F5] border border-[#EAE7DF] rounded-lg text-center text-xs">
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#8A887E]">
                    Deed Stated Area
                  </div>
                  <div className="font-bold text-[#16241F] mt-0.5">
                    {currentRecord.gis?.area_doc_acres ? `${currentRecord.gis.area_doc_acres} Acres` : "N/A"}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-[#8A887E]">
                    Cadastral GIS Area
                  </div>
                  <div className="font-bold text-[#16241F] mt-0.5">
                    {currentRecord.gis?.area_gis_acres ? `${currentRecord.gis.area_gis_acres} Acres` : "N/A"}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-[#8A887E]">
                    Spatial Delta (Δ%)
                  </div>
                  <div className="font-bold text-[#16241F] mt-0.5">
                    {currentRecord.gis?.spatial_delta_pct !== null && currentRecord.gis?.spatial_delta_pct !== undefined
                      ? `${currentRecord.gis.spatial_delta_pct}%`
                      : "N/A"}
                  </div>
                </div>
              </div>

              {/* If geometry is available, render Leaflet map */}
              {currentRecord.gis?.geometry && (
                <div className="mt-2">
                  <CadastralLeafletMap
                    geometry={currentRecord.gis.geometry}
                    gis={currentRecord.gis}
                    height="200px"
                  />
                </div>
              )}
            </div>

            {/* Officer Remarks & Decision Buttons */}
            <div className="bg-white border border-[#E6E3DB] rounded-xl p-5 shadow-xs space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#16241F] mb-1">
                  Revenue Officer Verification Remarks / Mutation Ref
                </label>
                <textarea
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  rows={2}
                  placeholder="Enter verification rationale, mutation reference order, or audit justification..."
                  className="w-full text-xs bg-[#F7F5EF] border border-[#DDD9CE] rounded-lg p-2.5 text-[#16241F] focus:outline-none focus:ring-1 focus:ring-[#D9714B]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#F2EFE8]">
                <button
                  onClick={handleSaveCorrections}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-[#16241F] bg-white border border-[#DDD9CE] hover:bg-[#F2EFE8] transition-colors inline-flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5 text-[#737167]" />
                  Save Corrections
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDecision("REJECTED")}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors inline-flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Flag / Reject
                  </button>

                  <button
                    onClick={() => handleDecision("APPROVED")}
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-[#D9714B] hover:bg-[#C25F39] transition-colors inline-flex items-center gap-1.5 shadow-xs"
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
    </div>
  );
}
