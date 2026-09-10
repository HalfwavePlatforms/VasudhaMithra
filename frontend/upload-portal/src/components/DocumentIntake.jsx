import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  RefreshCw,
  Sparkles,
  ShieldCheck
} from "lucide-react";

export default function DocumentIntake({
  apiBase,
  onUploadSuccess,
  setActiveTab,
  setSelectedRecordId,
}) {
  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState("auto");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pipelineStage, setPipelineStage] = useState("");
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const detectLanguageFromFilename = (filename) => {
    if (!filename) return "auto";
    const fname = filename.toLowerCase();
    if (["karnataka", "bhoomi", "rtc", "pahani", "kannada", "_kn_"].some((k) => fname.includes(k))) return "kn";
    if (["maharashtra", "satbara", "7_12", "7-12", "712", "mahabhulekh", "marathi", "_mr_"].some((k) => fname.includes(k))) return "mr";
    if (["telangana", "dharani", "adangal", "telugu", "_te_"].some((k) => fname.includes(k))) return "te";
    if (["tamil", "patta", "chitta", "tamilnadu", "_ta_"].some((k) => fname.includes(k))) return "ta";
    if (["bengal", "banglarbhumi", "bengali", "_bn_"].some((k) => fname.includes(k))) return "bn";
    if (["khasra", "khatauni", "bhopal", "madhya", "hindi", "_hi_"].some((k) => fname.includes(k))) return "hi";
    if (["english", "deed", "_en_"].some((k) => fname.includes(k))) return "en";
    return "auto";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selected = e.dataTransfer.files[0];
      setFile(selected);
      setError(null);
      setUploadResult(null);
      const autoLang = detectLanguageFromFilename(selected.name);
      if (autoLang !== "auto") {
        setLanguage(autoLang);
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      setFile(selected);
      setError(null);
      setUploadResult(null);
      const autoLang = detectLanguageFromFilename(selected.name);
      if (autoLang !== "auto") {
        setLanguage(autoLang);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(15);
    setPipelineStage("Uploading document scan to secure gateway...");

    // Responsive progress interval so user never sees a frozen spinner
    let currentPct = 15;
    const interval = setInterval(() => {
      currentPct += Math.floor(Math.random() * 8) + 4;
      if (currentPct < 40) {
        setPipelineStage("Pre-processing image & detecting script...");
        setUploadProgress(currentPct);
      } else if (currentPct < 65) {
        setPipelineStage("Neural OCR stroke recognition in progress...");
        setUploadProgress(currentPct);
      } else if (currentPct < 85) {
        setPipelineStage("Extracting cadastral fields & NLP validation...");
        setUploadProgress(currentPct);
      } else if (currentPct < 94) {
        setPipelineStage("Geodetic cadastre cross-check & audit chain...");
        setUploadProgress(Math.min(currentPct, 94));
      }
    }, 350);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("language", language);
    formData.append("actor", "Deepak G.M. (District Admin)");

    try {
      const token = localStorage.getItem("vasudha_token");
      const headers = {
        "X-Role": "tahsildar",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${apiBase}/records/upload`, {
        method: "POST",
        headers,
        body: formData,
      });

      clearInterval(interval);

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("vasudha_token");
          localStorage.removeItem("vasudha_auth");
          throw new Error("Session expired or invalid. Please refresh the page to sign in again.");
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Upload failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      setUploadProgress(100);
      setPipelineStage("Digitization completed successfully!");
      setUploadResult(data);

      if (setSelectedRecordId) {
        setSelectedRecordId(data.record_id);
      }
      if (onUploadSuccess) {
        onUploadSuccess(data);
      }

      // Automatically navigate to Verification Desk pre-loaded with this exact record
      setTimeout(() => {
        if (setActiveTab) {
          setActiveTab("verification_desk");
        }
      }, 750);
    } catch (err) {
      clearInterval(interval);
      setError(err.message || "Failed to upload document. Ensure API Gateway is running.");
    } finally {
      clearInterval(interval);
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setUploadResult(null);
    setError(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-8 pb-16 max-w-4xl mx-auto">
      {/* Page Header */}
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
          DOCUMENT INGESTION
        </span>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[var(--color-text-primary)] tracking-tight mt-1">
          Document intake
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Upload scanned land deeds, mutation registers, and Khasra extracts for automated OCR and spatial validation.
        </p>
      </div>

      {/* Upload Form Card */}
      {!uploadResult ? (
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-8 shadow-xs space-y-6">
          {/* Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)]"
                : file
                ? "border-[var(--color-success)] bg-[var(--color-success-bg)]"
                : "border-[var(--color-border-strong)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-primary)]"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center">
                <UploadCloud className="w-6 h-6" />
              </div>

              {file ? (
                <div className="space-y-1">
                  <div className="text-sm font-bold text-[var(--color-text-primary)]">
                    {file.name}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {(file.size / 1024).toFixed(1)} KB · Click or drag to replace
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Drop your scanned deed or ledger here, or{" "}
                    <span className="text-[var(--color-accent-text)] underline">browse</span>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    Supports PDF, PNG, JPG, TIFF up to 25MB
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form Options (Real parameters accepted by backend) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1.5">
                Language / Script Hint
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full text-xs bg-[var(--color-bg-primary)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2 text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              >
                <option value="auto">Auto-detect script (Recommended)</option>
                <option value="hi">Hindi (Devanagari - MP / UP / Rajasthan)</option>
                <option value="kn">Kannada (Karnataka Bhoomi RTC)</option>
                <option value="en">English (Survey Deeds)</option>
                <option value="mr">Marathi (7/12 Extract)</option>
                <option value="ta">Tamil (Patta / Chitta)</option>
                <option value="te">Telugu (Adangal / Pahani)</option>
              </select>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                Passed to OCR pipeline for script-specific preprocessing.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1.5">
                Target Registry Role
              </label>
              <input
                type="text"
                disabled
                value="Tahsildar / Revenue Inspector (Authenticated)"
                className="w-full text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2 text-[var(--color-text-muted)] cursor-not-allowed"
              />
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                Authorized via RBAC X-Role header.
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-lg flex items-center gap-2 text-xs text-[var(--color-error)]">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload Button & Progress */}
          <div className="pt-4 border-t border-[var(--color-border)] space-y-3">
            {uploading && (
              <div className="space-y-1.5 animate-fadeIn">
                <div className="flex justify-between items-center text-xs text-[var(--color-text-muted)]">
                  <span className="font-medium text-[var(--color-text-primary)] flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-accent)]" />
                    {pipelineStage || "Processing pipeline..."}
                  </span>
                  <span className="font-mono font-bold text-[var(--color-accent-text)]">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-[var(--color-bg-tertiary)] rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[var(--color-accent)] h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--color-text-muted)]">
                {file ? `Ready to process: ${file.name}` : "No file selected"}
              </div>

              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`px-6 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                  !file || uploading
                    ? "bg-[var(--color-border-strong)] text-[var(--color-text-muted)] cursor-not-allowed"
                    : "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] shadow-xs cursor-pointer"
                }`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing ({uploadProgress}%)...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    Start Digitization & Validation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Real Upload Result Card */
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 text-[var(--color-success)]">
            <div className="w-10 h-10 rounded-full bg-[var(--color-success-bg)] border border-[var(--color-success-border)] flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-[var(--color-text-primary)]">
                Document Ingested Successfully
              </h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                Pipeline completed: OCR extraction, rule validation & GIS cross-check.
              </p>
            </div>
          </div>

          {/* Returned Real Data Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)]">
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">
                RECORD ID
              </span>
              <div className="text-xs font-mono font-semibold text-[var(--color-text-primary)] truncate mt-1">
                {uploadResult.record_id}
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">
                STATUS
              </span>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    uploadResult.status === "validated"
                      ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]"
                      : "bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border border-[var(--color-border)]"
                  }`}
                >
                  ● {uploadResult.status === "validated" ? "Validated" : "Pending Review"}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">
                RISK LEVEL
              </span>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                    uploadResult.risk_level === "LOW"
                      ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]"
                      : uploadResult.risk_level === "MEDIUM"
                      ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]"
                      : "bg-[var(--color-error-bg)] text-[var(--color-error)] border border-[var(--color-error-border)]"
                  }`}
                >
                  {uploadResult.risk_level || "MEDIUM"}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">
                SPATIAL GIS
              </span>
              <div className="text-xs font-semibold text-[var(--color-text-primary)] mt-1">
                {uploadResult.spatial_consistency || "NOT_EVALUATED"}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[var(--color-border)]">
            <button
              onClick={resetForm}
              className="text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
            >
              + Upload another document
            </button>

            <button
              onClick={() => {
                if (setSelectedRecordId) setSelectedRecordId(uploadResult.record_id);
                if (setActiveTab) setActiveTab("verification_desk");
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-xs font-semibold text-white bg-[var(--color-sidebar-bg)] hover:bg-[var(--color-sidebar-hover)] inline-flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              Inspect in Verification Desk
              <ArrowRight className="w-4 h-4 text-[var(--color-accent)]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
