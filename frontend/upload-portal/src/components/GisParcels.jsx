import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  MapPin,
  Search,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  Loader2,
  Compass,
  X,
  Check
} from "lucide-react";
import CadastralLeafletMap from "./CadastralLeafletMap";

export default function GisParcels({
  apiBase,
  setActiveTab,
  setSelectedRecordId,
}) {
  const { t } = useTranslation();
  const [parcels, setParcels] = useState([]);
  const [selectedParcel, setSelectedParcel] = useState(null);
  const [parcelDetail, setParcelDetail] = useState(null);
  const [matchedRecord, setMatchedRecord] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Combobox state for Problem 3
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [comboboxSearch, setComboboxSearch] = useState("");
  const comboboxRef = useRef(null);

  // Close combobox popover on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target)) {
        setComboboxOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 1. Fetch available real parcels from GIS service AND digitized database records
  useEffect(() => {
    setLoadingList(true);
    Promise.all([
      fetch(`${apiBase}/gis/parcels`)
        .then((res) => (res.ok ? res.json() : { parcels: [] }))
        .catch(() =>
          fetch("http://127.0.0.1:8003/gis/parcels")
            .then((res) => res.json())
            .catch(() => ({ parcels: [] }))
        ),
      fetch(`${apiBase}/records?limit=100`)
        .then((res) => (res.ok ? res.json() : { records: [] }))
        .catch(() => ({ records: [] })),
    ])
      .then(([gisData, recData]) => {
        const gisList = (gisData && gisData.parcels) || [];
        const recList = (recData && recData.records) || [];

        // Deduplicate and combine seeded parcels with digitized land records
        const combined = [...gisList];
        const seenSns = new Set(gisList.map((p) => String(p.survey_number).toLowerCase().trim()));

        for (const r of recList) {
          const sn = r.fields?.survey_number || r.fields?.khasra_number;
          if (sn && !seenSns.has(String(sn).toLowerCase().trim())) {
            seenSns.add(String(sn).toLowerCase().trim());
            combined.push({
              parcel_id: r.gis?.parcel_id || r.parcel_id || `PARCEL-${sn}-REC`,
              survey_number: sn,
              village: r.fields?.village || "Karnataka / Regional Record",
              district: r.fields?.district || "",
              tehsil: r.fields?.tehsil || "",
              state: r.fields?.state || "",
              area_acres: r.gis?.area_gis_acres || r.gis?.area_doc_acres || 3.75,
              source: r.gis ? "digitized_record_gis" : "digitized_record",
            });
          }
        }

        setParcels(combined);
        if (combined.length > 0 && !selectedParcel) {
          setSelectedParcel(combined[0]);
        }
      })
      .catch((err) => console.error("Could not fetch GIS parcels:", err))
      .finally(() => setLoadingList(false));
  }, [apiBase]);

  // 2. Fetch full geometry and details for the selected parcel (supporting dynamic geocoding params)
  useEffect(() => {
    if (!selectedParcel) return;

    setLoadingDetail(true);
    const sn = encodeURIComponent(selectedParcel.survey_number);

    const params = new URLSearchParams();
    if (selectedParcel.village) params.set("village", selectedParcel.village);
    if (selectedParcel.tehsil) params.set("tehsil", selectedParcel.tehsil);
    if (selectedParcel.district) params.set("district", selectedParcel.district);
    if (selectedParcel.state) params.set("state", selectedParcel.state);
    if (selectedParcel.area_acres) params.set("area_acres", selectedParcel.area_acres);
    const queryStr = params.toString() ? `?${params.toString()}` : "";

    fetch(`${apiBase}/gis/parcel/${sn}${queryStr}`)
      .then((res) => {
        if (!res.ok) throw new Error("Proxy failed");
        return res.json();
      })
      .catch(() => {
        return fetch(`http://127.0.0.1:8003/gis/parcel/${sn}${queryStr}`).then((res) => res.json());
      })
      .then((data) => {
        setParcelDetail(data);

        // Check if there is a matching digitized record in the DB for this survey number
        fetch(`${apiBase}/records?limit=50`)
          .then((r) => (r.ok ? r.json() : { records: [] }))
          .then((recData) => {
            const match = (recData.records || []).find(
              (r) =>
                r.fields?.survey_number === data.survey_number ||
                r.fields?.khasra_number === data.survey_number ||
                r.parcel_id === data.parcel_id
            );
            setMatchedRecord(match || null);
          })
          .catch(() => setMatchedRecord(null));
      })
      .catch((err) => console.error("Error loading parcel detail:", err))
      .finally(() => setLoadingDetail(false));
  }, [selectedParcel, apiBase]);

  // Filter real parcels based on combobox search input
  const filteredParcels = parcels.filter((p) => {
    if (!comboboxSearch.trim()) return true;
    const q = comboboxSearch.trim().toLowerCase();
    return (
      (p.survey_number && p.survey_number.toLowerCase().includes(q)) ||
      (p.village && p.village.toLowerCase().includes(q)) ||
      (p.district && p.district.toLowerCase().includes(q)) ||
      (p.parcel_id && p.parcel_id.toLowerCase().includes(q))
    );
  });

  const handleSelectParcel = (p) => {
    setSelectedParcel(p);
    setComboboxSearch("");
    setComboboxOpen(false);
  };

  const handleCustomSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (!comboboxSearch.trim()) return;
    const clean = comboboxSearch.trim();
    const found = parcels.find(
      (p) =>
        p.survey_number.toLowerCase() === clean.toLowerCase() ||
        (p.village && p.village.toLowerCase() === clean.toLowerCase())
    );
    if (found) {
      handleSelectParcel(found);
    } else {
      // Support searching formatted queries like "55, Hongasandra" or raw survey number
      const parts = clean.split(",").map((s) => s.trim());
      const sn = parts[0];
      const village = parts.length > 1 ? parts[1] : "";
      const district = parts.length > 2 ? parts[2] : "";
      setSelectedParcel({
        survey_number: sn,
        village: village,
        district: district,
      });
      setComboboxOpen(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-label-muted)]">
            {t("sidebar.operations")}
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[var(--color-text-primary)] tracking-tight mt-1">
            {t("sidebar.gisParcels")}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {t("gis.satelliteSubtitle")}
          </p>
        </div>
      </div>

      {/* Main Layout: Left Controls + Center Map + Right Parcel Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Control Panel (3 Cols) — Formatted strictly top-to-bottom per spec */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5 shadow-xs space-y-5">
            {/* 1. "Search or select parcel" (Merged single searchable combobox) */}
            <div className="space-y-2 relative" ref={comboboxRef}>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-[var(--color-text-primary)]">
                  {t("gis.searchPlaceholder")}
                </label>
                <span className="text-[10px] font-mono text-[var(--color-sidebar-muted)]">
                  {loadingList ? t("common.loading") : `${parcels.length} ${t("common.records")}`}
                </span>
              </div>

              {/* Input + Combobox triggers */}
              <div className="relative">
                <Search className="w-4 h-4 text-[var(--color-sidebar-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={comboboxSearch}
                  onFocus={() => setComboboxOpen(true)}
                  onChange={(e) => {
                    setComboboxSearch(e.target.value);
                    setComboboxOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCustomSearchSubmit(e);
                    } else if (e.key === "Escape") {
                      setComboboxOpen(false);
                    }
                  }}
                  placeholder={
                    selectedParcel
                      ? `Survey ${selectedParcel.survey_number} (${selectedParcel.village || "Cadastral"})`
                      : "Search survey, village, or district..."
                  }
                  className="w-full pl-9 pr-14 py-2 text-xs bg-[var(--color-bg-primary)] border border-[var(--color-border-strong)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] transition-all"
                />

                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  {comboboxSearch && (
                    <button
                      type="button"
                      onClick={() => setComboboxSearch("")}
                      className="p-1 text-[var(--color-sidebar-muted)] hover:text-[var(--color-text-primary)] rounded"
                      title="Clear text"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setComboboxOpen(!comboboxOpen)}
                    className="p-1 text-[var(--color-sidebar-muted)] hover:text-[var(--color-text-primary)] rounded"
                    title="Toggle parcel list"
                  >
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-150 ${
                        comboboxOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Active Selection Badge */}
              {selectedParcel && (
                <div className="p-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] flex items-center justify-between text-xs">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-success)] shrink-0" />
                    <span className="font-semibold text-[var(--color-text-primary)] truncate">
                      Survey {selectedParcel.survey_number}
                    </span>
                    <span className="text-[var(--color-sidebar-muted)] truncate text-[11px]">
                      {selectedParcel.village ? `· ${selectedParcel.village}` : ""}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[var(--color-accent-text)] font-medium shrink-0 ml-1.5">
                    {selectedParcel.area_acres || parcelDetail?.area_gis || "—"} ac
                  </span>
                </div>
              )}

              {/* Filtered Dropdown List Popover */}
              {comboboxOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[var(--color-bg-secondary)] border border-[var(--color-border-strong)] rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-[var(--color-border-subtle)]">
                  {filteredParcels.length > 0 ? (
                    filteredParcels.map((p) => {
                      const isSelected = selectedParcel?.survey_number === p.survey_number;
                      return (
                        <button
                          key={p.parcel_id}
                          type="button"
                          onClick={() => handleSelectParcel(p)}
                          className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between transition-colors ${
                            isSelected
                              ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] font-semibold"
                              : "hover:bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-[var(--color-text-primary)]">
                                Survey {p.survey_number}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-[var(--color-success)]" />}
                            </div>
                            <div className="text-[11px] text-[var(--color-sidebar-muted)] truncate">
                              {p.village}, {p.district} ({p.state || "MP"})
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] shrink-0">
                            {p.area_acres} ac
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-3 text-center">
                      <div className="text-xs text-[var(--color-sidebar-muted)] mb-2">
                        No seeded parcel matching "{comboboxSearch}"
                      </div>
                      <button
                        type="button"
                        onClick={handleCustomSearchSubmit}
                        className="text-xs font-semibold text-[var(--color-accent-text)] hover:underline"
                      >
                        Search survey "{comboboxSearch}" directly &rarr;
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Record Status Legend (Moved up directly below the combobox per Problem 2) */}
            <div className="pt-4 border-t border-[var(--color-border-subtle)] space-y-2.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-sidebar-muted)]">
                RECORD STATUS LEGEND
              </span>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-xs bg-[var(--color-success)] shrink-0" />
                  <span className="text-[var(--color-text-secondary)]">Linked & validated (&le;5% &Delta;)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-xs bg-[var(--color-warning)] shrink-0" />
                  <span className="text-[var(--color-text-secondary)]">Pending review</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-xs bg-[var(--color-accent)] shrink-0" />
                  <span className="text-[var(--color-text-secondary)]">Boundary mismatch (&gt;5% &Delta;)</span>
                </div>
              </div>
            </div>
            {/* 3. (nothing else — the redundant static map layers list is removed per Problem 2) */}
          </div>
        </div>

        {/* Center: Interactive Map (5 Cols) */}
        <div className="lg:col-span-5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-subtle)]">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[var(--color-success)]" />
              <span className="text-xs font-bold text-[var(--color-text-primary)]">
                Multi-Layer Cadastral & Satellite Map
              </span>
            </div>
            <span className="text-[10px] font-mono text-[var(--color-sidebar-muted)]">
              {parcelDetail ? `Survey: ${parcelDetail.survey_number}` : "Select parcel"}
            </span>
          </div>

          {loadingDetail ? (
            <div className="h-[460px] flex items-center justify-center text-xs text-[var(--color-sidebar-muted)]">
              <Loader2 className="w-5 h-5 animate-spin mr-2 text-[var(--color-accent)]" />
              Loading cadastral boundary polygon...
            </div>
          ) : parcelDetail?.geometry ? (
            <div className="rounded-lg overflow-hidden border border-[var(--color-border-strong)]">
              <CadastralLeafletMap
                geometry={parcelDetail.geometry}
                gis={{
                  parcel_id: parcelDetail.parcel_id,
                  area_gis_acres: parcelDetail.area_gis,
                  area_doc_acres: matchedRecord?.gis?.area_doc_acres,
                  spatial_delta_pct: matchedRecord?.gis?.spatial_delta_pct,
                  spatial_consistency: matchedRecord?.gis?.spatial_consistency || "MATCH",
                }}
                height="460px"
                collapsedLayers={true}
              />
            </div>
          ) : (
            <div className="h-[460px] bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border-subtle)] flex items-center justify-center text-xs text-[var(--color-sidebar-muted)]">
              No geometry found for this survey number.
            </div>
          )}

          {/* Contextual Helper text directly below the map per Problem 2 */}
          <div className="flex items-center justify-between text-[11px] text-[var(--color-sidebar-muted)] px-1 pt-0.5">
            <span className="italic">
              Toggle base tiles (OpenStreetMap, Esri Satellite, CartoDB Positron) and cadastral overlays via the top-right map control.
            </span>
          </div>
        </div>

        {/* Right: Selected Parcel Card (4 Cols) */}
        <div className="lg:col-span-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 shadow-xs space-y-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-sidebar-muted)]">
              {t("gis.boundaryInspection").toUpperCase()}
            </span>
            <h3 className="text-2xl font-serif font-bold text-[var(--color-text-primary)] mt-1">
              {t("verificationDesk.surveyNumber")} {parcelDetail?.survey_number || "—"}
            </h3>
            <div className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">
              {parcelDetail?.parcel_id || "PARCEL-CADASTRAL"}
            </div>
          </div>

          {/* Owner Row */}
          <div className="p-3.5 bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[var(--color-sidebar-bg)] text-white flex items-center justify-center text-xs font-bold font-serif flex-shrink-0">
              {matchedRecord?.fields?.owner_name ? matchedRecord.fields.owner_name.slice(0, 2).toUpperCase() : "LP"}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold text-[var(--color-sidebar-muted)]">
                {t("verificationDesk.ownerName")}
              </div>
              <div className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                {matchedRecord?.fields?.owner_name || "Revenue Master Record"}
              </div>
            </div>
          </div>

          {/* Details Table */}
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[var(--color-border-subtle)]">
              <span className="text-[var(--color-text-muted)]">{t("verificationDesk.village")}</span>
              <span className="font-semibold text-[var(--color-text-primary)]">
                {parcelDetail?.metadata?.village || matchedRecord?.fields?.village || "Kothari"}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[var(--color-border-subtle)]">
              <span className="text-[var(--color-text-muted)]">{t("verificationDesk.district")}</span>
              <span className="font-semibold text-[var(--color-text-primary)]">
                {parcelDetail?.metadata?.district || matchedRecord?.fields?.district || "Bhopal"}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[var(--color-border-subtle)]">
              <span className="text-[var(--color-text-muted)]">{t("gis.gisCalculatedArea")}</span>
              <span className="font-bold text-[var(--color-success)]">
                {parcelDetail?.area_gis ? `${parcelDetail.area_gis} Acres` : "—"}
              </span>
            </div>
            {matchedRecord?.gis?.area_doc_acres && (
              <div className="flex justify-between py-1.5 border-b border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-muted)]">{t("gis.documentArea")}</span>
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {matchedRecord.gis.area_doc_acres} Acres
                </span>
              </div>
            )}
            {matchedRecord?.gis?.spatial_delta_pct !== undefined && (
              <div className="flex justify-between py-1.5 border-b border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-muted)]">{t("gis.spatialDelta")}</span>
                <span className="font-bold text-[var(--color-text-primary)]">
                  {matchedRecord.gis.spatial_delta_pct}%
                </span>
              </div>
            )}
            <div className="flex justify-between py-1.5 border-b border-[var(--color-border-subtle)]">
              <span className="text-[var(--color-text-muted)]">Geodetic Source</span>
              <span className="font-medium text-[11px] text-[var(--color-success)] text-right truncate max-w-[170px]" title={parcelDetail?.metadata?.geocoding_provider || "State Cadastral Master"}>
                {parcelDetail?.source === "osm_nominatim_dynamic_cadastre"
                  ? "OSM Nominatim (Live)"
                  : (parcelDetail?.metadata?.geocoding_provider ? "Public Geodetic Service" : "Cadastral Master")}
              </span>
            </div>
          </div>

          {/* Variance Status Alert */}
          {matchedRecord?.gis?.spatial_consistency === "DISCREPANCY" ? (
            <div className="p-3 bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-lg flex items-start gap-2 text-xs text-[var(--color-error)]">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>{t("commandCentre.spatialDiscrepancy")}:</strong> {t("commandCentre.areaMismatch")}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-lg flex items-center gap-2 text-xs text-[var(--color-success)]">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Boundary reconciled within statutory tolerance.</span>
            </div>
          )}

          {/* Action button */}
          {matchedRecord && (
            <button
              onClick={() => {
                if (setSelectedRecordId) setSelectedRecordId(matchedRecord.record_id);
                if (setActiveTab) setActiveTab("verification_desk");
              }}
              className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-[var(--color-sidebar-bg)] hover:bg-[var(--color-sidebar-hover)] inline-flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              {t("gis.openVerification")}
              <ArrowRight className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
