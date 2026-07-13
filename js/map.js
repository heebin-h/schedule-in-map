// Leaflet 헬퍼. 지도 생성 / 루트(노선) / 역 마커 / 사용자 위치 마커.
/* global L */

export function createMap(elId, opts = {}) {
  const map = L.map(elId, { zoomControl: false, ...opts });
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  map.setView([37.5665, 126.978], 12); // 기본: 서울
  return map;
}

// 루트 라인 + 번호 역 마커. 반환: { layers, markers } (재렌더 시 제거용)
export function renderRoute(map, stops, onMarkerClick, fit = true) {
  const latlngs = stops.map(s => [s.lat, s.lng]);
  const layers = [];
  const markers = [];

  if (latlngs.length >= 2) {
    layers.push(L.polyline(latlngs, { color: "#fff", weight: 10, opacity: .9, lineJoin: "round" }).addTo(map));
    layers.push(L.polyline(latlngs, { color: "#00a98f", weight: 5, lineJoin: "round" }).addTo(map));
  }

  stops.forEach((s, i) => {
    const icon = L.divIcon({
      className: "",
      html: `<div class="station-marker">${i + 1}</div>`,
      iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18],
    });
    const m = L.marker([s.lat, s.lng], { icon }).addTo(map);
    m.bindPopup(`
      <div class="popup-time">${s.time || ""}</div>
      <div class="popup-name">${i + 1}. ${esc(s.name)}</div>
      ${s.memo ? `<div class="popup-memo">${esc(s.memo)}</div>` : ""}
    `);
    if (onMarkerClick) m.on("click", () => onMarkerClick(i));
    markers.push(m);
    layers.push(m);
  });

  if (fit && latlngs.length) map.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50] });
  return { layers, markers };
}

export function clearLayers(map, layers) {
  layers.forEach(l => map.removeLayer(l));
}

// 사용자 위치 마커 (이름 라벨 포함). isMe면 강조색.
export function userMarker(map, { name, lat, lng }, isMe) {
  const icon = L.divIcon({
    className: "",
    html: `
      <div class="user-marker ${isMe ? "me" : ""}">
        <div class="user-dot"></div>
        <div class="user-label">${esc(name)}</div>
      </div>`,
    iconSize: [0, 0], iconAnchor: [8, 8],
  });
  return L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map);
}

export function esc(s = "") {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
