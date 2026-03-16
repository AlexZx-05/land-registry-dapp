import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet-draw";

function normalizePolygon(coords = []) {
  return coords.map(([lat, lng]) => [Number(lat), Number(lng)]);
}

export default function MapPolygonPicker({
  onPolygonChange,
  polygonCoordinates = [],
  locked = false
}) {
  const mapRef = useRef(null);
  const hostRef = useRef(null);
  const featureGroupRef = useRef(null);
  const polygonLayerRef = useRef(null);
  const drawControlRef = useRef(null);

  useEffect(() => {
    if (mapRef.current || !hostRef.current) return;

    const map = L.map(hostRef.current).setView([28.5369, 77.0688], 16);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    const featureGroup = new L.FeatureGroup();
    featureGroupRef.current = featureGroup;
    map.addLayer(featureGroup);

    function addOrReplacePolygon(latlngs) {
      if (!featureGroupRef.current) return;
      featureGroupRef.current.clearLayers();
      if (!latlngs.length) return;
      const layer = L.polygon(latlngs);
      polygonLayerRef.current = layer;
      featureGroupRef.current.addLayer(layer);
      map.fitBounds(layer.getBounds(), { padding: [20, 20] });
    }

    const drawControl = new L.Control.Draw({
      draw: locked
        ? false
        : {
            polygon: true,
            polyline: false,
            rectangle: false,
            circle: false,
            marker: false,
            circlemarker: false
          },
      edit: locked ? false : { featureGroup, remove: true }
    });
    drawControlRef.current = drawControl;
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (event) => {
      const layer = event.layer;
      const points = layer
        .getLatLngs()[0]
        .map((p) => [Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))]);
      addOrReplacePolygon(points);
      onPolygonChange(points);
    });

    map.on(L.Draw.Event.EDITED, (event) => {
      event.layers.eachLayer((layer) => {
        const points = layer
          .getLatLngs()[0]
          .map((p) => [Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))]);
        onPolygonChange(points);
      });
    });

    map.on(L.Draw.Event.DELETED, () => {
      polygonLayerRef.current = null;
      onPolygonChange([]);
    });

    addOrReplacePolygon(normalizePolygon(polygonCoordinates));

    return () => {
      map.remove();
      mapRef.current = null;
      featureGroupRef.current = null;
      polygonLayerRef.current = null;
      drawControlRef.current = null;
    };
  }, [onPolygonChange, locked]);

  useEffect(() => {
    if (!mapRef.current || !featureGroupRef.current) return;
    const normalized = normalizePolygon(polygonCoordinates);
    featureGroupRef.current.clearLayers();
    if (!normalized.length) return;
    const layer = L.polygon(normalized);
    polygonLayerRef.current = layer;
    featureGroupRef.current.addLayer(layer);
    mapRef.current.fitBounds(layer.getBounds(), { padding: [20, 20] });
  }, [polygonCoordinates]);

  return <div ref={hostRef} className="map-container" />;
}
