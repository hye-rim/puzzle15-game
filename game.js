'use strict';

// 15퍼즐: 화면·입력·흐름. 판 규칙과 풀이는 logic.js (LOGIC_P15).
(() => {
const L = LOGIC_P15;
const $ = (id) => document.getElementById(id);
const board = $('board'), colEl = $('col');

const SAVE_KEY = 'puzzle15Save';
const SIZE_NAME = { 3: '3×3 · 쉬움', 4: '4×4 · 보통', 5: '5×5 · 어려움' };
// 타일 색은 목표 줄마다 다르게: 줄 단위로 맞춰 가기 쉽다
const ROW_COLORS = [['#ff7aa8', '#e0457f'], ['#ffc83d', '#e09b00'], ['#4cd98a', '#1c9a55'], ['#4fa8ff', '#1f6fd6'], ['#b57bff', '#7d3fd9']];

// ---------- 저장소 ----------
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  del(k) { try { localStorage.removeItem(k); } catch (_) {} },
};
const rec = (n) => ({ score: Number(store.get('puzzle15Best' + n)) || 0, moves: Number(store.get('puzzle15BestMoves' + n)) || 0, time: Number(store.get('puzzle15BestTime' + n)) || 0 });

// ---------- 소리 ----------
let audio = null;
let muted = store.get('puzzle15Muted') === '1';
function tone(freq, dur, type = 'sine', vol = 0.09, slide = 0) {
  if (muted) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + dur);
  } catch (_) {}
}
const seq = (notes, step, type = 'triangle', vol = 0.09) => notes.forEach((f, i) => setTimeout(() => tone(f, step * 0.0009, type, vol), i * step));
const sfx = {
  slide: (k) => tone(300 + k * 50, 0.06, 'triangle', 0.07, 90),
  nope: () => tone(190, 0.1, 'square', 0.05, -50),
  undo: () => tone(440, 0.09, 'sine', 0.08, -160),
  hint: () => tone(880, 0.12, 'sine', 0.07, 260),
  win: () => seq([523, 659, 784, 1047, 784, 1047, 1319], 110, 'square', 0.06),
};

// ---------- 상태 ----------
let st = null, hist = [], size = 4;
let elapsed = 0, hudClock = 0, started = false, playing = false, paused = false, won = false;
let hintTimer = null, toastT = null;
let M = { ts: 60, gap: 6 };                  // 타일 크기·간격
const tiles = new Map();                     // 숫자 -> 요소

// ---------- 배치 ----------
function metrics() {
  const W = board.clientWidth, n = st ? st.n : 4;
  const gap = Math.max(4, Math.round(W * (n === 5 ? 0.02 : 0.026)));
  M = { W, gap, ts: Math.floor((W - gap * (n + 1)) / n) };
  board.style.setProperty('--ts', M.ts + 'px');
}
const posX = (i) => M.gap + (i % st.n) * (M.ts + M.gap);
const posY = (i) => M.gap + Math.floor(i / st.n) * (M.ts + M.gap);

function buildBoard() {
  board.querySelectorAll('.tile, .hole').forEach((e) => e.remove());
  tiles.clear();
  const n = st.n;
  for (let i = 0; i < n * n; i++) { const e = document.createElement('div'); e.className = 'hole'; e.dataset.slot = i; board.appendChild(e); }
  for (let v = 1; v < n * n; v++) {
    const e = document.createElement('div');
    e.className = 'tile'; e.dataset.v = v; e.textContent = v;
    const [a, b] = ROW_COLORS[Math.floor((v - 1) / n) % ROW_COLORS.length];
    e.style.background = `linear-gradient(160deg, ${a}, ${b})`;
    board.appendChild(e); tiles.set(v, e);
  }
}
function render(instant = false) {
  if (!st) return;
  const n = st.n;
  board.querySelectorAll('.hole').forEach((e) => { const i = Number(e.dataset.slot); Object.assign(e.style, { width: M.ts + 'px', height: M.ts + 'px', transform: `translate(${posX(i)}px,${posY(i)}px)` }); });
  st.tiles.forEach((v, i) => {
    if (!v) return;
    const e = tiles.get(v);
    if (instant) e.style.transition = 'none';
    Object.assign(e.style, { width: M.ts + 'px', height: M.ts + 'px', transform: `translate(${posX(i)}px,${posY(i)}px)` });
    e.classList.toggle('ok', v === i + 1);
  });
  if (instant) { void board.offsetWidth; tiles.forEach((e) => { e.style.transition = ''; }); }
  updateBar();
}

