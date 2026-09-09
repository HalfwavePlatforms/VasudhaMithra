import React, { useState, useRef, useEffect } from "react";
import { Search, Bell, ChevronDown, LogOut, RefreshCw, UserCheck } from "lucide-react";

export default function TopBar({
  title = "Command centre",
  breadcrumb = "KARNATAKA / REVENUE DEPARTMENT",
  searchTerm = "",
  setSearchTerm,
  pendingCount = 0,
  user = null,
  onLogout = null,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getInitials = () => {
    if (!user) return "VM";
    if (user.email) {
      const parts = user.email.split("@")[0].split(".");
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return user.email.slice(0, 2).toUpperCase();
    }
    return "VM";
  };

  const getRoleDisplay = () => {
    if (!user?.xRole) return "Authorized Officer";
    if (user.xRole === "officer") return "Revenue Officer";
    if (user.xRole === "surveyor") return "Cadastral Surveyor";
    if (user.xRole === "tahsildar") return "Tahsildar / Verifier";
    return user.xRole;
  };

  return (
    <header className="h-16 bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] flex items-center justify-between px-8 sticky top-0 z-20">
      {/* Breadcrumb & Title */}
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold tracking-wider text-[var(--color-text-muted)] uppercase">
          {breadcrumb}
        </span>
        <h2 className="text-base font-bold text-[var(--color-text-primary)] tracking-tight">
          {title}
        </h2>
      </div>

      {/* Global Search Bar */}
      <div className="relative w-96 max-w-md">
        <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm && setSearchTerm(e.target.value)}
          placeholder="Search survey no, owner or batch..."
          className="w-full pl-10 pr-12 py-2 text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border-strong)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] transition-all shadow-xs"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] border border-[var(--color-border-strong)] rounded">
            ⌘ K
          </kbd>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-5">
        {/* Language Selector */}
        <div className="flex items-center gap-1 text-xs font-semibold text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text-primary)]">
          <span>EN</span>
          <span className="text-[var(--color-text-muted)] text-[10px]">›</span>
        </div>

        {/* Notifications */}
        <div className="relative cursor-pointer text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-1.5">
          <Bell className="w-4 h-4" />
          {pendingCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--color-accent)] rounded-full ring-2 ring-[var(--color-bg-primary)]" />
          )}
        </div>

        <div className="h-6 w-px bg-[var(--color-border)]" />

        {/* User Profile */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2.5 cursor-pointer focus:outline-none hover:opacity-90"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--color-sidebar-active)] text-[var(--color-sidebar-muted)] flex items-center justify-center text-xs font-bold font-serif shadow-xs ring-1 ring-[var(--color-accent)]/30">
              {getInitials()}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold text-[var(--color-text-primary)] leading-none truncate max-w-[130px]">
                {user?.actor || user?.email?.split("@")[0] || "Authorized Officer"}
              </span>
              <span className="text-[10px] text-[var(--color-accent)] font-medium leading-none mt-1">
                {getRoleDisplay()}
              </span>
            </div>
            <ChevronDown className="w-3 h-3 text-[var(--color-text-muted)]" />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-lg py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-3 border-b border-[var(--color-border-subtle)]">
                <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">{user?.email || "officer@karnataka.gov.in"}</p>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-[var(--color-success)]" /> NIC Authenticated
                </p>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] flex items-center gap-2 font-medium transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out / Switch role
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
