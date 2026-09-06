import React, { useState, useEffect, useRef } from "react";
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

  // 1. Fetch available real parcels from GIS service via api-gateway or direct
  useEffect(() => {
    setLoadingList(true);
    // Try API Gateway proxy first, then fallback to port 8003
    fetch(`${apiBase}/gis/parcels`)
      .then((res) => {
        if (!res.ok) throw new Error("API Gateway GIS proxy 404");
        return res.json();
      })
      .catch(() => {
        return fetch("http://127.0.0.1:8003/gis/parcels").then((res) => res.json());
      })
      .then((data) => {
        const list = data.parcels || [];
        setParcels(list);
        if (list.length > 0 && !selectedParcel) {
          setSelectedParcel(list[0]);
        }
      })
      .catch((err) => console.error("Could not fetch GIS parcels:", err))
      .finally(() => setLoadingList(false));
  }, [apiBase]);

  // 2. Fetch full geometry and details for the selected parcel
  useEffect(() => {
    if (!selectedParcel) return;

    setLoadingDetail(true);
    const sn = encodeURIComponent(selectedParcel.survey_number);

    fetch(`${apiBase}/gis/parcel/${sn}`)
      .then((res) => {
        if (!res.ok) throw new Error("Proxy failed");
        return res.json();
      })
      .catch(() => {
        return fetch(`http://127.0.0.1:8003/gis/parcel/${sn}`).then((res) => res.json());
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
      p.survey_number.toLowerCase().includes(q) ||
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
      (p) => p.survey_number.toLowerCase() === clean.toLowerCase()
    );
    if (found) {
      handleSelectParcel(found);
    } else {
      setSelectedParcel({ survey_number: clean });
      setComboboxOpen(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#D9714B]">
            SPATIAL INTELLIGENCE
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#16241F] tracking-tight mt-1">
            GIS & cadastral parcels
          </h1>
          <p className="text-sm text-[#737167] mt-1">
            Reconcile digitized records with surveyed boundaries and spatial masters.
          </p>
        </div>
      </div>

      {/* Main Layout: Left Controls + Center Map + Right Parcel Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Control Panel (3 Cols) — Formatted strictly top-to-bottom per spec */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white border border-[#E6E3DB] rounded-xl p-5 shadow-xs space-y-5">
            {/* 1. "Search or select parcel" (Merged single searchable combobox) */}
            <div className="space-y-2 relative" ref={comboboxRef}>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-[#16241F]">
                  Search or select parcel
                </label>
                <span className="text-[10px] font-mono text-[#8A887E]">
                  {loadingList ? "Loading..." : `${parcels.length} available`}
                </span>
              </div>

              {/* Input + Combobox triggers */}
              <div className="relative">
                <Search className="w-4 h-4 text-[#8A887E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                  className="w-full pl-9 pr-14 py-2 text-xs bg-[#F7F5EF] border border-[#DDD9CE] rounded-lg text-[#16241F] placeholder:text-[#737167] focus:outline-none focus:ring-1 focus:ring-[#D9714B] focus:border-[#D9714B] transition-all"
                />

                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  {comboboxSearch && (
                    <button
                      type="button"
                      onClick={() => setComboboxSearch("")}
                      className="p-1 text-[#8A887E] hover:text-[#16241F] rounded"
                      title="Clear text"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setComboboxOpen(!comboboxOpen)}
                    className="p-1 text-[#8A887E] hover:text-[#16241F] rounded"
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
                <div className="p-2 rounded-lg bg-[#FAF9F5] border border-[#EAE7DF] flex items-center justify-between text-xs">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#1D8374] shrink-0" />
                    <span className="font-semibold text-[#16241F] truncate">
                      Survey {selectedParcel.survey_number}
                    </span>
                    <span className="text-[#8A887E] truncate text-[11px]">
                      {selectedParcel.village ? `· ${selectedParcel.village}` : ""}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#D9714B] font-medium shrink-0 ml-1.5">
                    {selectedParcel.area_acres || parcelDetail?.area_gis || "—"} ac
                  </span>
                </div>
              )}

              {/* Filtered Dropdown List Popover */}
              {comboboxOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-[#DDD9CE] rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-[#F2EFE8]">
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
                              ? "bg-[#FAF9F5] text-[#16241F] font-semibold"
                              : "hover:bg-[#F7F5EF] text-[#16241F]"
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-[#16241F]">
                                Survey {p.survey_number}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-[#1D8374]" />}
                            </div>
                            <div className="text-[11px] text-[#8A887E] truncate">
                              {p.village}, {p.district} ({p.state || "MP"})
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F2EFE8] text-[#5A584F] shrink-0">
                            {p.area_acres} ac
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-3 text-center">
                      <div className="text-xs text-[#8A887E] mb-2">
                        No seeded parcel matching "{comboboxSearch}"
                      </div>
                      <button
                        type="button"
                        onClick={handleCustomSearchSubmit}
                        className="text-xs font-semibold text-[#D9714B] hover:underline"
                      >
                        Search survey "{comboboxSearch}" directly &rarr;
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Record Status Legend (Moved up directly below the combobox per Problem 2) */}
            <div className="pt-4 border-t border-[#F2EFE8] space-y-2.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#8A887E]">
                RECORD STATUS LEGEND
              </span>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-xs bg-[#1D8374] shrink-0" />
                  <span className="text-[#5A584F]">Linked & validated (&le;5% &Delta;)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-xs bg-amber-500 shrink-0" />
                  <span className="text-[#5A584F]">Pending review</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-xs bg-[#D9714B] shrink-0" />
                  <span className="text-[#5A584F]">Boundary mismatch (&gt;5% &Delta;)</span>
                </div>
              </div>
            </div>
            {/* 3. (nothing else — the redundant static map layers list is removed per Problem 2) */}
          </div>
        </div>

        {/* Center: Interactive Map (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-[#E6E3DB] rounded-xl p-4 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between pb-3 border-b border-[#F2EFE8]">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#1D8374]" />
              <span className="text-xs font-bold text-[#16241F]">
                Multi-Layer Cadastral & Satellite Map
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#8A887E]">
              {parcelDetail ? `Survey: ${parcelDetail.survey_number}` : "Select parcel"}
            </span>
          </div>

          {loadingDetail ? (
            <div className="h-[460px] flex items-center justify-center text-xs text-[#8A887E]">
              <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#D9714B]" />
              Loading cadastral boundary polygon...
            </div>
          ) : parcelDetail?.geometry ? (
            <div className="rounded-lg overflow-hidden border border-[#DDD9CE]">
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
            <div className="h-[460px] bg-[#FAF9F5] rounded-lg border border-[#EAE7DF] flex items-center justify-center text-xs text-[#8A887E]">
              No geometry found for this survey number.
            </div>
          )}

          {/* Contextual Helper text directly below the map per Problem 2 */}
          <div className="flex items-center justify-between text-[11px] text-[#8A887E] px-1 pt-0.5">
            <span className="italic">
              Toggle base tiles (OpenStreetMap, Esri Satellite, CartoDB Positron) and cadastral overlays via the top-right map control.
            </span>
          </div>
        </div>

        {/* Right: Selected Parcel Card (4 Cols) */}
        <div className="lg:col-span-4 bg-white border border-[#E6E3DB] rounded-xl p-6 shadow-xs space-y-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A887E]">
              SELECTED PARCEL
            </span>
            <h3 className="text-2xl font-serif font-bold text-[#16241F] mt-1">
              Survey {parcelDetail?.survey_number || "—"}
            </h3>
            <div className="text-xs font-mono text-[#737167] mt-0.5">
              {parcelDetail?.parcel_id || "PARCEL-CADASTRAL"}
            </div>
          </div>

          {/* Owner Row */}
          <div className="p-3.5 bg-[#FAF9F5] border border-[#EAE7DF] rounded-xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#16241F] text-white flex items-center justify-center text-xs font-bold font-serif flex-shrink-0">
              {matchedRecord?.fields?.owner_name ? matchedRecord.fields.owner_name.slice(0, 2).toUpperCase() : "LP"}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold text-[#8A887E]">
                Recorded Owner
              </div>
              <div className="text-xs font-bold text-[#16241F] truncate">
                {matchedRecord?.fields?.owner_name || "Revenue Master Record (Seeded)"}
              </div>
            </div>
          </div>

          {/* Details Table */}
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#F2EFE8]">
              <span className="text-[#737167]">Village (Gram)</span>
              <span className="font-semibold text-[#16241F]">
                {parcelDetail?.metadata?.village || matchedRecord?.fields?.village || "Kothari"}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#F2EFE8]">
              <span className="text-[#737167]">District (Zilla)</span>
              <span className="font-semibold text-[#16241F]">
                {parcelDetail?.metadata?.district || matchedRecord?.fields?.district || "Bhopal"}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#F2EFE8]">
              <span className="text-[#737167]">Cadastral GIS Area</span>
              <span className="font-bold text-[#1D8374]">
                {parcelDetail?.area_gis ? `${parcelDetail.area_gis} Acres` : "—"}
              </span>
            </div>
            {matchedRecord?.gis?.area_doc_acres && (
              <div className="flex justify-between py-1.5 border-b border-[#F2EFE8]">
                <span className="text-[#737167]">Deed Stated Area</span>
                <span className="font-semibold text-[#16241F]">
                  {matchedRecord.gis.area_doc_acres} Acres
                </span>
              </div>
            )}
            {matchedRecord?.gis?.spatial_delta_pct !== undefined && (
              <div className="flex justify-between py-1.5 border-b border-[#F2EFE8]">
                <span className="text-[#737167]">Area Variance (Δ%)</span>
                <span className="font-bold text-[#16241F]">
                  {matchedRecord.gis.spatial_delta_pct}%
                </span>
              </div>
            )}
          </div>

          {/* Variance Status Alert */}
          {matchedRecord?.gis?.spatial_consistency === "DISCREPANCY" ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Spatial Discrepancy (&gt;5%):</strong> Deed extent and cadastral boundary differ significantly.
              </div>
            </div>
          ) : (
            <div className="p-3 bg-[#EBF7F2] border border-[#C5E8D9] rounded-lg flex items-center gap-2 text-xs text-[#1D8374]">
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
              className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-[#16241F] hover:bg-[#243B30] inline-flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              Open land record
              <ArrowRight className="w-3.5 h-3.5 text-[#D9714B]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
