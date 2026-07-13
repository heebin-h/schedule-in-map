// 데이터 계층. Firebase 경로 구조는 전부 여기서만 관리.
//
// DB 구조
// admin/initialized: true                     ← 관리자 비번 설정 여부
// vaults/{passHash}/codes/{tripId}: code      ← 관리자 전용(경로 비밀), 일정별 초대 코드
// trips/{tripId}/meta: {title, date, ...}     ← 공개 (리스트용)
// trips/{tripId}/private/{codeHash}/stops     ← 초대 코드 알아야 접근
// trips/{tripId}/private/{codeHash}/live/{uid}← 실시간 위치

import {
  db, ref, get, set, update, remove, push, onValue, onDisconnect,
} from "./firebase.js";

// ---------- 해시 ----------
export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// ---------- 관리자 vault ----------
export async function isAdminInitialized() {
  return (await get(ref(db, "admin/initialized"))).val() === true;
}

export async function createVault(passHash) {
  await set(ref(db, `vaults/${passHash}/createdAt`), Date.now());
  await set(ref(db, "admin/initialized"), true);
}

export async function vaultExists(passHash) {
  return (await get(ref(db, `vaults/${passHash}/createdAt`))).exists();
}

export async function getVaultCodes(passHash) {
  return (await get(ref(db, `vaults/${passHash}/codes`))).val() || {};
}

// ---------- 일정 ----------
export function subscribeTripList(cb) {
  return onValue(ref(db, "trips"), snap => {
    const val = snap.val() || {};
    const list = Object.entries(val)
      .map(([id, t]) => ({ id, ...(t.meta || {}) }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    cb(list);
  });
}

export async function getTripStops(tripId, codeHash) {
  const snap = await get(ref(db, `trips/${tripId}/private/${codeHash}/stops`));
  return snap.exists() ? snap.val() : null; // null = 코드 틀림
}

export async function getTripMeta(tripId) {
  return (await get(ref(db, `trips/${tripId}/meta`))).val();
}

// 생성/수정. code가 바뀌면 이전 private 노드를 새 경로로 옮김.
export async function saveTrip(passHash, { tripId, title, date, code, stops }) {
  const codeHash = await sha256(code);

  if (!tripId) {
    tripId = push(ref(db, "trips")).key;
    await set(ref(db, `trips/${tripId}/meta`), { title, date, createdAt: Date.now() });
  } else {
    await update(ref(db, `trips/${tripId}/meta`), { title, date, updatedAt: Date.now() });
    // 코드 변경 시 이전 경로 제거
    const oldCode = (await getVaultCodes(passHash))[tripId];
    if (oldCode && oldCode !== code) {
      await remove(ref(db, `trips/${tripId}/private/${await sha256(oldCode)}`));
    }
  }

  await set(ref(db, `trips/${tripId}/private/${codeHash}/stops`), stops);
  await set(ref(db, `vaults/${passHash}/codes/${tripId}`), code);
  return tripId;
}

export async function deleteTrip(passHash, tripId) {
  await remove(ref(db, `trips/${tripId}`));
  await remove(ref(db, `vaults/${passHash}/codes/${tripId}`));
}

// ---------- 실시간 위치 ----------
export function liveRef(tripId, codeHash, uid) {
  return ref(db, `trips/${tripId}/private/${codeHash}/live/${uid}`);
}

export async function publishLocation(tripId, codeHash, uid, data) {
  const r = liveRef(tripId, codeHash, uid);
  onDisconnect(r).remove(); // 브라우저 종료 시 자동 제거
  await set(r, { ...data, ts: Date.now() });
}

export async function removeLocation(tripId, codeHash, uid) {
  await remove(liveRef(tripId, codeHash, uid));
}

export function subscribeLive(tripId, codeHash, cb) {
  return onValue(ref(db, `trips/${tripId}/private/${codeHash}/live`), snap => {
    cb(snap.val() || {});
  });
}
