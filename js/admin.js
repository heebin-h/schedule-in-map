// 관리자 페이지: 비밀번호 게이트 → 일정 목록 → 편집(지도 클릭으로 정거장 추가)
import {
  sha256, isAdminInitialized, createVault, vaultExists,
  getVaultCodes, subscribeTripList, getTripStops, saveTrip, deleteTrip,
} from "./store.js";
import { createMap, renderRoute, clearLayers, esc } from "./map.js";

const $ = id => document.getElementById(id);
const screens = ["gate-screen", "dash-screen", "edit-screen"];
function show(id) { screens.forEach(s => $(s).classList.toggle("hidden", s !== id)); }

let passHash = null;   // 로그인 후 세션 동안 유지
let codes = {};        // tripId -> 초대 코드
let trips = [];

// ---------- 1. 게이트 ----------
(async () => {
  const initialized = await isAdminInitialized();
  $("gate-title").textContent = initialized ? "관리자 로그인" : "관리자 비밀번호 설정";
  $("gate-sub").textContent = initialized
    ? "설정한 비밀번호를 입력하세요."
    : "처음 접속입니다. 앞으로 사용할 관리자 비밀번호를 만드세요.";
  $("gate-btn").textContent = initialized ? "들어가기" : "설정하고 시작";
  $("gate-btn").dataset.mode = initialized ? "login" : "setup";
})();

$("gate-btn").addEventListener("click", gateSubmit);
$("pass-input").addEventListener("keydown", e => { if (e.key === "Enter") gateSubmit(); });

async function gateSubmit() {
  const pass = $("pass-input").value;
  if (pass.length < 4) { $("gate-err").textContent = "4자 이상 입력"; return; }
  const hash = await sha256(pass);

  if ($("gate-btn").dataset.mode === "setup") {
    await createVault(hash);
  } else if (!(await vaultExists(hash))) {
    $("gate-err").textContent = "비밀번호가 올바르지 않습니다";
    return;
  }

  passHash = hash;
  codes = await getVaultCodes(passHash);
  renderDash();
  show("dash-screen");
}

// ---------- 2. 일정 목록 ----------
subscribeTripList(list => {
  trips = list;
  if (!passHash) return;
  renderDash();
});

function renderDash() {
  const el = $("admin-trip-list");
  if (!trips.length) {
    el.innerHTML = `<div class="empty">일정이 없습니다. 새 일정을 만들어보세요.</div>`;
    return;
  }
  el.innerHTML = trips.map(t => `
    <div class="trip-row">
      <div>
        <div class="t">${esc(t.title)}</div>
        <div class="d">${esc(t.date || "")}</div>
        <div class="code">코드: ${esc(codes[t.id] || "?")}</div>
      </div>
      <div class="acts">
        <button class="btn sm" data-edit="${t.id}">수정</button>
        <button class="btn sm danger" data-del="${t.id}">삭제</button>
      </div>
    </div>`).join("");

  el.querySelectorAll("[data-edit]").forEach(b =>
    b.addEventListener("click", () => openEditor(b.dataset.edit)));
  el.querySelectorAll("[data-del]").forEach(b =>
    b.addEventListener("click", async () => {
      const t = trips.find(x => x.id === b.dataset.del);
      if (!confirm(`"${t.title}" 일정을 삭제할까요?`)) return;
      await deleteTrip(passHash, t.id);
      delete codes[t.id];
    }));
}

$("new-btn").addEventListener("click", () => openEditor(null));
$("edit-back").addEventListener("click", () => { renderDash(); show("dash-screen"); });

// ---------- 3. 편집 ----------
let editMap = null;
let editingId = null;
let stops = [];              // {name, time, memo, lat, lng}
let repinIndex = null;       // 좌표 다시 찍기 대기 중인 인덱스
let previewLayers = [];

async function openEditor(tripId) {
  editingId = tripId;
  repinIndex = null;
  $("save-msg").textContent = "";

  if (tripId) {
    const t = trips.find(x => x.id === tripId);
    $("edit-title").textContent = "일정 수정";
    $("f-title").value = t.title;
    $("f-date").value = t.date || "";
    $("f-code").value = codes[tripId] || "";
    const code = codes[tripId];
    stops = code ? (await getTripStops(tripId, await sha256(code))) || [] : [];
  } else {
    $("edit-title").textContent = "새 일정";
    $("f-title").value = "";
    $("f-date").value = "";
    $("f-code").value = "";
    stops = [];
  }

  show("edit-screen");

  if (!editMap) {
    editMap = createMap("edit-map");
    editMap.on("click", onMapClick);
  }
  setTimeout(() => editMap.invalidateSize(), 50);
  refresh(true); // 최초만 전체 루트에 맞춰 줌
}

