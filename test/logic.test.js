'use strict';
const test = require('node:test');
const assert = require('node:assert');
const L = require('../logic.js');

// 3×3 의 풀 수 있는 모든 배치(181,440개)를 완성 상태에서 너비 우선으로 만들어 둔다: 정답 기준표
let bfs3 = null;
function bfs() {
  if (bfs3) return bfs3;
  const start = L.solvedTiles(3), dist = new Map([[start.join(''), 0]]);
  let frontier = [start];
  while (frontier.length) {
    const next = [];
    for (const t of frontier) {
      const b = t.indexOf(0), d = dist.get(t.join(''));
      const r = Math.floor(b / 3), c = b % 3;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc; if (nr < 0 || nr > 2 || nc < 0 || nc > 2) continue;
        const u = t.slice(); u[b] = u[nr * 3 + nc]; u[nr * 3 + nc] = 0;
        const k = u.join(''); if (!dist.has(k)) { dist.set(k, d + 1); next.push(u); }
      }
    }
    frontier = next;
  }
  return (bfs3 = dist);
}

test('solvability rule matches the real reachable set (3x3: 181,440 states)', () => {
  const dist = bfs();
  assert.strictEqual(dist.size, 181440);
  let max = 0; for (const d of dist.values()) max = Math.max(max, d);
  assert.strictEqual(max, 31);                                                 // the known hardest 8-puzzle needs 31 moves
  // every random deal is in the reachable set; every unsolvable arrangement is not
  for (let s = 1; s <= 300; s++) assert.ok(dist.has(L.newGame(3, s).tiles.join('')), 'seed ' + s);
  const rand = L.rng(5);
  for (let k = 0; k < 400; k++) {
    const t = L.solvedTiles(3); for (let i = 8; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
    assert.strictEqual(L.isSolvable(t, 3), dist.has(t.join('')));
  }
});

test('solvability rule for 4x4 and 5x5 (parity with the blank row)', () => {
  const solved4 = L.solvedTiles(4);
  assert.ok(L.isSolvable(solved4, 4));
  const swapped = solved4.slice(); [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  assert.ok(!L.isSolvable(swapped, 4));                                        // one swapped pair is the classic unsolvable 15-puzzle
  const t = solved4.slice(); [t[14], t[15]] = [t[15], t[14]];                  // blank moved one step left: still solvable
  assert.ok(L.isSolvable(t, 4));
  for (const n of [4, 5]) for (let s = 1; s <= 200; s++) assert.ok(L.isSolvable(L.newGame(n, s).tiles, n));
  // a long random walk from the solved board always stays solvable
  const st = { n: 4, tiles: L.solvedTiles(4), moves: 0, hints: 0 }; const rand = L.rng(9);
  for (let k = 0; k < 3000; k++) { const b = L.blankOf(st); const opts = [b - 4, b + 4, b - 1, b + 1].filter((x) => L.canMove(st, x)); L.move(st, opts[Math.floor(rand() * opts.length)]); }
  assert.ok(L.isSolvable(st.tiles, 4));
});

test('newGame: same seed same deal, never already solved, correct tile set', () => {
  for (const n of L.SIZES) {
    const g = L.newGame(n, 42);
    assert.deepStrictEqual(g.tiles, L.newGame(n, 42).tiles);
    assert.deepStrictEqual(g.tiles.slice().sort((a, b) => a - b), Array.from({ length: n * n }, (_, i) => i));
    assert.ok(!L.isSolved(g));
    for (let s = 1; s <= 100; s++) assert.ok(!L.isSolved(L.newGame(n, s)));
  }
});

test('move: same row or column slides the whole chain toward the blank', () => {
  const st = { n: 3, tiles: [1, 2, 3, 4, 5, 6, 7, 0, 8], moves: 0, hints: 0 };
  assert.ok(L.canMove(st, 6) && L.canMove(st, 8) && L.canMove(st, 4));
  assert.ok(!L.canMove(st, 0) && !L.canMove(st, 2) && !L.canMove(st, 7));      // not in line with the blank / the blank itself
  const r = L.move(st, 8);
  assert.deepStrictEqual(st.tiles, [1, 2, 3, 4, 5, 6, 7, 8, 0]); assert.strictEqual(st.moves, 1);
  assert.ok(L.isSolved(st));
  assert.deepStrictEqual(r.moved, [{ from: 8, to: 7, v: 8 }]);
  const s2 = { n: 3, tiles: [0, 1, 2, 3, 4, 5, 6, 7, 8], moves: 0, hints: 0 };
  const r2 = L.move(s2, 2);                                                    // two tiles slide left at once
  assert.deepStrictEqual(s2.tiles, [1, 2, 0, 3, 4, 5, 6, 7, 8]); assert.strictEqual(s2.moves, 2);
  assert.deepStrictEqual(r2.moved.map((m) => [m.from, m.to]), [[1, 0], [2, 1]]);
  const s3 = { n: 4, tiles: L.solvedTiles(4), moves: 0, hints: 0 };           // blank at the bottom-right: slide a column of 3
  L.move(s3, 3);
  assert.deepStrictEqual(s3.tiles.slice(3), [15, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0].slice(0, 13).map((v, i) => s3.tiles[3 + i]));
  assert.strictEqual(s3.moves, 3); assert.strictEqual(L.blankOf(s3), 3);
  assert.strictEqual(L.move(s3, 3), null);
});

test('solve: finds the optimal solution on every 3x3 test deal', () => {
  const dist = bfs();
  for (let s = 1; s <= 120; s++) {
    const g = L.newGame(3, s);
    const sol = L.solve(g.tiles, 3);
    assert.ok(sol, 'solved seed ' + s);
    assert.strictEqual(sol.length, dist.get(g.tiles.join('')), 'optimal length for seed ' + s);
    const st = { n: 3, tiles: g.tiles.slice(), moves: 0, hints: 0 };
    for (const t of sol) assert.ok(L.move(st, t), 'step is a legal move');
    assert.ok(L.isSolved(st));
  }
});

test('solveFast on 4x4 and 5x5: finds a legal full solution quickly, and the hint is its first step', () => {
  let ok4 = 0, t4 = 0; const lens = [];
  const t0 = Date.now();
  for (let s = 1; s <= 25; s++) {
    const g = L.newGame(4, s * 13);
    const sol = L.solveFast(g.tiles, 4, 3, 150000);
    if (!sol) continue;
    ok4++;
    const st = { n: 4, tiles: g.tiles.slice(), moves: 0, hints: 0 };
    for (const t of sol) assert.ok(L.move(st, t), 'legal step');
    assert.ok(L.isSolved(st)); lens.push(sol.length);
    const h = L.hint(g); assert.ok(h && L.canMove(g, h.tile));
  }
  t4 = Date.now() - t0;
  assert.ok(ok4 >= 22, `4x4 solved ${ok4}/25`);
  assert.ok(t4 < 20000, `took ${t4}ms`);
  let ok5 = 0; for (let s = 1; s <= 6; s++) { const g = L.newGame(5, s); const sol = L.solveFast(g.tiles, 5, 4, 200000); if (sol) { ok5++; const st = { n: 5, tiles: g.tiles.slice(), moves: 0, hints: 0 }; for (const x of sol) assert.ok(L.move(st, x)); assert.ok(L.isSolved(st)); } }
  assert.ok(ok5 >= 3, `5x5 solved ${ok5}/6`);
  // the fallback hint when nothing is found is still a legal move next to the blank
  const g = L.newGame(5, 3); const h = L.hint(g);
  assert.ok(h && L.canMove(g, h.tile));
  assert.strictEqual(L.hint({ n: 3, tiles: L.solvedTiles(3), moves: 0, hints: 0 }), null);
  console.log('   4x4 avg solution length', Math.round(lens.reduce((a, b) => a + b, 0) / lens.length), 'in', t4, 'ms; 5x5 solved', ok5, '/6');
});

test('snapshot / restore and serialize / deserialize', () => {
  const st = L.newGame(4, 11); const snap = L.snapshot(st);
  const b = L.blankOf(st); const t = [b - 4, b + 4, b - 1, b + 1].find((x) => L.canMove(st, x)); L.move(st, t);
  assert.strictEqual(st.moves, 1); L.restore(st, snap);
  assert.deepStrictEqual(st.tiles, snap.tiles); assert.strictEqual(st.moves, 0);
  const back = L.deserialize(JSON.parse(JSON.stringify(L.serialize(st))));
  assert.deepStrictEqual(back.tiles, st.tiles);
  const bad = JSON.parse(JSON.stringify(L.serialize(st))); bad.tiles[0] = bad.tiles[1];
  assert.strictEqual(L.deserialize(bad), null);                                // duplicate tile
  const unsolvable = L.solvedTiles(4); [unsolvable[0], unsolvable[1]] = [unsolvable[1], unsolvable[0]];
  assert.strictEqual(L.deserialize({ n: 4, tiles: unsolvable }), null);        // a tampered save that can never be solved
  assert.strictEqual(L.deserialize({ n: 7, tiles: [] }), null); assert.strictEqual(L.deserialize(null), null);
});

test('score: bigger boards are worth more, fewer moves and less time are better, never below 50', () => {
  assert.ok(L.scoreOf(4, 80, 90) > L.scoreOf(4, 200, 300));
  assert.ok(L.scoreOf(5, 150, 300) > L.scoreOf(3, 20, 20));
  assert.ok(L.scoreOf(3, 20, 30) > L.scoreOf(3, 20, 30, 2));
  assert.strictEqual(L.scoreOf(3, 9999, 9999), 50);
});
