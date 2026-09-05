import React, { useState, useEffect } from "react";
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
  Compass
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
  const [surveyQuery, setSurveyQuery] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [layerCadastral, setLayerCadastral] = useState(true);
  const [layerValidated, setLayerValidated] = useState(true);

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

  // Handle direct survey search submit
  const handleSearch = (e) => {
    e.preventDefault();
    if (!surveyQuery.trim()) return;
    const clean = surveyQuery.trim();
    const found = parcels.find(
      (p) => p.survey_number.toLowerCase() === clean.toLowerCase()
    );
    if (found) {
      setSelectedParcel(found);
    } else {
      // Query backend directly for whatever the user searched
      setSelectedParcel({ survey_number: clean });
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
        {/* Left Control Panel (3 Cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white border border-[#E6E3DB] rounded-xl p-5 shadow-xs space-y-5">
            {/* Search Input */}
            <form onSubmit={handleSearch} className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#16241F]">
                Lookup Cadastral Parcel
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#8A887E] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={surveyQuery}
                  onChange={(e) => setSurveyQuery(e.target.value)}
                  placeholder="e.g. 145/2, 72/3..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F7F5EF] border border-[#DDD9CE] rounded-lg text-[#16241F] focus:outline-none focus:ring-1 focus:ring-[#D9714B]"
                />
              </div>
            </form>

            {/* Seeded Parcels Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#16241F]">
                Real Cadastral Parcels ({parcels.length})
              </label>
              <select
                value={selectedParcel?.survey_number || ""}
                onChange={(e) => {
                  const p = parcels.find((item) => item.survey_number === e.target.value);
                  if (p) setSelectedParcel(p);
                }}
                className="w-full text-xs bg-[#F7F5EF] border border-[#DDD9CE] rounded-lg p-2 text-[#16241F] focus:outline-none focus:ring-1 focus:ring-[#D9714B]"
              >
                {parcels.map((p) => (
                  <option key={p.parcel_id} value={p.survey_number}>
                    Survey {p.survey_number} — {p.village || "Cadastral"} ({p.area_acres} ac)
                  </option>
                ))}
              </select>
            </div>

            {/* Map Layers Toggles */}
            <div className="pt-3 border-t border-[#F2EFE8] space-y-3">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#8A887E]">
                MAP LAYERS
              </span>
              <div className="space-y-2 text-xs">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="font-medium text-[#16241F]">Cadastral parcels</span>
                  <input
                    type="checkbox"
                    checked={layerCadastral}
                    onChange={(e) => setLayerCadastral(e.target.checked)}
                    className="accent-[#1D8374]"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="font-medium text-[#16241F]">Validated records</span>
                  <input
                    type="checkbox"
                    checked={layerValidated}
                    onChange={(e) => setLayerValidated(e.target.checked)}
                    className="accent-[#1D8374]"
                  />
                </label>
                <label className="flex items-center justify-between opacity-50 cursor-not-allowed">
                  <span className="text-[#8A887E]">Satellite imagery</span>
                  <input type="checkbox" disabled />
                </label>
              </div>
            </div>

            {/* Record Status Legend */}
            <div className="pt-3 border-t border-[#F2EFE8] space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#8A887E]">
                RECORD STATUS LEGEND
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-xs bg-[#1D8374]" />
                  <span className="text-[#5A584F]">Linked & validated (&le;5% &Delta;)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-xs bg-amber-500" />
                  <span className="text-[#5A584F]">Pending review</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-xs bg-[#D9714B]" />
                  <span className="text-[#5A584F]">Boundary mismatch (&gt;5% &Delta;)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Interactive Map (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-[#E6E3DB] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F2EFE8]">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#1D8374]" />
              <span className="text-xs font-bold text-[#16241F]">
                OpenStreetMap Cadastral View
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
              />
            </div>
          ) : (
            <div className="h-[460px] bg-[#FAF9F5] rounded-lg border border-[#EAE7DF] flex items-center justify-center text-xs text-[#8A887E]">
              No geometry found for this survey number.
            </div>
          )}
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
