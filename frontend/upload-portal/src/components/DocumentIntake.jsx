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
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

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
      setFile(e.dataTransfer.files[0]);
      setError(null);
      setUploadResult(null);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(20);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("language", language);
    formData.append("actor", "Deepak G.M. (District Admin)");

    try {
      setUploadProgress(45);
      const res = await fetch(`${apiBase}/records/upload`, {
        method: "POST",
        headers: {
          "X-Role": "tahsildar",
        },
        body: formData,
      });

      setUploadProgress(85);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Upload failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      setUploadProgress(100);
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
      setError(err.message || "Failed to upload document. Ensure API Gateway is running.");
    } finally {
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
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#D9714B]">
          DOCUMENT INGESTION
        </span>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#16241F] tracking-tight mt-1">
          Document intake
        </h1>
        <p className="text-sm text-[#737167] mt-1">
          Upload scanned land deeds, mutation registers, and Khasra extracts for automated OCR and spatial validation.
        </p>
      </div>

      {/* Upload Form Card */}
      {!uploadResult ? (
        <div className="bg-white border border-[#E6E3DB] rounded-xl p-8 shadow-xs space-y-6">
          {/* Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-[#D9714B] bg-[#FAF3EE]"
                : file
                ? "border-[#1D8374] bg-[#EBF7F2]"
                : "border-[#DDD9CE] hover:border-[#D9714B] hover:bg-[#FAF9F5]"
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
              <div className="w-12 h-12 rounded-full bg-[#FAF3EE] text-[#D9714B] flex items-center justify-center">
                <UploadCloud className="w-6 h-6" />
              </div>

              {file ? (
                <div className="space-y-1">
                  <div className="text-sm font-bold text-[#16241F]">
                    {file.name}
                  </div>
                  <div className="text-xs text-[#737167]">
                    {(file.size / 1024).toFixed(1)} KB · Click or drag to replace
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-[#16241F]">
                    Drop your scanned deed or ledger here, or{" "}
                    <span className="text-[#D9714B] underline">browse</span>
                  </div>
                  <div className="text-xs text-[#8A887E]">
                    Supports PDF, PNG, JPG, TIFF up to 25MB
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form Options (Real parameters accepted by backend) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-[#16241F] mb-1.5">
                Language / Script Hint
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full text-xs bg-[#F7F5EF] border border-[#DDD9CE] rounded-lg px-3 py-2 text-[#16241F] focus:outline-none focus:ring-1 focus:ring-[#D9714B]"
              >
                <option value="auto">Auto-detect script (Recommended)</option>
                <option value="hi">Hindi (Devanagari - MP / UP / Rajasthan)</option>
                <option value="kn">Kannada (Karnataka Bhoomi RTC)</option>
                <option value="en">English (Survey Deeds)</option>
                <option value="mr">Marathi (7/12 Extract)</option>
                <option value="ta">Tamil (Patta / Chitta)</option>
                <option value="te">Telugu (Adangal / Pahani)</option>
              </select>
              <p className="text-[11px] text-[#8A887E] mt-1">
                Passed to OCR pipeline for script-specific preprocessing.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#16241F] mb-1.5">
                Target Registry Role
              </label>
              <input
                type="text"
                disabled
                value="Tahsildar / Revenue Inspector (Authenticated)"
                className="w-full text-xs bg-[#F2EFE8] border border-[#DDD9CE] rounded-lg px-3 py-2 text-[#737167] cursor-not-allowed"
              />
              <p className="text-[11px] text-[#8A887E] mt-1">
                Authorized via RBAC X-Role header.
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload Button & Progress */}
          <div className="pt-4 border-t border-[#E6E3DB] flex items-center justify-between">
            <div className="text-xs text-[#8A887E]">
              {file ? `Ready to process: ${file.name}` : "No file selected"}
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className={`px-6 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                !file || uploading
                  ? "bg-[#DDD9CE] text-[#8A887E] cursor-not-allowed"
                  : "bg-[#D9714B] text-white hover:bg-[#C25F39] shadow-xs"
              }`}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing pipeline ({uploadProgress}%)...
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
      ) : (
        /* Real Upload Result Card */
        <div className="bg-white border border-[#E6E3DB] rounded-xl p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 text-[#1D8374]">
            <div className="w-10 h-10 rounded-full bg-[#EBF7F2] flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-[#16241F]">
                Document Ingested Successfully
              </h2>
              <p className="text-xs text-[#737167]">
                Pipeline completed: OCR extraction, rule validation & GIS cross-check.
              </p>
            </div>
          </div>

          {/* Returned Real Data Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 bg-[#F7F5EF] rounded-xl border border-[#E6E3DB]">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#8A887E]">
                RECORD ID
              </span>
              <div className="text-xs font-mono font-semibold text-[#16241F] truncate mt-1">
                {uploadResult.record_id}
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[#8A887E]">
                STATUS
              </span>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    uploadResult.status === "validated"
                      ? "bg-[#EBF7F2] text-[#1D8374]"
                      : "bg-[#FAF3EE] text-[#D9714B]"
                  }`}
                >
                  ● {uploadResult.status === "validated" ? "Validated" : "Pending Review"}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[#8A887E]">
                RISK LEVEL
              </span>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                    uploadResult.risk_level === "LOW"
                      ? "bg-emerald-100 text-emerald-800"
                      : uploadResult.risk_level === "MEDIUM"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {uploadResult.risk_level || "MEDIUM"}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[#8A887E]">
                SPATIAL GIS
              </span>
              <div className="text-xs font-semibold text-[#16241F] mt-1">
                {uploadResult.spatial_consistency || "NOT_EVALUATED"}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#E6E3DB]">
            <button
              onClick={resetForm}
              className="text-xs font-semibold text-[#737167] hover:text-[#16241F] transition-colors"
            >
              + Upload another document
            </button>

            <button
              onClick={() => {
                if (setSelectedRecordId) setSelectedRecordId(uploadResult.record_id);
                if (setActiveTab) setActiveTab("verification_desk");
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-xs font-semibold text-white bg-[#16241F] hover:bg-[#243B30] inline-flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              Inspect in Verification Desk
              <ArrowRight className="w-4 h-4 text-[#D9714B]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
