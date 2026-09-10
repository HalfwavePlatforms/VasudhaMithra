import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Clock,
  Shield,
  ShieldCheck,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  ArrowRight,
} from "lucide-react";

export default function AuditTrailView({
  apiBase,
  setActiveTab,
  setSelectedRecordId,
  selectedRecordId,
}) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [targetRecordId, setTargetRecordId] = useState(selectedRecordId || "");
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("vasudha_token");
      const headers = { "X-Role": "admin" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`${apiBase}/dashboard/audit-trail?limit=50`, { headers });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.audit_logs || []);
      }
    } catch (e) {
      console.error("Failed to fetch audit trail:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [apiBase]);

  useEffect(() => {
    if (selectedRecordId) {
      setTargetRecordId(selectedRecordId);
    }
  }, [selectedRecordId]);

  useEffect(() => {
    if (!targetRecordId && logs.length > 0) {
      const firstWithId = logs.find((l) => l.record_id);
      if (firstWithId) {
        setTargetRecordId(firstWithId.record_id);
      }
    }
  }, [logs, targetRecordId]);

  const uniqueRecordIds = Array.from(new Set(logs.map((l) => l.record_id).filter(Boolean)));

  const handleVerifyIntegrity = async (recIdToVerify) => {
    const recId = recIdToVerify || targetRecordId;
    if (!recId) return;
    setVerifying(true);
    try {
      const token = localStorage.getItem("vasudha_token");
      const headers = { "X-Role": "admin" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${apiBase}/records/${recId}/audit/verify`, { headers });
      if (res.ok) {
        const data = await res.json();
        setVerifyResult({ recordId: recId, ...data });
      } else {
        const err = await res.json().catch(() => ({}));
        setVerifyResult({
          recordId: recId,
          valid: false,
          broken_at: "Error",
          reason: err.detail || "Failed to verify audit trail integrity",
        });
      }
    } catch (e) {
      setVerifyResult({
        recordId: recId,
        valid: false,
        broken_at: "Network Error",
        reason: e.message,
      });
    } finally {
      setVerifying(false);
    }
  };

  const filteredLogs = logs.filter((l) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const action = (l.action || "").toLowerCase();
    const actor = (l.actor || "").toLowerCase();
    const id = (l.record_id || "").toLowerCase();
    return action.includes(term) || actor.includes(term) || id.includes(term);
  });

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-label-muted)]">
            {t("sidebar.governance")}
          </span>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[var(--color-text-primary)] tracking-tight">
              {t("sidebar.auditTrail")}
            </h1>
            {uniqueRecordIds.length > 0 && (
              <div className="flex items-center gap-2 bg-[var(--color-bg-secondary)] p-1 rounded-xl border border-[var(--color-border-strong)]">
                <select
                  value={targetRecordId}
                  onChange={(e) => {
                    setTargetRecordId(e.target.value);
                    setVerifyResult(null);
                  }}
                  className="text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border-strong)] rounded-lg px-2 py-1.5 font-mono text-[var(--color-text-primary)] focus:outline-none"
                  title="Select record to verify"
                >
                  {uniqueRecordIds.map((id) => (
                    <option key={id} value={id}>
                      Record: {id.slice(0, 8)}...
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleVerifyIntegrity(targetRecordId)}
                  disabled={verifying || !targetRecordId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[var(--color-success)] hover:brightness-90 rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  title="Cryptographically verify hash-chain integrity of this record"
                >
                  {verifying ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  {t("auditTrail.verifyIntegrity")}
                </button>
              </div>
            )}
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {t("auditTrail.subtitle")}
          </p>

          {/* Verification Status Badge */}
          {verifyResult && (
            <div className="mt-2.5">
              {verifyResult.valid ? (
                verifyResult.note ? (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] text-[var(--color-warning)] shadow-xs">
                    <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] flex-shrink-0" />
                    <span>Legacy entries present (unhashed) &mdash; verified {verifyResult.verified_entries} hashed events</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-[var(--color-success)] shadow-xs">
                    <ShieldCheck className="w-4 h-4 text-[var(--color-success)] flex-shrink-0" />
                    <span>Audit trail verified &mdash; {verifyResult.verified_entries} events, chain intact</span>
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-error-bg)] border border-[var(--color-error-border)] text-[var(--color-error)] shadow-xs">
                  <AlertTriangle className="w-4 h-4 text-[var(--color-error)] flex-shrink-0" />
                  <span>
                    TAMPER DETECTED at event {verifyResult.broken_at ? `${verifyResult.broken_at.slice(0, 8)}...` : "unknown"} &mdash; hash mismatch
                  </span>
                </span>
              )}
            </div>
          )}
        </div>

        <button
          onClick={fetchAuditLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-tertiary)] rounded-lg shadow-xs transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[var(--color-text-muted)] ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </button>
      </div>

      {/* Filter */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4 shadow-xs flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[var(--color-sidebar-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("auditTrail.searchPlaceholder")}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-[var(--color-bg-primary)] border border-[var(--color-border-strong)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-sidebar-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
        </div>
        <span className="text-xs text-[var(--color-sidebar-muted)]">
          {filteredLogs.length} {t("common.records")}
        </span>
      </div>

      {/* Table */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)] text-[var(--color-text-muted)] font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">{t("auditTrail.timestamp")}</th>
                <th className="py-3.5 px-4">{t("auditTrail.action")}</th>
                <th className="py-3.5 px-4">{t("auditTrail.actor")}</th>
                <th className="py-3.5 px-4">{t("auditTrail.recordId")}</th>
                <th className="py-3.5 px-4">{t("auditTrail.details")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[var(--color-sidebar-muted)]">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--color-accent)]" />
                    Loading audit trail from database...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[var(--color-sidebar-muted)]">
                    No audit records match your search.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const detailEntries = log.details
                    ? Object.entries(log.details).map(([k, v]) => `${k}: ${v}`)
                    : [];

                  const isTamperedRow =
                    verifyResult && !verifyResult.valid && log.id === verifyResult.broken_at;

                  return (
                    <tr
                      key={log.id}
                      className={
                        isTamperedRow
                          ? "bg-[var(--color-error-bg)] border-l-4 border-[var(--color-error)] transition-colors"
                          : "hover:bg-[var(--color-bg-tertiary)] transition-colors"
                      }
                    >
                      <td className="py-3 px-4 font-mono text-[11px] text-[var(--color-text-muted)] whitespace-nowrap">
                        {log.created_at
                          ? new Date(log.created_at).toLocaleString()
                          : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] uppercase tracking-wide bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[var(--color-text-primary)]">
                        {log.actor || "System"}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[var(--color-accent-text)]">
                        {log.record_id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                if (setSelectedRecordId) setSelectedRecordId(log.record_id);
                                if (setActiveTab) setActiveTab("verification_desk");
                              }}
                              className="hover:underline flex items-center gap-1"
                              title="Inspect record in Verification Desk"
                            >
                              {log.record_id.slice(0, 8)}...
                            </button>
                            <button
                              onClick={() => {
                                setTargetRecordId(log.record_id);
                                handleVerifyIntegrity(log.record_id);
                              }}
                              className="px-1.5 py-0.5 rounded text-[10px] font-sans font-medium text-[var(--color-success)] bg-[var(--color-success-bg)] hover:bg-[var(--color-success-border)] border border-[var(--color-success-border)] transition-colors"
                              title="Verify hash-chain for this record"
                            >
                              Verify
                            </button>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 px-4 text-[var(--color-text-secondary)] max-w-xs truncate">
                        {detailEntries.join(" | ") || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
