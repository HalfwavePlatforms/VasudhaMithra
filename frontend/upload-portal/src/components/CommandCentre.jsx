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
      <div className="p-12 text-center text-[var(--color-text-muted)] font-medium">
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
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
            DIGITIZATION OVERVIEW
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[var(--color-text-primary)] tracking-tight mt-1">
            Good morning, Deepak.
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 font-normal">
            Here's what needs attention across your land record operations today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onExport && onExport()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-tertiary)] rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            Export report
          </button>
          <button
            onClick={() => setActiveTab("document_intake")}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[var(--color-sidebar-bg)] hover:bg-[var(--color-sidebar-hover)] rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            Add documents
          </button>
        </div>
      </div>

      {/* Alert / Attention Banner */}
      {pendingCount > 0 ? (
        <div className="bg-[var(--color-accent-subtle)] border border-[var(--color-border)] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-accent)] flex items-center justify-center text-white flex-shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--color-text-primary)]">
                {pendingCount} records need verification
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                AI confidence below threshold or flagged for revenue officer review.
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("verification_desk")}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-accent-text)] hover:text-[var(--color-accent-hover)] transition-colors self-end sm:self-auto cursor-pointer"
          >
            Open verification desk
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-xl p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-success)] flex items-center justify-center text-white flex-shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--color-text-primary)]">
                All records verified
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                0 records pending verification in this queue.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Records digitized */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Records digitized
            </span>
            <FileText className="w-4 h-4 text-[var(--color-text-muted)]" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-serif font-bold text-[var(--color-text-primary)]">
              {totalProcessed.toLocaleString()}
            </div>
            <div className="text-xs text-[var(--color-success)] font-medium mt-1 flex items-center gap-1">
              <span>●</span> Live database total
            </div>
          </div>
          {/* Mini Sparkline Bar Visual */}
          <div className="mt-4 flex items-end gap-1 h-6">
            {[40, 65, 45, 80, 55, 90, 75, 100].map((val, i) => (
              <div
                key={i}
                style={{ height: `${val}%` }}
                className="flex-1 bg-[var(--color-success)]/30 rounded-t-xs hover:bg-[var(--color-success)] transition-colors"
              />
            ))}
          </div>
        </div>

        {/* Card 2: Field accuracy */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Field accuracy
            </span>
            <CheckCircle2 className="w-4 h-4 text-[var(--color-text-muted)]" />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <div className="text-3xl font-serif font-bold text-[var(--color-text-primary)]">
                {accuracyPct}%
              </div>
              <div className="text-xs text-[var(--color-success)] font-medium mt-1">
                Avg token confidence
              </div>
            </div>
            {/* Donut Visual */}
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[var(--color-border)]"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-[var(--color-success)]"
                  strokeDasharray={`${accuracyPct}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-[11px] font-bold text-[var(--color-text-primary)]">
                {Math.round(parseFloat(accuracyPct) || 0)}
              </span>
            </div>
          </div>
          <div className="mt-4 text-[11px] text-[var(--color-text-muted)]">
            Post-verification calibrated
          </div>
        </div>

        {/* Card 3: Spatial checks / discrepancies */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Spatial discrepancies
            </span>
            <Compass className="w-4 h-4 text-[var(--color-text-muted)]" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-serif font-bold text-[var(--color-text-primary)]">
              {discrepancyCount}
            </div>
            <div className="text-xs text-[var(--color-accent-text)] font-medium mt-1">
              Deed vs Cadastral GIS
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${discrepancyCount > 0 ? "bg-[var(--color-accent)]" : "bg-[var(--color-success)]"}`} />
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {discrepancyCount > 0 ? "Flagged for parcel survey" : "All boundaries consistent"}
            </span>
          </div>
        </div>

        {/* Card 4: Pending validation (Dark Reference Card) */}
        <div className="bg-[var(--color-sidebar-bg)] text-white rounded-xl p-5 shadow-xs flex flex-col justify-between border border-[var(--color-sidebar-border)]">
          <div className="flex items-center justify-between text-[var(--color-sidebar-muted)]">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Pending validation
            </span>
            <Clock className="w-4 h-4 text-[var(--color-sidebar-muted)]" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-serif font-bold text-white">
              {pendingCount}
            </div>
            <div className="text-xs text-[var(--color-sidebar-muted)] font-medium mt-1">
              Requires Tahsildar sign-off
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-[var(--color-sidebar-border)]">
            <button
              onClick={() => setActiveTab("verification_desk")}
              className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] inline-flex items-center gap-1 transition-colors cursor-pointer"
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
        <div className="lg:col-span-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
                LATEST ACTIVITY
              </span>
              <h3 className="text-lg font-serif font-bold text-[var(--color-text-primary)]">
                Recent audit events
              </h3>
            </div>
            <button
              onClick={() => setActiveTab("audit_trail")}
              className="text-xs font-bold text-[var(--color-accent-text)] hover:text-[var(--color-accent-hover)] inline-flex items-center gap-1 cursor-pointer"
            >
              View all
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {auditLogs && auditLogs.length > 0 ? (
            <div className="divide-y divide-[var(--color-border-subtle)]">
              {auditLogs.slice(0, 6).map((log) => {
                const actionColor =
                  log.action === "human_reviewed" || log.action === "extracted_and_validated"
                    ? "text-[var(--color-success)] bg-[var(--color-success-bg)] border border-[var(--color-success-border)]"
                    : log.action === "uploaded"
                    ? "text-[var(--color-info)] bg-[var(--color-info-bg)] border border-[var(--color-info-border)]"
                    : "text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]";

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
                        className={`px-2.5 py-1 rounded-full font-semibold text-[11px] uppercase tracking-wide flex-shrink-0 ${actionColor}`}
                      >
                        {log.action?.replace(/_/g, " ")}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--color-text-primary)] truncate">
                          {log.record_id ? `Record: ${log.record_id.slice(0, 8)}...` : "System Event"}
                        </div>
                        <div className="text-[11px] text-[var(--color-text-muted)] truncate">
                          {detailStr}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 text-[11px] text-[var(--color-text-muted)]">
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
            <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">
              No recent audit events recorded.
            </div>
          )}
        </div>

        {/* Right Column (1/3): Coverage & District Progress */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
              COVERAGE
            </span>
            <h3 className="text-lg font-serif font-bold text-[var(--color-text-primary)] mb-4">
              District records
            </h3>

            {Object.keys(byDistrict).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(byDistrict).slice(0, 5).map(([distName, count]) => {
                  const safeName = distName.replace(/[()]/g, "").slice(0, 18);
                  const pct = totalProcessed > 0 ? Math.min(100, Math.round((count / totalProcessed) * 100)) : 0;

                  return (
                    <div key={distName} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-[var(--color-text-primary)]">
                        <span className="truncate">{safeName}</span>
                        <span className="text-[var(--color-text-muted)] font-normal">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-[var(--color-bg-tertiary)] h-2 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="bg-[var(--color-success)] h-full rounded-full transition-all"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-[var(--color-text-muted)] py-4">
                No district breakdown available.
              </div>
            )}

            {/* Document Types */}
            {Object.keys(byDocType).length > 0 && (
              <div className="mt-6 pt-5 border-t border-[var(--color-border-subtle)]">
                <div className="text-xs font-bold text-[var(--color-text-primary)] mb-2.5">
                  Document Types
                </div>
                <div className="space-y-2">
                  {Object.entries(byDocType).map(([dtype, count]) => (
                    <div
                      key={dtype}
                      className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]"
                    >
                      <span className="truncate">{dtype}</span>
                      <span className="font-semibold text-[var(--color-text-primary)]">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--color-border-subtle)] text-right">
            <button
              onClick={() => setActiveTab("land_records")}
              className="text-xs font-bold text-[var(--color-accent-text)] hover:text-[var(--color-accent-hover)] inline-flex items-center gap-1 cursor-pointer"
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
