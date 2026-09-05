import React from "react";
import { Search, Bell, ChevronDown } from "lucide-react";

export default function TopBar({
  title = "Command centre",
  breadcrumb = "KARNATAKA / REVENUE DEPARTMENT",
  searchTerm = "",
  setSearchTerm,
  pendingCount = 0,
}) {
  return (
    <header className="h-16 bg-[#F7F5EF] border-b border-[#E6E3DB] flex items-center justify-between px-8 sticky top-0 z-20">
      {/* Breadcrumb & Title */}
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold tracking-wider text-[#8A887E] uppercase">
          {breadcrumb}
        </span>
        <h2 className="text-base font-bold text-[#16241F] tracking-tight">
          {title}
        </h2>
      </div>

      {/* Global Search Bar */}
      <div className="relative w-96 max-w-md">
        <Search className="w-4 h-4 text-[#8A887E] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm && setSearchTerm(e.target.value)}
          placeholder="Search survey no, owner or batch..."
          className="w-full pl-10 pr-12 py-2 text-sm bg-white border border-[#DDD9CE] rounded-lg text-[#16241F] placeholder-[#9E9B91] focus:outline-none focus:ring-1 focus:ring-[#D9714B] focus:border-[#D9714B] transition-all shadow-xs"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-[#8A887E] bg-[#F2EFE8] border border-[#DDD9CE] rounded">
            ⌘ K
          </kbd>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-5">
        {/* Language Selector */}
        <div className="flex items-center gap-1 text-xs font-semibold text-[#5A584F] cursor-pointer hover:text-[#16241F]">
          <span>EN</span>
          <span className="text-[#8A887E] text-[10px]">›</span>
        </div>

        {/* Notifications */}
        <div className="relative cursor-pointer text-[#5A584F] hover:text-[#16241F] p-1.5">
          <Bell className="w-4 h-4" />
          {pendingCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#D9714B] rounded-full ring-2 ring-[#F7F5EF]" />
          )}
        </div>

        <div className="h-6 w-px bg-[#E6E3DB]" />

        {/* User Profile */}
        <div className="flex items-center gap-2.5 cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-[#16241F] text-white flex items-center justify-center text-xs font-bold font-serif shadow-xs">
            DG
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-semibold text-[#16241F] leading-none">
              Deepak G.M.
            </span>
            <span className="text-[10px] text-[#8A887E] leading-none mt-1">
              District Admin
            </span>
          </div>
          <ChevronDown className="w-3 h-3 text-[#8A887E]" />
        </div>
      </div>
    </header>
  );
}
