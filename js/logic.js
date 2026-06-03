// ===== 빙고판 로직: 배치 섞기 · 줄 완성 판정 =====
import { RULES } from "./config.js";

// 3x3 인덱스 기준 8개 줄(가로3·세로3·대각2)
export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

// Fisher-Yates 셔플(원본 보존)
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 한 팀의 3x3 채움 여부 배열(boolean[9]) 계산
// layout: 그 팀의 9칸에 배치된 gameId 배열
// results: { gameId: 'A' | 'B' | null }  (각 게임의 승자)
export function teamGrid(layout, results, team) {
  return layout.map((gid) => results[gid] === team);
}

// 완성된 줄 목록 반환
export function completedLines(grid) {
  return LINES.filter((line) => line.every((i) => grid[i]));
}

// 우승자 판정: winLines 이상 완성한 팀. (동시 도달 시 줄 수 많은 팀, 그래도 같으면 null)
export function evaluateWinner(state) {
  const need = state.winLines || RULES.winLines;
  const counts = {};
  for (const team of ["A", "B"]) {
    const grid = teamGrid(state.layouts[team], state.results, team);
    counts[team] = completedLines(grid).length;
  }
  const reached = ["A", "B"].filter((t) => counts[t] >= need);
  if (reached.length === 1) return reached[0];
  if (reached.length === 2) {
    if (counts.A !== counts.B) return counts.A > counts.B ? "A" : "B";
    return null; // 진행자 판단 필요
  }
  return null;
}

// 모든 게임 종료 후 폴백 순위용: { team: {lines, cells} }
export function teamStats(state) {
  const out = {};
  for (const team of ["A", "B"]) {
    const grid = teamGrid(state.layouts[team], state.results, team);
    out[team] = {
      lines: completedLines(grid).length,
      cells: grid.filter(Boolean).length,
    };
  }
  return out;
}

// 아직 승부가 안 난 게임 id 목록
export function remainingGames(state) {
  return state.boardLayout.filter((gid) => !state.results[gid]);
}