function fit() {
  const small = innerWidth <= 520;
  const used = $('hud').offsetHeight + $('bar').offsetHeight + 8;
  const availH = innerHeight - 16 - used - 14 - (small ? 0 : 8);
  const maxW = small ? innerWidth : Math.min(innerWidth - 16, 560);
  const w = Math.max(240, Math.min(maxW, availH));
  colEl.style.width = w + 'px';
  if (st) { metrics(); render(true); }
}
addEventListener('resize', fit);

// ---------- 화면 표시 ----------
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function liveScore() { return st ? L.scoreOf(st.n, st.moves, elapsed, st.hints) : 0; }
function updateHud() {
  $('score').textContent = st && started ? liveScore().toLocaleString() : '0';
  $('moves').textContent = st ? st.moves : 0;
  $('time').textContent = fmtTime(elapsed);
}
function updateBar() {
  $('undoBtn').disabled = !hist.length || won || !playing;
  $('hintBtn').disabled = won || !playing;
}
function toast(msg, ms = 1800) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms);
}
function clearHint() { clearTimeout(hintTimer); tiles.forEach((e) => e.classList.remove('hint')); }

// ---------- 행동 ----------
function pushHist() { hist.push(L.snapshot(st)); if (hist.length > 800) hist.shift(); }

function doMove(i) {
  if (!st || won || !playing || paused) return false;
  const v = st.tiles[i];
  if (!L.canMove(st, i)) {
    if (v) { const e = tiles.get(v); e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); setTimeout(() => e.classList.remove('shake'), 320); sfx.nope(); }
    return false;
  }
  pushHist();
  const r = L.move(st, i);
  started = true;
  sfx.slide(r.moved.length);
  clearHint();
  render(); updateHud(); save();
  if (L.isSolved(st)) win();
  return true;
}

function undo() {
  if (!st || won || !hist.length || !playing) return;
  const keep = st.moves;
  L.restore(st, hist.pop());
  st.moves = keep + 1;                                    // 되돌리기도 한 번으로 친다
  sfx.undo(); clearHint(); render(); updateHud(); save();
}

function showHint() {
  if (!st || won || !playing || paused) return;
  const h = L.hint(st);
  clearHint();
  if (!h) return;
  sfx.hint();
  st.hints++; updateHud(); save();
  const e = tiles.get(st.tiles[h.tile]);
  if (e) e.classList.add('hint');
  toast(h.left && st.n < 5 ? `이 타일을 밀어요 · 앞으로 ${h.exact ? '' : '약 '}${h.left}수 (점수 -40)` : '이 타일을 밀어 보세요 (점수 -40)', 2400);
  hintTimer = setTimeout(clearHint, 3200);
}

// ---------- 입력 ----------
board.addEventListener('pointerdown', (e) => {
  const t = e.target.closest('.tile');
  if (!t || !$('overlay').classList.contains('hidden')) return;
  e.preventDefault();
  const v = Number(t.dataset.v), i = st.tiles.indexOf(v);
  doMove(i);
});
// 방향키: 화살표 방향으로 '타일'이 움직인다 (빈칸 반대쪽 이웃 타일을 민다)
const ARROW = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowLeft: [0, 1], ArrowRight: [0, -1] };
function arrowMove(code) {
  const d = ARROW[code]; if (!d || !st) return false;
  const b = L.blankOf(st), r = Math.floor(b / st.n) + d[0], c = (b % st.n) + d[1];
  if (r < 0 || r >= st.n || c < 0 || c >= st.n) { sfx.nope(); return true; }
  doMove(r * st.n + c); return true;
}

