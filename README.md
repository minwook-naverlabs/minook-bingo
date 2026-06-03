# 민이 게임 천구우욱 — 미니게임 빙고

회사 워크샵 레크레이션용 9칸 빙고 미니게임 웹앱. 빌드 없는 정적 앱(Preact + htm + Firebase, 모두 CDN).

## 화면
- **홈** (`#/`) — A팀 / B팀 진입. 진행자 진입은 하단의 작은 링크.
- **진행자** (`#/host`) — 게임 세팅(우승 2줄/3줄), 두 팀 빙고판, 게임 진행 제어.
- **팀** (`#/team/A`, `#/team/B`) — 자기 빙고판 + 퀴즈/제시어 플레이.

## 로컬에서 실행 (Node 불필요)
```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```
브라우저에서 http://localhost:8080 접속. 진행자·A팀·B팀을 각각 다른 탭(또는 창)으로 열면 됩니다.
> Firebase 키가 없으면 **로컬 모드**로 동작 — 같은 브라우저의 탭끼리만 동기화됩니다(개발/테스트용).

데이터(이미지·문제)를 자료 폴더에서 다시 만들려면:
```powershell
powershell -ExecutionPolicy Bypass -File tools\build-data.ps1
```
- 힌트(영화 의미 힌트)는 `tools/hints.json`에서 수정 후 재실행.

## 실제 워크샵: 인터넷 실시간 동기화 (Firebase)
3개 화면(진행자 + 2팀 노트북)이 인터넷으로 실시간 공유되려면 Firebase 실시간 DB가 필요합니다.

### 1) Firebase 프로젝트 만들기 (무료)
1. https://console.firebase.google.com 에서 프로젝트 생성
2. **빌드 > Realtime Database** 만들기 (위치 선택, **테스트 모드**로 시작)
3. 프로젝트 설정 > 일반 > 내 앱 > **웹 앱 추가(</>)** → 표시되는 `firebaseConfig` 복사

### 2) 키 넣기
`js/config.js`의 `firebaseConfig`에 붙여넣기:
```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "....firebaseapp.com",
  databaseURL: "https://....firebasedatabase.app",  // ← 반드시 포함
  projectId: "...",
  appId: "...",
};
```
> `databaseURL`이 있어야 Firebase 모드로 전환됩니다.

### 3) 사이트 호스팅 (모든 기기가 접속할 URL)
이 PC엔 Node가 없어 Firebase CLI 배포는 어렵습니다. Node 없이 쓰는 방법:
- **GitHub Pages** (git 사용 가능): `bingo-app` 폴더를 저장소에 올리고 Settings > Pages 활성화.
- **Netlify Drop / Vercel** 등: `bingo-app` 폴더를 드래그&드롭으로 업로드.
- (선택) Node를 설치하면 `firebase deploy`로 Firebase Hosting 사용 가능.

배포한 URL을 진행자·두 팀이 각자 열면 끝. (Firebase RTDB가 상태를 실시간 공유)

### 4) 보안 규칙 (행사용)
일회성 행사라면 Realtime Database 규칙을 한시적으로 열어 두면 됩니다(행사 후 닫기):
```json
{ "rules": { ".read": true, ".write": true } }
```

## 게임 규칙 요약
- 2팀 대결. 게임마다 이긴 팀이 자기 빙고판 칸 획득. **먼저 N줄(진행자가 2/3 선택) 완성 시 우승.**
- 다음 게임은 직전에 이긴 팀이 빙고 칸을 눌러 선택(첫 게임은 진행자가 시작).
- **온라인 퀴즈**(10문제·문제당 20초): 가구=6지선다, 나머지(라이프스타일·문화/예술·컬러·음악·유머)=주관식. 오답은 안 넘어가고 재시도, 모르면 Pass. 주관식은 4초 남으면 힌트(가구 제외).
- **커뮤니케이션**(몸으로 말해요): 제시어 7개, 양 팀 동일 제시어 + 30초, 진행자가 라운드마다 판정.
- **스포츠/코 워킹**(허벅지 씨름·컵쌓기): 오프라인, 진행자가 승팀 판정.
- 승부가 명확히 갈리면 진행자 클릭 없이 자동 확정. 동점은 퀴즈=더 빨리 끝낸 팀, 그 외=진행자 판정.

## 파일
- `index.html` / `css/styles.css` / `js/*.js` — 앱
- `data/games.json` — 생성된 게임 데이터 (`tools/build-data.ps1`이 만듦)
- `assets/` — 익명 ID로 복사된 퀴즈 이미지
- `serve.ps1` — 로컬 미리보기 서버
