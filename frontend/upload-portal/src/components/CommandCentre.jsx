import React from "react";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
  Download,
  Plus,
  Compass,
  Layers,
  ChevronRight
} from "lucide-react";

export default function CommandCentre({
  stats,
  auditLogs,
  loading,
  setActiveTab,
  onExport,
}) {
  if (loading && !stats) {
    return (
      <div className="p-12 text-center text-[#8A887E] font-medium">
        Loading Command Centre intelligence...
      </div>
    );
  }

  const totalProcessed = stats?.total_processed || 0;
  const pendingCount = stats?.pending_review_count || 0;
  const verifiedCount = stats?.verified_count || 0;
  const accuracyPct = stats?.avg_extraction_accuracy
    ? (stats.avg_extraction_accuracy * 100).toFixed(1)
    : "0.0";
  const discrepancyCount = stats?.spatial_discrepancy_count || 0;
  const byDistrict = stats?.by_district || {};
  const byDocType = stats?.by_doc_type || {};

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#D9714B]">
            DIGITIZATION OVERVIEW
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#16241F] tracking-tight mt-1">
            Good morning, Deepak.
          </h1>
          <p className="text-sm text-[#737167] mt-1 font-normal">
            Here's what needs attention across your land record operations today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onExport && onExport()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#16241F] bg-white border border-[#DDD9CE] hover:bg-[#F2EFE8] rounded-lg shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#737167]" />
            Export report
          </button>
          <button
            onClick={() => setActiveTab("document_intake")}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#16241F] hover:bg-[#22382F] rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            Add documents
          </button>
        </div>
      </div>

      {/* Alert / Attention Banner */}
      {pendingCount > 0 ? (
        <div className="bg-[#FAF3EE] border border-[#F3DFC7] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#D9714B] flex items-center justify-center text-white flex-shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#16241F]">
                {pendingCount} records need verification
              </div>
              <div className="text-xs text-[#8A7A71]">
                AI confidence below threshold or flagged for revenue officer review.
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("verification_desk")}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D9714B] hover:text-[#B55A37] transition-colors self-end sm:self-auto"
          >
            Open verification desk
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="bg-[#EBF7F2] border border-[#C5E8D9] rounded-xl p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#1D8374] flex items-center justify-center text-white flex-shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#16241F]">
                All records verified
              </div>
              <div className="text-xs text-[#52796F]">
                0 records pending verification in this queue.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Records digitized */}
        <div className="bg-white border border-[#E6E3DB] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#8A887E]">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Records digitized
            </span>
            <FileText className="w-4 h-4 text-[#8A887E]" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-serif font-bold text-[#16241F]">
              {totalProcessed.toLocaleString()}
            </div>
            <div className="text-xs text-[#1D8374] font-medium mt-1 flex items-center gap-1">
              <span>●</span> Live database total
            </div>
          </div>
          {/* Mini Sparkline Bar Visual */}
          <div className="mt-4 flex items-end gap-1 h-6">
            {[40, 65, 45, 80, 55, 90, 75, 100].map((val, i) => (
              <div
                key={i}
                style={{ height: `${val}%` }}
                className="flex-1 bg-[#1D8374]/30 rounded-t-xs hover:bg-[#1D8374] transition-colors"
              />
            ))}
          </div>
        </div>

        {/* Card 2: Field accuracy */}
        <div className="bg-white border border-[#E6E3DB] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#8A887E]">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Field accuracy
            </span>
            <CheckCircle2 className="w-4 h-4 text-[#8A887E]" />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <div className="text-3xl font-serif font-bold text-[#16241F]">
                {accuracyPct}%
              </div>
              <div className="text-xs text-[#1D8374] font-medium mt-1">
                Avg token confidence
              </div>
            </div>
            {/* Donut Visual */}
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[#E6E3DB]"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-[#1D8374]"
                  strokeDasharray={`${accuracyPct}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-[11px] font-bold text-[#16241F]">
                {Math.round(parseFloat(accuracyPct) || 0)}
              </span>
            </div>
          </div>
          <div className="mt-4 text-[11px] text-[#8A887E]">
            Post-verification calibrated
          </div>
        </div>

        {/* Card 3: Spatial checks / discrepancies */}
        <div className="bg-white border border-[#E6E3DB] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#8A887E]">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Spatial discrepancies
            </span>
            <Compass className="w-4 h-4 text-[#8A887E]" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-serif font-bold text-[#16241F]">
              {discrepancyCount}
            </div>
            <div className="text-xs text-[#D9714B] font-medium mt-1">
              Deed vs Cadastral GIS
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${discrepancyCount > 0 ? "bg-[#D9714B]" : "bg-[#1D8374]"}`} />
            <span className="text-[11px] text-[#8A887E]">
              {discrepancyCount > 0 ? "Flagged for parcel survey" : "All boundaries consistent"}
            </span>
          </div>
        </div>

        {/* Card 4: Pending validation (Dark Reference Card) */}
        <div className="bg-[#16241F] text-white rounded-xl p-5 shadow-xs flex flex-col justify-between border border-[#22332B]">
          <div className="flex items-center justify-between text-[#8FA396]">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Pending validation
            </span>
            <Clock className="w-4 h-4 text-[#8FA396]" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-serif font-bold text-white">
              {pendingCount}
            </div>
            <div className="text-xs text-[#A7B9AE] font-medium mt-1">
              Requires Tahsildar sign-off
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-[#243930]">
            <button
              onClick={() => setActiveTab("verification_desk")}
              className="text-xs font-semibold text-[#D9714B] hover:text-[#E88663] inline-flex items-center gap-1 transition-colors"
            >
              Review queue
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Two-Column Grid: Recent Activity (Left) + District Progress (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3): Recent Activity / Audit Trail */}
        <div className="lg:col-span-2 bg-white border border-[#E6E3DB] rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D9714B]">
                LATEST ACTIVITY
              </span>
              <h3 className="text-lg font-serif font-bold text-[#16241F]">
                Recent audit events
              </h3>
            </div>
            <button
              onClick={() => setActiveTab("audit_trail")}
              className="text-xs font-bold text-[#D9714B] hover:text-[#B55A37] inline-flex items-center gap-1"
            >
              View all
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {auditLogs && auditLogs.length > 0 ? (
            <div className="divide-y divide-[#F2EFE8]">
              {auditLogs.slice(0, 6).map((log) => {
                const actionColor =
                  log.action === "human_reviewed" || log.action === "extracted_and_validated"
                    ? "text-[#1D8374] bg-[#EBF7F2]"
                    : log.action === "uploaded"
                    ? "text-blue-700 bg-blue-50"
                    : "text-[#737167] bg-[#F7F5EF]";

                const detailStr = log.details
                  ? Object.entries(log.details)
                      .slice(0, 2)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")
                  : "No details";

                return (
                  <div
                    key={log.id}
                    className="py-3.5 flex items-center justify-between gap-4 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`px-2 py-1 rounded font-semibold text-[11px] uppercase tracking-wide flex-shrink-0 ${actionColor}`}
                      >
                        {log.action?.replace(/_/g, " ")}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-[#16241F] truncate">
                          {log.record_id ? `Record: ${log.record_id.slice(0, 8)}...` : "System Event"}
                        </div>
                        <div className="text-[11px] text-[#8A887E] truncate">
                          {detailStr}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 text-[11px] text-[#8A887E]">
                      <div>{log.actor || "System"}</div>
                      <div>
                        {log.created_at
                          ? new Date(log.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[#8A887E]">
              No recent audit events recorded.
            </div>
          )}
        </div>

        {/* Right Column (1/3): Coverage & District Progress */}
        <div className="bg-white border border-[#E6E3DB] rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#D9714B]">
              COVERAGE
            </span>
            <h3 className="text-lg font-serif font-bold text-[#16241F] mb-4">
              District records
            </h3>

            {Object.keys(byDistrict).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(byDistrict).slice(0, 5).map(([distName, count]) => {
                  const safeName = distName.replace(/[()]/g, "").slice(0, 18);
                  const pct = totalProcessed > 0 ? Math.min(100, Math.round((count / totalProcessed) * 100)) : 0;

                  return (
                    <div key={distName} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-[#16241F]">
                        <span className="truncate">{safeName}</span>
                        <span className="text-[#8A887E] font-normal">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-[#F2EFE8] h-2 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="bg-[#1D8374] h-full rounded-full transition-all"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-[#8A887E] py-4">
                No district breakdown available.
              </div>
            )}

            {/* Document Types */}
            {Object.keys(byDocType).length > 0 && (
              <div className="mt-6 pt-5 border-t border-[#F2EFE8]">
                <div className="text-xs font-bold text-[#16241F] mb-2.5">
                  Document Types
                </div>
                <div className="space-y-2">
                  {Object.entries(byDocType).map(([dtype, count]) => (
                    <div
                      key={dtype}
                      className="flex items-center justify-between text-xs text-[#5A584F]"
                    >
                      <span className="truncate">{dtype}</span>
                      <span className="font-semibold text-[#16241F]">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-[#F2EFE8] text-right">
            <button
              onClick={() => setActiveTab("land_records")}
              className="text-xs font-bold text-[#D9714B] hover:text-[#B55A37] inline-flex items-center gap-1"
            >
              View master table
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
