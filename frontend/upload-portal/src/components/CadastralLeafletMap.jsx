import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default Leaflet marker icon asset paths for Vite bundling
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function CadastralLeafletMap({ geometry, gis, height = "280px" }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const hasGeometry = Boolean(
    geometry &&
    (
      (geometry.type === "Polygon" && Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0) ||
      (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0)
    )
  );

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up any existing map instance on container
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const isDiscrepancy = (gis?.spatial_delta_pct || 0) > 5 || gis?.spatial_consistency === "DISCREPANCY";
    const strokeColor = isDiscrepancy ? "#DC2626" : "#059669";
    const fillColor = isDiscrepancy ? "#EF4444" : "#10B981";

    // 1. Initialize interactive Leaflet map
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true,
    });
    mapInstanceRef.current = map;

    // 2. OpenStreetMap tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | VasudhaMithra GIS',
    }).addTo(map);

    if (hasGeometry) {
      try {
        // 3. Render GeoJSON parcel boundary
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
            const statusText = isDiscrepancy ? "⚠️ SPATIAL DISCREPANCY (>5%)" : "✓ CONSISTENT BOUNDARY MATCH";
            layer.bindPopup(`
              <div style="font-family: Inter, sans-serif; font-size: 12px; line-height: 1.4; min-width: 180px;">
                <strong style="color: #0B3B60; font-size: 13px;">${props.parcel_id}</strong><br/>
                <span style="color: ${strokeColor}; font-weight: bold;">${statusText}</span><hr style="margin: 6px 0; border: none; border-top: 1px solid #E5E7EB;"/>
                <div><strong>GIS Computed Area:</strong> ${props.area_gis_acres ? `${props.area_gis_acres} Acres` : "N/A"}</div>
                <div><strong>Deed Stated Area:</strong> ${props.area_doc_acres ? `${props.area_doc_acres} Acres` : "N/A"}</div>
                <div><strong>Spatial Delta:</strong> ${props.spatial_delta_pct !== undefined ? `${props.spatial_delta_pct}%` : "N/A"}</div>
              </div>
            `);
          },
        }).addTo(map);

        // 4. Fit map bounds to parcel polygon on load
        const bounds = geoJsonLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
        } else {
          map.setView([20.5937, 78.9629], 5);
        }
      } catch (err) {
        console.error("Failed to render GeoJSON parcel polygon on Leaflet map:", err);
        map.setView([20.5937, 78.9629], 5);
      }
    } else {
      // Default regional cadastral view
      map.setView([20.5937, 78.9629], 5);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [geometry, gis, hasGeometry]);

  return (
    <div
      className="cadastral-leaflet-map-wrapper"
      style={{
        position: "relative",
        width: "100%",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid #E5E7EB",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div
        ref={mapContainerRef}
        style={{ height: height, width: "100%", zIndex: 1 }}
      />
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 400,
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          padding: "4px 10px",
          borderRadius: "6px",
          fontSize: "11px",
          fontWeight: 600,
          color: "#1F2937",
          boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          border: "1px solid #E5E7EB",
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
            backgroundColor: (gis?.spatial_delta_pct || 0) > 5 ? "#DC2626" : "#059669",
          }}
        />
        <span>{gis?.parcel_id || "Cadastral Parcel"}</span>
      </div>
    </div>
  );
}
