// ===== 게임 데이터 로드 + 라운드(문제 세트) 생성 =====
import { RULES } from "./config.js";
import { shuffle } from "./logic.js";

let _games = null;

export async function loadGames() {
  if (_games) return _games;
  const res = await fetch("data/games.json", { cache: "no-store" });
  if (!res.ok) throw new Error("games.json 로드 실패: " + res.status);
  _games = await res.json();
  return _games;
}

export function getGame(games, gameId) {
  return games.quizGames[gameId] || games.offlineGames[gameId] || null;
}

export function isQuiz(game) {
  return game && (game.type === "image-choice" || game.type === "text-choice");
}

// 퀴즈 게임 -> 라운드 생성. 두 팀이 동일 문제를 풀도록 한 번 만들어 공유한다.
// mode: "choice"(가구=6지선다) | "input"(나머지=주관식)
export function buildRound(game) {
  const pool = game.pool || [];
  const picked = shuffle(pool).slice(0, Math.min(RULES.quizPickCount, pool.length));
  const allAnswers = [...new Set(pool.map((p) => p.answer))];
  const mode = game.id === "furniture" ? "choice" : "input";

  const items = picked.map((p) => {
    const base = {
      prompt: game.prompt || "",
      question: p.question || "",   // 텍스트형(넌센스)
      image: p.image || "",         // 이미지형
      reveal: p.reveal || "",       // 캐릭터 정답 이미지
      sub: p.sub || "",             // 부가정보(작품명/제품명)
      hint: p.hint || "",           // 주관식 간접 힌트
      answer: p.answer,
    };
    if (mode === "choice") {
      const distractors = shuffle(allAnswers.filter((a) => a !== p.answer)).slice(0, RULES.choiceCount - 1);
      const choices = shuffle([p.answer, ...distractors]);
      return { ...base, choices, answerIndex: choices.indexOf(p.answer) };
    }
    return base;
  });

  return { gameId: game.id, type: game.type, mode, answerLabel: game.answerLabel || "정답", items };
}

// 주관식 정답 비교: 공백·대소문자·일부 문장부호 무시 후 일치
export function normalizeAnswer(s) {
  return (s || "").toString().toLowerCase().replace(/\s+/g, "").replace(/[.,!?·\-_/()\[\]'"`~“”’:;]/g, "");
}
export function matchAnswer(input, answer) {
  const a = normalizeAnswer(input);
  return a.length > 0 && a === normalizeAnswer(answer);
}

// 몸으로 말해요: 난이도 섞어 제시어 N개 뽑기
export function buildCharades(game, count = 10) {
  const pool = game.pool || [];
  return shuffle(pool).slice(0, Math.min(count, pool.length));
}

// 몸으로 말해요 라운드(두 팀 동일 제시어 공유)
export function buildCharadeRound(game, count) {
  return { gameId: game.id, type: game.type, mode: "charade", items: buildCharades(game, count) };
}
