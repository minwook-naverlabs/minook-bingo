// ===== 미니게임 빙고 - 메인 앱 (Phase 1: 공통 틀) =====
import { h, render, Fragment } from "https://esm.sh/preact@10.19.3";
import { useState, useEffect, useRef } from "https://esm.sh/preact@10.19.3/hooks";
import htm from "https://esm.sh/htm@3.1.1";

import { TEAM_INFO, DEFAULT_ROOM, RULES, GAME_NAME, BRAND, HINT_MODE, GAME_INFO } from "./config.js";
import { createSync } from "./sync.js";
import { loadGames, getGame, isQuiz, buildRound, buildCharadeRound, matchAnswer, matchesItem } from "./data.js";
import { shuffle, evaluateWinner, teamGrid, completedLines, remainingGames, teamStats } from "./logic.js";

const html = htm.bind(h);

// ---------- 퀴즈 채점 헬퍼 ----------
function isCorrect(round, i, a) {
  const it = round.items[i];
  if (!it) return false;
  return round.mode === "choice" ? a === it.answerIndex : matchesItem(a, it);
}
function scoreOf(round, answers) {
  if (!round || !answers) return 0;
  return answers.reduce((s, a, i) => s + (isCorrect(round, i, a) ? 1 : 0), 0);
}
function isDone(round, answers) {
  return !!(round && answers && answers.length >= round.items.length);
}

// 공유 시작시각(startedAt) 기준 남은 초 — 0.5초마다 재렌더
function useSecondsLeft(startedAt, total) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt) return total;
  return Math.max(0, total - Math.floor((Date.now() - startedAt) / 1000));
}

// ---------- 상태 생성 ----------
function freshState(games, winLines) {
  const order = games.boardLayout;
  const results = {};
  order.forEach((gid) => (results[gid] = null));
  return {
    phase: "playing",
    winLines: winLines || RULES.winLines,
    boardLayout: order,
    layouts: { A: shuffle(order), B: shuffle(order) },
    results,
    currentGame: null,
    round: null,         // 공유 라운드(몸으로 말해요 전용)
    rounds: null,        // 팀별 라운드 { A, B } (퀴즈 — 팀마다 다른 문제)
    progress: null,
    charade: null,
    finishedAt: null,
    picker: null,        // null=첫 게임(진행자 시작), 이후 직전 승리 팀
    winner: null,
    updatedAt: Date.now(),
  };
}

// 빙고판 짧은 이름
function labelOf(gid, g) {
  return (GAME_INFO[gid] && GAME_INFO[gid].label) || (g ? g.title : gid);
}

// 게임 시작(상태 전이) — 진행자/팀 공용
function makeStartGame(games, sync) {
  return (gid) => sync.set((prev) => {
    const g = getGame(games, gid);
    const now = Date.now();
    const base = { ...prev, currentGame: gid, round: null, rounds: null, progress: null, charade: null, finishedAt: null, updatedAt: now };
    if (isQuiz(g)) {
      // 팀마다 독립적으로 무작위 추출 → 같은 게임이어도 다른 문제
      return { ...base, rounds: { A: { ...buildRound(g), startedAt: now }, B: { ...buildRound(g), startedAt: now } }, progress: { A: [], B: [] }, finishedAt: { A: null, B: null } };
    }
    if (g.type === "charade") return { ...base, round: buildCharadeRound(g, RULES.charadeRounds), charade: { results: [], startedAt: now } };
    return base;
  });
}

