'use strict';

// 15퍼즐(슬라이딩 퍼즐): 규칙만 모아 둔 파일 (그리기·입력 없음). 브라우저와 테스트(Node)가 같이 쓴다.
//
// - n×n 판에 타일 1~(n²-1)과 빈칸 하나. 빈칸과 같은 줄(가로·세로)에 있는 타일을 누르면 그 사이 타일들이 빈칸 쪽으로 한 칸씩 밀린다
// - 1부터 차례로 왼쪽 위 → 오른쪽 아래, 마지막이 빈칸이 되면 완성
// - 이동 수는 타일이 한 칸 움직일 때마다 센다 (두 장을 한 번에 밀면 2)
// - 섞을 때는 '풀 수 있는 배치'만 만든다 (뒤집힌 쌍의 수와 빈칸 줄로 판정)
const LOGIC_P15 = (() => {
const SIZES = [3, 4, 5];

function rng(seed) {                                     // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 칸 번호 = 행 × n + 열. tiles[i] = 그 칸의 숫자 (0 은 빈칸)
const solvedTiles = (n) => Array.from({ length: n * n }, (_, i) => (i + 1) % (n * n));
const isSolved = (st) => st.tiles.every((v, i) => v === (i + 1) % (st.n * st.n));

// 풀 수 있는 배치인가: 빈칸을 뺀 숫자열의 '뒤집힌 쌍' 수(inv)로 판정한다
//  - 가로 칸 수가 홀수: inv 가 짝수
//  - 짝수: (inv + 빈칸이 아래에서 몇 번째 줄인가(1부터)) 가 홀수
function inversions(tiles) {
  let inv = 0;
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) if (tiles[i] && tiles[j] && tiles[i] > tiles[j]) inv++;
  return inv;
}
function isSolvable(tiles, n) {
  const inv = inversions(tiles);
  if (n % 2 === 1) return inv % 2 === 0;
  const rowFromBottom = n - Math.floor(tiles.indexOf(0) / n);
  return (inv + rowFromBottom) % 2 === 1;
}

function newGame(n = 4, seed = (Math.random() * 2 ** 31) | 0) {
  const rand = rng(seed);
  let tiles;
  do {
    tiles = solvedTiles(n);
    for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
    if (!isSolvable(tiles, n)) {                           // 서로 다른 두 타일(빈칸 제외)을 바꾸면 풀 수 있는 쪽으로 넘어온다
      const idx = tiles.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
      [tiles[idx[0]], tiles[idx[1]]] = [tiles[idx[1]], tiles[idx[0]]];
    }
  } while (tiles.every((v, i) => v === (i + 1) % (n * n)) || manhattan(tiles, n) < n * 2);   // 이미 풀렸거나 너무 쉬운 판은 다시
  return { n, seed, tiles, moves: 0, hints: 0 };
}

const blankOf = (st) => st.tiles.indexOf(0);
// i 칸의 타일을 눌렀을 때 움직이는 칸들(빈칸과 같은 줄일 때): 빈칸에 가까운 쪽부터. 못 움직이면 null
function slidePath(st, i) {
  const n = st.n, b = blankOf(st);
  if (i === b || i < 0 || i >= n * n) return null;
  const ri = Math.floor(i / n), ci = i % n, rb = Math.floor(b / n), cb = b % n;
  if (ri !== rb && ci !== cb) return null;
  const step = ri === rb ? (ci < cb ? 1 : -1) : (ri < rb ? n : -n);
  const path = [];
  for (let k = b - step; ; k -= step) { path.push(k); if (k === i) break; }
  return path;
}
const canMove = (st, i) => !!slidePath(st, i);
// 타일을 민다. 돌려주는 값: { path:[움직인 칸들(빈칸 쪽부터)], from:[...], to:[...] } 또는 null
function move(st, i) {
  const path = slidePath(st, i);
  if (!path) return null;
  const b = blankOf(st);
  const dest = [b, ...path.slice(0, -1)];                  // path[k] 의 타일이 dest[k] 로 간다
  const moved = path.map((from, k) => ({ from, to: dest[k], v: st.tiles[from] }));
  for (const m of moved) st.tiles[m.to] = m.v;
  st.tiles[i] = 0;
  st.moves += path.length;
  return { moved };
}

// ---- 풀이 (힌트·최적 이동 수) ----
function manhattan(tiles, n) {
  let s = 0;
  for (let i = 0; i < tiles.length; i++) {
    const v = tiles[i];
    if (!v) continue;
    const g = v - 1;
    s += Math.abs(Math.floor(i / n) - Math.floor(g / n)) + Math.abs((i % n) - (g % n));
  }
  return s;
}
// 같은 줄에 목표 줄이 같은 두 타일이 서로 반대로 놓여 있으면 하나는 비켜 가야 해서 2수 더 든다 (linear conflict)
function linearConflict(tiles, n) {
  let s = 0;
  for (let r = 0; r < n; r++) {
    const row = [];
    for (let c = 0; c < n; c++) { const v = tiles[r * n + c]; if (v && Math.floor((v - 1) / n) === r) row.push((v - 1) % n); }
    for (let a = 0; a < row.length; a++) for (let b = a + 1; b < row.length; b++) if (row[a] > row[b]) s += 2;
  }
  for (let c = 0; c < n; c++) {
    const col = [];
    for (let r = 0; r < n; r++) { const v = tiles[r * n + c]; if (v && (v - 1) % n === c) col.push(Math.floor((v - 1) / n)); }
    for (let a = 0; a < col.length; a++) for (let b = a + 1; b < col.length; b++) if (col[a] > col[b]) s += 2;
  }
  return s;
}
const heuristic = (tiles, n) => manhattan(tiles, n) + linearConflict(tiles, n);

// IDA*: 타일 하나씩 미는 최단 풀이를 찾는다. maxNodes 를 넘으면 포기(null). 돌려주는 값: 타일이 간 칸 번호의 배열(빈칸 옆 칸부터)
function solve(tilesIn, n, maxNodes = 400000) {
  const tiles = tilesIn.slice(), N = n * n;
  let nodes = 0, bound = heuristic(tiles, n);
  const path = [];
  const nbr = Array.from({ length: N }, (_, i) => { const r = Math.floor(i / n), c = i % n, o = []; if (r > 0) o.push(i - n); if (r < n - 1) o.push(i + n); if (c > 0) o.push(i - 1); if (c < n - 1) o.push(i + 1); return o; });
  let blank = tiles.indexOf(0);
  function dfs(g, h, prevBlank) {
    const f = g + h;
    if (f > bound) return f;
    if (h === 0) return -1;
    if (++nodes > maxNodes) return Infinity;
    let min = Infinity;
    for (const t of nbr[blank]) {
      if (t === prevBlank) continue;                       // 방금 온 길로 되돌아가지 않는다
      const v = tiles[t];
      const g0 = v - 1, gr = Math.floor(g0 / n), gc = g0 % n;
      const before = Math.abs(Math.floor(t / n) - gr) + Math.abs((t % n) - gc);
      const after = Math.abs(Math.floor(blank / n) - gr) + Math.abs((blank % n) - gc);
      const oldBlank = blank;
      tiles[blank] = v; tiles[t] = 0; blank = t; path.push(t);
      const r = dfs(g + 1, h - before + after, oldBlank);
      if (r === -1) return -1;
      path.pop(); blank = oldBlank; tiles[t] = v; tiles[oldBlank] = 0;
      if (r < min) min = r;
      if (nodes > maxNodes) return Infinity;
    }
    return min;
  }
  const h0 = manhattan(tiles, n);
  // 줄 충돌 보정은 시작 경계에만 쓰고, 탐색 중에는 맨해튼만 쓴다 (가볍고 항상 정확한 하한)
  bound = h0 + linearConflict(tiles, n);
  for (let guard = 0; guard < 80; guard++) {
    const r = dfs(0, h0, -1);
    if (r === -1) return path.slice();
    if (r === Infinity) return null;
    bound = r;
  }
  return null;
}

// 빠른 근사 풀이: 가중 A* (f = g + w·h). 최단은 아니어도 4×4·5×5 에서 금방 풀이를 찾는다. 못 찾으면 null
function solveFast(tilesIn, n, w = 3, maxNodes = 150000) {
  const N = n * n;
  const nbr = Array.from({ length: N }, (_, i) => { const r = Math.floor(i / n), c = i % n, o = []; if (r > 0) o.push(i - n); if (r < n - 1) o.push(i + n); if (c > 0) o.push(i - 1); if (c < n - 1) o.push(i + 1); return o; });
  const key = (t) => String.fromCharCode(...t);
  const open = [];                                          // 이진 힙: [f, g, h, 상태, 부모, 방금 민 칸]
  const push = (e) => { open.push(e); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p][0] <= open[i][0]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } };
  const pop = () => {
    const top = open[0], last = open.pop();
    if (open.length) { open[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === i) break; [open[m], open[i]] = [open[i], open[m]]; i = m; } }
    return top;
  };
  const start = tilesIn.slice(), h0 = heuristic(start, n);
  const best = new Map([[key(start), 0]]);
  push([w * h0, 0, h0, start, null, -1]);
  let nodes = 0;
  while (open.length) {
    const cur = pop();
    const [, g, h, tiles, , ] = cur;
    if (h === 0 && tiles.every((v, i) => v === (i + 1) % N)) {
      const out = []; for (let e = cur; e && e[4]; e = e[4]) out.push(e[5]);
      return out.reverse();
    }
    if (++nodes > maxNodes) return null;
    if (g > (best.get(key(tiles)) ?? Infinity)) continue;
    const b = tiles.indexOf(0);
    for (const t of nbr[b]) {
      if (cur[4] && t === cur[4][3].indexOf(0)) continue;   // 방금 온 칸으로 되돌아가지 않는다
      const next = tiles.slice(); next[b] = next[t]; next[t] = 0;
      const k = key(next), g2 = g + 1;
      if (g2 >= (best.get(k) ?? Infinity)) continue;
      best.set(k, g2);
      const h2 = heuristic(next, n);
      push([g2 + w * h2, g2, h2, next, cur, t]);
    }
  }
  return null;
}