function onMapClick(e) {
  const { lat, lng } = e.latlng;
  if (repinIndex != null) {
    stops[repinIndex].lat = lat;
    stops[repinIndex].lng = lng;
    repinIndex = null;
  } else {
    stops.push({ name: `정거장 ${stops.length + 1}`, time: "", memo: "", lat, lng });
  }
  refresh();
}

$("add-stop-btn").addEventListener("click", () => {
  stops.push({ name: `정거장 ${stops.length + 1}`, time: "", memo: "", lat: null, lng: null });
  refresh();
});

function refresh(fit = false) {
  // 지도 미리보기 (좌표 있는 정거장만)
  clearLayers(editMap, previewLayers);
  const placed = stops.filter(s => s.lat != null);
  if (placed.length) previewLayers = renderRoute(editMap, placed, null, fit).layers;
  else previewLayers = [];

  // 카드 리스트
  const el = $("stop-list");
  el.innerHTML = "";
  stops.forEach((s, i) => {
    const card = document.createElement("div");
    card.className = "stop-card";
    card.innerHTML = `
      <div class="row1">
        <div class="num">${i + 1}</div>
        <input class="name-in" data-f="name" placeholder="장소명" value="${esc(s.name)}">
        <input class="time-in" data-f="time" placeholder="10:00" value="${esc(s.time)}">
      </div>
      <div class="row2">
        <input data-f="memo" placeholder="메모 (선택)" value="${esc(s.memo)}">
      </div>
      <div class="row1" style="margin-bottom:0">
        <div class="coord ${s.lat == null ? "unset" : ""}">
          ${s.lat == null
            ? (repinIndex === i ? "지도를 클릭하세요…" : "좌표 없음 — 지도 클릭 필요")
            : `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`}
        </div>
        <div class="acts">
          <button class="btn ghost sm" data-repin="${i}">📍 ${repinIndex === i ? "클릭 대기" : "다시 찍기"}</button>
          <button class="btn ghost sm" data-up="${i}" ${i === 0 ? "disabled" : ""}>↑</button>
          <button class="btn ghost sm" data-down="${i}" ${i === stops.length - 1 ? "disabled" : ""}>↓</button>
          <button class="btn danger sm" data-rm="${i}">✕</button>
        </div>
      </div>`;
    // 입력 바인딩
    card.querySelectorAll("input").forEach(inp => {
      inp.addEventListener("input", () => { s[inp.dataset.f] = inp.value; });
    });
    el.appendChild(card);
  });

  el.querySelectorAll("[data-repin]").forEach(b =>
    b.addEventListener("click", () => { repinIndex = +b.dataset.repin; refresh(); }));
  el.querySelectorAll("[data-rm]").forEach(b =>
    b.addEventListener("click", () => { stops.splice(+b.dataset.rm, 1); refresh(); }));
  el.querySelectorAll("[data-up]").forEach(b =>
    b.addEventListener("click", () => { swap(+b.dataset.up, +b.dataset.up - 1); }));
  el.querySelectorAll("[data-down]").forEach(b =>
    b.addEventListener("click", () => { swap(+b.dataset.down, +b.dataset.down + 1); }));
}

function swap(a, b) {
  [stops[a], stops[b]] = [stops[b], stops[a]];
  refresh();
}

// ---------- 저장 ----------
$("save-btn").addEventListener("click", async () => {
  const title = $("f-title").value.trim();
  const date = $("f-date").value.trim();
  const code = $("f-code").value.trim();
  const msg = $("save-msg");
  msg.className = "err";

  if (!title) { msg.textContent = "제목을 입력하세요"; return; }
  if (code.length < 2) { msg.textContent = "초대 코드는 2자 이상"; return; }
  if (!stops.length) { msg.textContent = "정거장을 1개 이상 추가하세요"; return; }
  if (stops.some(s => s.lat == null)) { msg.textContent = "좌표 없는 정거장이 있습니다 (지도 클릭)"; return; }
  if (stops.some(s => !s.name.trim())) { msg.textContent = "이름 없는 정거장이 있습니다"; return; }

  msg.textContent = "저장 중…";
  msg.className = "";
  try {
    const id = await saveTrip(passHash, { tripId: editingId, title, date, code, stops });
    editingId = id;
    codes[id] = code;
    msg.textContent = "저장 완료";
    msg.className = "ok";
  } catch (e) {
    msg.textContent = "저장 실패: " + e.message;
    msg.className = "err";
  }
});
