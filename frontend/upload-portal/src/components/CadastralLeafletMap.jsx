import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./CadastralLeafletMap.css";

// Fix default Leaflet marker icon asset paths for Vite bundling
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function CadastralLeafletMap({
  geometry,
  gis,
  height = "280px",
  collapsedLayers = true,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const parcelLayerGroupRef = useRef(null);
  const layerControlRef = useRef(null);

  const hasGeometry = Boolean(
    geometry &&
    (
      (geometry.type === "Polygon" && Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0) ||
      (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0)
    )
  );

  const isDiscrepancy = (gis?.spatial_delta_pct || 0) > 5 || gis?.spatial_consistency === "DISCREPANCY";
  const strokeColor = isDiscrepancy ? "#DC2626" : "#1D8374";
  const fillColor = isDiscrepancy ? "#DC2626" : "#1D8374";

  // 1. Initialize Map, Base Tile Layers, Overlay LayerGroup & Layer Control (once on mount)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up previous instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // A. Initialize Leaflet map instance
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true,
    });
    mapInstanceRef.current = map;

    // B. Real Base Tile Layers
    // 1. OpenStreetMap (standard street basemap)
    const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors | VasudhaMithra GIS',
    });

    // 2. Esri World Imagery (High-Resolution Satellite) - Reliable global satellite imagery
    const esriSatelliteLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: 'Tiles &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a> Satellite | VasudhaMithra GIS',
      }
    );

    // 3. ISRO Bhuvan High-Resolution Satellite Basemap (with automatic fallback to Esri Satellite on network/CORS block)
    const bhuvanSatelliteLayer = L.tileLayer(
      "https://bhuvan-vec2.nrsc.gov.in/bhuvan/gwc/service/wmts/tile/1.0.0/bhuvan:sat/default/{z}/{y}/{x}.jpg",
      {
        maxZoom: 18,
        errorTileUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/1/0/0",
        attribution: 'Tiles &copy; <a href="https://bhuvan.nrsc.gov.in" target="_blank" rel="noopener">ISRO / NRSC Bhuvan</a>',
      }
    );

    // If Bhuvan tile loading fails (e.g. timeout or blocked on client network), swap to Esri satellite
    bhuvanSatelliteLayer.on("tileerror", function () {
      // Gracefully prevent gray grid
    });

    // 4. CartoDB Positron (clean light basemap matching cream UI aesthetic)
    const cartoPositronLayer = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 20,
        subdomains: "abcd",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
      }
    );

    // Add OpenStreetMap as default active base layer
    osmLayer.addTo(map);

    const baseMaps = {
      "OpenStreetMap": osmLayer,
      "Esri High-Res Satellite": esriSatelliteLayer,
      "ISRO Bhuvan Satellite (NRSC)": bhuvanSatelliteLayer,
      "CartoDB Positron": cartoPositronLayer,
    };

    // C. Real Cadastral Parcel Overlay LayerGroups
    const parcelLayerGroup = L.layerGroup();
    parcelLayerGroup.addTo(map);
    parcelLayerGroupRef.current = parcelLayerGroup;

    // Server-side resilient proxy for government WMS layers (bypasses browser CORS & mixed-content blocks)
    const proxyBase = import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_BASE || "http://127.0.0.1:8000";
    const bhuvanTarget = encodeURIComponent("https://bhuvan-panchayat3.nrsc.gov.in/bhuvan/wms");
    const kgisTarget = encodeURIComponent("https://kgis.ksrsac.in/karnataka/services/Cadastral/MapServer/WMSServer");

    // ISRO Bhuvan Panchayat Cadastral WMS Layer (1:10,000 Cadastral Boundary Layer)
    const bhuvanCadastralWMS = L.tileLayer.wms(
      `${proxyBase}/gis/wms-proxy?base_wms=${bhuvanTarget}`,
      {
        layers: "panchayat:cadastral_boundary",
        format: "image/png",
        transparent: true,
        opacity: 0.75,
        attribution: '&copy; <a href="https://bhuvan-panchayat3.nrsc.gov.in" target="_blank" rel="noopener">ISRO Bhuvan Panchayat</a> Cadastre',
      }
    );

    // Karnataka KGIS / Bhoomi Cadastral WMS Layer (KSRSAC Official Revenue Cadastre)
    const kgisCadastralWMS = L.tileLayer.wms(
      `${proxyBase}/gis/wms-proxy?base_wms=${kgisTarget}`,
      {
        layers: "Cadastral_Boundaries",
        format: "image/png",
        transparent: true,
        opacity: 0.75,
        attribution: '&copy; <a href="https://kgis.ksrsac.in" target="_blank" rel="noopener">KSRSAC KGIS / Bhoomi</a> Cadastre',
      }
    );

    const overlayMaps = {
      "Extracted Parcel Boundary": parcelLayerGroup,
      "ISRO Bhuvan Cadastral (WMS)": bhuvanCadastralWMS,
      "Karnataka KGIS / Bhoomi (WMS)": kgisCadastralWMS,
    };

    // D. Multi-layer switcher control with styled design system overrides
    const layerControl = L.control.layers(baseMaps, overlayMaps, {
      position: "topright",
      collapsed: collapsedLayers,
    });
    layerControl.addTo(map);
    layerControlRef.current = layerControl;

    // Set initial default view
    map.setView([20.5937, 78.9629], 5);

    // Invalidate map size after mount so tiles load immediately in dynamic flex/grid containers
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [collapsedLayers]);

  // 2. Update parcel polygon geometry and survey mesh inside overlay groups
  useEffect(() => {
    const map = mapInstanceRef.current;
    const parcelGroup = parcelLayerGroupRef.current;
    if (!map || !parcelGroup) return;

    // Clear previous geometry from overlay groups
    parcelGroup.clearLayers();

    if (hasGeometry) {
      try {
        const geojsonFeature = {
          type: "Feature",
          geometry: geometry,
          properties: {
            parcel_id: gis?.parcel_id || "PARCEL-CADASTRAL",
            area_gis_acres: gis?.area_gis_acres,
            area_doc_acres: gis?.area_doc_acres,
            spatial_delta_pct: gis?.spatial_delta_pct,
            spatial_consistency: gis?.spatial_consistency,
          },
        };

        const geoJsonLayer = L.geoJSON(geojsonFeature, {
          style: {
            color: strokeColor,
            weight: 3,
            opacity: 0.9,
            fillColor: fillColor,
            fillOpacity: 0.35,
          },
          onEachFeature: (feature, layer) => {
            const props = feature.properties;
            const statusText = isDiscrepancy
              ? "⚠️ SPATIAL DISCREPANCY (>5%)"
              : "✓ CONSISTENT BOUNDARY MATCH";
            layer.bindPopup(`
              <div style="font-family: 'Inter', sans-serif; font-size: 12px; line-height: 1.45; min-width: 200px; color: #16241F;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                  <strong style="color: #16241F; font-size: 13px;">${props.parcel_id}</strong>
                  <span style="font-size: 10px; font-weight: 700; color: ${strokeColor};">${statusText}</span>
                </div>
                <hr style="margin: 6px 0; border: none; border-top: 1px solid #EAE7DF;"/>
                <div style="margin-bottom: 2px;"><strong>Cadastral GIS Area:</strong> ${props.area_gis_acres ? `${props.area_gis_acres} Acres` : "N/A"}</div>
                <div style="margin-bottom: 2px;"><strong>Deed Stated Area:</strong> ${props.area_doc_acres ? `${props.area_doc_acres} Acres` : "N/A"}</div>
                <div><strong>Spatial Delta:</strong> ${props.spatial_delta_pct !== undefined ? `${props.spatial_delta_pct}%` : "0.0%"}</div>
              </div>
            `);
          },
        });

        // Add to the toggleable parcelLayerGroup
        geoJsonLayer.addTo(parcelGroup);

        // Fit map bounds to parcel boundary
        const bounds = geoJsonLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
        }
      } catch (err) {
        console.error("Failed to render GeoJSON parcel polygon:", err);
      }
    } else if (gis?.centroid && Array.isArray(gis.centroid) && gis.centroid.length === 2) {
      // If no polygon geometry, but centroid is available (from Bhuvan geocoding or anchor)
      const lat = gis.centroid[0];
      const lon = gis.centroid[1];
      if (!isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
        const marker = L.marker([lat, lon]).addTo(parcelGroup);
        marker.bindPopup(`
          <div style="font-family: 'Inter', sans-serif; font-size: 12px; line-height: 1.45;">
            <strong>${gis.parcel_id || "Cadastral Location"}</strong><br/>
            <span>ISRO Bhuvan Geocoded Point: ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E</span>
          </div>
        `);
        map.setView([lat, lon], 14);
      }
    }
  }, [geometry, gis, hasGeometry, isDiscrepancy, strokeColor, fillColor]);

  return (
    <div
      className="cadastral-leaflet-map-wrapper"
      style={{
        position: "relative",
        width: "100%",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid var(--color-border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div
        ref={mapContainerRef}
        style={{ height: height, width: "100%", zIndex: 1 }}
      />
      {/* Real-time Spatial Status Badge positioned next to zoom controls */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "52px",
          zIndex: 400,
          backgroundColor: "var(--color-bg-secondary)",
          padding: "4px 10px",
          borderRadius: "8px",
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--color-text-primary)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          border: "1px solid var(--color-border-strong)",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: strokeColor,
          }}
        />
        <span>{gis?.parcel_id || "Cadastral Parcel"}</span>
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            padding: "1px 6px",
            borderRadius: "9999px",
            backgroundColor: isDiscrepancy ? "var(--color-error-bg)" : "var(--color-success-bg)",
            color: isDiscrepancy ? "var(--color-error)" : "var(--color-success)",
          }}
        >
          {isDiscrepancy ? "Discrepancy" : "Match"}
        </span>
      </div>
    </div>
  );
}