// 힌트: 지금 눌러야 할 타일 칸 (최단 풀이의 첫 수). 풀이를 못 찾으면 맨해튼이 가장 줄어드는 수
function hint(st) {
  if (isSolved(st)) return null;
  if (st.n === 3) { const sol = solve(st.tiles, 3, 600000); if (sol && sol.length) return { tile: sol[0], exact: true, left: sol.length }; }
  else { const sol = solveFast(st.tiles, st.n, 3, 120000); if (sol && sol.length) return { tile: sol[0], exact: false, left: sol.length }; }
  const b = blankOf(st), n = st.n;
  let best = null, bs = Infinity;
  for (const t of [b - n, b + n, b - 1, b + 1]) {
    if (t < 0 || t >= n * n || (Math.abs(t - b) === 1 && Math.floor(t / n) !== Math.floor(b / n))) continue;
    const next = st.tiles.slice(); next[b] = next[t]; next[t] = 0;
    const s = heuristic(next, n);
    if (s < bs) { bs = s; best = t; }
  }
  return best === null ? null : { tile: best, exact: false, left: null };
}

// 되돌리기용 복사본
const snapshot = (st) => ({ tiles: st.tiles.slice(), moves: st.moves, hints: st.hints });
function restore(st, snap) { st.tiles = snap.tiles.slice(); st.moves = snap.moves; st.hints = snap.hints; }

