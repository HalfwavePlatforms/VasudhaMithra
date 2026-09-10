import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Printer,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Loader2,
  Building2,
  Calendar,
  Layers,
  MapPin,
} from "lucide-react";

export default function PublicVerifyPage({ apiBase }) {
  const resolvedApiBase = apiBase || import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Parse record_id and token from URL path & query
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const recordId =
    pathParts.length >= 2 && pathParts[0] === "verify"
      ? pathParts[1]
      : new URLSearchParams(window.location.search).get("record_id");
  const token = new URLSearchParams(window.location.search).get("token") || "";

  useEffect(() => {
    if (!recordId) {
      setError("Missing Record Identifier in URL.");
      setLoading(false);
      return;
    }
    if (!token) {
      setError("Missing HMAC security verification token. Please access via the official QR code.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`${resolvedApiBase}/public/verify/${recordId}?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.detail || `Verification failed with HTTP ${res.status}`);
        }
        return body;
      })
      .then((result) => {
        setData(result);
      })
      .catch((err) => {
        setError(err.message || "Failed to verify land record integrity.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [recordId, token, resolvedApiBase]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col justify-between selection:bg-[var(--color-accent-subtle)] selection:text-[var(--color-accent)]">
      {/* Top Header */}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-4 px-6 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-sidebar-bg)] flex items-center justify-center text-white font-serif font-bold text-lg shadow-xs">
              🏛
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-accent)] flex items-center gap-1.5">
                <span>GOVERNMENT OF INDIA</span>
                <span className="text-[var(--color-border-strong)]">•</span>
                <span>LAND RECORD VERIFICATION</span>
              </div>
              <h1 className="text-base sm:text-lg font-serif font-bold text-[var(--color-text-primary)]">
                Vasudha Public Record Verification Portal
              </h1>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-[var(--color-text-muted)] bg-[var(--color-bg-primary)] px-3 py-1.5 rounded-lg border border-[var(--color-border)]">
            <Lock className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span>Cryptographic Proof</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 flex flex-col justify-center">
        {loading && (
          <div className="py-20 text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-[var(--color-accent)]" />
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                Querying Cryptographic Audit Ledger
              </h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                Verifying hash-chain integrity against official registrar records...
              </p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-error)]/40 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--color-error-bg)] border border-[var(--color-error-border)] mx-auto flex items-center justify-center text-[var(--color-error)]">
              <ShieldAlert className="w-9 h-9" />
            </div>

            <div className="space-y-2 max-w-lg mx-auto">
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-[var(--color-text-primary)]">
                Verification Unsuccessful
              </h2>
              <p className="text-sm text-[var(--color-error)] font-medium">
                {error}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed pt-2">
                This verification URL may have been altered, truncated, or expired.
                Ensure you are scanning the official QR code issued by the Department of Revenue.
              </p>
            </div>

            <div className="pt-4 border-t border-[var(--color-border)] flex justify-center">
              <a
                href="/"
                className="px-5 py-2.5 bg-[var(--color-sidebar-bg)] hover:bg-[var(--color-sidebar-hover)] text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-2 cursor-pointer shadow-xs"
              >
                Go to Portal Home
              </a>
            </div>
          </div>
        )}

        {!loading && data && (
          <div className="space-y-6 animate-fadeIn">
            {/* Trust Status Card */}
            {data.audit_chain_valid ? (
              <div className="bg-[var(--color-success-bg)] border-2 border-[var(--color-success)] rounded-2xl p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                  <div className="w-16 h-16 rounded-full bg-white text-[var(--color-success)] flex items-center justify-center flex-shrink-0 shadow-xs border border-[var(--color-success-border)]">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white text-[var(--color-success)] border border-[var(--color-success-border)] uppercase tracking-wide">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      OFFICIAL INTEGRITY CERTIFIED
                    </div>
                    <h2 className="text-xl sm:text-2xl font-serif font-bold text-[var(--color-text-primary)]">
                      This land record is verified and has not been tampered with
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
                      Cryptographic hash-chain integrity verified against official land registrar audit logs.
                      All recorded mutations, boundaries, and ownership details match the certified immutable ledger.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[var(--color-error-bg)] border-2 border-[var(--color-error)] rounded-2xl p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                  <div className="w-16 h-16 rounded-full bg-white text-[var(--color-error)] flex items-center justify-center flex-shrink-0 shadow-xs border border-[var(--color-error-border)]">
                    <ShieldAlert className="w-10 h-10" />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white text-[var(--color-error)] border border-[var(--color-error-border)] uppercase tracking-wide">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      INTEGRITY CHECK FAILED
                    </div>
                    <h2 className="text-xl sm:text-2xl font-serif font-bold text-[var(--color-error)]">
                      Warning: Audit Hash Chain Tamper Detected
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
                      The cryptographic audit chain for this record failed verification. Stored ledger entries
                      diverge from computed hashes. This record should not be relied upon without manual registrar inspection.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Core Non-Sensitive Facts Sheet */}
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                    PUBLIC RECORD ID
                  </div>
                  <div className="text-xs sm:text-sm font-mono font-bold text-[var(--color-text-primary)]">
                    {data.record_id}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)]">
                    {data.document_type || "Land Record"}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                      data.validation_status === "validated"
                        ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]"
                        : "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]"
                    }`}
                  >
                    ● {data.validation_status}
                  </span>
                </div>
              </div>

              {/* Facts Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-xl space-y-1">
                  <div className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    Survey / Khasra Number
                  </div>
                  <div className="text-base font-bold font-mono text-[var(--color-text-primary)]">
                    {data.survey_number}
                  </div>
                </div>

                <div className="p-4 bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-xl space-y-1">
                  <div className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    Registered Legal Owner
                  </div>
                  <div className="text-base font-bold text-[var(--color-text-primary)]">
                    {data.owner_name}
                  </div>
                </div>

                <div className="p-4 bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-xl space-y-1">
                  <div className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    Village & District
                  </div>
                  <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {data.village}, {data.district}
                  </div>
                </div>

                <div className="p-4 bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-xl space-y-1">
                  <div className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    Jurisdiction State
                  </div>
                  <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {data.state}
                  </div>
                </div>
              </div>

              {/* Cryptographic Ledger Summary */}
              <div className="p-4 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl text-xs space-y-2">
                <div className="font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[var(--color-accent)]" />
                  <span>Tamper-Evident Ledger Status:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[var(--color-text-secondary)]">
                  <div>
                    • Hash Chain Validated Entries: <strong className="text-[var(--color-text-primary)]">{data.audit_entries_count} block(s)</strong>
                  </div>
                  <div>
                    • Cryptographic Seal: <strong className="text-[var(--color-text-primary)]">HMAC-SHA256 Signed</strong>
                  </div>
                  <div className="col-span-1 sm:col-span-2 text-[10px] text-[var(--color-text-muted)]">
                    Verified on: {new Date(data.verified_at).toLocaleString("en-IN", { timeZoneName: "short" })}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyLink}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[var(--color-bg-primary)] border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-success)]" /> : <Copy className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />}
                    <span>{copied ? "Link Copied!" : "Copy Verification URL"}</span>
                  </button>

                  <button
                    onClick={handlePrint}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[var(--color-bg-primary)] border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                    <span>Print Certificate</span>
                  </button>
                </div>

                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Read-only public record inquiry for citizens, banks & buyers.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Public Footer */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-4 px-6 text-center text-xs text-[var(--color-text-muted)]">
        <p>National Land Record Modernization & Tamper-Evident Verification System • VasudhaMithra</p>
      </footer>
    </div>
  );
}
