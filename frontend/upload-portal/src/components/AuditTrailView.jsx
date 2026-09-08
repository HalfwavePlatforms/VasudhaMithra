import React, { useState, useEffect } from "react";
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
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#D9714B]">
            GOVERNANCE & COMPLIANCE
          </span>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#16241F] tracking-tight">
              Audit trail
            </h1>
            {uniqueRecordIds.length > 0 && (
              <div className="flex items-center gap-2 bg-[#FAF9F5] p-1 rounded-xl border border-[#DDD9CE]">
                <select
                  value={targetRecordId}
                  onChange={(e) => {
                    setTargetRecordId(e.target.value);
                    setVerifyResult(null);
                  }}
                  className="text-xs bg-white border border-[#DDD9CE] rounded-lg px-2 py-1.5 font-mono text-[#16241F] focus:outline-none"
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1D8374] hover:bg-[#16675B] rounded-lg shadow-xs transition-colors disabled:opacity-50"
                  title="Cryptographically verify hash-chain integrity of this record"
                >
                  {verifying ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  Verify integrity
                </button>
              </div>
            )}
          </div>
          <p className="text-sm text-[#737167] mt-1">
            Tamper-evident SHA-256 hash-chain audit trail of all ingestion, optical OCR, schema validation, and human review actions.
          </p>

          {/* Verification Status Badge */}
          {verifyResult && (
            <div className="mt-2.5">
              {verifyResult.valid ? (
                verifyResult.note ? (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 border border-amber-300 text-amber-900 shadow-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Legacy entries present (unhashed) &mdash; verified {verifyResult.verified_entries} hashed events</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 border border-emerald-300 text-emerald-900 shadow-xs">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Audit trail verified &mdash; {verifyResult.verified_entries} events, chain intact</span>
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 border border-rose-300 text-rose-900 shadow-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
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
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#16241F] bg-white border border-[#DDD9CE] hover:bg-[#F2EFE8] rounded-lg shadow-xs transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#737167] ${loading ? "animate-spin" : ""}`} />
          Refresh trail
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white border border-[#E6E3DB] rounded-xl p-4 shadow-xs flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#8A887E] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search action, actor, or record ID..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-[#F7F5EF] border border-[#DDD9CE] rounded-lg text-[#16241F] placeholder-[#8A887E] focus:outline-none focus:ring-1 focus:ring-[#D9714B]"
          />
        </div>
        <span className="text-xs text-[#8A887E]">
          {filteredLogs.length} events logged
        </span>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E6E3DB] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#FAF9F5] border-b border-[#E6E3DB] text-[#737167] font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">TIMESTAMP</th>
                <th className="py-3.5 px-4">ACTION</th>
                <th className="py-3.5 px-4">ACTOR</th>
                <th className="py-3.5 px-4">RECORD ID</th>
                <th className="py-3.5 px-4">DETAILS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2EFE8]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#8A887E]">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#D9714B]" />
                    Loading audit trail from database...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#8A887E]">
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
                          ? "bg-rose-50 border-l-4 border-rose-500 transition-colors"
                          : "hover:bg-[#FAF9F5] transition-colors"
                      }
                    >
                      <td className="py-3 px-4 font-mono text-[11px] text-[#737167] whitespace-nowrap">
                        {log.created_at
                          ? new Date(log.created_at).toLocaleString()
                          : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] uppercase tracking-wide bg-[#F2EFE8] text-[#16241F]">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#16241F]">
                        {log.actor || "System"}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#D9714B]">
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
                              className="px-1.5 py-0.5 rounded text-[10px] font-sans font-medium text-[#1D8374] bg-[#EBF7F2] hover:bg-[#D5EFE5] border border-[#C5E8D9] transition-colors"
                              title="Verify hash-chain for this record"
                            >
                              Verify
                            </button>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 px-4 text-[#5A584F] max-w-xs truncate">
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
