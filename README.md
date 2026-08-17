# Schedule in Map

일정 루트를 지도에 공유하는 정적 웹앱. **DB 없음** — repo 안의 JSON 파일이 곧 데이터.

## 구조

```
├── index.html      공유 페이지 (리스트 → 초대 코드 → 지도)
├── editor.html     일정 만들기 도구 (JSON 생성기)
├── config.js       repo 정보 (브랜치 데이터 로딩용)
├── data/
│   ├── index.json  일정 목록
│   └── trips/      일정별 상세 JSON
├── css/  base · viewer · editor
└── js/   data(로딩 계층) · map · viewer · editor
```

## 일정 추가하는 법

**방법 A — editor.html 사용 (권장)**
1. `배포주소/editor.html` 접속
2. 지도 클릭으로 정거장 추가, 제목/날짜/초대 코드 입력
3. "JSON 내려받기" → 받은 파일을 `data/trips/`에 넣기
4. 화면에 안내되는 항목을 `data/index.json`의 `trips` 배열에 추가
5. 커밋 & 푸시 → 사이트에 바로 반영 (Pages 재배포 1~2분)

**방법 B — 파일 직접 편집**
`data/trips/coex-character-fair.json` 형식 참고해서 작성. 초대 코드를 걸려면 `code`에 코드를 넣고, `index.json` 항목에 `"locked": true` 표시.

**trips JSON 필드**

```jsonc
{
  "title": "일정 제목",          // 필수
  "date": "2026. 8. 1 (토)",    // 선택
  "code": "1234",               // 선택 — 있으면 초대 코드 게이트 활성화
  "stops": [
    {
      "name": "장소명",          // 필수
      "lat": 37.512,            // 필수
      "lng": 127.059,           // 필수
      "time": "09:00",          // 선택
      "address": "서울 강남구…", // 선택 — 패널·팝업에 표시
      "url": "https://…",       // 선택 — "지도에서 보기" 링크 + 길찾기 폴백
      "memo": "메모"             // 선택 — 패널·팝업에 표시
    }
  ]
}
```

## 브랜치별 일정 세트

기본은 배포된 브랜치(main)의 `data/`를 읽음.
URL에 `?b=브랜치명`을 붙이면 **그 브랜치의 data/를 읽음**:

```
https://heebin-h.github.io/schedule-in-map/?b=jeju-trip
```

- 브랜치 만들고 `data/`만 갈아끼우면 일정 세트가 통째로 분리됨
- 특정 일정 바로 열기: `?t=일정id` (조합 가능: `?b=jeju-trip&t=day1`)
- 단, 브랜치 로딩은 raw.githubusercontent.com 을 쓰므로 **repo가 공개**여야 하고, 반영에 몇 분 캐시 지연이 있을 수 있음

## 초대 코드에 대해

코드는 일정 JSON의 `code` 필드에 평문으로 저장됨. 정적 사이트 특성상 일정 데이터(JSON)는 주소만 알면 직접 받을 수 있어 **가벼운 잠금**이지 보안 장치가 아님. 민감한 정보는 넣지 말 것.

> 이전엔 SHA-256 해시(`codeHash`)로 저장했으나, `crypto.subtle`이 secure context(https·localhost) 밖에선 없어 코드 검증이 조용히 실패하는 문제가 있어 평문 `code`로 전환함. 어차피 데이터가 공개라 해시는 실질 보안이 아니었음.

## 내 위치

뷰어의 "내 위치 표시"는 **본인 화면에만** 표시됨 (서버가 없어 다른 사람과 실시간 공유는 불가).

## 로컬 실행

ES module(`import`/`export`) 사용으로 `file://` 직접 열기 불가. HTTP 서버 필요:

```sh
python -m http.server 8080
# 또는
npx serve .
```

이후 `http://localhost:8080` 접속. `?b=브랜치` 기능은 로컬에서 테스트 불가 (raw.githubusercontent.com 접근 필요).

## 배포

GitHub Pages: Settings → Pages → Branch `main` / root.
공유 링크: `https://<아이디>.github.io/<repo>/`
