import React from "react";
import {
  LayoutGrid,
  UploadCloud,
  CheckSquare,
  FileText,
  MapPin,
  Clock,
  Layers,
  BarChart2,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";

export default function Sidebar({
  activeTab,
  setActiveTab,
  pendingCount = 0,
  discrepancyCount = 0,
}) {
  const navItems = [
    {
      group: "OPERATIONS",
      items: [
        {
          id: "command_centre",
          label: "Command centre",
          icon: LayoutGrid,
        },
        {
          id: "document_intake",
          label: "Document intake",
          icon: UploadCloud,
        },
        {
          id: "verification_desk",
          label: "Verification desk",
          icon: CheckSquare,
          badge: pendingCount > 0 ? pendingCount : null,
          badgeColor: "bg-[var(--color-accent)] text-white",
        },
        {
          id: "land_records",
          label: "Land records",
          icon: FileText,
        },
        {
          id: "gis_parcels",
          label: "GIS & parcels",
          icon: MapPin,
          badge: discrepancyCount > 0 ? `${discrepancyCount} alert` : null,
          badgeColor: "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]",
        },
      ],
    },
    {
      group: "GOVERNANCE",
      items: [
        {
          id: "analytics",
          label: "Analytics",
          icon: BarChart2,
          tag: "Coming soon",
        },
        {
          id: "audit_trail",
          label: "Audit trail",
          icon: Clock,
        },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-[var(--color-sidebar-bg)] text-[var(--color-sidebar-text)] flex flex-col h-screen fixed left-0 top-0 z-30 border-r border-[var(--color-sidebar-border)] select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-[var(--color-sidebar-border)]">
        <div className="flex items-center gap-3">
          {/* Overlapping Squares Logo */}
          <div className="relative w-8 h-8 flex-shrink-0">
            <div className="absolute top-0 left-0 w-5 h-5 bg-[var(--color-info)] rounded-[4px]" />
            <div className="absolute bottom-0 right-0 w-5 h-5 bg-[var(--color-accent)] rounded-[4px] opacity-90 shadow-sm" />
          </div>
          <div>
            <h1 className="text-white text-lg font-serif font-bold tracking-tight leading-tight">
              VasudhaMithra
            </h1>
            <p className="text-[var(--color-sidebar-muted)] text-[11px] font-medium tracking-wide">
              भूमि अभिलेख प्रणाली
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
                Systems operational
              </span>
            </div>
            <span className="text-[10px] text-[var(--color-sidebar-muted)]">Live API</span>
          </div>
          <p className="text-[11px] text-[var(--color-sidebar-muted)] mt-1">
            Real data from PostgreSQL & GIS
          </p>
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-[var(--color-sidebar-border)] text-[10px] text-[var(--color-sidebar-icon)]">
            <span>NIC Cloud · Bengaluru</span>
            <span className="font-mono">v2.4.0</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
