// Leaflet 헬퍼. 지도 / 루트 / 번호 마커 / 내 위치 마커.
/* global L */

const BLUE = "#3182f6";

export function createMap(elId, opts = {}) {
  const map = L.map(elId, { zoomControl: false, ...opts });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  map.setView([37.5665, 126.978], 12);
  return map;
}

export function renderRoute(map, stops, onMarkerClick, fit = true) {
  const latlngs = stops.map(s => [s.lat, s.lng]);
  const layers = [];
  const markers = [];

  if (latlngs.length >= 2) {
    layers.push(L.polyline(latlngs, { color: "#fff", weight: 9, opacity: .95, lineJoin: "round" }).addTo(map));
    layers.push(L.polyline(latlngs, { color: BLUE, weight: 4.5, lineJoin: "round" }).addTo(map));
  }

  stops.forEach((s, i) => {
    const icon = L.divIcon({
      className: "",
      html: `<div class="station-marker">${i + 1}</div>`,
      iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -17],
    });
    const m = L.marker([s.lat, s.lng], { icon }).addTo(map);
    m.bindPopup(`
      <div class="popup-time">${esc(s.time || "")}</div>
      <div class="popup-name">${esc(s.name)}</div>
      ${s.memo ? `<div class="popup-memo">${esc(s.memo)}</div>` : ""}
    `);
    if (onMarkerClick) m.on("click", () => onMarkerClick(i));
    markers.push(m);
    layers.push(m);
  });

  if (fit && latlngs.length) map.fitBounds(L.latLngBounds(latlngs), { padding: [48, 48] });
  return { layers, markers };
}

export function clearLayers(map, layers) {
  layers.forEach(l => map.removeLayer(l));
}

// 내 위치 마커 (본인 화면에서만 보임)
export function myLocationMarker(map, lat, lng) {
  const icon = L.divIcon({
    className: "",
    html: `<div class="me-marker"><div class="me-pulse"></div><div class="me-dot"></div></div>`,
    iconSize: [0, 0], iconAnchor: [10, 10],
  });
  return L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map);
}

export function esc(s = "") {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
