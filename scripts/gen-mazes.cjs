/* Generate pools of solvable mazes with on-path signs for MazePuzzle.
   The goal (G) is placed at the dead-end farthest from the start. */
const fs = require("fs");

const H = 11, W = 11;
function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32; }
const open = (g, r, c) => r >= 0 && c >= 0 && r < H && c < W && g[r][c] !== "#";
const find = (g, ch) => { for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (g[r][c] === ch) return [r, c]; };
const neighbours = (r, c) => [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dr, dc]) => [r + dr, c + dc]);

function bfs(g, s) {
  const dist = {}, q = [s]; dist[s[0] + "," + s[1]] = 0;
  while (q.length) {
    const [r, c] = q.shift();
    for (const [nr, nc] of neighbours(r, c)) {
      const k = nr + "," + nc;
      if (open(g, nr, nc) && !(k in dist)) { dist[k] = dist[r + "," + c] + 1; q.push([nr, nc]); }
    }
  }
  return dist;
}

function genMaze(rand) {
  const g = Array.from({ length: H }, () => Array(W).fill("#"));
  const inb = (r, c) => r > 0 && c > 0 && r < H - 1 && c < W - 1;
  const stack = [[1, 1]]; g[1][1] = ".";
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const dirs = [[-2, 0], [2, 0], [0, -2], [0, 2]].sort(() => rand() - 0.5);
    let moved = false;
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (inb(nr, nc) && g[nr][nc] === "#") { g[nr][nc] = "."; g[r + dr / 2][c + dc / 2] = "."; stack.push([nr, nc]); moved = true; break; }
    }
    if (!moved) stack.pop();
  }
  // Place G at the dead-end (degree 1) farthest from S=[1,1].
  const deg = (r, c) => neighbours(r, c).filter(([nr, nc]) => open(g, nr, nc)).length;
  const dist = bfs(g, [1, 1]);
  let best = null, bestD = -1;
  for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) {
    if (g[r][c] !== "." || (r === 1 && c === 1)) continue;
    if (deg(r, c) === 1) { const d = dist[r + "," + c] ?? -1; if (d > bestD) { bestD = d; best = [r, c]; } }
  }
  g[1][1] = "S"; g[best[0]][best[1]] = "G";
  return g;
}

function path(g) {
  const s = find(g, "S"), e = find(g, "G"), prev = {}; prev[s[0] + "," + s[1]] = null;
  const q = [s];
  while (q.length) {
    const [r, c] = q.shift();
    if (r === e[0] && c === e[1]) break;
    for (const [nr, nc] of neighbours(r, c)) {
      const k = nr + "," + nc;
      if (open(g, nr, nc) && !(k in prev)) { prev[k] = [r, c]; q.push([nr, nc]); }
    }
  }
  const out = []; let cur = e;
  while (cur) { out.push(cur); cur = prev[cur[0] + "," + cur[1]]; }
  return out.reverse();
}
const dirInfo = (a, b) => {
  if (b[0] < a[0]) return { word: "up", arrow: "⬆️" };
  if (b[0] > a[0]) return { word: "down", arrow: "⬇️" };
  if (b[1] < a[1]) return { word: "left", arrow: "⬅️" };
  return { word: "right", arrow: "➡️" };
};
function junctions(g, p) {
  const onPath = new Set(p.map(([r, c]) => r + "," + c));
  const res = [];
  for (let i = 1; i < p.length - 1; i++) {
    const [r, c] = p[i];
    const branches = neighbours(r, c).filter(([nr, nc]) => open(g, nr, nc) && !onPath.has(nr + "," + nc));
    if (branches.length) res.push({ i, cell: [r, c], next: p[i + 1], branch: branches[0] });
  }
  return res;
}
function pick3(js) {
  if (js.length < 3) return null;
  const at = [0.25, 0.5, 0.75].map((f) => Math.floor(js.length * f));
  const uniq = [...new Set(at)];
  while (uniq.length < 3) uniq.push((uniq[uniq.length - 1] + 1) % js.length);
  return uniq.slice(0, 3).sort((a, b) => a - b).map((k) => js[k]);
}

