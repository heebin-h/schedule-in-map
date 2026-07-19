// 데이터 계층. DB 없음 — repo 안의 data/ 폴더를 그대로 읽음.
//
// 기본:      배포된 사이트의 data/ 를 상대경로로 fetch (= main 브랜치)
// ?b=브랜치: raw.githubusercontent.com 에서 해당 브랜치의 data/ 를 fetch
//
// data/index.json          → { trips: [ { id, title, date, locked } ] }
// data/trips/{id}.json     → { title, date, codeHash?, stops: [...] }

import { REPO } from "../config.js";

export const branch = new URLSearchParams(location.search).get("b") || null;

function url(path) {
  if (branch) {
    return `https://raw.githubusercontent.com/${REPO.owner}/${REPO.name}/${encodeURIComponent(branch)}/${path}`;
  }
  return path; // 배포된 브랜치(main) 기준 상대경로
}

async function fetchJson(path) {
  const res = await fetch(url(path), { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} 불러오기 실패 (${res.status})`);
  return res.json();
}

export async function getTripIndex() {
  const data = await fetchJson("data/index.json");
  return data.trips || [];
}

export async function getTrip(id) {
  return fetchJson(`data/trips/${id}.json`);
}

export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// 초대 코드 검증. 코드가 설정 안 된 일정(codeHash 없음)은 통과.
export async function verifyCode(trip, code) {
  if (!trip.codeHash) return true;
  return (await sha256(code.trim())) === trip.codeHash;
}
