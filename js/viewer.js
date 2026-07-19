// 공유 페이지: data/ 폴더의 JSON을 읽어 리스트 → (코드) → 뷰어
// ?b=브랜치  해당 브랜치 데이터 사용
// ?t=일정id  해당 일정 바로 열기 (코드 있으면 코드 화면부터)
import { branch, getTripIndex, getTrip, verifyCode } from "./data.js";
import { createMap, renderRoute, clearLayers, myLocationMarker, esc } from "./map.js";

const $ = id => document.getElementById(id);
const screens = ["list-screen", "code-screen", "viewer-screen"];
const show = id => screens.forEach(s => $(s).classList.toggle("hidden", s !== id));

let index = [];
let selected = null;   // index 항목
let trip = null;       // 상세 데이터
let map = null;
let routeLayers = [];
let routeMarkers = [];
let items = [];
let myMarker = null;
let watchId = null;

if (branch) {
  const chip = $("branch-chip");
  chip.textContent = `브랜치: ${branch}`;
  chip.classList.remove("hidden");
}

// ---------- 1. 리스트 ----------
(async () => {
  try {
    index = await getTripIndex();
  } catch (e) {
    $("trip-list").innerHTML = `<div class="error">일정을 불러오지 못했어요<br><span style="font-size:13px">${esc(e.message)}</span></div>`;
    return;
  }
  renderList();

  // 딥링크 ?t=id
  const t = new URLSearchParams(location.search).get("t");
  if (t) {
    const found = index.find(x => x.id === t);
    if (found) select(found);
  }
})();

function renderList() {
  const el = $("trip-list");
  if (!index.length) {
    el.innerHTML = `<div class="empty">아직 등록된 일정이 없어요</div>`;
    return;
  }
  el.innerHTML = index.map(t => `
    <div class="trip-card card" data-id="${esc(t.id)}">
      <div>
        <div class="t">${esc(t.title)}</div>
        <div class="d">${esc(t.date || "")}</div>
      </div>
      <div class="right">
        ${t.locked ? `<span class="lock">초대 코드</span>` : ""}
        <span class="arrow">›</span>
      </div>
    </div>`).join("");
  el.querySelectorAll(".trip-card").forEach(card =>
    card.addEventListener("click", () => select(index.find(x => x.id === card.dataset.id))));
}

async function select(t) {
  selected = t;
  try {
    trip = await getTrip(t.id);
  } catch (e) {
    alert("일정 데이터를 불러오지 못했어요: " + e.message);
    return;
  }
  if (t.locked || trip.code) {
    $("code-title").textContent = trip.title;
    $("code-input").value = "";
    $("code-err").textContent = "";
    show("code-screen");
    $("code-input").focus();
  } else {
    openViewer();
  }
}

// ---------- 2. 코드 ----------
$("code-btn").addEventListener("click", submitCode);
$("code-input").addEventListener("keydown", e => { if (e.key === "Enter") submitCode(); });
$("code-input").addEventListener("input", () => { $("code-err").textContent = ""; });
$("code-back").addEventListener("click", () => show("list-screen"));

function submitCode() {
  const code = $("code-input").value;
  if (!code.trim()) return;
  if (verifyCode(trip, code)) { openViewer(); return; }
  $("code-err").textContent = "❌ 초대 코드가 맞지 않아요";
  $("code-input").focus();
  $("code-input").select();
}

// ---------- 3. 뷰어 ----------
function openViewer() {
  show("viewer-screen");
  $("trip-title").textContent = trip.title;
  $("trip-date").textContent = trip.date || "";
  document.title = trip.title;

  if (!map) map = createMap("map");
  setTimeout(() => map.invalidateSize(), 50);

  clearLayers(map, routeLayers);
  const r = renderRoute(map, trip.stops, i => setActive(i, false));
  routeLayers = r.layers;
  routeMarkers = r.markers;

  const listEl = $("stops");
  listEl.innerHTML = "";
  items = trip.stops.map((s, i) => {
    const item = document.createElement("div");
    item.className = "stop";
    item.innerHTML = `
      <div class="dot">${i + 1}</div>
      <div class="info">
        <div class="time">${esc(s.time || "")}</div>
        <div class="name">${esc(s.name)}</div>
        ${s.address ? `<div class="address">${esc(s.address)}</div>` : ""}
        ${s.url ? `<div class="map-link"><a href="${esc(s.url)}" target="_blank" rel="noopener">지도에서 보기 →</a></div>` : ""}
        <div class="map-link"><a class="dir-btn" href="#">🧭 여기로 길찾기 →</a></div>
        ${s.memo ? `<div class="memo">${esc(s.memo)}</div>` : ""}
      </div>`;
    item.addEventListener("click", () => setActive(i, true));
    item.querySelector(".dir-btn").addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      naverDirections(s.lat, s.lng, s.name, s.url);
    });
    listEl.appendChild(item);
    return item;
  });
}

function setActive(i, fly) {
  items.forEach(el => el.classList.remove("active"));
  items[i].classList.add("active");
  items[i].scrollIntoView({ block: "nearest", behavior: "smooth" });
  if (fly) map.flyTo([trip.stops[i].lat, trip.stops[i].lng], Math.max(map.getZoom(), 15), { duration: .6 });
  routeMarkers[i].openPopup();
}

// 현재 위치 → 정거장 길찾기. 네이버 앱 스킴(출발지 생략=현 위치, 대중교통)을 열고,
// 앱이 안 뜨면(데스크톱·미설치) 웹으로 폴백. 웹 폴백은 정거장의 naver.me 링크(있으면) → 없으면 장소검색.
function naverDirections(lat, lng, name, fallbackUrl) {
  const app = `nmap://route/public?dlat=${lat}&dlng=${lng}&dname=${encodeURIComponent(name)}&appname=schedule-in-map`;
  const web = fallbackUrl || `https://map.naver.com/p/search/${encodeURIComponent(name)}`;
  const t = setTimeout(() => { window.location.href = web; }, 1200);
  // 앱이 열리면 탭이 백그라운드로 가며 visibilitychange 발생 → 웹 폴백 취소
  document.addEventListener("visibilitychange", () => { if (document.hidden) clearTimeout(t); }, { once: true });
  window.location.href = app;
}

$("viewer-back").addEventListener("click", () => {
  stopLocate();
  show("list-screen");
  document.title = "일정 지도";
});

// ---------- 내 위치 (본인 화면 표시용, 공유 아님) ----------
$("locate-btn").addEventListener("click", () => {
  if (watchId != null) { stopLocate(); return; }
  if (!navigator.geolocation) { alert("이 브라우저는 위치를 지원하지 않아요"); return; }

  $("locate-btn").textContent = "위치 확인 중…";
  watchId = navigator.geolocation.watchPosition(
    pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      if (myMarker) myMarker.setLatLng([lat, lng]);
      else {
        myMarker = myLocationMarker(map, lat, lng);
        map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: .6 });
      }
      $("locate-btn").textContent = "📍 내 위치 끄기";
    },
    () => {
      alert("위치를 가져올 수 없어요. 권한을 확인해주세요.");
      stopLocate();
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
  );
});

function stopLocate() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  if (myMarker) { map.removeLayer(myMarker); myMarker = null; }
  $("locate-btn").textContent = "📍 내 위치 표시";
}