const SCENARIOS = [
  { prompt: "You forgot your homework.", honest: "Tell the teacher the truth", lie: "Pretend you lost it" },
  { prompt: "You knocked over a plant.", honest: "Own up and help clean it", lie: "Blame the cat" },
  { prompt: "You found a friend's lost pen.", honest: "Give it back honestly", lie: "Keep it secretly" },
  { prompt: "You broke a toy at a friend's house.", honest: "Tell them it was an accident", lie: "Hide it under the sofa" },
  { prompt: "You scored extra points by mistake.", honest: "Point out the error", lie: "Keep the wrong score" },
];
const NOTES = [
  "🏘️ Old kampong houses once stood on stilts along here.",
  "🚢 The busy harbour traded spices, silk and tin.",
  "🏛️ Grand riverside buildings from long ago line the bend.",
  "🛺 Trishaws once rattled down these narrow lanes.",
  "⚓ Bumboats ferried goods up and down the river.",
];

function honestyVariant(g, p, scen) {
  const js = pick3(junctions(g, p));
  if (!js) return null;
  const signs = js.map((j, k) => {
    const t = dirInfo(j.cell, j.next), l = dirInfo(j.cell, j.branch), s = scen[k % scen.length];
    return { at: j.cell, text: `🤔 ${s.prompt} ${l.arrow} ${l.word}: '${s.lie}' (a lie). ${t.arrow} ${t.word}: '${s.honest}'.` };
  });
  return { grid: g.map((r) => r.join("")), signs };
}
function flavourVariant(g, p, notes) {
  const idx = [0.25, 0.5, 0.75].map((f) => Math.floor(p.length * f));
  const signs = idx.map((ix, k) => ({ at: p[ix], text: notes[k % notes.length] }));
  return { grid: g.map((r) => r.join("")), signs };
}

const honesty = [], history = [];
let seed = 1;
while (honesty.length < 10 || history.length < 10) {
  const g = genMaze(rng(seed++)), p = path(g);
  if (honesty.length < 10) {
    const off = honesty.length % SCENARIOS.length;
    const scen = SCENARIOS.slice(off).concat(SCENARIOS.slice(0, off));
    const v = honestyVariant(g, p, scen);
    if (v) honesty.push(v);
  } else if (history.length < 10) {
    const off = history.length % NOTES.length;
    history.push(flavourVariant(g, p, NOTES.slice(off).concat(NOTES.slice(0, off))));
  }
  if (seed > 5000) break;
}

const ser = (arr) => JSON.stringify(arr, null, 0).replace(/\},\{/g, "},\n  {").replace(/^\[/, "[\n  ").replace(/\]$/, ",\n]");
const body = `// AUTO-GENERATED by scripts/gen-mazes.cjs — do not edit by hand.
// Pools of solvable 11×11 mazes (goal at the farthest dead-end) with on-path
// signs; MazePuzzle picks one at random.

export type MazeVariant = {
  /** Rows of equal length: '#' wall, '.' path, 'S' start, 'G' goal. */
  grid: string[];
  /** Scenario / flavour signposts shown when the hero stands on a cell. */
  signs?: { at: [number, number]; text: string }[];
};

export const HONESTY_MAZES: MazeVariant[] = ${ser(honesty)};

export const HISTORY_MAZES: MazeVariant[] = ${ser(history)};
`;
fs.writeFileSync("src/lib/maze-pool.ts", body);

// Verify: solvable AND G is a dead end (degree 1).
let allOk = true;
for (const v of [...honesty, ...history]) {
  const g = v.grid.map((r) => r.split(""));
  const e = find(g, "G");
  const solved = path(g).slice(-1)[0].join() === e.join();
  const gdeg = neighbours(e[0], e[1]).filter(([nr, nc]) => open(g, nr, nc)).length;
  if (!solved || gdeg !== 1) { allOk = false; console.log("BAD variant", { solved, gdeg }); }
}
console.log(`wrote ${honesty.length} honesty + ${history.length} history mazes`);
console.log("all solvable & G at dead-end:", allOk);
