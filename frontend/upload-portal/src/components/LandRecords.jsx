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
  Loader2
} from "lucide-react";

export default function LandRecords({
  apiBase,
  stats,
  setActiveTab,
  setSelectedRecordId,
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
  }, [currentPage, statusFilter, apiBase]);

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
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#D9714B]">
            MASTER REPOSITORY
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#16241F] tracking-tight mt-1">
            Land records
          </h1>
          <p className="text-sm text-[#737167] mt-1">
            Search, inspect and export validated records across the district.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#16241F] bg-white border border-[#DDD9CE] hover:bg-[#F2EFE8] rounded-lg shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#737167]" />
            Export CSV
          </button>
          <button
            onClick={() => setActiveTab("document_intake")}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#16241F] hover:bg-[#22382F] rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            Add records
          </button>
        </div>
      </div>

      {/* Dark Summary Banner Strip (Design Reference) */}
      <div className="bg-[#16241F] text-white rounded-xl p-5 border border-[#22332B] shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-[#263D33]">
          <div className="pt-2 sm:pt-0">
            <span className="text-[11px] uppercase font-semibold tracking-wider text-[#8FA396]">
              Total records
            </span>
            <div className="text-2xl font-serif font-bold text-white mt-1">
              {totalProcessed.toLocaleString()}
            </div>
            <div className="text-[11px] text-[#A7B9AE] mt-0.5">
              Live database master
            </div>
          </div>

          <div className="pt-2 sm:pt-0 sm:pl-6">
            <span className="text-[11px] uppercase font-semibold tracking-wider text-[#8FA396]">
              Validated
            </span>
            <div className="text-2xl font-serif font-bold text-[#1D8374] mt-1">
              {verifiedCount.toLocaleString()}
            </div>
            <div className="text-[11px] text-[#8FA396] mt-0.5">
              {verifiedPct}% of repository
            </div>
          </div>

          <div className="pt-2 sm:pt-0 sm:pl-6">
            <span className="text-[11px] uppercase font-semibold tracking-wider text-[#8FA396]">
              Pending review
            </span>
            <div className="text-2xl font-serif font-bold text-[#D9714B] mt-1">
              {pendingCount.toLocaleString()}
            </div>
            <div className="text-[11px] text-[#8FA396] mt-0.5">
              Action required
            </div>
          </div>

          <div className="pt-2 sm:pt-0 sm:pl-6">
            <span className="text-[11px] uppercase font-semibold tracking-wider text-[#8FA396]">
              Spatial Status
            </span>
            <div className="text-2xl font-serif font-bold text-white mt-1">
              {stats?.spatial_discrepancy_count || 0}
            </div>
            <div className="text-[11px] text-[#8FA396] mt-0.5">
              Cadastral discrepancies
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E6E3DB] rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#8A887E] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by owner, survey or khata number..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-[#F7F5EF] border border-[#DDD9CE] rounded-lg text-[#16241F] placeholder-[#8A887E] focus:outline-none focus:ring-1 focus:ring-[#D9714B]"
          />
        </div>

        {/* Status Dropdown Filter */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-2 text-xs text-[#5A584F]">
            <Filter className="w-3.5 h-3.5 text-[#737167]" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs bg-[#F7F5EF] border border-[#DDD9CE] rounded-lg px-2.5 py-1.5 text-[#16241F] font-semibold focus:outline-none focus:ring-1 focus:ring-[#D9714B]"
            >
              <option value="all">All statuses</option>
              <option value="validated">Validated</option>
              <option value="pending_review">Pending Review</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <span className="text-xs text-[#8A887E]">
            {filteredRecords.length} records shown
          </span>
        </div>
      </div>

      {/* Master Table */}
      <div className="bg-white border border-[#E6E3DB] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#FAF9F5] border-b border-[#E6E3DB] text-[#737167] font-semibold uppercase tracking-wider text-[10px]">
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
            <tbody className="divide-y divide-[#F2EFE8]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#8A887E]">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#D9714B]" />
                    Loading master land records from PostgreSQL...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#8A887E]">
                    No land records match the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const fields = r.fields || {};
                  const isPending = r.status === "pending_review";
                  const isValidated = r.status === "validated";
                  const isRejected = r.status === "rejected";

                  return (
                    <tr
                      key={r.record_id}
                      className="hover:bg-[#FAF9F5] transition-colors group"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-[#16241F]">
                        {fields.survey_number || fields.khasra_number || "—"}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#16241F] max-w-[180px] truncate">
                        {fields.owner_name || "—"}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#5A584F]">
                        {fields.khata_number || "—"}
                      </td>
                      <td className="py-3.5 px-4 text-[#5A584F] max-w-[140px] truncate">
                        {fields.village || "—"}
                      </td>
                      <td className="py-3.5 px-4 text-[#16241F] font-medium">
                        {fields.plot_area || (r.gis?.area_doc_acres ? `${r.gis.area_doc_acres} ac` : "—")}
                      </td>
                      <td className="py-3.5 px-4 text-[#737167] max-w-[140px] truncate">
                        {fields.land_classification || "—"}
                      </td>
                      <td className="py-3.5 px-4">
                        {isValidated ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EBF7F2] text-[#1D8374] border border-[#C5E8D9]">
                            ● Validated
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            ● Mismatch
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FAF3EE] text-[#D9714B] border border-[#F3DFC7]">
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
                          className="p-1.5 text-[#737167] hover:text-[#D9714B] hover:bg-[#FAF3EE] rounded-lg transition-colors"
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
        <div className="py-3.5 px-6 border-t border-[#E6E3DB] bg-[#FAF9F5] flex items-center justify-between text-xs text-[#737167]">
          <div>
            Showing {(currentPage - 1) * limit + 1}–
            {Math.min(currentPage * limit, totalCount)} of {totalCount} records
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
              className="p-1.5 rounded-lg border border-[#DDD9CE] bg-white text-[#16241F] hover:bg-[#F2EFE8] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-[#16241F]">
              Page {currentPage} of {Math.max(1, Math.ceil(totalCount / limit))}
            </span>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage * limit >= totalCount || loading}
              className="p-1.5 rounded-lg border border-[#DDD9CE] bg-white text-[#16241F] hover:bg-[#F2EFE8] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
