// 일정 만들기 도구. 저장소에 아무것도 쓰지 않음 —
// 지도로 편집 → JSON 내려받기 → data/trips/에 넣고 index.json에 등록 → 푸시.
import { sha256 } from "./data.js";
import { createMap, renderRoute, clearLayers, esc } from "./map.js";

const $ = id => document.getElementById(id);

let stops = [];          // {name, time, memo, lat, lng}
let repinIndex = null;
let previewLayers = [];

const map = createMap("editor-map");
map.on("click", e => {
  const { lat, lng } = e.latlng;
  if (repinIndex != null) {
    stops[repinIndex].lat = lat;
    stops[repinIndex].lng = lng;
    repinIndex = null;
  } else {
    stops.push({ name: `정거장 ${stops.length + 1}`, time: "", memo: "", lat, lng });
  }
  refresh();
});

$("add-stop-btn").addEventListener("click", () => {
  stops.push({ name: `정거장 ${stops.length + 1}`, time: "", memo: "", lat: null, lng: null });
  refresh();
});

function refresh(fit = false) {
  clearLayers(map, previewLayers);
  const placed = stops.filter(s => s.lat != null);
  previewLayers = placed.length ? renderRoute(map, placed, null, fit).layers : [];

  const el = $("stop-list");
  el.innerHTML = "";
  stops.forEach((s, i) => {
    const card = document.createElement("div");
    card.className = "stop-card";
    card.innerHTML = `
      <div class="r1">
        <div class="num">${i + 1}</div>
        <input class="name-in" data-f="name" placeholder="장소명" value="${esc(s.name)}">
        <input class="time-in" data-f="time" placeholder="10:00" value="${esc(s.time)}">
      </div>
      <div class="r2">
        <input data-f="memo" placeholder="메모 (선택)" value="${esc(s.memo)}">
      </div>
      <div class="r3">
        <div class="coord ${s.lat == null ? "unset" : ""}">
          ${s.lat == null
            ? (repinIndex === i ? "지도를 클릭하세요…" : "좌표 없음")
            : `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`}
        </div>
        <button class="btn ghost sm" data-repin="${i}">📍</button>
        <button class="btn ghost sm" data-up="${i}" ${i === 0 ? "disabled" : ""}>↑</button>
        <button class="btn ghost sm" data-down="${i}" ${i === stops.length - 1 ? "disabled" : ""}>↓</button>
        <button class="btn danger-text sm" data-rm="${i}">삭제</button>
      </div>`;
    card.querySelectorAll("input").forEach(inp =>
      inp.addEventListener("input", () => { s[inp.dataset.f] = inp.value; }));
    el.appendChild(card);
  });

  el.querySelectorAll("[data-repin]").forEach(b =>
    b.addEventListener("click", () => { repinIndex = +b.dataset.repin; refresh(); }));
  el.querySelectorAll("[data-rm]").forEach(b =>
    b.addEventListener("click", () => { stops.splice(+b.dataset.rm, 1); refresh(); }));
  el.querySelectorAll("[data-up]").forEach(b =>
    b.addEventListener("click", () => swap(+b.dataset.up, +b.dataset.up - 1)));
  el.querySelectorAll("[data-down]").forEach(b =>
    b.addEventListener("click", () => swap(+b.dataset.down, +b.dataset.down + 1)));
}

function swap(a, b) { [stops[a], stops[b]] = [stops[b], stops[a]]; refresh(); }

// ---------- 기존 JSON 불러오기 ----------
$("load-btn").addEventListener("click", () => $("load-input").click());
$("load-input").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const t = JSON.parse(await file.text());
    $("f-id").value = file.name.replace(/\.json$/, "");
    $("f-title").value = t.title || "";
    $("f-date").value = t.date || "";
    $("f-code").value = ""; // 코드는 해시만 저장돼 있어 복원 불가 — 새로 입력
    stops = t.stops || [];
    refresh(true);
    if (t.codeHash) setMsg("기존 파일에 초대 코드가 있었어요. 유지하려면 코드를 다시 입력하세요.", "");
  } catch {
    setMsg("JSON 파일을 읽을 수 없어요", "err");
  }
  e.target.value = "";
});

// ---------- 내보내기 ----------
$("export-btn").addEventListener("click", async () => {
  const id = $("f-id").value.trim();
  const title = $("f-title").value.trim();
  const date = $("f-date").value.trim();
  const code = $("f-code").value.trim();

  if (!/^[a-z0-9-]+$/i.test(id)) return setMsg("파일 이름은 영문/숫자/하이픈만", "err");
  if (!title) return setMsg("제목을 입력하세요", "err");
  if (!stops.length) return setMsg("정거장을 1개 이상 추가하세요", "err");
  if (stops.some(s => s.lat == null)) return setMsg("좌표 없는 정거장이 있어요 (📍 후 지도 클릭)", "err");
  if (stops.some(s => !s.name.trim())) return setMsg("이름 없는 정거장이 있어요", "err");

  const trip = { title, date, stops };
  if (code) trip.codeHash = await sha256(code);

  // 파일 다운로드
  const blob = new Blob([JSON.stringify(trip, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${id}.json`;
  a.click();
  URL.revokeObjectURL(a.href);

  // index.json 등록 안내
  const entry = JSON.stringify({ id, title, date, locked: !!code });
  setMsg(
    `내려받은 파일을 <code>data/trips/${id}.json</code>에 넣고,<br>` +
    `<code>data/index.json</code>의 trips 배열에 아래 항목을 추가한 뒤 푸시하세요:<br>` +
    `<code>${esc(entry)}</code>`,
    "ok",
  );
});

function setMsg(html, cls) {
  const el = $("export-msg");
  el.innerHTML = html;
  el.className = cls;
}

refresh();
