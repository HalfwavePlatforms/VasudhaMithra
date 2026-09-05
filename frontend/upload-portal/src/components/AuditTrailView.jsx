import React, { useState, useEffect } from "react";
import { Clock, Shield, Search, Filter, RefreshCw, Loader2, ArrowRight } from "lucide-react";

export default function AuditTrailView({
  apiBase,
  setActiveTab,
  setSelectedRecordId,
}) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/dashboard/audit-trail?limit=50`);
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
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#16241F] tracking-tight mt-1">
            Audit trail
          </h1>
          <p className="text-sm text-[#737167] mt-1">
            Immutable system logs of all ingestion, optical OCR, schema validation, and human review actions.
          </p>
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

                  return (
                    <tr key={log.id} className="hover:bg-[#FAF9F5] transition-colors">
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
                          <button
                            onClick={() => {
                              if (setSelectedRecordId) setSelectedRecordId(log.record_id);
                              if (setActiveTab) setActiveTab("verification_desk");
                            }}
                            className="hover:underline flex items-center gap-1"
                          >
                            {log.record_id.slice(0, 12)}...
                          </button>
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
