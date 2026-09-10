import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Bell,
  ChevronDown,
  LogOut,
  UserCheck,
  Camera,
  Globe,
  Check,
  FileCheck2,
  AlertTriangle,
  FileEdit,
  UploadCloud,
  CheckCircle2,
} from "lucide-react";
import { SUPPORTED_LANGUAGES, changeLanguage } from "../i18n";

export default function TopBar({
  title = "Command centre",
  breadcrumb = "KARNATAKA / REVENUE DEPARTMENT",
  searchTerm = "",
  setSearchTerm,
  pendingCount = 0,
  user = null,
  onLogout = null,
  onUpdatePhoto = null,
  auditLogs = [],
}) {
  const { t, i18n } = useTranslation();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const profileRef = useRef(null);
  const langRef = useRef(null);
  const notifRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
      if (langRef.current && !langRef.current.contains(event.target)) {
        setLangDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ||
    SUPPORTED_LANGUAGES[0];

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
    if (!user?.xRole) return t("topbar.officer");
    if (user.xRole === "officer") return t("topbar.revenueOfficer");
    if (user.xRole === "surveyor") return t("topbar.cadastralSurveyor");
    if (user.xRole === "tahsildar") return t("topbar.tahsildar");
    return user.xRole;
  };

  const formatTimeAgo = (ts) => {
    if (!ts) return t("notifications.now");
    try {
      const diffMs = Date.now() - new Date(ts).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return t("notifications.now");
      if (diffMins < 60) return t("notifications.minutesAgo", { count: diffMins });
      const diffHours = Math.floor(diffMins / 60);
      return t("notifications.hoursAgo", { count: diffHours });
    } catch {
      return t("notifications.now");
    }
  };

  const renderNotificationText = (log) => {
    const actor = log.actor || "Officer";
    const survey = log.survey_number || log.record_id?.slice(0, 8) || "N/A";
    const action = (log.action || "").toLowerCase();
    if (action.includes("correct") || action.includes("edit") || action.includes("update")) {
      return t("notifications.correction", {
        actor,
        field: log.field_name || "Record",
        survey,
      });
    }
    if (action.includes("valida") || action.includes("approv")) {
      return t("notifications.validation", { actor, survey });
    }
    if (action.includes("reject")) {
      return t("notifications.rejection", { actor, survey });
    }
    if (action.includes("upload") || action.includes("intake") || action.includes("creat")) {
      return t("notifications.uploaded", { file: log.file_name || `Survey ${survey}` });
    }
    if (action.includes("discrepan") || action.includes("flag")) {
      return t("notifications.discrepancy", { survey });
    }
    return `${actor}: ${log.action} (${survey})`;
  };

  const getNotificationIcon = (action = "") => {
    const act = action.toLowerCase();
    if (act.includes("correct") || act.includes("edit")) {
      return <FileEdit className="w-4 h-4 text-[var(--color-warning)]" />;
    }
    if (act.includes("valida") || act.includes("approv")) {
      return <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" />;
    }
    if (act.includes("reject")) {
      return <AlertTriangle className="w-4 h-4 text-[var(--color-error)]" />;
    }
    if (act.includes("upload") || act.includes("creat")) {
      return <UploadCloud className="w-4 h-4 text-[var(--color-info)]" />;
    }
    return <FileCheck2 className="w-4 h-4 text-[var(--color-accent)]" />;
  };

  return (
    <header className="h-16 bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] flex items-center justify-between px-8 sticky top-0 z-20">
      {/* Breadcrumb & Title */}
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold tracking-wider text-[var(--color-text-muted)] uppercase">
          {breadcrumb || t("topbar.breadcrumbState")}
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
          placeholder={t("topbar.searchPlaceholder")}
          className="w-full pl-10 pr-12 py-2 text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border-strong)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] transition-all shadow-xs"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] border border-[var(--color-border-strong)] rounded">
            ⌘ K
          </kbd>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Language Selector Dropdown */}
        <div className="relative" ref={langRef}>
          <button
            type="button"
            onClick={() => setLangDropdownOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-all shadow-xs cursor-pointer"
            title={t("topbar.selectLanguage")}
          >
            <Globe className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span className="tracking-wide">{currentLang.nativeName}</span>
            <ChevronDown className="w-3 h-3 text-[var(--color-text-muted)]" />
          </button>

          {langDropdownOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider border-b border-[var(--color-border-subtle)] mb-1">
                {t("topbar.selectLanguage")}
              </div>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = i18n.language === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => {
                      changeLanguage(lang.code);
                      setLangDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-xs transition-colors text-left cursor-pointer ${
                      isSelected
                        ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-semibold"
                        : "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium leading-snug">{lang.nativeName}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)] leading-none">{lang.label}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            className="relative cursor-pointer text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-1.5 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors focus:outline-none"
            title={t("topbar.notificationsTitle")}
          >
            <Bell className="w-4 h-4" />
            {pendingCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--color-accent)] rounded-full ring-2 ring-[var(--color-bg-primary)] animate-pulse" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-84 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-2 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--color-text-primary)]">
                    {t("topbar.notificationsTitle")}
                  </span>
                  {auditLogs.length > 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] font-semibold bg-[var(--color-accent-subtle)] text-[var(--color-accent)] rounded-full">
                      {auditLogs.length}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {t("commandCentre.liveLedger")}
                </span>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[var(--color-border-subtle)]">
                {auditLogs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[var(--color-text-muted)]">
                    {t("topbar.noNotifications")}
                  </div>
                ) : (
                  auditLogs.slice(0, 8).map((log, idx) => (
                    <div
                      key={log.id || idx}
                      className="px-4 py-2.5 hover:bg-[var(--color-bg-tertiary)] transition-colors flex items-start gap-3"
                    >
                      <div className="p-1.5 bg-[var(--color-bg-primary)] rounded-md border border-[var(--color-border-subtle)] mt-0.5">
                        {getNotificationIcon(log.action)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-[var(--color-text-primary)] leading-snug">
                          {renderNotificationText(log)}
                        </p>
                        <span className="text-[10px] text-[var(--color-text-muted)] mt-1 block">
                          {formatTimeAgo(log.created_at || log.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-[var(--color-border)]" />

        {/* User Profile */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2.5 cursor-pointer focus:outline-none hover:opacity-90"
          >
            {user?.picture ? (
              <img
                src={user.picture}
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover ring-2 ring-[var(--color-accent)] shadow-xs"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[var(--color-sidebar-active)] text-[var(--color-sidebar-muted)] flex items-center justify-center text-xs font-bold font-serif shadow-xs ring-1 ring-[var(--color-accent)]/30">
                {getInitials()}
              </div>
            )}
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold text-[var(--color-text-primary)] leading-none truncate max-w-[130px]">
                {user?.actor || user?.email?.split("@")[0] || t("topbar.officer")}
              </span>
              <span className="text-[10px] text-[var(--color-role-tag)] font-medium leading-none mt-1">
                {getRoleDisplay()}
              </span>
            </div>
            <ChevronDown className="w-3 h-3 text-[var(--color-text-muted)]" />
          </button>

          {/* Dropdown Menu */}
          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-lg py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] flex items-center gap-3">
                {user?.picture ? (
                  <img
                    src={user.picture}
                    alt="Profile"
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-[var(--color-accent)] shadow-xs"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--color-sidebar-active)] text-[var(--color-sidebar-muted)] flex items-center justify-center text-sm font-bold font-serif shadow-xs ring-1 ring-[var(--color-accent)]/30">
                    {getInitials()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                    {user?.email || "officer@karnataka.gov.in"}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-[var(--color-success)]" /> {t("topbar.authenticated")}
                  </p>
                </div>
              </div>

              <div className="py-1">
                {onUpdatePhoto && (
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onUpdatePhoto();
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-2 font-medium transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    <span>{t("topbar.retakePhoto")}</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] flex items-center gap-2 font-medium transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {t("topbar.signOut")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