// ---------- 라우팅 ----------
function useHashRoute() {
  const [route, setRoute] = useState(window.location.hash || "#/");
  useEffect(() => {
    const on = () => setRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

// Firebase는 null/빈 배열을 저장하지 않으므로, 읽을 때 누락 필드를 복원한다.
function normalizeState(s) {
  if (!s) return s;
  const results = {};
  (s.boardLayout || []).forEach((gid) => { results[gid] = (s.results && s.results[gid]) || null; });
  const out = {
    ...s,
    results,
    currentGame: s.currentGame || null,
    picker: s.picker || null,
    winner: s.winner || null,
    round: s.round || null,
    rounds: s.rounds || null,
    charade: s.charade || null,
    finishedAt: s.finishedAt || null,
    progress: s.progress || null,
  };
  if (out.rounds) {
    const p = s.progress || {};
    out.progress = { A: p.A || [], B: p.B || [] };
  }
  return out;
}

// ---------- 동기화 훅 ----------
function useSync() {
  const [state, setState] = useState(null);
  const [sync, setSync] = useState(null);
  useEffect(() => {
    let s;
    createSync({ roomId: DEFAULT_ROOM, onChange: (v) => setState(normalizeState(v)) }).then((created) => {
      s = created;
      setSync(created);
    });
    return () => {};
  }, []);
  return { state, sync };
}

// ===== 루트 =====
function App() {
  const route = useHashRoute();
  const [games, setGames] = useState(null);
  const { state, sync } = useSync();

  useEffect(() => { loadGames().then(setGames); }, []);
  useEffect(() => {
    if (BRAND.color) document.documentElement.style.setProperty("--accent", BRAND.color);
  }, []);

  if (!games) return html`<div class="center muted">게임 데이터 불러오는 중…</div>`;
  if (!sync) return html`<div class="center muted">동기화 준비 중…</div>`;

  const ctx = { games, state, sync };

  let view;
  if (route.startsWith("#/host")) view = html`<${HostView} ...${ctx} />`;
  else if (route.startsWith("#/team/A")) view = html`<${TeamView} team="A" ...${ctx} />`;
  else if (route.startsWith("#/team/B")) view = html`<${TeamView} team="B" ...${ctx} />`;
  else view = html`<${Home} ...${ctx} />`;

  const showWin = state && state.winner && route !== "#/";
  return h(Fragment, null, view, showWin ? h(WinnerOverlay, { team: state.winner, isHost: route.startsWith("#/host"), onRestart: () => sync.set(null) }) : null);
}

// ===== 제목 로고 · 브랜드 =====
function GameTitle({ className }) {
  return html`<span class="gametitle ${className || ""}">
    <span class="gt-big">${GAME_NAME.pre}</span><span class="gt-mini">${GAME_NAME.mini}</span><span class="gt-big">${GAME_NAME.post}</span>
  </span>`;
}
function BrandMark() {
  if (!BRAND.company && !BRAND.logo) return null;
  return html`<span class="brandmark">
    ${BRAND.logo && html`<img src=${BRAND.logo} alt="" />`}
    ${BRAND.company && html`<span>${BRAND.company}</span>`}
  </span>`;
}

// ===== 홈: 팀 선택 (참가자용) =====
const ROLES = [
  { key: "teamA", href: "#/team/A", icon: "Ⓐ", label: "A팀", desc: "우리 팀 화면으로" },
  { key: "teamB", href: "#/team/B", icon: "Ⓑ", label: "B팀", desc: "우리 팀 화면으로" },
];
function Home({ games, state, sync }) {
  return html`
    <div class="home">
      <div class="home-head">
        <div class="home-brand"><${BrandMark} /></div>
        <p class="kicker">회사 워크샵 레크레이션 · 2팀 대결</p>
        <h1><${GameTitle} /></h1>
        <div class="badge ${sync.mode === "firebase" ? "ok" : "warn"}">
          <span class="dot"></span>
          ${sync.mode === "firebase" ? "Firebase 실시간 연결" : "로컬 모드 (같은 브라우저 탭 전용)"}
        </div>
      </div>

      <nav class="role-grid two">
        ${ROLES.map((r, i) => html`
          <a class="role" data-role=${r.key} href=${r.href} style=${`--i:${i}`}>
            <span class="role-reveal"></span>
            <span class="role-inner">
              <span class="role-icon">${r.icon}</span>
              <span class="role-label">${r.label}</span>
              <span class="role-desc">${r.desc}</span>
            </span>
            <span class="role-arrow">→</span>
          </a>`)}
      </nav>

      <p class="home-guide muted small">각 팀은 위에서 자기 팀을 선택하세요.</p>

      <footer class="home-foot">
        <a class="host-link" href="#/host">진행자 화면</a>
      </footer>
    </div>`;
}

// ===== 빙고판 =====
function BingoBoard({ games, layout, results, team, currentGame, compact, onCellClick }) {
  return html`
    <div class="board ${compact ? "compact" : ""}">
      ${layout.map((gid) => {
        const g = getGame(games, gid);
        const winner = results[gid];
        const mine = winner === team;
        const lost = winner && winner !== team;
        const clickable = onCellClick && !winner && !currentGame;
        const cls = ["cell", mine ? "won" : "", lost ? "lost" : "", gid === currentGame ? "current" : "", clickable ? "clickable" : ""].join(" ");
        const style = mine ? `--c:${TEAM_INFO[team].color}` : "";
        return html`<div class=${cls} style=${style} onClick=${clickable ? () => onCellClick(gid) : null}>
          <span class="cell-title">${labelOf(gid, g)}</span>
          ${winner && html`<span class="cell-flag">${TEAM_INFO[winner].name} 승</span>`}
        </div>`;
      })}
    </div>`;
}

// 칸 클릭 시 게임 설명 → 시작 모달
function GameIntroModal({ gid, games, onStart, onClose }) {
  if (!gid) return null;
  const g = getGame(games, gid);
  const info = GAME_INFO[gid] || {};
  return html`
    <div class="modal-back" onClick=${onClose}>
      <div class="modal" onClick=${(e) => e.stopPropagation()}>
        <div class="modal-label">${info.label || (g && g.title)}</div>
        <div class="modal-title">${g && g.title}</div>
        <p class="modal-desc">${info.desc || ""}</p>
        <div class="modal-actions">
          <button class="btn ghost" onClick=${onClose}>취소</button>
          <button class="btn primary" onClick=${onStart}>게임 시작 →</button>
        </div>
      </div>
    </div>`;
}

// ===== 진행자 화면 =====
function HostView({ games, state, sync }) {
  const [intro, setIntro] = useState(null);
  const [winSel, setWinSel] = useState(3);  // 우승 방식(줄 수) 선택
  const [confirmReset, setConfirmReset] = useState(false);
  const reset = () => sync.set(null);        // 셋업 화면으로 되돌리기

  if (!state) {
    return html`
      <div class="host">
        <${TopBar} title="🎤 진행자 화면" />
        <div class="host-start">
          <h2>게임 세팅</h2>
          <p class="muted">우승 방식을 고르고 시작하세요. 시작하면 두 팀의 빙고판이 새로 섞여 배치됩니다.</p>
          <div class="winsel">
            <span class="winsel-label">우승 조건</span>
            <div class="seg">
              ${[2, 3].map((n) => html`<button class=${"seg-btn " + (winSel === n ? "on" : "")} onClick=${() => setWinSel(n)}>${n}줄</button>`)}
            </div>
            <span class="winsel-hint">${winSel}개 줄(가로·세로·대각)을 먼저 완성하면 우승</span>
          </div>
          <button class="btn primary" onClick=${() => sync.set(freshState(games, winSel))}>게임 시작</button>
        </div>
      </div>`;
  }

  const declare = (gid, team) => {
    sync.set((prev) => {
      const results = { ...prev.results, [gid]: team };
      const next = { ...prev, results, currentGame: null, round: null, rounds: null, progress: null, charade: null, finishedAt: null, picker: team, updatedAt: Date.now() };
      next.winner = evaluateWinner(next);
      // 3줄 우승자가 없는데 9게임이 모두 끝났으면: 완성 줄 수 → 칸 수로 최종 결정
      if (!next.winner && remainingGames(next).length === 0) {
        const st = teamStats(next);
        if (st.A.lines !== st.B.lines) next.winner = st.A.lines > st.B.lines ? "A" : "B";
        else if (st.A.cells !== st.B.cells) next.winner = st.A.cells > st.B.cells ? "A" : "B";
      }
      if (next.winner) next.phase = "finished";
      return next;
    });
  };
  const startGame = makeStartGame(games, sync);
  const openIntro = state.currentGame ? null : (gid) => setIntro(gid);

  const rem = remainingGames(state);
  const cur = state.currentGame ? getGame(games, state.currentGame) : null;

  return html`
    <div class="host">
      <${TopBar} title="🎤 진행자 화면" />
      ${state.winner && html`<div class="winner-banner" style="background:${TEAM_INFO[state.winner].color}">
        🏆 ${TEAM_INFO[state.winner].name} 우승! (${state.winLines}줄 완성)
      </div>`}

      <div class="boards-row">
        ${["A", "B"].map((t) => html`
          <div class="board-col">
            <h3 style="color:${TEAM_INFO[t].color}">${TEAM_INFO[t].name} <${LineCount} games=${games} state=${state} team=${t} /></h3>
            <${BingoBoard} games=${games} layout=${state.layouts[t]} results=${state.results} team=${t} currentGame=${state.currentGame} onCellClick=${openIntro} />
          </div>`)}
      </div>

      <div class="control">
        <div class="control-head">
          <h3>게임 진행</h3>
          ${confirmReset
            ? html`<span class="reset-confirm"><span class="muted small">초기화할까요?</span>
                <button class="btn teamB small-btn" onClick=${() => { reset(); setConfirmReset(false); }}>예</button>
                <button class="btn ghost small-btn" onClick=${() => setConfirmReset(false)}>취소</button></span>`
            : html`<button class="btn ghost small-btn" onClick=${() => setConfirmReset(true)}>↻ 새로 시작</button>`}
        </div>
        ${cur && state.round && state.round.mode === "charade" ? html`
          <${HostCharade} game=${cur} round=${state.round} charade=${state.charade} sync=${sync} declare=${declare} />`
        : cur && state.rounds ? html`
          <${HostScore} game=${cur} rounds=${state.rounds} progress=${state.progress} finishedAt=${state.finishedAt} declare=${declare} />`
        : cur ? html`
          <div class="current-box">
            <div>진행 중: <b>${cur.title}</b> <span class="muted small">(오프라인 — 진행자 판정)</span></div>
            <div class="declare">
              <span>승자 선언:</span>
              <button class="btn teamA" onClick=${() => declare(state.currentGame, "A")}>${TEAM_INFO.A.name} 승</button>
              <button class="btn teamB" onClick=${() => declare(state.currentGame, "B")}>${TEAM_INFO.B.name} 승</button>
            </div>
          </div>`
        : html`
          <div>
            ${state.picker && html`<p class="pick-hint">다음 게임 선택권: <b style="color:${TEAM_INFO[state.picker].color}">${TEAM_INFO[state.picker].name}</b> <span class="muted small">— 빙고 칸이나 아래 버튼을 누르세요</span></p>`}
            ${rem.length === 0
              ? html`<p class="muted">남은 게임이 없습니다.</p>`
              : html`<div class="game-pick">
                  ${rem.map((gid) => html`<button class="btn ghost" onClick=${() => setIntro(gid)}>${labelOf(gid, getGame(games, gid))}</button>`)}
                </div>`}
          </div>`}
      </div>

      <${GameIntroModal} gid=${intro} games=${games} onClose=${() => setIntro(null)} onStart=${() => { startGame(intro); setIntro(null); }} />
    </div>`;
}

function LineCount({ games, state, team }) {
  const grid = teamGrid(state.layouts[team], state.results, team);
  const lines = completedLines(grid).length;
  return html`<span class="muted small">· ${lines}/${state.winLines || RULES.winLines}줄</span>`;
}

// 완료 시간 표기 (예: 37초 / 1분 5초)
function fmtSecs(s) {
  if (s == null) return "";
  return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`;
}

// 진행자: 퀴즈 점수판 + 결과/판정 (팀마다 다른 문제, 동점 시 더 빨리 끝낸 팀 승)
function HostScore({ game, rounds, progress, finishedAt, declare }) {
  const ft = finishedAt || {};
  const stats = ["A", "B"].map((t) => {
    const round = rounds[t];
    const ans = progress[t] || [];
    const done = isDone(round, ans);
    const secs = done && ft[t] && round.startedAt ? Math.max(0, Math.round((ft[t] - round.startedAt) / 1000)) : null;
    return { t, count: ans.length, total: round.items.length, done, score: scoreOf(round, ans), secs };
  });
  const [a, b] = stats;
  const bothDone = a.done && b.done;

  // 승자: 점수 우선 → 동점이면 더 빨리 끝낸 팀 → 시간도 같으면 진행자 판정
  let winner = null, byTime = false;
  if (bothDone) {
    if (a.score !== b.score) winner = a.score > b.score ? "A" : "B";
    else if (a.secs != null && b.secs != null && a.secs !== b.secs) { winner = a.secs < b.secs ? "A" : "B"; byTime = true; }
  }

  // 승부가 자동으로 갈리면 진행자 클릭 없이 잠시 후 자동 확정(결과를 보여준 뒤)
  const autoRef = useRef(false);
  useEffect(() => {
    if (bothDone && winner && !autoRef.current) {
      autoRef.current = true;
      const t = setTimeout(() => declare(game.id, winner), 2600);
      return () => clearTimeout(t);
    }
  }, [bothDone, winner, game.id]);

  return html`
    <div class="current-box scoreboard">
      <div class="sb-title">진행 중 · <b>${game.title}</b></div>
      <div class="sb-teams">
        ${stats.map((s) => html`
          <div class="sb-team" style=${`--c:${TEAM_INFO[s.t].color}`}>
            <div class="sb-row">
              <span class="sb-name">${TEAM_INFO[s.t].name}</span>
              <span class="sb-score">${s.done
                ? html`<b>${s.score}</b><span class="muted">/${s.total}점</span> <span class="sb-time">⏱ ${fmtSecs(s.secs)}</span>`
                : html`<span class="muted">${s.count}/${s.total} 풀이중</span>`}</span>
            </div>
            <div class="sb-prog"><span style=${`width:${(s.count / s.total) * 100}%`}></span></div>
          </div>`)}
      </div>

      ${bothDone
        ? (winner
            ? html`<div class="sb-result">
                <div class="sb-result-line">결과 <b style="color:${TEAM_INFO.A.color}">${a.score}</b> : <b style="color:${TEAM_INFO.B.color}">${b.score}</b></div>
                ${byTime && html`<div class="sb-tiebreak">동점! 더 빨리 끝낸 <b>${TEAM_INFO[winner].name}</b> 승 (A ${fmtSecs(a.secs)} · B ${fmtSecs(b.secs)})</div>`}
                <div class="sb-auto">🏁 <b style="color:${TEAM_INFO[winner].color}">${TEAM_INFO[winner].name} 승</b> · 곧 칸이 자동으로 채워집니다…</div>
              </div>`
            : html`<div class="sb-result">
                <div class="sb-result-line">동점 ${a.score} : ${b.score} · 완료 시간도 동일 — 진행자가 정하세요</div>
                <div class="declare">
                  <button class="btn teamA" onClick=${() => declare(game.id, "A")}>${TEAM_INFO.A.name} 승</button>
                  <button class="btn teamB" onClick=${() => declare(game.id, "B")}>${TEAM_INFO.B.name} 승</button>
                </div>
              </div>`)
        : html`<details class="sb-manual">
            <summary>양 팀이 모두 풀면 결과가 나옵니다 · 수동 판정 열기</summary>
            <div class="declare">
              <button class="btn teamA" onClick=${() => declare(game.id, "A")}>${TEAM_INFO.A.name} 승</button>
              <button class="btn teamB" onClick=${() => declare(game.id, "B")}>${TEAM_INFO.B.name} 승</button>
            </div>
          </details>`}
    </div>`;
}

// 진행자: 몸으로 말해요 (제시어 7개, 라운드마다 A승/B승/Pass 판정)
function HostCharade({ game, round, charade, sync, declare }) {
  const total = round.items.length;
  const results = (charade && charade.results) || [];
  const idx = results.length;
  const done = idx >= total;
  const aWins = results.filter((r) => r === "A").length;
  const bWins = results.filter((r) => r === "B").length;
  const left = useSecondsLeft(charade && charade.startedAt, RULES.charadeSeconds);
  const item = round.items[idx];
  const winnerByScore = aWins === bWins ? null : aWins > bWins ? "A" : "B";

  const judge = (winner) => sync.set((prev) => ({
    ...prev,
    charade: { results: ((prev.charade && prev.charade.results) || []).concat([winner]), startedAt: Date.now() },
    updatedAt: Date.now(),
  }));

  // 7라운드 끝에 합계가 갈리면 자동 확정
  const autoRef = useRef(false);
  useEffect(() => {
    if (done && winnerByScore && !autoRef.current) {
      autoRef.current = true;
      const t = setTimeout(() => declare(game.id, winnerByScore), 2600);
      return () => clearTimeout(t);
    }
  }, [done, winnerByScore, game.id]);

  return html`
    <div class="current-box charade-host">
      <div class="sb-title">진행 중 · <b>${game.title}</b> <span class="muted">· 제시어 ${Math.min(idx + 1, total)}/${total}</span></div>
      ${!done ? html`
        <div class="charade-now">
          <div class="charade-phrase">${item.phrase}<span class="lv">${item.level}</span></div>
          <div class="charade-timer ${left <= 5 ? "danger" : ""}">${left}<small>초</small></div>
        </div>
        <div class="charade-tally">A <b>${aWins}</b> : <b>${bWins}</b> B</div>
        <div class="declare">
          <span>이 제시어 승자:</span>
          <button class="btn teamA" onClick=${() => judge("A")}>${TEAM_INFO.A.name} 맞힘</button>
          <button class="btn teamB" onClick=${() => judge("B")}>${TEAM_INFO.B.name} 맞힘</button>
          <button class="btn ghost" onClick=${() => judge(null)}>Pass (둘 다 실패)</button>
        </div>`
      : html`
        <div class="sb-result">
          <div class="sb-result-line">결과 <b style="color:${TEAM_INFO.A.color}">${aWins}</b> : <b style="color:${TEAM_INFO.B.color}">${bWins}</b></div>
          ${winnerByScore
            ? html`<div class="sb-auto">🏁 <b style="color:${TEAM_INFO[winnerByScore].color}">${TEAM_INFO[winnerByScore].name} 승</b> · 곧 칸이 자동으로 채워집니다…</div>`
            : html`<div>
                <div class="muted" style="margin-bottom:10px">동점! 진행자가 승팀을 정하세요</div>
                <div class="declare">
                  <button class="btn teamA" onClick=${() => declare(game.id, "A")}>${TEAM_INFO.A.name} 승</button>
                  <button class="btn teamB" onClick=${() => declare(game.id, "B")}>${TEAM_INFO.B.name} 승</button>
                </div>
              </div>`}
        </div>`}
    </div>`;
}

// 팀: 몸으로 말해요 (양 팀 동일 제시어 + 30초 타이머, 표현하는 사람만 화면을 봄)
function CharadePlay({ round, charade }) {
  const total = round.items.length;
  const results = (charade && charade.results) || [];
  const idx = results.length;
  const done = idx >= total;
  const left = useSecondsLeft(charade && charade.startedAt, RULES.charadeSeconds);

  if (done) return html`<div class="play-stub done">
    <div class="done-badge">제시어 종료</div>
    <p class="muted">진행자가 승팀을 판정합니다.</p>
  </div>`;

  const item = round.items[idx];
  const danger = left <= 5;
  return html`
    <div class="charade-team">
      <div class="charade-meta">제시어 ${idx + 1} / ${total} · <span class="lv">${item.level}</span></div>
      <div class="quiz-timerbar ${danger ? "danger" : ""}">
        <span style=${`width:${(left / RULES.charadeSeconds) * 100}%`}></span>
        <em>${left}초</em>
      </div>
      <div class="charade-phrase-big">${item.phrase}</div>
      <p class="muted charade-warn">🙈 몸으로 표현하는 사람만 화면을 보세요!</p>
    </div>`;
}

// 글자 수 힌트: 정답 글자 수만큼 ○ + (N글자)
function lengthHint(ans) {
  const n = [...((ans || "").replace(/\s/g, ""))].length;
  return "○".repeat(n) + ` (${n}글자)`;
}

// 팀: 퀴즈 풀이 (문제당 20초 / 가구=6지선다 / 그 외=주관식, 4초 남으면 힌트, 오답은 안 넘어감, Pass 가능)
function QuizPlayer({ round, answers, onAnswer }) {
  const total = round.items.length;
  const idx = answers.length;
  const item = round.items[idx];
  const isChoice = round.mode === "choice";
  const hintMode = HINT_MODE[round.gameId] || "none";

  const [secs, setSecs] = useState(RULES.questionSeconds);
  const [result, setResult] = useState(null); // { value, correct, reason }
  const [text, setText] = useState("");
  const [wrongFlash, setWrongFlash] = useState(false);
  const resolvedRef = useRef(false);
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  const resolve = (value, correct, reason = null) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    clearInterval(timerRef.current);
    setResult({ value, correct, reason, idx });   // 어느 문제의 결과인지 기록
    setTimeout(() => onAnswer(value), 1500);
  };

  // 문제가 바뀔 때마다 초기화 + 타이머 시작
  useEffect(() => {
    if (!item) return;
    resolvedRef.current = false;
    setResult(null);
    setText("");
    setWrongFlash(false);
    setSecs(RULES.questionSeconds);
    let s = RULES.questionSeconds;
    timerRef.current = setInterval(() => {
      s -= 1;
      setSecs(s);
      if (s <= 0) {
        clearInterval(timerRef.current);
        resolve(isChoice ? -1 : "", false, "timeout");
      }
    }, 1000);
    if (!isChoice && inputRef.current) inputRef.current.focus();
    return () => clearInterval(timerRef.current);
  }, [idx, round.gameId]);

  if (!item) return null;

  // result가 "현재 문제"의 것일 때만 표시 → 다음 문제로 넘어가는 프레임에 정답이 깜빡이는 현상 방지
  const showResult = !!result && result.idx === idx;
  const showHint = !showResult && hintMode !== "none" && secs <= RULES.hintAtSecondsLeft;
  const hintText = hintMode === "length" ? lengthHint(item.answer) : (hintMode === "semantic" ? item.hint : "");
  const danger = secs <= 5;
  const answerLabel = item.sub ? `${item.answer} · ${item.sub}` : item.answer;
  const bannerLabel = showResult && (result.correct ? "정답!" : result.reason === "timeout" ? "시간 초과" : result.reason === "pass" ? "패스" : "오답");

  // 주관식: 정답이면 넘어가고, 오답이면 넘어가지 않고 다시 시도
  const submitText = () => {
    if (showResult || !text.trim()) return;
    if (matchesItem(text, item)) resolve(text.trim(), true);
    else { setWrongFlash(true); setText(""); if (inputRef.current) inputRef.current.focus(); }
  };
  const pass = () => resolve("", false, "pass");

  return html`
    <div class="quiz">
      <div class="quiz-top">
        <span class="quiz-count">문제 ${idx + 1} <span class="muted">/ ${total}</span></span>
        <div class="quiz-dots">${round.items.map((_, i) => html`<span class=${"qd " + (i < idx ? "done" : i === idx ? "now" : "")}></span>`)}</div>
      </div>

      <div class="quiz-timerbar ${danger ? "danger" : ""}">
        <span style=${`width:${Math.max(0, (secs / RULES.questionSeconds) * 100)}%`}></span>
        <em>${Math.max(0, secs)}초</em>
      </div>

      <div class="quiz-stage">
        ${item.image && html`<img class="quiz-img ${showResult && item.reveal ? "revealing" : ""}" src=${(showResult && item.reveal) ? item.reveal : item.image} alt="" />`}
        ${item.question && html`<div class="quiz-question">${item.question}</div>`}
        ${item.prompt && !item.question && html`<div class="quiz-prompt">${item.prompt}</div>`}
      </div>

      ${showHint && hintText && html`<div class="quiz-hint">💡 힌트 · ${hintText}</div>`}

      ${showResult && html`<div class="result-banner ${result.correct ? "ok" : "no"}">
        ${bannerLabel} · <b>${answerLabel}</b>
      </div>`}

      ${isChoice
        ? html`<div class="choices six">
            ${item.choices.map((c, i) => {
              let cls = "choice";
              if (showResult) {
                if (i === item.answerIndex) cls += " correct";
                else if (i === result.value) cls += " wrong";
                else cls += " dim";
              }
              return html`<button class=${cls} disabled=${!!showResult} onClick=${() => resolve(i, i === item.answerIndex)}>${c}</button>`;
            })}
          </div>`
        : html`<div class="quiz-answerbox">
            <form class="quiz-inputrow" onSubmit=${(e) => { e.preventDefault(); submitText(); }}>
              <input ref=${inputRef} class="quiz-input ${wrongFlash ? "shake" : ""}" type="text" value=${text} disabled=${!!showResult}
                placeholder=${wrongFlash ? "❌ 오답! 다시 입력하세요" : "정답을 입력하세요"}
                onInput=${(e) => { setText(e.target.value); if (wrongFlash) setWrongFlash(false); }} autocomplete="off" />
              <button class="btn primary" type="submit" disabled=${!!showResult || !text.trim()}>제출</button>
            </form>
            <button class="btn ghost quiz-pass" disabled=${!!showResult} onClick=${pass}>잘 모르겠어요 · Pass →</button>
          </div>`}
    </div>`;
}

// ===== 팀 화면 =====
function TeamView({ team, games, state, sync }) {
  const info = TEAM_INFO[team];
  const [intro, setIntro] = useState(null);
  if (!state) return html`<${NoGame} />`;
  const cur = state.currentGame ? getGame(games, state.currentGame) : null;
  const startGame = makeStartGame(games, sync);
  // 선택권이 우리 팀이고 진행 중인 게임이 없을 때만 칸으로 게임 시작 가능
  const canPick = !state.currentGame && state.picker === team;
  const openIntro = canPick ? (gid) => setIntro(gid) : null;

  const answer = (choiceIdx) => sync.set((prev) => {
    const r = prev.rounds && prev.rounds[team];
    if (!r) return prev;
    const prog = prev.progress || {};
    const mine = prog[team] || [];
    if (mine.length >= r.items.length) return prev;
    const updated = mine.concat([choiceIdx]);
    const nextProg = { A: prog.A || [], B: prog.B || [], [team]: updated };
    const next = { ...prev, progress: nextProg, updatedAt: Date.now() };
    if (updated.length >= r.items.length) {
      const ft = prev.finishedAt || {};
      next.finishedAt = { A: ft.A || null, B: ft.B || null, [team]: Date.now() };   // 완료 시각 기록(동점 시 빠른 팀 판정용)
    }
    return next;
  });

  const isCharade = cur && state.round && state.round.mode === "charade";
  const myRound = state.rounds ? state.rounds[team] : null;   // 우리 팀 전용 라운드
  const myAns = state.progress ? (state.progress[team] || []) : [];
  const oppAns = state.progress ? (state.progress[team === "A" ? "B" : "A"] || []) : [];
  const showQuiz = cur && myRound && !isDone(myRound, myAns);
  const iAmDone = cur && myRound && isDone(myRound, myAns);

  return html`
    <div class="team" style="--team:${info.color}">
      <${TopBar} title=${`${info.name} 화면`} />
      ${state.winner && html`<div class="winner-banner" style="background:${TEAM_INFO[state.winner].color}">
        🏆 ${TEAM_INFO[state.winner].name} 우승!
      </div>`}

      <div class="play-area">
        ${isCharade
          ? html`<${CharadePlay} round=${state.round} charade=${state.charade} />`
        : showQuiz
          ? html`<${QuizPlayer} round=${myRound} answers=${myAns} onAnswer=${answer} />`
        : iAmDone
          ? html`<div class="play-stub done">
              <div class="done-badge">✓ 다 풀었어요!</div>
              <div class="done-score">${scoreOf(myRound, myAns)} <span class="muted">/ ${myRound.items.length}점</span></div>
              <p class="muted">${isDone(state.rounds && state.rounds[team === "A" ? "B" : "A"], oppAns) ? "결과 집계 중…" : "상대 팀이 푸는 중이에요. 잠시만 기다려 주세요."}</p>
            </div>`
        : cur
          ? html`<div class="play-stub">
              <h3>${cur.title}</h3>
              <p class="muted">오프라인 게임이에요. 현장에서 진행한 뒤 진행자가 승팀을 판정합니다.</p>
            </div>`
          : html`<div class="play-stub">
              ${canPick
                ? html`<p class="pick-hint">🎲 우리 팀 차례예요! 아래 <b>빙고 칸</b>을 눌러 다음 게임을 고르세요.</p>`
                : html`<p class="muted">진행자가 게임을 시작하면 여기에 표시됩니다.</p>`}
            </div>`}
      </div>

      <${BingoBoard} games=${games} layout=${state.layouts[team]} results=${state.results} team=${team} currentGame=${state.currentGame} onCellClick=${openIntro} />

      <${GameIntroModal} gid=${intro} games=${games} onClose=${() => setIntro(null)} onStart=${() => { startGame(intro); setIntro(null); }} />
    </div>`;
}

// ===== 우승 연출: 폭죽 + 'OO팀 우승!' =====
function Fireworks() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let w, h, raf;
    const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const colors = ["#e8ff4d", "#4d7cff", "#ff5a6e", "#ffffff", "#ffd166", "#2fd089"];
    let parts = [];
    const burst = (x, y) => {
      const color = colors[(Math.random() * colors.length) | 0];
      const n = 70 + (Math.random() * 40 | 0);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = Math.random() * 5 + 1.5;
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color, size: Math.random() * 2 + 1.5 });
      }
    };
    const tick = () => {
      ctx.fillStyle = "rgba(6,7,12,0.22)";
      ctx.fillRect(0, 0, w, h);
      for (const p of parts) {
        p.vy += 0.045; p.vx *= 0.99; p.vy *= 0.99;
        p.x += p.vx; p.y += p.vy; p.life -= 0.012;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      parts = parts.filter((p) => p.life > 0);
      raf = requestAnimationFrame(tick);
    };
    const launcher = setInterval(() => burst(w * (0.15 + Math.random() * 0.7), h * (0.12 + Math.random() * 0.45)), 650);
    burst(w * 0.5, h * 0.35);
    tick();
    return () => { cancelAnimationFrame(raf); clearInterval(launcher); window.removeEventListener("resize", resize); };
  }, []);
  return html`<canvas class="fw-canvas" ref=${ref}></canvas>`;
}

function WinnerOverlay({ team, isHost, onRestart }) {
  const [show, setShow] = useState(true);
  if (!show) return null;
  const info = TEAM_INFO[team];
  return html`
    <div class="win-overlay" style=${`--win:${info.color}`} onClick=${() => setShow(false)}>
      <${Fireworks} />
      <div class="win-card">
        <div class="win-emoji">🎉🏆🎉</div>
        <div class="win-text">${info.name} 우승!</div>
        ${isHost
          ? html`<div class="win-actions">
              <button class="btn primary" onClick=${(e) => { e.stopPropagation(); onRestart(); }}>↻ 새 게임 시작</button>
              <button class="btn ghost" onClick=${(e) => { e.stopPropagation(); setShow(false); }}>결과 보기</button>
            </div>`
          : html`<div class="win-sub">축하합니다! · 화면을 누르면 닫혀요</div>`}
      </div>
    </div>`;
}

// ===== 공통 =====
function TopBar({ title }) {
  return html`<div class="topbar">
    <a class="back" href="#/">← 홈</a>
    <span class="topbar-title">${title}</span>
    <span class="topbar-right"><${GameTitle} className="tiny" /><${BrandMark} /></span>
  </div>`;
}
function NoGame() {
  return html`<div class="center">
    <p class="muted">아직 게임이 시작되지 않았어요.</p>
    <p class="muted small">진행자가 시작하면 자동으로 나타납니다. 잠시만 기다려 주세요.</p>
    <a class="back" href="#/">← 홈</a>
  </div>`;
}

render(html`<${App} />`, document.getElementById("app"));
