import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import CommandCentre from "./components/CommandCentre";
import DocumentIntake from "./components/DocumentIntake";
import VerificationDesk from "./components/VerificationDesk";
import LandRecords from "./components/LandRecords";
import GisParcels from "./components/GisParcels";
import AuditTrailView from "./components/AuditTrailView";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function App() {
  const [activeTab, setActiveTab] = useState("command_centre");
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [stats, setStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const loadDashboardData = () => {
    // 1. Fetch real stats
    fetch(`${API_BASE}/dashboard/stats`)
      .then((res) => {
        if (!res.ok) throw new Error(`Stats fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setStats(data);
      })
      .catch((e) => console.error("Error loading dashboard stats:", e))
      .finally(() => setLoading(false));

    // 2. Fetch real recent audit logs
    fetch(`${API_BASE}/dashboard/audit-trail?limit=15`)
      .then((res) => (res.ok ? res.json() : { audit_logs: [] }))
      .then((data) => setAuditLogs(data.audit_logs || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 8000);
    return () => clearInterval(interval);
  }, []);

  const pageTitles = {
    command_centre: "Command centre",
    document_intake: "Document intake",
    verification_desk: "Verification desk",
    land_records: "Land records",
    gis_parcels: "GIS & parcels",
    audit_trail: "Audit trail",
  };

  return (
    <div className="flex min-h-screen bg-[#F7F5EF] text-[#16241F] font-sans antialiased">
      {/* Fixed Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingCount={stats?.pending_review_count || 0}
        discrepancyCount={stats?.spatial_discrepancy_count || 0}
      />

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Top Header Bar */}
        <TopBar
          title={pageTitles[activeTab] || "Command centre"}
          breadcrumb="KARNATAKA / REVENUE DEPARTMENT"
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          pendingCount={stats?.pending_review_count || 0}
        />

        {/* Dynamic Page View */}
        <main className="flex-1 p-8 overflow-y-auto">
          {activeTab === "command_centre" && (
            <CommandCentre
              stats={stats}
              auditLogs={auditLogs}
              loading={loading}
              setActiveTab={setActiveTab}
              onExport={() => {
                window.print();
              }}
            />
          )}

          {activeTab === "document_intake" && (
            <DocumentIntake
              apiBase={API_BASE}
              onUploadSuccess={(uploadData) => {
                loadDashboardData();
                if (uploadData?.record_id) {
                  setSelectedRecordId(uploadData.record_id);
                }
              }}
              setActiveTab={setActiveTab}
              setSelectedRecordId={setSelectedRecordId}
            />
          )}

          {activeTab === "verification_desk" && (
            <VerificationDesk
              apiBase={API_BASE}
              selectedRecordId={selectedRecordId}
              setSelectedRecordId={setSelectedRecordId}
              onRecordUpdated={loadDashboardData}
            />
          )}

          {activeTab === "land_records" && (
            <LandRecords
              apiBase={API_BASE}
              stats={stats}
              setActiveTab={setActiveTab}
              setSelectedRecordId={setSelectedRecordId}
            />
          )}

          {activeTab === "gis_parcels" && (
            <GisParcels
              apiBase={API_BASE}
              setActiveTab={setActiveTab}
              setSelectedRecordId={setSelectedRecordId}
            />
          )}

          {activeTab === "audit_trail" && (
            <AuditTrailView
              apiBase={API_BASE}
              setActiveTab={setActiveTab}
              setSelectedRecordId={setSelectedRecordId}
            />
          )}
        </main>
      </div>
    </div>
  );
}