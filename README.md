# Schedule in Map

일정 루트를 지도에 공유하고, 참여자 실시간 위치까지 보여주는 정적 웹앱.
GitHub Pages + Firebase Realtime Database.

## 구조

```
├── index.html      공유 페이지 (리스트 → 초대 코드 → 뷰어)
├── admin.html      관리자 페이지 (비밀번호 → 일정 생성/수정)
├── config.js       Firebase 설정 ← 직접 붙여넣기 필요
├── css/
│   ├── base.css    공통 토큰/컴포넌트
│   ├── viewer.css
│   └── admin.css
└── js/
    ├── firebase.js Firebase 초기화
    ├── store.js    데이터 계층 (DB 경로는 전부 여기)
    ├── map.js      Leaflet 헬퍼
    ├── live.js     실시간 위치 공유
    ├── viewer.js   index.html 엔트리
    └── admin.js    admin.html 엔트리
```

## 세팅 (1회, ~5분)

### 1. Firebase 프로젝트

1. https://console.firebase.google.com → 프로젝트 추가 (애널리틱스 꺼도 됨)
2. 좌측 **빌드 → Realtime Database → 데이터베이스 만들기**
   - 위치 아무거나 (asia-southeast1 권장)
   - **테스트 모드로 시작** 선택
3. **규칙** 탭에서 아래로 교체 후 게시 (테스트 모드는 30일 뒤 만료되므로 필수):

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

4. 프로젝트 개요 → 웹 앱 추가(`</>` 아이콘) → 등록 → `firebaseConfig` 객체 복사
5. 이 repo의 `config.js`에 붙여넣기 (`databaseURL` 포함 확인)

### 2. GitHub Pages

1. 새 repo 생성 → 이 폴더 내용물 전부 푸시 (index.html이 root에 오게)
2. Settings → Pages → Branch: `main` / root → Save
3. `https://<아이디>.github.io/<repo>/` ← 친구에게 줄 링크
4. `.../admin.html` ← 관리자 페이지 (본인용)

## 사용 흐름

**관리자 (admin.html)**
1. 최초 접속 시 관리자 비밀번호 설정 → 이후 이 비번으로 로그인
2. 새 일정 → 제목/날짜/초대 코드 입력
3. **지도 클릭**으로 정거장 추가 → 이름/시간/메모 입력, ↑↓로 순서 조정
4. 저장 → 공유 페이지에 즉시 반영

**친구 (index.html)**
1. 링크 접속 → 일정 목록에서 선택
2. 초대 코드 입력 → 지도 + 시간별 일정 열람
3. "위치 공유" 버튼 → 내 위치가 같은 일정 보는 사람 전원에게 실시간 표시
   (명시적으로 켜야만 공유됨, 언제든 끄기 가능, 창 닫으면 자동 제거)

## 보안 한계 (알고 쓸 것)

- 정적 사이트라 비밀번호/초대 코드는 **친구용 잠금 수준**. 해시된 코드를 DB 경로로 써서 코드를 모르면 데이터를 못 읽게 했지만, 작정한 공격을 막는 구조는 아님.
- 위치는 공유 버튼을 켠 동안만 DB에 기록되고 끄면/창 닫으면 삭제됨.
- 민감한 일정에는 쓰지 말 것.

## 관리자 비밀번호를 잊었다면

Firebase 콘솔 → Realtime Database → `admin`과 `vaults` 노드 삭제 → admin.html 재접속하면 다시 설정 화면이 뜸. (일정 데이터는 유지되지만 초대 코드 목록은 사라지므로 일정도 다시 만드는 게 깔끔함)
