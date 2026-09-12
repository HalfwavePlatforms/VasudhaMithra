import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import CommandCentre from "./components/CommandCentre";
import DocumentIntake from "./components/DocumentIntake";
import VerificationDesk from "./components/VerificationDesk";
import LandRecords from "./components/LandRecords";
import GisParcels from "./components/GisParcels";
import AuditTrailView from "./components/AuditTrailView";
import AnalyticsView from "./components/AnalyticsView";
import LoginPage from "./components/LoginPage";
import PublicVerifyPage from "./components/PublicVerifyPage";
import CitizenVoiceQueryPage from "./components/CitizenVoiceQueryPage";
import ProfileCaptureModal from "./components/ProfileCaptureModal";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function App() {
  const { t } = useTranslation();

  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("vasudha_auth");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [pendingFaceCheck, setPendingFaceCheck] = useState(false);

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab && ["command_centre", "document_intake", "verification_desk", "land_records", "gis_parcels", "audit_trail", "analytics"].includes(tab)) {
        return tab;
      }
    } catch {}
    return "command_centre";
  });
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [stats, setStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const handleLogin = (userSession) => {
    setUser(userSession);
    // After person logs in, immediately take them to the face check page
    setPendingFaceCheck(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("vasudha_auth");
    localStorage.removeItem("vasudha_token");
    setUser(null);
    setShowCaptureModal(false);
    setPendingFaceCheck(false);
  };

  const handlePhotoCaptured = (pictureUrl) => {
    setUser((prev) => (prev ? { ...prev, picture: pictureUrl } : prev));
    setShowCaptureModal(false);
    setPendingFaceCheck(false);
  };

  const loadDashboardData = () => {
    if (!user) return;
    const token = localStorage.getItem("vasudha_token");
    const authHeaders = token
      ? { Authorization: `Bearer ${token}`, "X-Role": user?.xRole || "officer" }
      : { "X-Role": user?.xRole || "officer" };

    // 1. Fetch real stats
    fetch(`${API_BASE}/dashboard/stats`, { headers: authHeaders })
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
    fetch(`${API_BASE}/dashboard/audit-trail?limit=15`, { headers: authHeaders })
      .then((res) => (res.ok ? res.json() : { audit_logs: [] }))
      .then((data) => setAuditLogs(data.audit_logs || []))
      .catch(() => {});
  };


  useEffect(() => {
    if (user) {
      loadDashboardData();
      const interval = setInterval(loadDashboardData, 8000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Refetch stats and audit trail on every navigation return so views are never stale
  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [activeTab, user]);

  // Standalone Citizen Voice Query route (/ask or /voice)
  const isVoiceQueryRoute =
    typeof window !== "undefined" &&
    (window.location.pathname.startsWith("/ask") || window.location.pathname.startsWith("/voice"));
  if (isVoiceQueryRoute) {
    return <CitizenVoiceQueryPage apiBase={API_BASE} />;
  }

  // Public read-only verification route for citizens, banks & buyers (no login required)
  const isVerifyRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/verify");
  if (isVerifyRoute) {
    return <PublicVerifyPage apiBase={API_BASE} />;
  }

  if (!user) {
    return <LoginPage onLoginSuccess={handleLogin} apiBase={API_BASE} />;
  }

  // Mandatory Biometric Face Check page directly after login
  if (pendingFaceCheck) {
    return (
      <ProfileCaptureModal
        user={user}
        apiBase={API_BASE}
        isFullPage={true}
        onComplete={(pictureUrl) => {
          handlePhotoCaptured(pictureUrl);
          setPendingFaceCheck(false);
        }}
        onSkip={() => setPendingFaceCheck(false)}
      />
    );
  }

  const pageTitles = {
    command_centre: t("sidebar.commandCentre"),
    document_intake: t("sidebar.documentIntake"),
    verification_desk: t("sidebar.verificationDesk"),
    land_records: t("sidebar.landRecords"),
    gis_parcels: t("sidebar.gisParcels"),
    audit_trail: t("sidebar.auditTrail"),
    analytics: t("sidebar.analytics"),
  };

  return (
    <div className="flex min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] font-sans antialiased">
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
          title={pageTitles[activeTab] || t("sidebar.commandCentre")}
          breadcrumb={t("topbar.breadcrumbState")}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          pendingCount={stats?.pending_review_count || 0}
          user={user}
          onLogout={handleLogout}
          onUpdatePhoto={() => setShowCaptureModal(true)}
          auditLogs={auditLogs}
        />

        {/* Dynamic Page View */}
        <main className="flex-1 p-8 overflow-y-auto">
          {activeTab === "command_centre" && (
            <CommandCentre
              stats={stats}
              auditLogs={auditLogs}
              loading={loading}
              setActiveTab={setActiveTab}
              user={user}
              onExport={() => {
                window.print();
              }}
            />
          )}

          {activeTab === "document_intake" && (
            <DocumentIntake
              apiBase={API_BASE}
              user={user}
              onUploadSuccess={(uploadData) => {
                loadDashboardData();
                if (uploadData?.record_id) {
                  setSelectedRecordId(uploadData.record_id);
                  setActiveTab("verification_desk");
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
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === "land_records" && (
            <LandRecords
              apiBase={API_BASE}
              user={user}
              setActiveTab={setActiveTab}
              setSelectedRecordId={setSelectedRecordId}
            />
          )}

          {activeTab === "gis_parcels" && (
            <GisParcels
              apiBase={API_BASE}
              user={user}
              setActiveTab={setActiveTab}
              setSelectedRecordId={setSelectedRecordId}
            />
          )}

          {activeTab === "audit_trail" && (
            <AuditTrailView
              apiBase={API_BASE}
              user={user}
              setActiveTab={setActiveTab}
              setSelectedRecordId={setSelectedRecordId}
              selectedRecordId={selectedRecordId}
            />
          )}

          {activeTab === "analytics" && (
            <AnalyticsView apiBase={API_BASE} />
          )}
        </main>
      </div>

      {/* Live OpenCV Profile Image Capture Modal */}
      {showCaptureModal && (
        <ProfileCaptureModal
          user={user}
          apiBase={API_BASE}
          onComplete={handlePhotoCaptured}
          onSkip={() => setShowCaptureModal(false)}
        />
      )}
    </div>
  );
}