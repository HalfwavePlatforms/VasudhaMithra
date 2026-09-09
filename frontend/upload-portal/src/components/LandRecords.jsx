import React, { useState, useEffect } from "react";
import {
  FileText,
  Search,
  Filter,
  Download,
  Plus,
  Eye,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw
} from "lucide-react";

export default function LandRecords({
  apiBase,
  stats,
  setActiveTab,
  setSelectedRecordId,
  selectedRecordId,
}) {
  const [records, setRecords] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(15);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchRecords = async (page = 1, status = "all") => {
    setLoading(true);
    try {
      let url = `${apiBase}/records?page=${page}&limit=${limit}`;
      if (status !== "all") {
        url += `&status=${status}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setTotalCount(data.total || 0);
        setCurrentPage(data.page || 1);
      }
    } catch (e) {
      console.error("Failed to fetch records:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords(currentPage, statusFilter);
  }, [currentPage, statusFilter, apiBase, selectedRecordId]);


  // Client-side search filtering
  const filteredRecords = records.filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const fields = r.fields || {};
    const owner = (fields.owner_name || "").toLowerCase();
    const survey = (fields.survey_number || "").toLowerCase();
    const khata = (fields.khata_number || "").toLowerCase();
    const village = (fields.village || "").toLowerCase();
    const id = (r.record_id || "").toLowerCase();
    return (
      owner.includes(term) ||
      survey.includes(term) ||
      khata.includes(term) ||
      village.includes(term) ||
      id.includes(term)
    );
  });

  const totalProcessed = stats?.total_processed || totalCount || 0;
  const verifiedCount = stats?.verified_count || 0;
  const pendingCount = stats?.pending_review_count || 0;
  const verifiedPct = totalProcessed > 0 ? Math.round((verifiedCount / totalProcessed) * 100) : 0;

  // Export records as CSV
  const handleExportCSV = () => {
    if (records.length === 0) return;
    const headers = ["Record ID", "Survey No", "Owner", "Khata No", "Village", "Area", "Status", "Risk"];
    const rows = records.map((r) => [
      r.record_id,
      r.fields?.survey_number || "",
      `"${(r.fields?.owner_name || "").replace(/"/g, '""')}"`,
      r.fields?.khata_number || "",
      `"${(r.fields?.village || "").replace(/"/g, '""')}"`,
      r.fields?.plot_area || "",
      r.status,
      r.risk_level,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `vasudhamithra_land_records_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
            MASTER REPOSITORY
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[var(--color-text-primary)] tracking-tight mt-1">
            Land records
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Search, inspect and export validated records across the district.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-tertiary)] rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            Export CSV
          </button>
          <button
            onClick={() => setActiveTab("document_intake")}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[var(--color-sidebar-bg)] hover:bg-[var(--color-sidebar-hover)] rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            Add records
          </button>
        </div>
      </div>

      {/* Dark Summary Banner Strip (Design Reference) */}
      <div className="bg-[var(--color-sidebar-bg)] text-white rounded-xl p-5 border border-[var(--color-sidebar-border)] shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-sidebar-border)]">
          <div className="pt-2 sm:pt-0">
            <span className="text-[11px] uppercase font-semibold tracking-wider text-[var(--color-sidebar-muted)]">
              Total records
            </span>
            <div className="text-2xl font-serif font-bold text-white mt-1">
              {totalProcessed.toLocaleString()}
            </div>
            <div className="text-[11px] text-[var(--color-sidebar-muted)] mt-0.5">
              Live database master
            </div>
          </div>

          <div className="pt-2 sm:pt-0 sm:pl-6">
            <span className="text-[11px] uppercase font-semibold tracking-wider text-[var(--color-sidebar-muted)]">
              Validated
            </span>
            <div className="text-2xl font-serif font-bold text-[var(--color-success)] mt-1">
              {verifiedCount.toLocaleString()}
            </div>
            <div className="text-[11px] text-[var(--color-sidebar-muted)] mt-0.5">
              {verifiedPct}% of repository
            </div>
          </div>

          <div className="pt-2 sm:pt-0 sm:pl-6">
            <span className="text-[11px] uppercase font-semibold tracking-wider text-[var(--color-sidebar-muted)]">
              Pending review
            </span>
            <div className="text-2xl font-serif font-bold text-[var(--color-accent)] mt-1">
              {pendingCount.toLocaleString()}
            </div>
            <div className="text-[11px] text-[var(--color-sidebar-muted)] mt-0.5">
              Action required
            </div>
          </div>

          <div className="pt-2 sm:pt-0 sm:pl-6">
            <span className="text-[11px] uppercase font-semibold tracking-wider text-[var(--color-sidebar-muted)]">
              Spatial Status
            </span>
            <div className="text-2xl font-serif font-bold text-white mt-1">
              {stats?.spatial_discrepancy_count || 0}
            </div>
            <div className="text-[11px] text-[var(--color-sidebar-muted)] mt-0.5">
              Cadastral discrepancies
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by owner, survey or khata number..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-[var(--color-bg-primary)] border border-[var(--color-border-strong)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
        </div>

        {/* Status Dropdown Filter */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <Filter className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs bg-[var(--color-bg-primary)] border border-[var(--color-border-strong)] rounded-lg px-2.5 py-1.5 text-[var(--color-text-primary)] font-semibold focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            >
              <option value="all">All statuses</option>
              <option value="validated">Validated</option>
              <option value="pending_review">Pending Review</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <button
            onClick={() => fetchRecords(currentPage, statusFilter)}
            disabled={loading}
            title="Refresh records from database"
            className="p-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-tertiary)] rounded-lg text-[var(--color-text-muted)] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[var(--color-accent)]" : ""}`} />
          </button>

          <span className="text-xs text-[var(--color-text-muted)]">
            {filteredRecords.length} records shown
          </span>
        </div>
      </div>

      {/* Master Table */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] text-[var(--color-text-muted)] font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">SURVEY NO.</th>
                <th className="py-3.5 px-4">OWNER</th>
                <th className="py-3.5 px-4">KHATA NO.</th>
                <th className="py-3.5 px-4">VILLAGE</th>
                <th className="py-3.5 px-4">AREA</th>
                <th className="py-3.5 px-4">CLASSIFICATION</th>
                <th className="py-3.5 px-4">STATUS</th>
                <th className="py-3.5 px-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--color-text-muted)]">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--color-accent)]" />
                    Loading master land records from PostgreSQL...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--color-text-muted)]">
                    No land records match the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const fields = r.fields || {};
                  const isValidated = r.status === "validated";
                  const isRejected = r.status === "rejected";

                  const isSelected = r.record_id === selectedRecordId;

                  return (
                    <tr
                      key={r.record_id}
                      className={`transition-colors group ${
                        isSelected
                          ? "bg-[var(--color-accent-subtle)] ring-1 ring-[var(--color-accent)]/40"
                          : "hover:bg-[var(--color-bg-primary)]"
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-[var(--color-text-primary)]">
                        <div className="flex items-center gap-1.5">
                          {isSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" title="Active record in current workflow" />
                          )}
                          <span>{fields.survey_number || fields.khasra_number || "—"}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[var(--color-text-primary)] max-w-[180px] truncate">
                        {fields.owner_name || "—"}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[var(--color-text-secondary)]">
                        {fields.khata_number || "—"}
                      </td>
                      <td className="py-3.5 px-4 text-[var(--color-text-secondary)] max-w-[140px] truncate">
                        {fields.village || "—"}
                      </td>
                      <td className="py-3.5 px-4 text-[var(--color-text-primary)] font-medium">
                        {fields.plot_area || (r.gis?.area_doc_acres ? `${r.gis.area_doc_acres} ac` : "—")}
                      </td>
                      <td className="py-3.5 px-4 text-[var(--color-text-muted)] max-w-[140px] truncate">
                        {fields.land_classification || "—"}
                      </td>
                      <td className="py-3.5 px-4">
                        {isValidated ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]">
                            ● Validated
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-error-bg)] text-[var(--color-error)] border border-[var(--color-error-border)]">
                            ● Mismatch
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]">
                            ● Review needed
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            if (setSelectedRecordId) setSelectedRecordId(r.record_id);
                            if (setActiveTab) setActiveTab("verification_desk");
                          }}
                          className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] rounded-lg transition-colors cursor-pointer"
                          title="Inspect in Verification Desk"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Real Pagination Controls */}
        <div className="py-3.5 px-6 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
          <div>
            Showing {(currentPage - 1) * limit + 1}–
            {Math.min(currentPage * limit, totalCount)} of {totalCount} records
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
              className="p-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-[var(--color-text-primary)]">
              Page {currentPage} of {Math.max(1, Math.ceil(totalCount / limit))}
            </span>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage * limit >= totalCount || loading}
              className="p-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
