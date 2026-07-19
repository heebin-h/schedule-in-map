// 데이터 계층. DB 없음 — repo 안의 data/ 폴더를 그대로 읽음.
//
// 기본:      배포된 사이트의 data/ 를 상대경로로 fetch (= main 브랜치)
// ?b=브랜치: raw.githubusercontent.com 에서 해당 브랜치의 data/ 를 fetch
//
// data/index.json          → { trips: [ { id, title, date, locked } ] }
// data/trips/{id}.json     → { title, date, code?, stops: [...] }

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

// 초대 코드 검증. 게이트 여부는 viewer 에서 index.locked || trip.code 로 판단하고,
// 여기선 코드 일치만 본다. code 가 없으면(잠금 오설정·데이터 불일치) 어떤 입력도 불일치 → 안전하게 닫힘.
// ponytail: 평문 비교. 정적 사이트라 JSON이 어차피 공개(README)라 해시는 실질 보안이 아니었고,
//           crypto.subtle 은 secure context(https·localhost) 밖에선 없어서 검증이 조용히 실패했음.
export function verifyCode(trip, code) {
  return code.trim() === trip.code;
}