// ---------- 저장·이어하기 ----------
function save() {
  if (!st || won || !playing) return;
  store.set(SAVE_KEY, JSON.stringify({ v: 1, st: L.serialize(st), elapsed, started }));
}
function loadSave() {
  try {
    const o = JSON.parse(store.get(SAVE_KEY) || 'null');
    if (!o || o.v !== 1) return null;
    const s = L.deserialize(o.st);
    if (!s || L.isSolved(s)) return null;
    return { st: s, elapsed: Number(o.elapsed) || 0, started: !!o.started };
  } catch (_) { return null; }
}

// ---------- 시작·끝 ----------
function startGame(n, seed) {
  size = n;
  st = L.newGame(n, seed);
  hist = []; elapsed = 0; started = false; won = false; playing = true; paused = false;
  st.optimal = n === 3 ? (L.solve(st.tiles, 3) || []).length : 0;
  buildBoard(); metrics(); render(true);
  hideOverlay(); updateHud(); save();
}
function resumeGame(data) {
  st = data.st; size = st.n; hist = []; elapsed = data.elapsed; started = data.started; won = false; playing = true; paused = false;
  st.optimal = st.n === 3 ? (L.solve(st.tiles, 3) || []).length : 0;
  buildBoard(); metrics(); render(true);
  hideOverlay(); updateHud();
}

function win() {
  won = true; playing = false;
  store.del(SAVE_KEY);
  clearHint();
  const secs = Math.max(1, Math.round(elapsed));
  const score = L.scoreOf(st.n, st.moves, secs, st.hints);
  const r = rec(st.n);
  const newScore = score > r.score, newMoves = !r.moves || st.moves < r.moves, newTime = !r.time || secs < r.time;
  if (newScore) store.set('puzzle15Best' + st.n, String(score));
  if (newMoves) store.set('puzzle15BestMoves' + st.n, String(st.moves));
  if (newTime) store.set('puzzle15BestTime' + st.n, String(secs));
  store.set('puzzle15Best', String(Math.max(...L.SIZES.map((n) => rec(n).score))));
  updateHud(); render();
  sfx.win();
  tiles.forEach((e, v) => { e.style.transitionDelay = (v * 25) + 'ms'; e.style.filter = 'brightness(1.25)'; });
  const opt = st.optimal ? `<dt>최적 풀이</dt><dd>${st.optimal}수 (+${Math.max(0, st.moves - st.optimal)})</dd>` : '';
  setTimeout(() => showOverlay(`
    <h2>🎉 완성!</h2>
    <div class="big">${score.toLocaleString()}</div>
    <span class="tag">${newScore ? '🏆 최고 점수!' : `${SIZE_NAME[st.n]} 최고 ${r.score.toLocaleString()}`}</span>
    <div class="card2"><dl class="stats">
      <dt>이동</dt><dd>${st.moves}번${newMoves ? ' 🏅' : ''}</dd>
      <dt>걸린 시간</dt><dd>${fmtTime(secs)}${newTime ? ' 🏅' : ''}</dd>
      ${opt}
      ${st.hints ? `<dt>힌트</dt><dd>${st.hints}번 (-${st.hints * 40})</dd>` : ''}
    </dl></div>
    <button id="againBtn">새 게임</button>`), 900);
  setTimeout(() => { const b = $('againBtn'); if (b) b.onclick = () => showMenu(false); }, 950);
}

