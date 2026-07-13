// 실시간 위치 공유.
// 옵트인 → watchPosition → Firebase 발행. 구독 측은 live 노드 변화를 마커로 렌더.
import { publishLocation, removeLocation, subscribeLive } from "./store.js";
import { userMarker } from "./map.js";

const STALE_MS = 2 * 60 * 1000; // 2분 이상 갱신 없으면 흐리게

export function getUid() {
  let uid = localStorage.getItem("sim_uid");
  if (!uid) {
    uid = "u" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("sim_uid", uid);
  }
  return uid;
}

export class LiveShare {
  constructor(map, tripId, codeHash) {
    this.map = map;
    this.tripId = tripId;
    this.codeHash = codeHash;
    this.uid = getUid();
    this.watchId = null;
    this.markers = {}; // uid -> leaflet marker
    this.unsub = null;
  }

  // 모두의 위치 구독 (열람만 해도 항상 켜짐)
  subscribe() {
    this.unsub = subscribeLive(this.tripId, this.codeHash, users => {
      // 사라진 사용자 마커 제거
      for (const uid of Object.keys(this.markers)) {
        if (!users[uid]) { this.map.removeLayer(this.markers[uid]); delete this.markers[uid]; }
      }
      // 갱신/추가
      for (const [uid, u] of Object.entries(users)) {
        if (!u || u.lat == null) continue;
        if (this.markers[uid]) this.map.removeLayer(this.markers[uid]);
        this.markers[uid] = userMarker(this.map, u, uid === this.uid);
        if (Date.now() - (u.ts || 0) > STALE_MS) {
          this.markers[uid].setOpacity(0.45);
        }
      }
    });
  }

  // 내 위치 공유 시작 (명시적 버튼으로만 호출)
  start(name, onStatus) {
    if (!navigator.geolocation) { onStatus("이 브라우저는 위치를 지원하지 않음"); return; }
    this.watchId = navigator.geolocation.watchPosition(
      pos => {
        publishLocation(this.tripId, this.codeHash, this.uid, {
          name, lat: pos.coords.latitude, lng: pos.coords.longitude,
        });
        onStatus("공유 중");
      },
      err => {
        onStatus(err.code === 1 ? "위치 권한이 거부됨" : "위치를 가져올 수 없음");
        this.stop();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }

  stop() {
    if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    removeLocation(this.tripId, this.codeHash, this.uid);
  }

  get sharing() { return this.watchId != null; }

  destroy() {
    this.stop();
    if (this.unsub) this.unsub();
    Object.values(this.markers).forEach(m => this.map.removeLayer(m));
    this.markers = {};
  }
}