// 저장·불러오기
const serialize = (st) => ({ n: st.n, seed: st.seed, tiles: st.tiles, moves: st.moves, hints: st.hints });
function deserialize(o) {
  try {
    if (!o || !SIZES.includes(o.n) || !Array.isArray(o.tiles) || o.tiles.length !== o.n * o.n) return null;
    const sorted = o.tiles.slice().sort((a, b) => a - b);
    if (!sorted.every((v, i) => v === i)) return null;       // 0~n²-1 이 한 번씩
    if (!isSolvable(o.tiles, o.n)) return null;
    return { n: o.n, seed: o.seed | 0, tiles: o.tiles.slice(), moves: Number(o.moves) || 0, hints: Number(o.hints) || 0 };
  } catch (_) { return null; }
}

// 점수 (로비에 보이는 숫자): 크기마다 기본 점수에서 이동·시간·힌트를 뺀다. 끝내기만 해도 최소 점수는 준다
const BASE = { 3: 400, 4: 1500, 5: 4000 };
function scoreOf(n, moves, seconds, hints = 0) {
  return Math.max(50, Math.round(BASE[n] - moves * (n === 3 ? 3 : n === 4 ? 4 : 6) - seconds * (n === 5 ? 3 : 2) - hints * 40));
}

return { SIZES, BASE, rng, solvedTiles, isSolved, inversions, isSolvable, newGame, blankOf, slidePath, canMove, move, manhattan, linearConflict, solve, solveFast, hint, snapshot, restore, serialize, deserialize, scoreOf };
})();
if (typeof module !== 'undefined') module.exports = LOGIC_P15;
