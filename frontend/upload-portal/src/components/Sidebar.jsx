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
          badgeColor: "bg-[#D9714B] text-white",
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
          badgeColor: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
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
    <aside className="w-64 bg-[#16241F] text-neutral-200 flex flex-col h-screen fixed left-0 top-0 z-30 border-r border-[#22332B] select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#22332B]">
        <div className="flex items-center gap-3">
          {/* Overlapping Squares Logo */}
          <div className="relative w-8 h-8 flex-shrink-0">
            <div className="absolute top-0 left-0 w-5 h-5 bg-[#1D8374] rounded-[4px]" />
            <div className="absolute bottom-0 right-0 w-5 h-5 bg-[#D9714B] rounded-[4px] opacity-90 shadow-sm" />
          </div>
          <div>
            <h1 className="text-white text-lg font-serif font-bold tracking-tight leading-tight">
              VasudhaMithra
            </h1>
            <p className="text-[#8FA396] text-[11px] font-medium tracking-wide">
              भूमि अभिलेख प्रणाली
            </p>
          </div>
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 custom-scrollbar">
        {navItems.map((sec, idx) => (
          <div key={idx}>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#637C6F] px-3 mb-2">
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
                        ? "bg-[#22382F] text-white shadow-sm border border-[#2D4A3E]"
                        : isComingSoon
                        ? "text-[#4E6357] cursor-not-allowed hover:bg-transparent"
                        : "text-[#A7B9AE] hover:bg-[#1C2E27] hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 flex-shrink-0 ${
                          isActive ? "text-[#D9714B]" : "text-[#768F81]"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {item.tag && (
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-[#5A7265] bg-[#1C2C25] px-1.5 py-0.5 rounded">
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
      <div className="p-3 border-t border-[#22332B] bg-[#13201B]">
        <div className="bg-[#1A2B24] border border-[#263D33] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-medium text-emerald-200">
                Systems operational
              </span>
            </div>
            <span className="text-[10px] text-[#718A7D]">Live API</span>
          </div>
          <p className="text-[11px] text-[#8FA396] mt-1">
            Real data from PostgreSQL & GIS
          </p>
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#243930] text-[10px] text-[#637C6F]">
            <span>NIC Cloud · Bengaluru</span>
            <span className="font-mono">v2.4.0</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
