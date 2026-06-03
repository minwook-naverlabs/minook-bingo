// ===== 미니게임 빙고 설정 =====
// Firebase 실시간 DB 연결. (firebase 콘솔 > 프로젝트 설정 > 웹 앱)
// null로 두면 "로컬 모드"로 동작합니다(같은 브라우저의 여러 탭끼리만 동기화 — 개발/테스트용).
export const firebaseConfig = {
  apiKey: "AIzaSyBBKIG8qjp416yhtmEeJD8TnQIxiXtUa8c",
  authDomain: "minook-bingo.firebaseapp.com",
  databaseURL: "https://minook-bingo-default-rtdb.firebaseio.com",
  projectId: "minook-bingo",
  storageBucket: "minook-bingo.firebasestorage.app",
  messagingSenderId: "622438771164",
  appId: "1:622438771164:web:bb9e696198169e6dc98719",
};

// 게임 규칙 상수
export const RULES = {
  quizPickCount: 10,      // 퀴즈당 문제 수
  choiceCount: 6,         // 가구(객관식) 보기 수
  winLines: 3,            // 아무 세 줄 완성 시 우승
  questionSeconds: 20,     // 문제당 제한 시간(초)
  hintAtSecondsLeft: 4,    // 주관식: 남은 시간이 이 이하가 되면 힌트 노출(초)
  charadeRounds: 7,        // 몸으로 말해요: 제시어 수
  charadeSeconds: 30,      // 몸으로 말해요: 제시어당 제한 시간(초)
};

// 퀴즈별 힌트 방식: "length"(글자 수) | "semantic"(작성한 의미 힌트) | "none"
export const HINT_MODE = {
  furniture: "none",
  logo: "length",
  movie: "semantic",
  character: "length",
  idol: "length",
  nonsense: "length",
};

export const TEAM_INFO = {
  A: { name: "A팀", color: "#4d7cff" },
  B: { name: "B팀", color: "#ff5a6e" },
};

// 게임 제목 로고: 괄호 없이 양옆 글자(pre/post)는 크게, 가운데(mini)는 40% 크기
export const GAME_NAME = { pre: "민", mini: "이 게임 천구우", post: "욱" };

// 회사 브랜딩. 공식 로고 이미지가 있으면 logo에 경로 지정(예: "assets/brand/naverlabs.png") → 텍스트 워드마크 대신 이미지 표시.
export const BRAND = {
  company: "NAVER LABS", // 회사명 (logo 비어있으면 워드마크 텍스트로 표시)
  logo: "",              // 로고 이미지 경로 (지정 시 이미지 사용)
  color: "#e8ff4d",      // 강조색 (NAVER 그린 #03C75A 등으로 교체 가능)
};

// 빙고판에 표시할 짧은 이름(label) + 칸 클릭 시 설명(desc)
export const GAME_INFO = {
  logo:      { label: "라이프 스타일", desc: "브랜드·서비스 로고를 보고 이름을 맞혀요. 주관식 10문제, 문제당 20초." },
  character: { label: "컬러",          desc: "색깔만 보고 어떤 캐릭터인지 맞혀요. 주관식 10문제, 문제당 20초." },
  movie:     { label: "문화/예술",     desc: "영화 장면을 보고 제목을 맞혀요. 주관식 10문제, 문제당 20초." },
  nonsense:  { label: "유머",          desc: "기발한 넌센스 문제를 풀어요. 주관식 10문제, 문제당 20초." },
  furniture: { label: "리빙",          desc: "가구 사진을 보고 브랜드를 고르는 6지선다. 10문제, 문제당 20초." },
  thigh:     { label: "스포츠",        desc: "두 팀이 허벅지 씨름으로 겨뤄요. 진행자가 승팀을 판정합니다." },
  cup:       { label: "코 워킹",       desc: "팀이 협동해 컵을 높이 쌓아요. 진행자가 승팀을 판정합니다." },
  charade:   { label: "커뮤니케이션",  desc: "제시어를 몸으로 표현해 맞혀요. 제시어 7개, 진행자가 라운드마다 판정." },
  idol:      { label: "음악",          desc: "사진을 보고 아이돌 그룹 이름을 맞혀요. 주관식 10문제, 문제당 20초." },
};

export const DEFAULT_ROOM = "workshop";
