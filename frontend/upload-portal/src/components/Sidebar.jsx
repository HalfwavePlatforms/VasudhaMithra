import React from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutGrid,
  UploadCloud,
  CheckSquare,
  FileText,
  MapPin,
  Clock,
  BarChart2,
  Mic,
} from "lucide-react";

export default function Sidebar({
  activeTab,
  setActiveTab,
  pendingCount = 0,
  discrepancyCount = 0,
}) {
  const { t } = useTranslation();

  const navItems = [
    {
      group: t("sidebar.operations"),
      items: [
        {
          id: "command_centre",
          label: t("sidebar.commandCentre"),
          icon: LayoutGrid,
        },
        {
          id: "document_intake",
          label: t("sidebar.documentIntake"),
          icon: UploadCloud,
        },
        {
          id: "verification_desk",
          label: t("sidebar.verificationDesk"),
          icon: CheckSquare,
          badge: pendingCount > 0 ? pendingCount : null,
          badgeColor: "bg-[var(--color-accent)] text-white",
        },
        {
          id: "land_records",
          label: t("sidebar.landRecords"),
          icon: FileText,
        },
        {
          id: "gis_parcels",
          label: t("sidebar.gisParcels"),
          icon: MapPin,
          badge: discrepancyCount > 0 ? `${discrepancyCount} ${t("sidebar.alerts")}` : null,
          badgeColor: "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]",
        },
      ],
    },
    {
      group: t("sidebar.governance"),
      items: [
        {
          id: "analytics",
          label: t("sidebar.analytics"),
          icon: BarChart2,
        },
        {
          id: "audit_trail",
          label: t("sidebar.auditTrail"),
          icon: Clock,
        },
      ],
    },
    {
      group: t("sidebar.publicServices"),
      items: [
        {
          id: "citizen_voice",
          label: t("sidebar.citizenVoice"),
          icon: Mic,
          href: "/ask",
          badge: "Live",
          badgeColor: "bg-emerald-500 text-white",
        },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-[var(--color-sidebar-bg)] text-[var(--color-sidebar-text)] flex flex-col h-screen fixed left-0 top-0 z-30 border-r border-[var(--color-sidebar-border)] select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-[var(--color-sidebar-border)]">
        <div className="flex items-center gap-3">
          {/* Brand Logo */}
          <div className="relative w-9 h-9 flex-shrink-0 rounded-xl bg-white p-1 shadow-md ring-1 ring-white/20 flex items-center justify-center">
            <img src="/logo-transparent.png" alt="VasudhaMithra" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-white text-lg font-serif font-bold tracking-tight leading-tight">
              {t("sidebar.appName")}
            </h1>
            <p className="text-[var(--color-sidebar-muted)] text-[11px] font-medium tracking-wide">
              {t("sidebar.appTagline")}
            </p>
          </div>
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 custom-scrollbar">
        {navItems.map((sec, idx) => (
          <div key={idx}>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-sidebar-icon)] px-3 mb-2">
              {sec.group}
            </div>
            <div className="space-y-1">
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const isComingSoon = item.tag === "Coming soon";

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.href) {
                        window.location.href = item.href;
                        return;
                      }
                      if (!isComingSoon) setActiveTab(item.id);
                    }}
                    disabled={isComingSoon}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                      isActive
                        ? "bg-[var(--color-sidebar-active)] text-white font-medium shadow-sm border border-[var(--color-sidebar-border)]"
                        : isComingSoon
                        ? "text-[var(--color-sidebar-icon)] cursor-not-allowed hover:bg-transparent"
                        : "text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 flex-shrink-0 ${
                          isActive ? "text-[var(--color-accent)]" : "text-[var(--color-sidebar-icon)]"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {item.tag && (
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-[var(--color-sidebar-muted)] bg-[var(--color-sidebar-hover)] px-1.5 py-0.5 rounded">
                        {item.tag}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom System Status Widget */}
      <div className="p-3 border-t border-[var(--color-sidebar-border)] bg-[var(--color-sidebar-bg)]">
        <div className="bg-[var(--color-sidebar-hover)] border border-[var(--color-sidebar-border)] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-medium text-[var(--color-sidebar-text)]">
                {t("sidebar.systemsOperational")}
              </span>
            </div>
            <span className="text-[10px] text-[var(--color-sidebar-muted)]">Live API</span>
          </div>
          <p className="text-[11px] text-[var(--color-sidebar-muted)] mt-1">
            {t("sidebar.realDataNotice")}
          </p>
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-[var(--color-sidebar-border)] text-[10px] text-[var(--color-sidebar-icon)]">
            <span>{t("sidebar.cloudRegion")}</span>
            <span className="font-mono">v2.4.0</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
