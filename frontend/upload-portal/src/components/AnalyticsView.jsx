import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  Info,
  RefreshCw,
  ShieldCheck,
  Percent,
} from "lucide-react";

export default function AnalyticsView({ apiBase }) {
  const resolvedApiBase = apiBase || import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  const fetchAnalytics = () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem("vasudha_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(`${resolvedApiBase}/dashboard/analytics/overview?days=90`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
        return res.json();
      })
      .then((resData) => {
        setData(resData);
        if (resData?.throughput?.timeline?.length > 0) {
          setSelectedDay(resData.throughput.timeline[resData.throughput.timeline.length - 1]);
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load analytics data.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAnalytics();
  }, [resolvedApiBase]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-[var(--color-text-muted)]">
        <RefreshCw className="w-8 h-8 animate-spin text-[var(--color-accent)] mb-3" />
        <p className="text-sm font-medium">Aggregating historical digitization intelligence...</p>
      </div>
    );
  }

  const throughput = data?.throughput || {};
  const accuracy = data?.accuracy || {};
  const districts = data?.districts?.districts || [];
  const reviewReasons = data?.review_reasons?.reasons || [];
  const timeline = throughput?.timeline || [];

  // Compute maximum daily created count for SVG chart scaling
  const maxDayCreated = Math.max(...timeline.map((t) => t.created), 10);

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-0.5 rounded">
              Verified Metrics
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">• No fabricated trends</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[var(--color-text-primary)]">
            Digitization Analytics & Precision
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Real-time aggregations from official records, audit hash-chains, and GIS spatial consistency checks.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchAnalytics}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-border)]/30 text-xs font-semibold text-[var(--color-text-primary)] transition-colors shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Honest Data Scope Notice (Non-Negotiable) */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4 flex items-start gap-3 shadow-xs">
        <Info className="w-5 h-5 text-[var(--color-info)] shrink-0 mt-0.5" />
        <div className="text-xs">
          <span className="font-semibold text-[var(--color-text-primary)] block">
            Authentic Historical Range: {throughput.honest_note}
          </span>
          <p className="text-[var(--color-text-muted)] mt-0.5">
            Every metric below is computed directly from active database rows. Zero synthetic data or projected growth curves are applied.
          </p>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Processed */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block">
            Total Records Digitized
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-bold font-serif text-[var(--color-text-primary)]">
              {throughput.total_records || 0}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">parcels</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Across 8 Administrative Districts</span>
          </div>
        </div>

        {/* Validated Records */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block">
            Officially Validated
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-bold font-serif text-[var(--color-text-primary)]">
              {throughput.total_validated || 0}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              ({throughput.validation_rate_pct || 0}%)
            </span>
          </div>
          <div className="mt-3 text-xs text-[var(--color-text-muted)]">
            Approved by Tahsildar / Revenue Officers
          </div>
        </div>

        {/* Overall Extraction Accuracy */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block">
            Rule-Based Extraction Accuracy
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-bold font-serif text-[var(--color-text-primary)]">
              {accuracy.overall_average_accuracy_pct || "0.0"}%
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">weighted avg</span>
          </div>
          <div className="mt-3 text-xs text-[var(--color-text-muted)]">
            Across {accuracy.total_scored_fields || 0} verified field extractions
          </div>
        </div>

        {/* Flagged Review Issues */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block">
            Manual Review Triggers
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-bold font-serif text-amber-600 dark:text-amber-400">
              {data?.review_reasons?.total_flagged_issues || 0}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">flags</span>
          </div>
          <div className="mt-3 text-xs text-[var(--color-text-muted)]">
            Preventing unverified records from entering ledger
          </div>
        </div>
      </div>

      {/* SECTION 1: Daily Throughput Chart (Step 1) */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-lg font-serif font-bold text-[var(--color-text-primary)]">
              Daily Digitization & Validation Throughput
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Exact count of records ingested vs. approved per calendar day.
            </p>
          </div>

          {/* Chart Legend */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[var(--color-accent)] inline-block" />
              <span className="text-[var(--color-text-muted)]">Total Created</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-600 dark:bg-emerald-500 inline-block" />
              <span className="text-[var(--color-text-muted)]">Validated</span>
            </div>
          </div>
        </div>

        {/* Responsive Bar Visualization */}
        <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end pt-8 pb-3 border-b border-[var(--color-border)]/60 min-h-[220px]">
          {timeline.map((day) => {
            const isSelected = selectedDay?.date === day.date;
            const createdHeight = Math.max(Math.round((day.created / maxDayCreated) * 160), 12);
            const validatedHeight = Math.max(Math.round((day.validated / maxDayCreated) * 160), 4);
            const dateLabel = new Date(day.date).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
            });

            return (
              <div
                key={day.date}
                onClick={() => setSelectedDay(day)}
                className={`flex flex-col items-center cursor-pointer group transition-all p-1.5 rounded-lg ${
                  isSelected ? "bg-[var(--color-border)]/30 ring-1 ring-[var(--color-accent)]" : "hover:bg-[var(--color-border)]/15"
                }`}
              >
                {/* Count Badge on Top */}
                <div className="text-[11px] font-bold text-[var(--color-text-primary)] mb-2 font-mono">
                  {day.created}
                </div>

                {/* Bars */}
                <div className="w-full flex items-end justify-center gap-1 h-[160px]">
                  {/* Created Bar */}
                  <div
                    style={{ height: `${createdHeight}px` }}
                    className="w-1/2 max-w-[24px] bg-[var(--color-accent)] rounded-t transition-all group-hover:opacity-90"
                    title={`Created: ${day.created}`}
                  />
                  {/* Validated Bar */}
                  <div
                    style={{ height: `${validatedHeight}px` }}
                    className="w-1/2 max-w-[24px] bg-emerald-600 dark:bg-emerald-500 rounded-t transition-all group-hover:opacity-90"
                    title={`Validated: ${day.validated}`}
                  />
                </div>

                {/* Date Label */}
                <span className="text-[11px] font-medium text-[var(--color-text-muted)] mt-3">
                  {dateLabel}
                </span>
              </div>
            );
          })}
        </div>

        {/* Selected Day Inspector */}
        {selectedDay && (
          <div className="mt-4 pt-3 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-text-muted)]">Selected Date:</span>
              <span className="font-bold text-[var(--color-text-primary)]">
                {new Date(selectedDay.date).toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span>Created: <strong>{selectedDay.created}</strong></span>
              <span className="text-emerald-600 dark:text-emerald-400">Validated: <strong>{selectedDay.validated}</strong></span>
              <span className="text-amber-600 dark:text-amber-400">Pending Review: <strong>{selectedDay.pending}</strong></span>
              <span className="text-rose-600 dark:text-rose-400">Rejected: <strong>{selectedDay.rejected}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2 & 3: Field Accuracy Matrix (Step 2) & District Progress (Step 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Field-Level Extraction Accuracy */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-serif font-bold text-[var(--color-text-primary)]">
                Field-Level OCR Accuracy
              </h2>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                Avg: {accuracy.overall_average_accuracy_pct || "0.0"}%
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-5">
              Direct confidence evaluations across rule-based extractions.
            </p>

            {/* Field Progress List */}
            <div className="space-y-3.5">
              {(accuracy.fields || []).slice(0, 8).map((field) => {
                const pct = field.accuracy_pct;
                const barColor =
                  pct >= 85
                    ? "bg-emerald-500"
                    : pct >= 75
                    ? "bg-[var(--color-accent)]"
                    : "bg-amber-500";

                return (
                  <div key={field.field_name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {field.display_name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--color-text-muted)]">
                          ({field.sample_count} records)
                        </span>
                        <span className="font-mono font-bold text-[var(--color-text-primary)]">
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-[var(--color-border)]/40 h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full ${barColor} rounded-full transition-all duration-500`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-[var(--color-border)]/50 text-[11px] text-[var(--color-text-muted)] flex items-center justify-between">
            <span>Excluded AI-unscored fields: {accuracy.unscored_fields_count || 0}</span>
            <span>Benchmark: Rule-based engine</span>
          </div>
        </div>

        {/* District Digitization Progress (Step 3) */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-serif font-bold text-[var(--color-text-primary)]">
                District Digitization Progress
              </h2>
              <span className="text-xs font-bold text-[var(--color-info)] bg-[var(--color-info)]/10 px-2 py-0.5 rounded">
                {districts.filter((d) => d.district !== "Unassigned").length} Districts Active
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-5">
              Real proportion of validated records vs. total ingested per administrative district.
            </p>

            <div className="space-y-4">
              {districts
                .filter((d) => d.district !== "Unassigned")
                .slice(0, 6)
                .map((dist) => {
                  const pct = dist.progress_pct;
                  return (
                    <div key={dist.district}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {dist.district}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[var(--color-text-muted)]">
                            {dist.validated_records} of {dist.total_records} validated
                          </span>
                          <span className="font-mono font-bold text-[var(--color-text-primary)]">
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-[var(--color-border)]/40 h-2 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-[var(--color-border)]/50 text-[11px] text-[var(--color-text-muted)] flex items-center justify-between">
            <span>Karnataka & Madhya Pradesh Records</span>
            <span>Source: PostgreSQL records</span>
          </div>
        </div>
      </div>

      {/* SECTION 4: Root-Causes for Manual Review (Step 4) */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-lg font-serif font-bold text-[var(--color-text-primary)]">
              Reasons for Manual Review Flagging
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Aggregated from ValidationResult rule failures and spatial GIS boundary checks.
            </p>
          </div>
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
            {data?.review_reasons?.total_flagged_issues || 0} Total Violations
          </span>
        </div>

        {/* Horizontal Stacked Bar */}
        <div className="w-full bg-[var(--color-border)]/40 h-3.5 rounded-full overflow-hidden flex my-5">
          {reviewReasons.map((reason, idx) => {
            const colors = [
              "bg-amber-500",
              "bg-[var(--color-accent)]",
              "bg-rose-500",
              "bg-indigo-500",
            ];
            const color = colors[idx % colors.length];
            return (
              <div
                key={reason.rule}
                style={{ width: `${reason.pct}%` }}
                className={`h-full ${color}`}
                title={`${reason.label}: ${reason.count} (${reason.pct}%)`}
              />
            );
          })}
        </div>

        {/* Reason Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {reviewReasons.map((reason, idx) => {
            const badgeColors = [
              "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25",
              "text-[var(--color-accent)] bg-[var(--color-accent)]/10 border-[var(--color-accent)]/25",
              "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/25",
            ];
            const badgeClass = badgeColors[idx % badgeColors.length];

            return (
              <div
                key={reason.rule}
                className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeClass}`}>
                      {reason.rule}
                    </span>
                    <span className="text-xs font-mono font-bold text-[var(--color-text-primary)]">
                      {reason.pct}%
                    </span>
                  </div>
                  <h3 className="text-xs font-semibold text-[var(--color-text-primary)] line-clamp-2">
                    {reason.label}
                  </h3>
                </div>

                <div className="mt-4 pt-2 border-t border-[var(--color-border)]/40 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                  <span>Occurrences</span>
                  <span className="font-bold text-[var(--color-text-primary)] font-mono">
                    {reason.count}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
