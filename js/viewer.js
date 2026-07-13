// 공유 페이지: 리스트 → 초대 코드 → 뷰어(지도 + 일정 + 실시간 위치)
import { sha256, subscribeTripList, getTripStops } from "./store.js";
import { createMap, renderRoute, clearLayers, esc } from "./map.js";
import { LiveShare } from "./live.js";

const $ = id => document.getElementById(id);
const screens = ["list-screen", "code-screen", "viewer-screen"];
function show(id) { screens.forEach(s => $(s).classList.toggle("hidden", s !== id)); }

let trips = [];
let selected = null;      // {id, title, date}
let map = null;
let routeLayers = [];
let routeMarkers = [];
let live = null;

// ---------- 1. 리스트 ----------
subscribeTripList(list => {
  trips = list;
  const el = $("trip-list");
  if (!list.length) {
    el.innerHTML = `<div class="empty">아직 공유된 일정이 없습니다</div>`;
    return;
  }
  el.innerHTML = list.map(t => `
    <div class="trip-card" data-id="${t.id}">
      <div>
        <div class="t">${esc(t.title)}</div>
        <div class="d">${esc(t.date || "")}</div>
      </div>
      <div class="arrow">→</div>
    </div>`).join("");
  el.querySelectorAll(".trip-card").forEach(card => {
    card.addEventListener("click", () => {
      selected = trips.find(t => t.id === card.dataset.id);
      $("code-title").textContent = selected.title;
      $("code-input").value = "";
      $("code-err").textContent = "";
      show("code-screen");
      $("code-input").focus();
    });
  });
});

// ---------- 2. 초대 코드 ----------
$("code-btn").addEventListener("click", enterTrip);
$("code-input").addEventListener("keydown", e => { if (e.key === "Enter") enterTrip(); });
$("code-back").addEventListener("click", () => show("list-screen"));

async function enterTrip() {
  const code = $("code-input").value.trim();
  if (!code) return;
  $("code-err").textContent = "";
  const codeHash = await sha256(code);
  const stops = await getTripStops(selected.id, codeHash);
  if (!stops) {
    $("code-err").textContent = "초대 코드가 올바르지 않습니다";
    return;
  }
  openViewer(stops, codeHash);
}

// ---------- 3. 뷰어 ----------
function openViewer(stops, codeHash) {
  show("viewer-screen");
  $("trip-title").textContent = selected.title;
  $("trip-date").textContent = selected.date || "";
  document.title = `${selected.title} | Schedule in Map`;

  if (!map) map = createMap("map");
  map.invalidateSize();

  clearLayers(map, routeLayers);
  const r = renderRoute(map, stops, i => setActive(i, false));
  routeLayers = r.layers;
  routeMarkers = r.markers;

  // 사이드바
  const listEl = $("stops");
  listEl.innerHTML = "";
  const items = stops.map((s, i) => {
    const item = document.createElement("div");
    item.className = "stop";
    item.innerHTML = `
      <div class="dot">${i + 1}</div>
      <div class="info">
        <div class="time">${esc(s.time || "")}</div>
        <div class="name">${esc(s.name)}</div>
        ${s.memo ? `<div class="memo">${esc(s.memo)}</div>` : ""}
      </div>`;
    item.addEventListener("click", () => setActive(i, true));
    listEl.appendChild(item);
    return item;
  });

  window.__setActive = (i, fly) => {
    items.forEach(el => el.classList.remove("active"));
    items[i].classList.add("active");
    items[i].scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (fly) map.flyTo([stops[i].lat, stops[i].lng], Math.max(map.getZoom(), 15), { duration: .7 });
    routeMarkers[i].openPopup();
  };

  // 실시간 위치
  if (live) live.destroy();
  live = new LiveShare(map, selected.id, codeHash);
  live.subscribe();
  updateLiveUI();

  $("my-name").value = localStorage.getItem("sim_name") || "";
}

function setActive(i, fly) { window.__setActive(i, fly); }

// ---------- 위치 공유 컨트롤 ----------
$("live-btn").addEventListener("click", () => {
  if (!live) return;
  if (live.sharing) {
    live.stop();
    setStatus("공유 중지됨", "");
  } else {
    const name = $("my-name").value.trim() || "익명";
    localStorage.setItem("sim_name", name);
    setStatus("위치 권한 요청 중…", "");
    live.start(name, msg => {
      setStatus(msg, msg === "공유 중" ? "on" : "err");
      if (msg !== "공유 중") updateLiveUI();
    });
  }
  updateLiveUI();
});

function updateLiveUI() {
  $("live-btn").textContent = live && live.sharing ? "공유 끄기" : "위치 공유";
  $("live-btn").classList.toggle("ghost", live && live.sharing);
}

function setStatus(msg, cls) {
  const el = $("live-status");
  el.textContent = msg;
  el.className = cls;
  el.id = "live-status";
}

// ---------- 뒤로가기 ----------
$("viewer-back").addEventListener("click", () => {
  if (live) { live.destroy(); live = null; }
  updateLiveUIReset();
  show("list-screen");
});

function updateLiveUIReset() {
  $("live-btn").textContent = "위치 공유";
  $("live-btn").classList.remove("ghost");
  setStatus("공유를 켜면 이 일정을 보는 사람에게 내 위치가 표시됩니다", "");
}

// 페이지 이탈 시 위치 공유 정리 (onDisconnect가 백업)
window.addEventListener("beforeunload", () => { if (live) live.stop(); });
