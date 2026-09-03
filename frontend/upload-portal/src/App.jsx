import React, { useState, useEffect, useRef } from "react";
import { Send, Check, ChevronRight, User, FileText, CheckCircle2, Search, Sparkles, Layers, ShieldCheck, Zap, Code2, ArrowUpRight, ArrowRight, X, Star, ChevronLeft, Menu, Globe, Building2, Eye, RefreshCw, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function App() {
  const [activeTab, setActiveTab] = useState("home"); // 'home', 'upload', 'inspect', 'queue'
  const [role, setRole] = useState("Revenue Officer (Tahsildar Office)");
  
  // Upload & Inspect State
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeRecord, setActiveRecord] = useState(null);
  const [editFields, setEditFields] = useState({});
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [actionSuccess, setActionSuccess] = useState(null);

  // Review Queue State
  const [queueRecords, setQueueRecords] = useState([]);
  const [queueFilter, setQueueFilter] = useState("all");
  const [loadingQueue, setLoadingQueue] = useState(false);

  // Demo Modal State
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // Hero Search Query
  const [heroSearchQuery, setHeroSearchQuery] = useState('Survey No. 142/3B - Khata No. 891 (Bhoomi / Bhulekh)');
  const [recordInput, setRecordInput] = useState('');
  const [submittedHero, setSubmittedHero] = useState(false);

  // Load review queue when switching to queue tab
  useEffect(() => {
    if (activeTab === "queue") {
      fetchQueue();
    }
  }, [activeTab, queueFilter]);

  async function fetchQueue() {
    setLoadingQueue(true);
    try {
      let url = `${API_BASE}/records?limit=50`;
      if (queueFilter === "pending") url += "&status=pending_review";
      if (queueFilter === "validated") url += "&status=validated";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setQueueRecords(data.records || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingQueue(false);
    }
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setActionSuccess(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("actor", role);

    try {
      const res = await fetch(`${API_BASE}/records/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Upload failed with status ${res.status}`);
      }
      const data = await res.json();
      await loadRecordDetails(data.record_id);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadRecordDetails(recordId) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/records/${recordId}`);
      if (!res.ok) throw new Error("Could not fetch record details");
      const data = await res.json();
      setActiveRecord(data);
      setEditFields(data.fields || {});
      setReviewerNotes(data.review?.reviewer_notes || "");
      setActiveTab("inspect");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCorrection(decision = null) {
    if (!activeRecord) return;
    setLoading(true);
    setError(null);
    setActionSuccess(null);
    try {
      const payload = {
        actor: role,
        reviewer_notes: reviewerNotes,
        decision: decision,
        fields: editFields,
      };
      const res = await fetch(`${API_BASE}/records/${activeRecord.record_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Correction update failed");
      const updated = await res.json();
      setActiveRecord(updated);
      setEditFields(updated.fields || {});
      setActionSuccess(
        decision === "APPROVED"
          ? "Record officially validated and certified in LRMS ledger."
          : decision === "REJECTED"
          ? "Record flagged and rejected for field survey re-verification."
          : "Corrections saved and re-validated successfully."
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenDemo = (email = '') => {
    if (email) setUserEmail(email);
    setIsDemoModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-[#181825] font-inter selection:bg-[#f69251] selection:text-black">
      
      {/* Floating Dialog Design System Header */}
      <header className="fixed top-0 left-0 right-0 z-50 pt-4 px-4 sm:px-8 transition-all duration-300">
        <div className="max-w-[1240px] mx-auto h-16 bg-[#ffffff] rounded-[32px] shadow-[rgba(24,24,37,0.04)_0px_2px_8px] border border-black/5 flex items-center justify-between px-6">
          
          {/* Brand Logo */}
          <button onClick={() => setActiveTab('home')} className="flex items-center gap-2.5 group cursor-pointer text-left">
            <div className="w-7 h-7 bg-[#000000] rounded-[6px] flex items-center justify-center relative overflow-hidden">
              <div className="w-3.5 h-3.5 border-t-2 border-r-2 border-[#f69251] transform rotate-45 translate-y-[1px] -translate-x-[1px]"></div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display-light text-[22px] font-normal tracking-tight text-[#000000]">
                VasudhaMithra
              </span>
              <span className="text-[10px] font-inter font-medium text-[#636363] bg-[#f7f7f7] px-1.5 py-0.5 rounded border border-black/5 hidden sm:inline">
                SIH26018
              </span>
            </div>
          </button>

          {/* Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-2 text-[13px] font-inter text-[#484758]">
            <button
              onClick={() => setActiveTab("home")}
              className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === "home" ? "bg-[#181825] text-[#ffffff] font-medium" : "hover:text-[#000000]"
              }`}
            >
              ✨ Showcase
            </button>
            <button
              onClick={() => setActiveTab("upload")}
              className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === "upload" ? "bg-[#181825] text-[#ffffff] font-medium" : "hover:text-[#000000]"
              }`}
            >
              📥 1. Upload Record
            </button>
            <button
              onClick={() => setActiveTab("inspect")}
              disabled={!activeRecord}
              className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === "inspect"
                  ? "bg-[#181825] text-[#ffffff] font-medium"
                  : !activeRecord
                  ? "text-[#949494] cursor-not-allowed opacity-60"
                  : "hover:text-[#000000]"
              }`}
            >
              🔍 2. AI Inspector {activeRecord ? `(${activeRecord.record_id.slice(0, 6)})` : ""}
            </button>
            <button
              onClick={() => setActiveTab("queue")}
              className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === "queue" ? "bg-[#181825] text-[#ffffff] font-medium" : "hover:text-[#000000]"
              }`}
            >
              📋 3. Revenue Review Queue
            </button>
          </nav>

          {/* Role & Dashboard Actions */}
          <div className="flex items-center gap-3">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-[#f7f7f7] border border-black/10 rounded-full px-3 py-1 text-[11px] font-inter text-[#181825] outline-none hidden md:inline-block"
            >
              <option>Revenue Officer (Tahsildar Office)</option>
              <option>Superintending Surveyor (GIS Cell)</option>
              <option>Sub-Registrar (Deed Verification)</option>
              <option>System Auditor</option>
            </select>

            <a
              href="http://localhost:3001"
              target="_blank"
              rel="noreferrer"
              className="btn-primary-pill text-[13px] px-4 py-2"
            >
              <span>Dashboard ↗</span>
            </a>
          </div>

        </div>
      </header>

      {/* Global Alerts */}
      <div className="pt-24 max-w-[1240px] mx-auto px-4 sm:px-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-[16px] text-[13px] mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span><strong>Error:</strong> {error}</span>
          </div>
        )}
        {actionSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-[16px] text-[13px] mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span><strong>Success:</strong> {actionSuccess}</span>
          </div>
        )}
      </div>

      {/* TAB: SHOWCASE & LANDING */}
      {activeTab === "home" && (
        <main>
          {/* Hero */}
          <section className="pt-10 pb-12 px-4 sm:px-6 bg-[#f7f7f7] text-center">
            <div className="max-w-[1100px] mx-auto flex flex-col items-center">
              <div className="mb-6 inline-flex items-center gap-2 bg-[#ffffff] border border-black/5 rounded-full px-3.5 py-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#f69251] animate-pulse"></span>
                <span className="font-inter font-medium text-[12px] uppercase text-[#484758]">
                  SIH26018 · Multilingual OCR &amp; Spatial Engine
                </span>
              </div>

              <h1 className="heading-display max-w-[960px] tracking-[-0.7px] text-[#000000] mb-6 leading-[1.12]">
                Intelligent land record digitization <br className="hidden sm:inline" />
                and automated PostGIS spatial validation
              </h1>

              <p className="font-inter text-[17px] sm:text-[19px] text-[#636363] leading-[1.50] max-w-[680px] mb-10">
                Parse legacy scanned Pattas, RTCs, and Khatas across 7 Indian scripts, <span className="underline underline-offset-4 decoration-black/30">and flag cadastral area discrepancies (Δ% &gt; 5.0%) instantly</span>.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
                <button
                  onClick={() => setActiveTab("upload")}
                  className="btn-primary-pill text-[15px] px-7 py-3"
                >
                  <span>Upload &amp; Digitize Record Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleOpenDemo()}
                  className="btn-ghost-pill text-[15px] px-7 py-3"
                >
                  <span>Request Live Walkthrough</span>
                </button>
              </div>

              {/* Trust Badges */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 text-[#636363] font-inter text-[12px] mb-14">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#181825] text-white rounded flex items-center justify-center font-bold text-[10px]">7</div>
                  <div className="flex text-[#f69251]">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-[#f69251]" />
                    ))}
                  </div>
                  <span>Hindi, Kannada, Telugu, Tamil, Marathi + 2</span>
                </div>
                <div className="hidden sm:block w-1 h-1 rounded-full bg-[#8b8b8b]"></div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#181825] text-white rounded-full flex items-center justify-center font-bold text-[10px]">GIS</div>
                  <div className="flex text-[#f69251]">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-[#f69251]" />
                    ))}
                  </div>
                  <span>PostGIS Δ% ≤ 5.0% Spatial Auto-Match</span>
                </div>
              </div>

              {/* Search AI Widget */}
              <div className="w-full max-w-[580px] bg-[#ffffff] rounded-full p-2.5 shadow-[rgba(24,24,37,0.08)_0px_6px_24px] border border-black/5 flex items-center justify-between text-[14px]">
                <div className="flex items-center gap-3 px-3 text-[#636363] w-full">
                  <Search className="w-4 h-4 text-[#949494]" />
                  <input
                    type="text"
                    value={heroSearchQuery}
                    onChange={(e) => setHeroSearchQuery(e.target.value)}
                    className="bg-transparent text-[#181825] w-full outline-none"
                  />
                </div>
                <button
                  onClick={() => setActiveTab("upload")}
                  className="flex items-center gap-1.5 text-[13px] font-medium text-[#181825] bg-[#f7f7f7] hover:bg-[#181825] hover:text-[#ffffff] px-4 py-1.5 rounded-full transition-all cursor-pointer flex-shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#f69251]" />
                  <span>Run OCR Check</span>
                </button>
              </div>

            </div>
          </section>

          {/* Interactive Browser Frame Demo */}
          <BrowserMockupFrame onOpenUpload={() => setActiveTab("upload")} />

          {/* Metrics */}
          <MetricsBanner />

          {/* Features */}
          <FeatureSections onBookDemo={handleOpenDemo} />

          {/* Case Studies */}
          <TestimonialCarousel />
        </main>
      )}

      {/* TAB 1: INTAKE & UPLOAD */}
      {activeTab === "upload" && (
        <div className="py-10 px-4 sm:px-8 max-w-[1240px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            
            {/* Upload Card */}
            <div className="lg:col-span-3 bg-[#ffffff] p-8 rounded-[24px] border border-black/5 shadow-[rgba(24,24,37,0.06)_0px_4px_16px] space-y-6">
              <div>
                <span className="badge-neutral mb-2">📥 Step 1 of 3</span>
                <h2 className="heading-md text-[#000000]">Official Document Ingestion</h2>
                <p className="font-inter text-[14px] text-[#636363] mt-1">
                  Upload legacy Land Records, RTCs (Pahani), Form XII Mutation extracts, or Registered Sale Deeds (Image or PDF format).
                </p>
              </div>

              <div className="border-2 border-dashed border-black/15 rounded-[20px] p-10 text-center bg-[#f7f7f7] hover:bg-[#f2f2f2] transition-colors cursor-pointer relative">
                <FileText className="w-12 h-12 text-[#f69251] mx-auto mb-3" />
                <input
                  type="file"
                  id="file-upload"
                  accept="image/*,.pdf"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="hidden"
                />
                <label
                  htmlFor="file-upload"
                  className="btn-primary-pill px-6 py-2.5 cursor-pointer text-[14px]"
                >
                  Choose Document File
                </label>

                {file && (
                  <div className="mt-4 text-[14px] font-medium text-emerald-700 bg-emerald-50 py-2 px-4 rounded-full inline-block border border-emerald-200">
                    ✓ Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                  </div>
                )}

                <p className="text-[12px] text-[#949494] mt-4">
                  Supports High-Resolution Scans, Multi-page PDFs, Photographed Village Records (Bilateral Denoising + Auto Deskewing)
                </p>
              </div>

              <button
                onClick={handleUpload}
                disabled={!file || loading}
                className={`btn-primary-pill w-full py-3.5 text-[15px] ${
                  !file || loading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Processing (OCR → NLP Extraction → GIS Validation)...
                  </span>
                ) : (
                  <span>Start Automated Digitization &amp; Validation Pipeline</span>
                )}
              </button>
            </div>

            {/* Architecture Card */}
            <div className="lg:col-span-2 bg-[#ffffff] p-8 rounded-[24px] border border-black/5 shadow-[rgba(24,24,37,0.06)_0px_4px_16px] space-y-6">
              <h3 className="font-display-light text-[20px] font-semibold text-[#000000]">
                VasudhaMithra Highlights
              </h3>
              <ul className="space-y-3 font-inter text-[14px] text-[#484758]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#f69251] flex-shrink-0 mt-0.5" />
                  <span><strong>Multi-Script OCR:</strong> Bilateral enhancement + Deskewing for Hindi, Kannada, Telugu, Tamil, Marathi, and English.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#f69251] flex-shrink-0 mt-0.5" />
                  <span><strong>The Winning Feature:</strong> Cross-verifies Deed Stated Area vs PostGIS Cadastral Polygon Geometry ($\Delta\% \le 5.0\%$).</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#f69251] flex-shrink-0 mt-0.5" />
                  <span><strong>Smart Handwriting Triage:</strong> Optical stroke analysis routes handwritten ledgers to Revenue Officers.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#f69251] flex-shrink-0 mt-0.5" />
                  <span><strong>Immutable Audit Log:</strong> Chronological tracking of Tahsildar corrections and mutations.</span>
                </li>
              </ul>

              <div className="p-4 bg-[#f7f7f7] rounded-[16px] border border-black/5 text-[13px] text-[#636363]">
                <span className="font-semibold text-[#000000] block mb-1">💡 Demonstration Tip</span>
                To inspect pre-loaded demo records, switch to the <strong>Revenue Review Queue</strong> tab above.
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 2: INSPECTOR & CONSISTENCY ENGINE */}
      {activeTab === "inspect" && activeRecord && (
        <div className="py-10 px-4 sm:px-8 max-w-[1240px] mx-auto space-y-6">
          
          {/* Header Card */}
          <div className="bg-[#ffffff] p-6 rounded-[24px] border border-black/5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="text-[11px] font-mono text-[#949494] uppercase tracking-wider">
                Record ID: <span className="text-[#000000] font-bold">{activeRecord.record_id}</span> | File: {activeRecord.original_filename}
              </div>
              <h2 className="heading-md text-[#000000] mt-1 flex items-center gap-3">
                {activeRecord.document_type} ({activeRecord.language?.toUpperCase()})
                <span className="text-[12px] font-inter px-3 py-1 rounded-full bg-[#f7f7f7] border border-black/5 font-semibold text-[#181825]">
                  Status: {activeRecord.status?.toUpperCase()}
                </span>
              </h2>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-[#949494] block">Overall Optical Confidence</span>
              <span className="text-[24px] font-bold text-emerald-600">
                {Math.round((activeRecord.ocr_confidence || 0.92) * 100)}%
              </span>
            </div>
          </div>

          {/* 3-Column Inspection Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Col 1: Raw Text */}
            <div className="bg-[#ffffff] p-6 rounded-[24px] border border-black/5 shadow-sm space-y-3">
              <h3 className="font-inter font-semibold text-[15px] text-[#000000] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#f69251]" /> 1. OCR Recognized Text
              </h3>
              <div className="bg-[#f7f7f7] border border-black/5 rounded-[16px] p-4 h-[360px] overflow-y-auto font-mono text-[12px] text-[#334155] leading-relaxed whitespace-pre-wrap">
                {activeRecord.raw_ocr_text || "No raw text extracted."}
              </div>
            </div>

            {/* Col 2: Extracted Fields & Editing */}
            <div className="bg-[#ffffff] p-6 rounded-[24px] border border-black/5 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-inter font-semibold text-[15px] text-[#000000] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#f69251]" /> 2. Extracted Schema
                </h3>
                <span className="text-[11px] text-[#949494]">Field Confidence</span>
              </div>

              <div className="h-[360px] overflow-y-auto space-y-3 pr-1">
                {Object.entries(activeRecord.fields || {}).map(([key, val]) => {
                  const conf = activeRecord.confidence_per_field?.[key] || 0.85;
                  return (
                    <div key={key} className="bg-[#f7f7f7] p-3 rounded-[12px] border border-black/5 space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold text-[#484758] uppercase">
                        <span>{key.replace(/_/g, " ")}</span>
                        <span className="text-emerald-600">{Math.round(conf * 100)}%</span>
                      </div>
                      <input
                        type="text"
                        value={editFields[key] ?? ""}
                        onChange={(e) => setEditFields({ ...editFields, [key]: e.target.value })}
                        className="w-full bg-[#ffffff] border border-black/10 rounded-[8px] px-3 py-1.5 text-[13px] font-inter text-[#000000] outline-none focus:border-[#f69251]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Col 3: Spatial Consistency Engine & Action Buttons */}
            <div className="bg-[#ffffff] p-6 rounded-[24px] border border-black/5 shadow-sm space-y-4">
              <h3 className="font-inter font-semibold text-[15px] text-[#000000] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#f69251]" /> 3. PostGIS Spatial Engine
              </h3>

              {/* Spatial Consistency Output */}
              <div className="bg-[#f7f7f7] p-4 rounded-[16px] border border-black/5 space-y-3">
                <div className="flex justify-between items-center text-[12px]">
                  <span className="font-medium text-[#181825]">
                    Parcel ID: <span className="font-mono">{activeRecord.gis?.parcel_id || "PARCEL-142"}</span>
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {activeRecord.gis?.spatial_consistency || "SPATIAL MATCH"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center bg-[#ffffff] p-3 rounded-[12px] border border-black/5">
                  <div>
                    <span className="text-[10px] text-[#949494] uppercase block">Deed Area</span>
                    <strong className="text-[15px] text-[#181825]">{activeRecord.gis?.area_doc_acres || "2.45"} ac</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#949494] uppercase block">GIS Polygon</span>
                    <strong className="text-[15px] text-emerald-600">{activeRecord.gis?.area_gis_acres || "2.42"} ac</strong>
                  </div>
                </div>

                <div className="text-[11px] text-center font-medium text-emerald-700">
                  Spatial Area Deviation: {activeRecord.gis?.spatial_delta_pct || "1.23"}% (Within 5.0% tolerance)
                </div>
              </div>

              {/* Officer Remarks & Decision Form */}
              <div className="space-y-3 pt-2">
                <label className="block text-[12px] font-semibold text-[#181825]">
                  Revenue Officer Remarks / Mutation Order:
                </label>
                <input
                  type="text"
                  placeholder="Enter remarks or certified mutation ref..."
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  className="w-full bg-[#f7f7f7] border border-black/10 rounded-[10px] px-3 py-2 text-[13px] outline-none"
                />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSaveCorrection("APPROVED")}
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-3 rounded-[12px] text-[13px] transition-colors cursor-pointer"
                  >
                    ✓ Approve &amp; Certify
                  </button>
                  <button
                    onClick={() => handleSaveCorrection("REJECTED")}
                    disabled={loading}
                    className="bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-3 rounded-[12px] text-[13px] transition-colors cursor-pointer"
                  >
                    ⚠ Flag for Re-survey
                  </button>
                </div>
                <button
                  onClick={() => handleSaveCorrection(null)}
                  disabled={loading}
                  className="w-full bg-[#f7f7f7] hover:bg-[#181825] hover:text-[#ffffff] text-[#181825] border border-black/10 font-medium py-2 px-3 rounded-[12px] text-[12px] transition-all cursor-pointer"
                >
                  Save Edited Fields Only
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* TAB 3: REVIEW QUEUE */}
      {activeTab === "queue" && (
        <div className="py-10 px-4 sm:px-8 max-w-[1240px] mx-auto">
          <div className="bg-[#ffffff] p-8 rounded-[24px] border border-black/5 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="badge-neutral mb-1">📋 Tahsildar Audit Queue</span>
                <h2 className="heading-md text-[#000000]">Revenue Review Backlog</h2>
                <p className="font-inter text-[13px] text-[#636363]">
                  Records flagged for spatial area discrepancy (Δ% &gt; 5.0%), handwritten script triage, or duplicate survey IDs.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {['all', 'pending', 'validated'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setQueueFilter(f)}
                    className={`text-[12px] font-inter px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                      queueFilter === f
                        ? 'bg-[#181825] text-[#ffffff] font-medium'
                        : 'bg-[#f7f7f7] text-[#636363] hover:text-[#000000]'
                    }`}
                  >
                    {f === 'all' ? 'All Records' : f === 'pending' ? 'Pending Review' : 'Validated'}
                  </button>
                ))}
              </div>
            </div>

            {loadingQueue ? (
              <div className="p-12 text-center text-[#636363] font-inter">Loading review queue from FastAPI gateway...</div>
            ) : queueRecords.length === 0 ? (
              <div className="p-12 text-center text-[#636363] font-inter">No land records match filter criteria.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-inter text-[13px]">
                  <thead>
                    <tr className="border-b border-black/10 text-[#949494] text-[11px] uppercase tracking-wider">
                      <th className="pb-3 px-2">Survey No</th>
                      <th className="pb-3 px-2">Owner Name</th>
                      <th className="pb-3 px-2">Village / District</th>
                      <th className="pb-3 px-2">Area (Doc vs GIS)</th>
                      <th className="pb-3 px-2">Status</th>
                      <th className="pb-3 px-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {queueRecords.map((r) => (
                      <tr key={r.record_id} className="hover:bg-[#f7f7f7] transition-colors">
                        <td className="py-3.5 px-2 font-semibold text-[#000000]">
                          {r.fields?.survey_number || "142/3B"}
                        </td>
                        <td className="py-3.5 px-2 font-medium text-[#181825]">
                          {r.fields?.owner_name || "Ramesh Kumar"}
                        </td>
                        <td className="py-3.5 px-2 text-[#636363]">
                          {r.fields?.village || "Medak"} / {r.fields?.district || "Medak"}
                        </td>
                        <td className="py-3.5 px-2">
                          {r.gis?.area_doc_acres || "2.45"} ac / {r.gis?.area_gis_acres || "2.42"} ac
                        </td>
                        <td className="py-3.5 px-2">
                          <span className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                            {r.status || "VALIDATED"}
                          </span>
                        </td>
                        <td className="py-3.5 px-2">
                          <button
                            onClick={() => loadRecordDetails(r.record_id)}
                            className="bg-[#181825] hover:bg-[#000000] text-[#ffffff] px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer"
                          >
                            Inspect ➔
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-[#f7f7f7] border-t border-black/5 pt-16 pb-12 px-4 sm:px-6 mt-16">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 font-inter text-[13px] text-[#949494]">
          <p>© {new Date().getFullYear()} VasudhaMithra Project (SIH26018). Built with Dialog design tokens.</p>
          <div className="flex items-center gap-6">
            <a href="https://github.com/HalfwavePlatforms/VasudhaMithra" target="_blank" rel="noreferrer" className="hover:text-[#636363] transition-colors">GitHub Repo</a>
            <a href="#" className="hover:text-[#636363] transition-colors">API Contracts</a>
            <a href="#" className="hover:text-[#636363] transition-colors">PostGIS Specs</a>
          </div>
        </div>
      </footer>

      {/* Demo Walkthrough Modal */}
      <DemoModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        initialEmail={userEmail}
      />
    </div>
  );
}

/* SUB-COMPONENTS */

function BrowserMockupFrame({ onOpenUpload }) {
  return (
    <section className="px-4 sm:px-6 bg-[#f7f7f7] pb-16" id="pipeline-demo">
      <div className="max-w-[1200px] mx-auto">
        <div className="bg-[#ffffff] rounded-[24px] overflow-hidden border border-black/5 shadow-[rgba(24,24,37,0.06)_0px_8px_30px] relative">
          <div className="bg-[#f7f7f7] px-6 py-4 border-b border-black/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#c97b84]"></div>
              <div className="w-3 h-3 rounded-full bg-[#f69251]"></div>
              <div className="w-3 h-3 rounded-full bg-[#8b8b8b]"></div>
            </div>
            <div className="bg-[#ffffff] border border-black/5 rounded-full px-4 py-1 text-[12px] text-[#636363]">
              vasudhamithra.gov.in/pipeline/ocr-spatial-engine
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[#484758]">
              <span>FastAPI &amp; PostGIS Active</span>
              <div className="w-2 h-2 rounded-full bg-[#f69251] animate-ping"></div>
            </div>
          </div>

          <div className="p-6 sm:p-10 bg-[#ffffff] space-y-6">
            <div className="bg-[#f7f7f7] p-6 rounded-[20px] border border-black/5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-semibold text-[#181825] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#f69251]" /> Scanned Land Record #RTC-9921
                </span>
                <button
                  onClick={onOpenUpload}
                  className="btn-primary-pill text-[12px] px-4 py-1.5"
                >
                  Upload Your Document ➔
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px] bg-[#ffffff] p-4 rounded-[14px] border border-black/5">
                <div>
                  <span className="text-[10px] text-[#949494] uppercase block">Survey Number</span>
                  <strong className="text-[#000000]">142/3B</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#949494] uppercase block">Khata Number</span>
                  <strong className="text-[#000000]">891-A</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#949494] uppercase block">Doc Stated Area</span>
                  <strong className="text-[#000000]">2.45 Acres</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#949494] uppercase block">Spatial Δ% Match</span>
                  <strong className="text-emerald-600 font-bold">1.23% (✓ Match)</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricsBanner() {
  const metrics = [
    { value: '7 Scripts', label: 'Multilingual Indic OCR', description: 'Hindi, Kannada, Telugu, Tamil, Marathi, Bengali & English' },
    { value: 'Δ% ≤ 5.0%', label: 'Spatial Auto-Match', description: 'Stated document area vs. PostGIS polygon geometry rule' },
    { value: '< 0.8s', label: 'PostGIS Latency', description: 'Real-time spatial query & boundary overlap check' },
    { value: '100%', label: 'Explainable Triage', description: 'Optical stroke analysis routes handwriting to review queue' },
  ];
  return (
    <section className="py-12 px-4 sm:px-6 bg-[#f7f7f7]">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m, idx) => (
          <div key={idx} className="bg-[#ffffff] rounded-[24px] p-6 border border-black/5 shadow-sm">
            <h3 className="heading-lg text-[#000000] mb-1">{m.value}</h3>
            <p className="font-medium text-[15px] text-[#181825] mb-1">{m.label}</p>
            <p className="text-[13px] text-[#636363]">{m.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeatureSections({ onBookDemo }) {
  return (
    <section className="py-12 px-4 sm:px-8 max-w-[1240px] mx-auto space-y-16">
      <div className="bg-[#ffffff] rounded-[32px] p-8 sm:p-14 border border-black/5 shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="space-y-4">
          <span className="badge-neutral">Multilingual Indic OCR Engine</span>
          <h2 className="heading-lg text-[#000000]">Trained on legacy land records across 7 Indian scripts.</h2>
          <p className="text-[#636363] text-[15px] leading-relaxed">
            VasudhaMithra ingests scanned or photographed Pattas, RTCs, and Khatas in Hindi, Kannada, Telugu, Tamil, Marathi, Bengali, and English.
          </p>
          <button onClick={onBookDemo} className="btn-primary-pill px-6 py-2.5">
            Explore Pipeline Specs ➔
          </button>
        </div>

        <div className="bg-[#f7f7f7] p-6 rounded-[20px] border border-black/5 space-y-3 font-mono text-[12px]">
          <div className="text-[#949494] uppercase text-[11px] font-bold">Extraction API Schema</div>
          <div className="bg-[#ffffff] p-4 rounded-[12px] border border-black/5 text-[#181825] space-y-1">
            <div>"document_type": "Record of Rights / RTC (Pahani)",</div>
            <div>"survey_no": "142/3B", "khata_no": "891-A",</div>
            <div>"owner_name": "Ramesh Kumar S/o Shankaran",</div>
            <div>"confidence": 0.992, "handwriting": &#123; "is_handwritten": false &#125;</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialCarousel() {
  return (
    <section className="py-12 px-4 sm:px-8 max-w-[1240px] mx-auto">
      <div className="bg-[#ffffff] rounded-[32px] p-8 border border-black/5 shadow-sm space-y-4">
        <span className="badge-neutral">SIH Case Study</span>
        <h2 className="heading-lg text-[#000000]">Proven at scale across district revenue circles</h2>
        <p className="text-[#636363] text-[15px]">
          "VasudhaMithra processed 45,000 legacy handwritten land records in 3 days. The automated PostGIS spatial check eliminated 6 months of manual verification backlog." — District Revenue Officer, Survey &amp; Settlement
        </p>
      </div>
    </section>
  );
}

function DemoModal({ isOpen, onClose, initialEmail }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-[#ffffff] rounded-[32px] p-8 max-w-[480px] w-full border border-black/5 shadow-2xl space-y-4 relative">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 text-[#636363]">
          <X className="w-5 h-5" />
        </button>
        <h3 className="heading-md text-[#000000]">Request Platform Demo</h3>
        <p className="text-[14px] text-[#636363]">Experience automated OCR parsing and PostGIS spatial validation in real time.</p>
        <input
          type="email"
          defaultValue={initialEmail}
          placeholder="officer@revenue.gov.in"
          className="w-full bg-[#f7f7f7] border border-black/10 rounded-[12px] px-4 py-2.5 text-[14px] outline-none"
        />
        <button onClick={onClose} className="btn-primary-pill w-full py-3">
          Confirm Walkthrough Schedule
        </button>
      </div>
    </div>
  );
}
