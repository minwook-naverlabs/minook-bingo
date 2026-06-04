// ===== 실시간 동기화 계층 =====
// Firebase 설정이 있으면 Realtime Database, 없으면 로컬 모드(BroadcastChannel+localStorage).
// 공통 API:  const sync = await createSync({ roomId, onChange });
//            sync.get()                      -> 현재 상태(캐시)
//            sync.set(state | (prev)=>next)  -> 상태 갱신(전체 객체 저장)
//            sync.mode                       -> "firebase" | "local"
import { firebaseConfig } from "./config.js";

export async function createSync({ roomId, onChange }) {
  if (firebaseConfig && firebaseConfig.databaseURL) {
    return createFirebaseSync({ roomId, onChange });
  }
  return createLocalSync({ roomId, onChange });
}

// ---------- Firebase ----------
async function createFirebaseSync({ roomId, onChange }) {
  const appMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const dbMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js");
  const app = appMod.initializeApp(firebaseConfig);
  const db = dbMod.getDatabase(app);
  const r = dbMod.ref(db, "rooms/" + roomId);

  let current = null;
  dbMod.onValue(r, (snap) => {
    current = snap.val();
    onChange(current);
  });

  return {
    mode: "firebase",
    get: () => current,
    set: async (next) => {
      if (typeof next === "function") {
        // 동시 쓰기 충돌 방지: 항상 최신 서버 값 위에서 원자적으로 갱신
        await dbMod.runTransaction(r, (cur) => (cur == null ? cur : next(cur)));
      } else {
        current = next;
        await dbMod.set(r, next); // 전체 교체(게임 시작/초기화) — 진행자 단독 호출
      }
    },
  };
}

// ---------- 로컬 모드 ----------
function createLocalSync({ roomId, onChange }) {
  const key = "bingo:" + roomId;
  const chan = new BroadcastChannel("bingo-" + roomId);

  const read = () => {
    try { return JSON.parse(localStorage.getItem(key) || "null"); }
    catch { return null; }
  };
  const write = (v) => localStorage.setItem(key, JSON.stringify(v));

  let current = read();

  chan.onmessage = () => {
    current = read();
    onChange(current);
  };
  // 다른 창의 localStorage 변경도 감지
  window.addEventListener("storage", (e) => {
    if (e.key === key) {
      current = read();
      onChange(current);
    }
  });

  // 초기 1회 통지
  queueMicrotask(() => onChange(current));

  return {
    mode: "local",
    get: () => current,
    set: (next) => {
      const prev = read();
      const value = typeof next === "function" ? next(prev) : next;
      current = value;
      write(value);
      chan.postMessage("u");
      onChange(value);
    },
  };
}