// ---------- 오버레이 ----------
function showOverlay(html) { const o = $('overlay'); o.innerHTML = html; o.classList.remove('hidden'); o.scrollTop = 0; }
function hideOverlay() { $('overlay').classList.add('hidden'); }
function choices(extra = '') {
  return `<div class="choices">${extra}
    ${L.SIZES.map((n) => { const r = rec(n); return `<button data-size="${n}">${n}×${n} · ${n === 3 ? '쉬움' : n === 4 ? '보통' : '어려움'}<small>${r.score ? `최고 ${r.score.toLocaleString()} · ${r.moves}수 · ${fmtTime(r.time)}` : '아직 기록 없음'}</small></button>`; }).join('')}
  </div>`;
}
function bindChoices() {
  document.querySelectorAll('#overlay [data-size]').forEach((b) => { b.onclick = () => startGame(Number(b.dataset.size)); });
  const c = $('contBtn'); if (c) c.onclick = () => { const d = loadSave(); if (d) resumeGame(d); };
  const r = $('restartBtn'); if (r) r.onclick = () => startGame(st.n, st.seed);
  const x = $('closeBtn'); if (x) x.onclick = () => { hideOverlay(); paused = false; };
}
function showTitle() {
  playing = false;
  const s = loadSave();
  showOverlay(`
    <h1>15퍼즐</h1>
    <p>타일을 밀어서 <b>1부터 차례로</b> 맞춰요.<br>빈칸과 <b>같은 줄</b>의 타일을 누르면 한 번에 밀려요!</p>
    ${choices(s ? `<button id="contBtn">▶ 이어서 하기<small>${SIZE_NAME[s.st.n]} · ${s.st.moves}수 · ${fmtTime(s.elapsed)}</small></button>` : '')}
    <div class="card2">
      👆 타일을 누르면 빈칸 쪽으로 밀려요<br>
      🎨 줄마다 색이 달라요: 위 줄부터 맞춰 가요<br>
      ⏱️ 첫 번째로 미는 순간 시간이 시작돼요
    </div>`);
  bindChoices();
}
function showMenu(canClose = true) {
  paused = true;
  showOverlay(`
    <h2>새 게임</h2>
    ${choices(st && playing && !won ? '<button id="restartBtn" class="sub">↻ 같은 판 다시 시작</button>' : '')}
    ${canClose && st && !won ? '<button id="closeBtn" class="sub">닫기</button>' : ''}`);
  bindChoices();
}
function pause() {
  if (!playing || paused) return;
  paused = true;
  showOverlay(`<h2>일시정지</h2><button id="closeBtn">계속하기</button>`);
  bindChoices();
}

// ---------- 버튼·키 ----------
$('undoBtn').onclick = undo;
$('hintBtn').onclick = showHint;
$('newBtn').onclick = () => { if (st && playing && !won) showMenu(true); else showMenu(false); };
$('pauseBtn').onclick = (e) => { e.currentTarget.blur(); if (paused) { hideOverlay(); paused = false; } else pause(); };
function toggleMute() { muted = !muted; store.set('puzzle15Muted', muted ? '1' : '0'); $('muteBtn').textContent = muted ? '🔇' : '🔊'; }
$('muteBtn').onclick = (e) => { e.currentTarget.blur(); toggleMute(); };
$('muteBtn').textContent = muted ? '🔇' : '🔊';
addEventListener('keydown', (e) => {
  if (e.repeat && !ARROW[e.code]) return;
  if (!$('overlay').classList.contains('hidden')) { if (e.code === 'Escape' && paused) { hideOverlay(); paused = false; } return; }
  if (arrowMoveKey(e)) return;
  if (e.code === 'KeyZ' || e.code === 'KeyU') undo();
  else if (e.code === 'KeyH') showHint();
  else if (e.code === 'KeyM') toggleMute();
  else if (e.code === 'KeyP' || e.code === 'Escape') pause();
});
function arrowMoveKey(e) { if (!ARROW[e.code]) return false; e.preventDefault(); return arrowMove(e.code); }
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('pagehide', save);

// ---------- 시계 ----------
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (playing && started && !paused && !won && !document.hidden) {
    elapsed += dt; hudClock += dt;
    if (hudClock > 0.25) { hudClock = 0; $('time').textContent = fmtTime(elapsed); $('score').textContent = liveScore().toLocaleString(); }
  }
  requestAnimationFrame(tick);
}

// 시작: 타이틀 뒤에 풀린 판을 깔아 둔다
st = L.newGame(4, 20241021); st.tiles = L.solvedTiles(4);
buildBoard();
fit();
metrics(); render(true);
showTitle();
requestAnimationFrame(tick);

/* @test-hooks:start */
window.__p15 = { get st() { return st; }, get hist() { return hist; }, get state() { return { playing, paused, won, started, elapsed }; }, doMove, undo, showHint, startGame, render, fit, get M() { return M; }, tiles };
/* @test-hooks:end */
})();
